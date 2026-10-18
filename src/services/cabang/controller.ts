import type { Request, Response } from 'express';
import sequelize from '../../databases';
import { createCabangService, updateCabangService, deleteCabangService } from './service';
import { findAllCabangs, findCabangById } from './repository';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { handleError, NotFoundError } from '../../utils/app-error';
import { parseFilterQuery, parseSortQuery, buildWhereFromFilters, buildOrderFromSort } from '../../utils/query-filter';

const CABANG_FILTERABLE_KEYS = [
  'id',
  'name',
  'code',
  'address',
  'phone',
  'email',
  'manager_name',
  'active',
  'user_id',
  'company_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

const buildCabangQueryOptions = (req: Request) => {
  const { filter, sort, order: orderDirection } = req.query as { filter?: string; sort?: string; order?: string };
  const filters = parseFilterQuery(filter);
  const sortCondition = parseSortQuery(sort, orderDirection);

  return {
    where: buildWhereFromFilters(filters, CABANG_FILTERABLE_KEYS),
    order: buildOrderFromSort(sortCondition, CABANG_FILTERABLE_KEYS),
  };
};

export const createCabang = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;
    const result = await createCabangService(
      {
        ...req.body,
        created_by: email,
        updated_by: email,
      },
      { user_id, role },
      t
    );

    await t.commit();
    sendCreated(res, result, 'Cabang berhasil dibuat');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getAllCabangs = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { where, order } = buildCabangQueryOptions(req);
    const result = await findAllCabangs(where, order, t);
    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil data cabang');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getCabangById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await findCabangById(req.params['id'] as string, t);
    if (!result) throw new NotFoundError('Cabang tidak ditemukan');
    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil data cabang');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updateCabang = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;
    const result = await updateCabangService(
      req.params['id'] as string,
      { ...req.body, updated_by: email },
      { user_id, role },
      t
    );

    await t.commit();
    sendSuccess(res, result, 'Cabang berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deleteCabang = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;
    await deleteCabangService(req.params['id'] as string, email, { user_id, role }, t);

    await t.commit();
    sendSuccess(res, null, 'Cabang berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
