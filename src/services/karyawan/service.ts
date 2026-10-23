import { Op, OrderItem, Transaction, WhereOptions } from 'sequelize';
import { BadRequestError, ConflictError, NotFoundError } from '../../utils/app-error';
import { hashPassword } from '../../utils/bcrypt';
import { resolveOwnerId } from '../products/service';
import { findCabangById } from '../cabang/repository';
import {
  createUser,
  deleteUser,
  findUserByEmail,
  findUserByUsername,
  updateUser,
} from '../users/repository';
import type { UserCreationAttributes } from '../users/model';
import Karyawan, { KaryawanAttributes } from './model';
import {
  countKaryawansByActive,
  createKaryawan,
  deleteKaryawan,
  findAllKaryawans,
  findKaryawanByEmail,
  findKaryawanByEmployeeId,
  findKaryawanById,
  updateKaryawan,
} from './repository';
import type {
  CreateKaryawanInput,
  KaryawanListQuery,
  ResetKaryawanPasswordInput,
  UpdateKaryawanInput,
} from './types';

type Requester = { user_id: string; role: string; email: string };
type KaryawanWithBranch = KaryawanAttributes & {
  branch?: { id: string; name: string } | null;
};

const emailPattern = /^\S+@\S+\.\S+$/;
const phonePattern = /^\d{10,15}$/;

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const asOptionalText = (value: unknown): string | undefined => value === undefined ? undefined : asText(value);
const asBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return !['false', '0', ''].includes(value.toLowerCase().trim());
  return Boolean(value);
};

const throwValidation = (field: string, message: string): never => {
  throw new BadRequestError('Validasi gagal', [{ field, message }]);
};

const assertEmail = (email: string): void => {
  if (!emailPattern.test(email)) throwValidation('email', 'Format email tidak valid');
};

const assertPhone = (phone: string): void => {
  if (!phonePattern.test(phone)) throwValidation('nomorHp', 'Nomor HP harus 10-15 digit angka');
};

const assertPassword = (password: string): void => {
  if (password.length < 8) throwValidation('password', 'Password minimal 8 karakter');
};

const toEmployeeResponse = (source: Karyawan): Record<string, unknown> => {
  const item = source.toJSON() as KaryawanWithBranch;
  return {
    id: item.id,
    userId: item.user_id,
    namaLengkap: item.name,
    name: item.name,
    email: item.email,
    nomorHp: item.phone,
    phone: item.phone,
    idKaryawan: item.employee_id,
    employeeId: item.employee_id,
    role: item.role,
    cabangId: item.branch_id,
    branchId: item.branch_id,
    cabang: item.branch?.name ?? null,
    branch: item.branch?.name ?? null,
    loginAccess: item.active,
    active: item.active,
    lastLogin: item.last_login,
    createdAt: item.created_at,
    updatedAt: item.updated_at,
  };
};

const ensureOwnedBranch = async (branchId: string, ownerId: string, t: Transaction) => {
  const branch = await findCabangById(branchId, t);
  if (!branch || branch.owner_id !== ownerId) {
    throw new NotFoundError('Cabang tidak ditemukan');
  }
};

const ensureUniqueKaryawan = async (
  ownerId: string,
  input: { employeeId?: string; email?: string },
  t: Transaction,
  excludeId?: string,
) => {
  if (input.employeeId) {
    const duplicate = await findKaryawanByEmployeeId(ownerId, input.employeeId, t, excludeId);
    if (duplicate) {
      throw new ConflictError('ID karyawan sudah digunakan', [
        { field: 'idKaryawan', message: 'ID karyawan sudah digunakan' },
      ]);
    }
  }

  if (input.email) {
    const duplicate = await findKaryawanByEmail(ownerId, input.email, t, excludeId);
    if (duplicate) {
      throw new ConflictError('Email karyawan sudah digunakan', [
        { field: 'email', message: 'Email karyawan sudah digunakan' },
      ]);
    }
  }
};

