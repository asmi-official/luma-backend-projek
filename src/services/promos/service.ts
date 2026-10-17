import { Transaction, WhereOptions, OrderItem } from 'sequelize';
import {
  createPromo,
  findAllPromos,
  findPromoById,
  findPromoByName,
  findActivePromos,
  updatePromo,
  toggleActivePromo,
  deletePromo,
} from './repository';
import { generateSerialNumber } from '../naming-series/service';
import { findUserById } from '../users/repository';
import { findCompanyByUserId, findCompanyById } from '../company/repository';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ConflictError, BadRequestError } from '../../utils/app-error';
import { CreatePromoInput, UpdatePromoInput } from './types';

const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction,
): Promise<{ owner_id: string; company_code: string }> => {
  if (requester.role === OWNER_ROLE) {
    const company = await findCompanyByUserId(requester.user_id, t);
    return {
      owner_id: requester.user_id,
      company_code: company?.id ? company.id.slice(0, 4).toUpperCase() : 'COMP',
    };
  }

  const requesterUser = await findUserById(requester.user_id, t);
  if (!requesterUser) throw new NotFoundError('User tidak ditemukan');

  const owner_id = requesterUser.header_id ?? requesterUser.id;
  let company_code = 'COMP';

  if (requesterUser.company_id) {
    const company = await findCompanyById(requesterUser.company_id, t);
    if (company?.id) company_code = company.id.slice(0, 4).toUpperCase();
  }

  return { owner_id, company_code };
};

// validasi spesifik per tipe diskon
const validateDiscountInput = (input: CreatePromoInput | UpdatePromoInput, isCreate: boolean) => {
  const discountType = input.discount_type;

  if (isCreate && !discountType) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'discount_type', message: 'Tipe diskon wajib diisi' },
    ]);
  }

  if (discountType === 'percentage') {
    if (isCreate && (input.discount_value === undefined || input.discount_value === null)) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'discount_value', message: 'Nilai diskon persentase wajib diisi' },
      ]);
    }
    if (input.discount_value !== undefined && Number(input.discount_value) > 100) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'discount_value', message: 'Diskon persentase tidak boleh lebih dari 100%' },
      ]);
    }
    if (input.discount_value !== undefined && Number(input.discount_value) < 0) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'discount_value', message: 'Diskon persentase tidak boleh negatif' },
      ]);
    }
  }

  if (discountType === 'fixed') {
    if (isCreate && (input.discount_value === undefined || input.discount_value === null)) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'discount_value', message: 'Nilai diskon nominal wajib diisi' },
      ]);
    }
    if (input.discount_value !== undefined && Number(input.discount_value) < 0) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'discount_value', message: 'Diskon nominal tidak boleh negatif' },
      ]);
    }
  }

  if (discountType === 'special_price') {
    const sp = (input as CreatePromoInput).special_price ?? (input as UpdatePromoInput).special_price;
    if (isCreate && (sp === undefined || sp === null)) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'special_price', message: 'Harga spesial wajib diisi untuk tipe harga spesial' },
      ]);
    }
    if (sp !== undefined && sp !== null && Number(sp) < 0) {
      throw new BadRequestError('Validasi gagal', [
        { field: 'special_price', message: 'Harga spesial tidak boleh negatif' },
      ]);
    }
  }
};

export const createPromoService = async (
  input: CreatePromoInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  if (!input.name) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'name', message: 'Nama promo wajib diisi' },
    ]);
  }

  if (!input.start_date) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'start_date', message: 'Tanggal mulai wajib diisi' },
    ]);
  }

  if (!input.end_date) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'end_date', message: 'Tanggal selesai wajib diisi' },
    ]);
  }

  if (new Date(input.end_date) < new Date(input.start_date)) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'end_date', message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' },
    ]);
  }

  // validasi per tipe diskon
  validateDiscountInput(input, true);

  const { owner_id, company_code } = await resolveOwnerId(requester, t);

  // cek nama duplikat
  const duplicateName = await findPromoByName(input.name, owner_id, t);
  if (duplicateName) {
    throw new ConflictError('Nama promo sudah digunakan', [
      { field: 'name', message: 'Nama promo sudah digunakan' },
    ]);
  }

  // generate kode promo otomatis
  const currentYear = new Date().getFullYear();
  const code = await generateSerialNumber('PROMO', currentYear, company_code, t);

  const id = crypto.randomUUID();

  // untuk special_price, discount_value = 0 (tidak relevan)
  const discountValue = input.discount_type === 'special_price'
    ? 0
    : Number(input.discount_value);

  const specialPrice = input.discount_type === 'special_price'
    ? Number(input.special_price)
    : null;

  return createPromo(
    {
      id,
      code,
      name: input.name,
      description: input.description ?? null,
      discount_type: input.discount_type,
      discount_value: discountValue,
      special_price: specialPrice,
      min_purchase: Number(input.min_purchase ?? 0),
      max_discount: input.discount_type === 'percentage'
        && input.max_discount !== undefined
        && input.max_discount !== null
        ? Number(input.max_discount)
        : null,
      start_date: new Date(input.start_date),
      end_date: new Date(input.end_date),
      usage_limit: input.usage_limit !== undefined && input.usage_limit !== null
        ? Number(input.usage_limit)
        : null,
      active: input.active ?? true,
      user_id: requester.user_id,
      owner_id,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t,
  );
};

