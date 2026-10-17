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
import { findPaymentGatewayById, findPaymentGatewaysByIds } from '../payment-gateway/repository';
import type PaymentGateway from '../payment-gateway/model';
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

// hanya info aman dari gateway yang ikut di response payment-methods.
// merchant_id / client_key / server_key TIDAK pernah disertakan di sini —
// credential hanya boleh diambil lewat endpoint payment-gateway
const toGatewaySummary = (gateway: PaymentGateway) => ({
  id: gateway.id,
  provider: gateway.provider,
  is_connected: gateway.is_connected,
});

// payment_gateway_id harus menunjuk ke credential milik owner yang sama.
// kalau milik owner lain diperlakukan seperti tidak ada, supaya id orang lain tidak bisa ditebak
const assertGatewayBelongsToOwner = async (
  payment_gateway_id: string,
  owner_id: string,
  t: Transaction
): Promise<void> => {
  const gateway = await findPaymentGatewayById(payment_gateway_id, t);

  if (!gateway || gateway.owner_id !== owner_id) {
    throw new NotFoundError('Payment gateway tidak ditemukan');
  }
};

export const createPaymentMethodService = async (
  input: CreatePaymentMethodInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  if (!input.payment_gateway_id) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'payment_gateway_id', message: 'payment_gateway_id wajib diisi' },
    ]);
  }

  const owner_id = await resolveOwnerId(requester, t);

  // key_payment_param_id opsional: '' / undefined dinormalkan jadi null,
  // dan hanya divalidasi ke flex_params kalau memang diisi
  const key_payment_param_id = input.key_payment_param_id || null;

  if (key_payment_param_id) {
    const keyParam = await findFlexParamById(key_payment_param_id, t);
    if (!keyParam) {
      throw new NotFoundError('Key payment param tidak ditemukan');
    }
  }

  // gateway wajib milik owner yang sama, supaya tidak bisa menunjuk credential owner lain
  await assertGatewayBelongsToOwner(input.payment_gateway_id, owner_id, t);

  const duplicate = await findDuplicatePaymentMethod(
    owner_id,
    key_payment_param_id,
    input.payment_gateway_id,
    t
  );
  if (duplicate) {
    throw new ConflictError('Metode pembayaran ini sudah terdaftar untuk owner Anda', [
      { field: 'payment_gateway_id', message: 'Metode pembayaran ini sudah terdaftar' },
    ]);
  }

  return createPaymentMethod(
    {
      user_id: requester.user_id,
      owner_id,
      key_payment_param_id,
      payment_gateway_id: input.payment_gateway_id,
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

  // key_payment_param_id boleh null, jadi id null disaring dulu sebelum di-query
  const keyParamIds = Array.from(
    new Set(rows.map((r) => r.key_payment_param_id).filter((id): id is string => !!id))
  );

  const flexParams = await findFlexParamsByIds(keyParamIds, t);
  const paramMap = new Map(flexParams.map((p) => [p.id, p]));

  const gatewayIds = Array.from(new Set(rows.map((r) => r.payment_gateway_id)));
  const gateways = await findPaymentGatewaysByIds(gatewayIds, t);
  const gatewayMap = new Map(gateways.map((g) => [g.id, toGatewaySummary(g)]));

  const data = rows.map((row) => ({
    ...row.toJSON(),
    key_payment: row.key_payment_param_id ? paramMap.get(row.key_payment_param_id) ?? null : null,
    payment_gateway: gatewayMap.get(row.payment_gateway_id) ?? null,
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

  const keyParam = result.key_payment_param_id
    ? await findFlexParamById(result.key_payment_param_id, t)
    : null;
  const gateway = await findPaymentGatewayById(result.payment_gateway_id, t);

  return {
    ...result.toJSON(),
    key_payment: keyParam ?? null,
    payment_gateway: gateway ? toGatewaySummary(gateway) : null,
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
  const effectiveGatewayId = input.payment_gateway_id ?? paymentMethod.payment_gateway_id;

  if (input.key_payment_param_id) {
    const keyParam = await findFlexParamById(input.key_payment_param_id, t);
    if (!keyParam) throw new NotFoundError('Key payment param tidak ditemukan');
  }

  if (input.payment_gateway_id) {
    await assertGatewayBelongsToOwner(input.payment_gateway_id, owner_id, t);
  }

  if (input.key_payment_param_id || input.payment_gateway_id) {
    const duplicate = await findDuplicatePaymentMethod(
      owner_id,
      effectiveKeyParamId,
      effectiveGatewayId,
      t,
      id
    );
    if (duplicate) {
      throw new ConflictError('Metode pembayaran ini sudah terdaftar untuk owner Anda', [
        { field: 'payment_gateway_id', message: 'Metode pembayaran ini sudah terdaftar' },
      ]);
    }
  }

  // field diambil eksplisit, tidak pakai ...input, supaya kolom kepemilikan
  // (user_id/owner_id) tidak bisa ikut tertimpa lewat body request
  await updatePaymentMethod(
    id,
    {
      key_payment_param_id: effectiveKeyParamId,
      payment_gateway_id: effectiveGatewayId,
      ...(input.active !== undefined && { active: input.active }),
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
