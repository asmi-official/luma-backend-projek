import type { Request, Response } from 'express';
import sequelize from '../../databases';
import { createCabangService, getAllCabangsService, getCabangByIdService, updateCabangService, deleteCabangService } from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination } from '../../utils/api-response';
import { handleError } from '../../utils/app-error';
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

const CABANG_STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'inactive', label: 'Nonaktif' },
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

export const getCabangFilterOptions = (_req: Request, res: Response): void => {
  sendSuccess(res, { status_options: CABANG_STATUS_OPTIONS }, 'Berhasil mengambil opsi filter cabang');
};

export const getAllCabangs = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const { where, order } = buildCabangQueryOptions(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search } = req.query as { search?: string };
    const { rows, count, total_active, total_inactive } = await getAllCabangsService(
      { user_id, role },
      where,
      order,
      page,
      limit,
      t,
      search
    );
    await t.commit();
    sendPaginated(res, rows, count, { page, limit }, 'Berhasil mengambil data cabang', {
      total_active,
      total_inactive,
    });
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getCabangById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const result = await getCabangByIdService(
      req.params['id'] as string,
      { user_id, role },
      t
    );
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