export const getAllPromosService = async (
  requester: { user_id: string; role: string },
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const effectiveWhere = { ...where, owner_id };

  return findAllPromos(effectiveWhere, order, page, limit, t);
};

export const getPromoByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError('Promo tidak ditemukan');
  }

  return promo;
};

export const getActivePromosService = async (
  requester: { user_id: string; role: string },
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  return findActivePromos(owner_id, t);
};

export const updatePromoService = async (
  id: string,
  input: UpdatePromoInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError('Promo tidak ditemukan');
  }

  // cek nama duplikat jika nama diubah
  if (input.name && input.name !== promo.name) {
    const duplicateName = await findPromoByName(input.name, owner_id, t, id);
    if (duplicateName) {
      throw new ConflictError('Nama promo sudah digunakan', [
        { field: 'name', message: 'Nama promo sudah digunakan' },
      ]);
    }
  }

  // validasi tanggal
  const startDate = input.start_date ? new Date(input.start_date) : promo.start_date;
  const endDate = input.end_date ? new Date(input.end_date) : promo.end_date;

  if (new Date(endDate) < new Date(startDate)) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'end_date', message: 'Tanggal selesai tidak boleh sebelum tanggal mulai' },
    ]);
  }

  // validasi per tipe diskon
  const effectiveType = input.discount_type ?? promo.discount_type;
  if (input.discount_type) {
    validateDiscountInput(input, false);
  }

  // hitung nilai berdasarkan tipe
  let discountValue = promo.discount_value;
  let specialPrice = promo.special_price;

  if (effectiveType === 'special_price') {
    discountValue = 0;
    specialPrice = input.special_price !== undefined && input.special_price !== null
      ? Number(input.special_price)
      : promo.special_price;
  } else {
    discountValue = input.discount_value !== undefined
      ? Number(input.discount_value)
      : promo.discount_value;
    specialPrice = null;
  }

  const maxDiscount = effectiveType === 'percentage'
    ? (input.max_discount !== undefined
      ? (input.max_discount !== null ? Number(input.max_discount) : null)
      : promo.max_discount)
    : null;

  await updatePromo(
    id,
    {
      name: input.name ?? promo.name,
      description: input.description !== undefined ? (input.description ?? null) : promo.description,
      discount_type: effectiveType,
      discount_value: discountValue,
      special_price: specialPrice,
      min_purchase: input.min_purchase !== undefined ? Number(input.min_purchase) : promo.min_purchase,
      max_discount: maxDiscount,
      start_date: startDate,
      end_date: endDate,
      usage_limit: input.usage_limit !== undefined
        ? (input.usage_limit !== null ? Number(input.usage_limit) : null)
        : promo.usage_limit,
      active: input.active !== undefined ? input.active : promo.active,
      updated_by: requester.email,
    },
    t,
  );

  return findPromoById(id, t);
};

// toggle aktif / non-aktif promo
export const togglePromoActiveService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError('Promo tidak ditemukan');
  }

  const newActive = !promo.active;
  await toggleActivePromo(id, newActive, requester.email, t);

  return findPromoById(id, t);
};

export const deletePromoService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction,
) => {
  const { owner_id } = await resolveOwnerId(requester, t);
  const promo = await findPromoById(id, t);

  if (!promo || promo.owner_id !== owner_id) {
    throw new NotFoundError('Promo tidak ditemukan');
  }

  await deletePromo(id, requester.email, t);
};
