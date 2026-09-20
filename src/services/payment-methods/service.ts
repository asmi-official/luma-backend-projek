import { Transaction, WhereOptions, OrderItem } from 'sequelize';
import {
  createPaymentMethod,
  findAllPaymentMethods,
  findPaymentMethodById,
  findDuplicatePaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
} from './repository';
import { findFlexParamById, findFlexParamsByIds } from '../flex-params/repository';
import { findUserById } from '../users/repository';
import { findCompanyById } from '../company/repository';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../../utils/app-error';
import { CreatePaymentMethodInput, UpdatePaymentMethodInput } from './types';

export const resolveOwnerId = async (
  requester: { user_id: string; role: string },
  t: Transaction
): Promise<string> => {
  if (requester.role === OWNER_ROLE) return requester.user_id;

  const requesterUser = await findUserById(requester.user_id, t);
  if (!requesterUser) throw new NotFoundError('User tidak ditemukan');

  if (requesterUser.header_id) return requesterUser.header_id;

  if (requesterUser.company_id) {
    const company = await findCompanyById(requesterUser.company_id, t);
    if (company?.user_id) return company.user_id;
  }

  throw new ForbiddenError('Anda tidak terikat dengan owner manapun');
};

export const createPaymentMethodService = async (
  input: CreatePaymentMethodInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  if (!input.key_payment_param_id) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'key_payment_param_id', message: 'key_payment_param_id wajib diisi' },
    ]);
  }

  if (!input.method_payment_param_id) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'method_payment_param_id', message: 'method_payment_param_id wajib diisi' },
    ]);
  }

  const owner_id = await resolveOwnerId(requester, t);

  const keyParam = await findFlexParamById(input.key_payment_param_id, t);
  if (!keyParam) {
    throw new NotFoundError('Key payment param tidak ditemukan');
  }

  const methodParam = await findFlexParamById(input.method_payment_param_id, t);
  if (!methodParam) {
    throw new NotFoundError('Method payment param tidak ditemukan');
  }

  const duplicate = await findDuplicatePaymentMethod(
    owner_id,
    input.key_payment_param_id,
    input.method_payment_param_id,
    t
  );
  if (duplicate) {
    throw new ConflictError('Metode pembayaran ini sudah terdaftar untuk owner Anda', [
      { field: 'method_payment_param_id', message: 'Metode pembayaran ini sudah terdaftar' },
    ]);
  }

  return createPaymentMethod(
    {
      user_id: requester.user_id,
      owner_id,
      key_payment_param_id: input.key_payment_param_id,
      method_payment_param_id: input.method_payment_param_id,
      active: input.active ?? false,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t
  );
};

export const getAllPaymentMethodsService = async (
  requester: { user_id: string; role: string },
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t: Transaction
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const effectiveWhere = { ...where, owner_id };

  const { rows, count } = await findAllPaymentMethods(effectiveWhere, order, page, limit, t);

  const keyParamIds = rows.map((r) => r.key_payment_param_id);
  const methodParamIds = rows.map((r) => r.method_payment_param_id);
  const allParamIds = Array.from(new Set([...keyParamIds, ...methodParamIds]));

  const flexParams = await findFlexParamsByIds(allParamIds, t);
  const paramMap = new Map(flexParams.map((p) => [p.id, p]));

  const data = rows.map((row) => ({
    ...row.toJSON(),
    key_payment: paramMap.get(row.key_payment_param_id) ?? null,
    method_payment: paramMap.get(row.method_payment_param_id) ?? null,
  }));

  return { rows: data, count };
};

export const getPaymentMethodByIdService = async (
  id: string,
  requester: { user_id: string; role: string },
  t: Transaction
) => {
  const owner_id = await resolveOwnerId(requester, t);
  const result = await findPaymentMethodById(id, t);

  if (!result || result.owner_id !== owner_id) {
    throw new NotFoundError('Metode pembayaran tidak ditemukan');
  }

  const keyParam = await findFlexParamById(result.key_payment_param_id, t);
  const methodParam = await findFlexParamById(result.method_payment_param_id, t);

  return {
    ...result.toJSON(),
    key_payment: keyParam ?? null,
    method_payment: methodParam ?? null,
  };
};

export const updatePaymentMethodService = async (
  id: string,
  input: UpdatePaymentMethodInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const owner_id = await resolveOwnerId(requester, t);

  const paymentMethod = await findPaymentMethodById(id, t);
  if (!paymentMethod || paymentMethod.owner_id !== owner_id) {
    throw new NotFoundError('Metode pembayaran tidak ditemukan');
  }

  const effectiveKeyParamId = input.key_payment_param_id ?? paymentMethod.key_payment_param_id;
  const effectiveMethodParamId = input.method_payment_param_id ?? paymentMethod.method_payment_param_id;

  if (input.key_payment_param_id) {
    const keyParam = await findFlexParamById(input.key_payment_param_id, t);
    if (!keyParam) throw new NotFoundError('Key payment param tidak ditemukan');
  }

  if (input.method_payment_param_id) {
    const methodParam = await findFlexParamById(input.method_payment_param_id, t);
    if (!methodParam) throw new NotFoundError('Method payment param tidak ditemukan');
  }

  if (input.key_payment_param_id || input.method_payment_param_id) {
    const duplicate = await findDuplicatePaymentMethod(
      owner_id,
      effectiveKeyParamId,
      effectiveMethodParamId,
      t,
      id
    );
    if (duplicate) {
      throw new ConflictError('Metode pembayaran ini sudah terdaftar untuk owner Anda', [
        { field: 'method_payment_param_id', message: 'Metode pembayaran ini sudah terdaftar' },
      ]);
    }
  }

  await updatePaymentMethod(
    id,
    {
      ...input,
      updated_by: requester.email,
    },
    t
  );

  return getPaymentMethodByIdService(id, requester, t);
};

export const deletePaymentMethodService = async (
  id: string,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const owner_id = await resolveOwnerId(requester, t);

  const paymentMethod = await findPaymentMethodById(id, t);
  if (!paymentMethod || paymentMethod.owner_id !== owner_id) {
    throw new NotFoundError('Metode pembayaran tidak ditemukan');
  }

  await deletePaymentMethod(id, requester.email, t);
};