const createEmployeeId = async (ownerId: string, t: Transaction): Promise<string> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const employeeId = `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
    const existing = await findKaryawanByEmployeeId(ownerId, employeeId, t);
    if (!existing) return employeeId;
  }

  throw new BadRequestError('Gagal membuat ID karyawan, silakan coba lagi');
};

const assertAccountIdentifiersAvailable = async (
  email: string,
  username: string | undefined,
  t: Transaction,
  currentUserId?: string | null,
) => {
  const existingEmail = await findUserByEmail(email, t);
  if (existingEmail && existingEmail.id !== currentUserId) {
    throw new ConflictError('Email sudah terdaftar', [
      { field: 'email', message: 'Email sudah terdaftar' },
    ]);
  }

  if (username) {
    const existingUsername = await findUserByUsername(username, t);
    if (existingUsername && existingUsername.id !== currentUserId) {
      throw new ConflictError('Username sudah digunakan', [
        { field: 'username', message: 'Username sudah digunakan' },
      ]);
    }
  }
};

const createLoginAccount = async (
  input: {
    name: string;
    email: string;
    phone: string;
    role: string;
    username: string;
    password: string;
  },
  ownerId: string,
  t: Transaction,
) => {
  await assertAccountIdentifiersAvailable(input.email, input.username, t);
  return createUser(
    {
      full_name: input.name,
      email: input.email,
      phone: input.phone,
      role: input.role,
      username: input.username,
      password: await hashPassword(input.password),
      agree: true,
      header_id: ownerId,
    } as UserCreationAttributes,
    t,
  );
};

export const createKaryawanService = async (
  rawInput: CreateKaryawanInput,
  requester: Requester,
  t: Transaction,
) => {
  const name = asText(rawInput.namaLengkap);
  const email = asText(rawInput.email).toLowerCase();
  const phone = asText(rawInput.nomorHp);
  const branchId = asText(rawInput.cabangId);
  const role = asText(rawInput.role);
  const loginAccess = asBoolean(rawInput.loginAccess);
  const username = asOptionalText(rawInput.username);
  const password = asOptionalText(rawInput.password);

  if (!name) throwValidation('namaLengkap', 'Nama lengkap wajib diisi');
  if (!email) throwValidation('email', 'Email wajib diisi');
  if (!phone) throwValidation('nomorHp', 'Nomor HP wajib diisi');
  if (!branchId) throwValidation('cabangId', 'Cabang wajib diisi');
  if (!role) throwValidation('role', 'Role wajib diisi');
  assertEmail(email);
  assertPhone(phone);
  if (loginAccess && !username) throwValidation('username', 'Username wajib diisi saat akses login aktif');
  if (loginAccess && !password) throwValidation('password', 'Password wajib diisi saat akses login aktif');
  if (password) assertPassword(password);

  const { owner_id } = await resolveOwnerId(requester, t);
  await ensureOwnedBranch(branchId, owner_id, t);
  const employeeId = asText(rawInput.idKaryawan) || await createEmployeeId(owner_id, t);
  await ensureUniqueKaryawan(owner_id, { employeeId, email }, t);

  const user = loginAccess
    ? await createLoginAccount(
        { name, email, phone, role, username: username!, password: password! },
        owner_id,
        t,
      )
    : null;

  const created = await createKaryawan(
    {
      id: crypto.randomUUID(),
      user_id: user?.id ?? null,
      owner_id,
      branch_id: branchId,
      name,
      email,
      phone,
      employee_id: employeeId,
      role,
      active: loginAccess,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t,
  );

  return toEmployeeResponse(created);
};

export const getAllKaryawansService = async (
  query: KaryawanListQuery,
  requester: Requester,
  page: number,
  limit: number,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const search = asText(query.search);
  const role = asText(query.role);
  const branchId = asText(query.cabangId ?? query.branchId);
  const status = asText(query.status).toLowerCase();
  const sort = asText(query.sort);
  const sortColumns = new Set(['name', 'employee_id', 'role', 'active', 'last_login', 'created_at']);
  const orderDirection: 'ASC' | 'DESC' = asText(query.order).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const where: WhereOptions = {
    owner_id,
    ...(role && { role }),
    ...(branchId && { branch_id: branchId }),
    ...(status === 'active' && { active: true }),
    ...(status === 'inactive' && { active: false }),
    ...(search && {
      [Op.or]: [
        { name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { employee_id: { [Op.iLike]: `%${search}%` } },
      ],
    }),
  };
  const order: OrderItem[] = sortColumns.has(sort)
    ? [[sort, orderDirection]]
    : [['created_at', 'DESC']];

  const { rows, count } = await findAllKaryawans(where, order, page, limit, t);
  const summaryWhere = { ...where } as Record<string, unknown>;
  delete summaryWhere.active;
  const summary = await countKaryawansByActive(summaryWhere as WhereOptions, t);

  return { rows: rows.map(toEmployeeResponse), count, ...summary };
};

export const getKaryawanByIdService = async (
  id: string,
  requester: Requester,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const karyawan = await findKaryawanById(id, t);
  if (!karyawan || karyawan.owner_id !== owner_id) throw new NotFoundError('Karyawan tidak ditemukan');
  return toEmployeeResponse(karyawan);
};

export const updateKaryawanService = async (
  id: string,
  rawInput: UpdateKaryawanInput,
  requester: Requester,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const karyawan = await findKaryawanById(id, t);
  if (!karyawan || karyawan.owner_id !== owner_id) throw new NotFoundError('Karyawan tidak ditemukan');

  const name = rawInput.namaLengkap !== undefined ? asText(rawInput.namaLengkap) : karyawan.name;
  const email = rawInput.email !== undefined ? asText(rawInput.email).toLowerCase() : karyawan.email;
  const phone = rawInput.nomorHp !== undefined ? asText(rawInput.nomorHp) : karyawan.phone;
  const branchId = rawInput.cabangId !== undefined ? asText(rawInput.cabangId) : karyawan.branch_id;
  const role = rawInput.role !== undefined ? asText(rawInput.role) : karyawan.role;
  const employeeId = rawInput.idKaryawan !== undefined ? asText(rawInput.idKaryawan) : karyawan.employee_id;
  const loginAccess = rawInput.loginAccess !== undefined ? asBoolean(rawInput.loginAccess) : karyawan.active;
  const username = asOptionalText(rawInput.username);
  const password = asOptionalText(rawInput.password);

  if (!name) throwValidation('namaLengkap', 'Nama lengkap wajib diisi');
  if (!email) throwValidation('email', 'Email wajib diisi');
  if (!phone) throwValidation('nomorHp', 'Nomor HP wajib diisi');
  if (!branchId) throwValidation('cabangId', 'Cabang wajib diisi');
  if (!role) throwValidation('role', 'Role wajib diisi');
  if (!employeeId) throwValidation('idKaryawan', 'ID karyawan wajib diisi');
  assertEmail(email);
  assertPhone(phone);
  if (password) assertPassword(password);
  await ensureOwnedBranch(branchId, owner_id, t);
  await ensureUniqueKaryawan(owner_id, { employeeId, email }, t, id);

  if (loginAccess && !karyawan.user_id && !username) {
    throwValidation('username', 'Username wajib diisi saat akses login diaktifkan');
  }
  if (loginAccess && !karyawan.user_id && !password) {
    throwValidation('password', 'Password wajib diisi saat akses login diaktifkan');
  }

  let userId = karyawan.user_id;
  if (karyawan.user_id) {
    if (username === '') throwValidation('username', 'Username tidak boleh kosong');
    await assertAccountIdentifiersAvailable(email, username, t, karyawan.user_id);
    await updateUser(
      karyawan.user_id,
      {
        full_name: name,
        email,
        phone,
        role,
        ...(username && { username }),
        ...(password && { password: await hashPassword(password) }),
      },
      t,
    );
  } else if (loginAccess) {
    const user = await createLoginAccount(
      { name, email, phone, role, username: username!, password: password! },
      owner_id,
      t,
    );
    userId = user.id;
  }

  await updateKaryawan(
    id,
    {
      user_id: userId,
      branch_id: branchId,
      name,
      email,
      phone,
      employee_id: employeeId,
      role,
      active: loginAccess,
      updated_by: requester.email,
    },
    t,
  );

  return getKaryawanByIdService(id, requester, t);
};

export const toggleKaryawanActiveService = async (
  id: string,
  requester: Requester,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const karyawan = await findKaryawanById(id, t);
  if (!karyawan || karyawan.owner_id !== owner_id) throw new NotFoundError('Karyawan tidak ditemukan');
  if (!karyawan.user_id && !karyawan.active) {
    throw new BadRequestError('Akun login karyawan belum dibuat');
  }

  await updateKaryawan(id, { active: !karyawan.active, updated_by: requester.email }, t);
  return getKaryawanByIdService(id, requester, t);
};

export const resetKaryawanPasswordService = async (
  id: string,
  input: ResetKaryawanPasswordInput,
  requester: Requester,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const karyawan = await findKaryawanById(id, t);
  if (!karyawan || karyawan.owner_id !== owner_id) throw new NotFoundError('Karyawan tidak ditemukan');
  if (!karyawan.user_id) throw new BadRequestError('Karyawan belum memiliki akses login');

  const password = asText(input.password);
  if (!password) throwValidation('password', 'Password wajib diisi');
  assertPassword(password);
  await updateUser(karyawan.user_id, { password: await hashPassword(password) }, t);
};

export const deleteKaryawanService = async (id: string, requester: Requester, t: Transaction) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const karyawan = await findKaryawanById(id, t);
  if (!karyawan || karyawan.owner_id !== owner_id) throw new NotFoundError('Karyawan tidak ditemukan');

  if (karyawan.user_id) await deleteUser(karyawan.user_id, t);
  await deleteKaryawan(id, requester.email, t);
};
