import type { Request, Response } from 'express';
import sequelize from '../../databases';
import {
  createPaymentMethodService,
  getAllPaymentMethodsService,
  getPaymentMethodByIdService,
  updatePaymentMethodService,
  deletePaymentMethodService,
} from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination } from '../../utils/api-response';
import { handleError } from '../../utils/app-error';
import { parseFilterQuery, parseSortQuery, buildWhereFromFilters, buildOrderFromSort } from '../../utils/query-filter';

const PAYMENT_METHOD_FILTERABLE_KEYS = [
  'id',
  'user_id',
  'owner_id',
  'active',
  'key_payment_param_id',
  'method_payment_param_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

const buildPaymentMethodQueryOptions = (req: Request) => {
  const { filter, sort, order: orderDirection } = req.query as { filter?: string; sort?: string; order?: string };
  const filters = parseFilterQuery(filter);
  const sortCondition = parseSortQuery(sort, orderDirection);

  return {
    where: buildWhereFromFilters(filters, PAYMENT_METHOD_FILTERABLE_KEYS),
    order: buildOrderFromSort(sortCondition, PAYMENT_METHOD_FILTERABLE_KEYS),
  };
};

export const createPaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await createPaymentMethodService(
      req.body,
      { user_id, role, email },
      t
    );

    await t.commit();
    sendCreated(res, result, 'Metode pembayaran berhasil dibuat');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getAllPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const { where, order } = buildPaymentMethodQueryOptions(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    const { rows, count } = await getAllPaymentMethodsService(
      { user_id, role },
      where,
      order,
      page,
      limit,
      t
    );

    await t.commit();
    sendPaginated(res, rows, count, { page, limit }, 'Berhasil mengambil data metode pembayaran');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getPaymentMethodById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const result = await getPaymentMethodByIdService(
      req.params['id'] as string,
      { user_id, role },
      t
    );

    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil metode pembayaran');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updatePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await updatePaymentMethodService(
      req.params['id'] as string,
      req.body,
      { user_id, role, email },
      t
    );

    await t.commit();
    sendSuccess(res, result, 'Metode pembayaran berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deletePaymentMethod = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    await deletePaymentMethodService(
      req.params['id'] as string,
      { user_id, role, email },
      t
    );

    await t.commit();
    sendSuccess(res, null, 'Metode pembayaran berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
