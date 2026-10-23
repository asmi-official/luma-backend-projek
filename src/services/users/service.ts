import { Transaction } from 'sequelize';
import { hashPassword, comparePassword } from '../../utils/bcrypt';
import { generateTokenPair } from '../../utils/jwt';
import { findUserByEmail, findUserByUsername, findUserByPhone, findUserById, createUser, updateUser, deleteUser } from './repository';
import { OWNER_ROLE } from './model';
import { ConflictError, UnauthorizedError, BadRequestError, ForbiddenError, NotFoundError } from '../../utils/app-error';
import { RegisterInput, LoginInput, CreateEmployeeInput, UpdateProfileInput } from './types';
import { createCompanyService } from '../company/service';
import { findCompanyById, findCompanyByUserId } from '../company/repository';
import { uploadDocumentService, updateDocumentService } from '../documents/service';
import { findKaryawanByUserId, touchKaryawanLastLogin } from '../karyawan/repository';

// resolve owner_id (pemilik grup usaha) dari seorang user:
// - kalau dia owner, cari salah satu Company miliknya lalu ambil user_id (dirinya sendiri)
// - kalau dia karyawan (hrd, dll), ambil company_id-nya lalu lihat Company.user_id (owner grup itu)
// dipakai supaya owner yang punya banyak company (pusat + cabang) tetap dianggap 1 relasi/grup yang sama
const resolveOwnerId = async (
  user: { user_id: string; role: string },
  t: Transaction
): Promise<string | null> => {
  if (user.role === OWNER_ROLE) {
    const company = await findCompanyByUserId(user.user_id, t);
    return company ? company.user_id : null;
  }

  const targetUser = await findUserById(user.user_id, t);
  if (!targetUser?.company_id) return null;

  const company = await findCompanyById(targetUser.company_id, t);
  return company ? company.user_id : null;
};

export const registerService = async (input: RegisterInput, t: Transaction) => {
  const existingEmail = await findUserByEmail(input.email, t);
  if (existingEmail) {
    throw new ConflictError('Email sudah terdaftar', [
      { field: 'email', message: 'Email sudah terdaftar' },
    ]);
  }

  const existingPhone = await findUserByPhone(input.phone, t);
  if (existingPhone) {
    throw new ConflictError('Nomor telepon sudah terdaftar', [
      { field: 'phone', message: 'Nomor telepon sudah terdaftar' },
    ]);
  }

  if (input.role === OWNER_ROLE && !input.company_name) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'company_name', message: 'Nama perusahaan wajib diisi untuk role owner' },
    ]);
  }

  if (input.agree !== true) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'agree', message: 'Anda harus menyetujui syarat dan ketentuan' },
    ]);
  }

  const existingUsername = await findUserByUsername(input.username, t);
  if (existingUsername) {
    throw new ConflictError('Username sudah digunakan', [
      { field: 'username', message: 'Username sudah digunakan' },
    ]);
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await createUser({
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    password: hashedPassword,
    role: input.role,
    username: input.username,
    photo_id: null,
    photo_url: null,
    agree: input.agree,
  }, t);

  // owner otomatis dapat company utama (cabang pusat) saat register
  if (input.role === OWNER_ROLE) {
    await createCompanyService({
      company_name: input.company_name!,
      company_cabang: true,
      user_id: user.id,
      created_by: user.email,
      updated_by: user.email,
    }, { user_id: user.id, role: user.role }, t);
  }

  return {
    ...generateTokenPair({ user_id: user.id, email: user.email, role: user.role, username: user.username }),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
};

export const createEmployeeService = async (
  input: CreateEmployeeInput,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  if (requester.role !== OWNER_ROLE) {
    throw new ForbiddenError('Hanya owner yang dapat membuat user karyawan');
  }

  const company = await findCompanyById(input.company_id, t);
  if (!company) throw new NotFoundError('Company tidak ditemukan');

  if (company.user_id !== requester.user_id) {
    throw new ForbiddenError('Company tersebut bukan milik Anda');
  }

  const existingEmail = await findUserByEmail(input.email, t);
  if (existingEmail) {
    throw new ConflictError('Email sudah terdaftar', [
      { field: 'email', message: 'Email sudah terdaftar' },
    ]);
  }

  const existingPhone = await findUserByPhone(input.phone, t);
  if (existingPhone) {
    throw new ConflictError('Nomor telepon sudah terdaftar', [
      { field: 'phone', message: 'Nomor telepon sudah terdaftar' },
    ]);
  }

  const existingUsername = await findUserByUsername(input.username, t);
  if (existingUsername) {
    throw new ConflictError('Username sudah digunakan', [
      { field: 'username', message: 'Username sudah digunakan' },
    ]);
  }

  const hashedPassword = await hashPassword(input.password);

  const user = await createUser({
    full_name: input.full_name,
    email: input.email,
    phone: input.phone,
    password: hashedPassword,
    role: input.role,
    username: input.username,
    photo_id: null,
    photo_url: null,
    agree: true,
    company_id: input.company_id,
    header_id: input.header_id,
  }, t);

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    phone: user.phone,
    full_name: user.full_name,
    role: user.role,
    company_id: user.company_id,
    header_id: user.header_id,
  };
};

