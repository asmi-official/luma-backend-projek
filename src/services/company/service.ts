import { Transaction } from 'sequelize';
import {
  createCompany,
  findCompanyById,
  findCompanyByCode,
  updateCompany,
  deleteCompany,
} from './repository';
import { findUserById } from '../users/repository';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ForbiddenError, InternalServerError } from '../../utils/app-error';
import { CompanyCreationAttributes } from './model';
import { CreateCompanyInput, UpdateCompanyInput } from './types';

// huruf kapital + angka, tanpa karakter yang mudah tertukar saat dibaca manusia (I, O, 0, 1)
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 4;
const MAX_CODE_ATTEMPTS = 10;

const randomCode = (): string => {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
};

// company_code digenerate server (bukan input client): acak 4 karakter A-Z/0-9,
// diulang kalau kebetulan sudah dipakai company lain
const generateCompanyCode = async (t: Transaction): Promise<string> => {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = randomCode();
    const existing = await findCompanyByCode(code, t);
    if (!existing) return code;
  }

  throw new InternalServerError('Gagal membuat kode perusahaan, silakan coba lagi');
};

// owner_id tidak pernah dikirim client, tapi di-resolve dari requester:
// - kalau requester owner → owner_id = user_id-nya sendiri
// - kalau requester bukan owner (hrd, dll) → owner_id = header_id milik requester
const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction
): Promise<string | null> => {
  if (requester.role === OWNER_ROLE) return requester.user_id;

  const requesterUser = await findUserById(requester.user_id, t);
  return requesterUser?.header_id ?? null;
};

export const createCompanyService = async (
  input: CreateCompanyInput,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const company_code = await generateCompanyCode(t);

  return createCompany({ ...input, owner_id, company_code } as CompanyCreationAttributes, t);
};

export const updateCompanyService = async (
  id: string,
  input: UpdateCompanyInput,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const company = await findCompanyById(id, t);
  if (!company) throw new NotFoundError('Company tidak ditemukan');

  if (requester.role !== OWNER_ROLE || company.user_id !== requester.user_id) {
    throw new ForbiddenError('Hanya owner pemilik company yang dapat mengupdate data ini');
  }

  // field diambil eksplisit supaya company_code (digenerate server) dan kolom
  // kepemilikan tidak bisa ikut tertimpa lewat body request
  await updateCompany(
    id,
    {
      ...(input.company_name !== undefined && { company_name: input.company_name }),
      ...(input.company_cabang !== undefined && { company_cabang: input.company_cabang }),
      ...(input.header_id !== undefined && { header_id: input.header_id }),
      updated_by: input.updated_by,
    },
    t
  );

  return findCompanyById(id, t);
};

export const deleteCompanyService = async (id: string, deleted_by: string, t: Transaction) => {
  const company = await findCompanyById(id, t);
  if (!company) throw new NotFoundError('Company tidak ditemukan');

  await updateCompany(id, { deleted_by }, t);
  await deleteCompany(id, t);
};
