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
import {
  findPaymentGatewayById,
  findPaymentGatewaysByIds,
  findPaymentGatewayByOwner,
} from '../payment-gateway/repository';
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

// TUNAI dikenali dari value_param di flex_params (type_param=PAYMENT_METHODS).
// metode tunai tidak melewati payment gateway manapun
const CASH_VALUE_PARAM = 'TUNAI';
const PAYMENT_METHOD_TYPE_PARAM = 'PAYMENT_METHODS';

const isCashMethod = (value_param: string): boolean =>
  value_param.trim().toUpperCase() === CASH_VALUE_PARAM;

// validasi key_payment_param_id: harus ada & bertipe PAYMENT_METHODS
const resolvePaymentMethodParam = async (key_payment_param_id: string, t: Transaction) => {
  const param = await findFlexParamById(key_payment_param_id, t);

  if (!param || param.type_param !== PAYMENT_METHOD_TYPE_PARAM) {
    throw new NotFoundError('Metode pembayaran tidak ditemukan');
  }

  return param;
};

// untuk metode selain TUNAI: gateway owner wajib ada DAN is_connected.
// dipakai saat create maupun saat mengaktifkan metode lewat update
const requireConnectedGateway = async (
  owner_id: string,
  t: Transaction
): Promise<PaymentGateway> => {
  const gateway = await findPaymentGatewayByOwner(owner_id, 'MIDTRANS', t);

  if (!gateway) {
    throw new BadRequestError('Payment gateway belum terhubung', [
      {
        field: 'payment_gateway_id',
        message: 'Hubungkan Midtrans terlebih dahulu sebelum mengaktifkan metode pembayaran ini',
      },
    ]);
  }

  if (!gateway.is_connected) {
    throw new BadRequestError('Payment gateway belum aktif', [
      {
        field: 'payment_gateway_id',
        message: 'Midtrans belum aktif, aktifkan terlebih dahulu',
      },
    ]);
  }

  return gateway;
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

  const owner_id = await resolveOwnerId(requester, t);
  const param = await resolvePaymentMethodParam(input.key_payment_param_id, t);
  const isCash = isCashMethod(param.value_param);

  const active = input.active ?? false;

  // TUNAI tidak lewat gateway. selain itu, gateway wajib terhubung & aktif
  // sebelum metodenya boleh dibuat dalam keadaan aktif
  let payment_gateway_id: string | null = null;

  if (!isCash && active) {
    const gateway = await requireConnectedGateway(owner_id, t);
    payment_gateway_id = gateway.id;
  }

  const duplicate = await findDuplicatePaymentMethod(
    owner_id,
    input.key_payment_param_id,
    t
  );
  if (duplicate) {
    throw new ConflictError('Metode pembayaran ini sudah terdaftar untuk owner Anda', [
      { field: 'key_payment_param_id', message: 'Metode pembayaran ini sudah terdaftar' },
    ]);
  }

  return createPaymentMethod(
    {
      user_id: requester.user_id,
      owner_id,
      key_payment_param_id: input.key_payment_param_id,
      payment_gateway_id,
      active,
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

  // payment_gateway_id null untuk metode TUNAI, jadi disaring dulu
  const gatewayIds = Array.from(
    new Set(rows.map((r) => r.payment_gateway_id).filter((id): id is string => !!id))
  );
  const gateways = await findPaymentGatewaysByIds(gatewayIds, t);
  const gatewayMap = new Map(gateways.map((g) => [g.id, toGatewaySummary(g)]));

  const data = rows.map((row) => ({
    ...row.toJSON(),
    key_payment: row.key_payment_param_id ? paramMap.get(row.key_payment_param_id) ?? null : null,
    payment_gateway: row.payment_gateway_id
      ? gatewayMap.get(row.payment_gateway_id) ?? null
      : null,
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
  const gateway = result.payment_gateway_id
    ? await findPaymentGatewayById(result.payment_gateway_id, t)
    : null;

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

  if (input.active === undefined) {
    throw new BadRequestError('Validasi gagal', [
      { field: 'active', message: 'active wajib diisi' },
    ]);
  }

  const param = paymentMethod.key_payment_param_id
    ? await findFlexParamById(paymentMethod.key_payment_param_id, t)
    : null;
  const isCash = param ? isCashMethod(param.value_param) : false;

  // TUNAI bebas di-toggle tanpa syarat apapun.
  // selain TUNAI: gateway wajib terhubung & aktif sebelum boleh diaktifkan.
  // payment_gateway_id diisi kalau masih kosong, kalau sudah terisi dibiarkan apa adanya
  let payment_gateway_id = paymentMethod.payment_gateway_id;

  if (!isCash && input.active) {
    const gateway = await requireConnectedGateway(owner_id, t);
    if (!payment_gateway_id) payment_gateway_id = gateway.id;
  }

  // field diambil eksplisit, tidak pakai ...input, supaya kolom kepemilikan
  // (user_id/owner_id) tidak bisa ikut tertimpa lewat body request
  await updatePaymentMethod(
    id,
    {
      payment_gateway_id,
      active: input.active,
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