export const updateProfileService = async (
  userId: string,
  input: UpdateProfileInput,
  t: Transaction,
  file?: Express.Multer.File
) => {
  const user = await findUserById(userId, t);
  if (!user) throw new NotFoundError('User tidak ditemukan');

  if (input.phone && input.phone !== user.phone) {
    const existingPhone = await findUserByPhone(input.phone, t);
    if (existingPhone) {
      throw new ConflictError('Nomor telepon sudah terdaftar', [
        { field: 'phone', message: 'Nomor telepon sudah terdaftar' },
      ]);
    }
  }

  let photo_id = user.photo_id;
  let photo_url = user.photo_url;

  if (file && user.photo_id) {
    // sudah punya foto → update document (hapus file lama dari disk, simpan baru)
    const updatedDoc = await updateDocumentService(user.photo_id, {
      updated_by: user.email,
      ref_id: user.id,
      ref_type: 'FILE_USER',
    }, t, file);

    photo_url = updatedDoc?.file_url ?? photo_url;
  } else if (file && !user.photo_id) {
    // belum punya foto → create document baru
    const doc = await uploadDocumentService(file, {
      user_id: user.id,
      created_by: user.email,
      updated_by: user.email,
      ref_id: user.id,
      ref_type: 'FILE_USER',
    }, t);

    photo_id = doc.id;
    photo_url = doc.file_url;
  }

  await updateUser(userId, {
    ...input,
    photo_id,
    photo_url,
  }, t);

  return findUserById(userId, t);
};

export const getEmployeeByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const employee = await findUserById(id, t);
  if (!employee) throw new NotFoundError('User tidak ditemukan');

  const requesterOwnerId = await resolveOwnerId(requester, t);
  const employeeOwnerId = await resolveOwnerId({ user_id: employee.id, role: employee.role }, t);

  if (!requesterOwnerId || requesterOwnerId !== employeeOwnerId) {
    throw new ForbiddenError('User tersebut bukan karyawan di grup usaha yang sama dengan Anda');
  }

  return employee;
};

export const deleteEmployeeService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const employee = await findUserById(id, t);
  if (!employee) throw new NotFoundError('User tidak ditemukan');

  const requesterOwnerId = await resolveOwnerId(requester, t);
  const employeeOwnerId = await resolveOwnerId({ user_id: employee.id, role: employee.role }, t);

  if (!requesterOwnerId || requesterOwnerId !== employeeOwnerId) {
    throw new ForbiddenError('User tersebut bukan karyawan di grup usaha yang sama dengan Anda');
  }

  await deleteUser(id, t);
};

export const loginService = async (input: LoginInput, t: Transaction) => {
  const user = await findUserByEmail(input.email, t);
  if (!user) {
    throw new UnauthorizedError('Email tidak terdaftar', [
      { field: 'email', message: 'Email tidak terdaftar' },
    ]);
  }

  const isMatch = await comparePassword(input.password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Password salah', [
      { field: 'password', message: 'Password salah' },
    ]);
  }

  // Owner dan akun lama yang belum mempunyai profil karyawan tetap dapat login.
  // Tetapi akun yang terhubung ke karyawan mengikuti status akses pada modul Karyawan.
  const karyawan = await findKaryawanByUserId(user.id, t);
  if (karyawan && !karyawan.active) {
    throw new UnauthorizedError('Akses login karyawan sedang dinonaktifkan');
  }

  if (karyawan) await touchKaryawanLastLogin(user.id, t);

  return {
    ...generateTokenPair({ user_id: user.id, email: user.email, role: user.role, username: user.username }),
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
};
