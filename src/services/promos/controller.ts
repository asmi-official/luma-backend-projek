import type { Request, Response } from 'express';
import sequelize from '../../databases';
import {
  createPromoService,
  getAllPromosService,
  getPromoByIdService,
  getActivePromosService,
  updatePromoService,
  togglePromoActiveService,
  deletePromoService,
} from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination } from '../../utils/api-response';
import { handleError } from '../../utils/app-error';
import { parseFilterQuery, parseSortQuery, buildWhereFromFilters, buildOrderFromSort } from '../../utils/query-filter';

const PROMO_FILTERABLE_KEYS = [
  'id',
  'name',
  'discount_type',
  'discount_value',
  'discount_text',
  'discount_description',
  'start_date',
  'end_date',
  'start_time',
  'end_time',
  'status',
  'user_id',
  'owner_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

const buildPromoQueryOptions = (req: Request) => {
  const { filter, sort, order: orderDirection } = req.query as { filter?: string; sort?: string; order?: string };
  const filters = parseFilterQuery(filter);
  const sortCondition = parseSortQuery(sort, orderDirection);

  return {
    where: buildWhereFromFilters(filters, PROMO_FILTERABLE_KEYS),
    order: buildOrderFromSort(sortCondition, PROMO_FILTERABLE_KEYS),
  };
};

// POST /api/promos — buat promo baru
export const createPromo = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await createPromoService(
      req.body,
      { user_id, role, email },
      t,
    );

    await t.commit();
    sendCreated(res, result, 'Promo berhasil dibuat');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// GET /api/promos — list semua promo (paginated + filter + sort)
export const getAllPromos = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const { where, order } = buildPromoQueryOptions(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { search } = req.query as { search?: string };

    const {
      rows,
      count,
      total_promo,
      total_aktif,
      total_terjadwal,
      total_selesai,
      total_nonaktif,
    } = await getAllPromosService({ user_id, role }, where, order, page, limit, t, search);

    await t.commit();
    sendPaginated(res, rows, count, { page, limit }, 'Berhasil mengambil data promo', {
      total_promo,
      total_aktif,
      total_terjadwal,
      total_selesai,
      total_nonaktif,
    });
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// GET /api/promos/active — list promo yang sedang aktif & dalam periode berlaku
export const getActivePromos = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const result = await getActivePromosService(
      { user_id, role },
      t,
    );

    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil promo aktif');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// GET /api/promos/:id — detail promo
export const getPromoById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const result = await getPromoByIdService(
      req.params['id'] as string,
      { user_id, role },
      t,
    );

    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil detail promo');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// PUT /api/promos/:id — edit promo
export const updatePromo = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await updatePromoService(
      req.params['id'] as string,
      req.body,
      { user_id, role, email },
      t,
    );

    await t.commit();
    sendSuccess(res, result, 'Promo berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// PATCH /api/promos/:id/toggle-active — non-aktifkan / aktifkan promo
export const togglePromoActive = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await togglePromoActiveService(
      req.params['id'] as string,
      { user_id, role, email },
      t,
    );

    await t.commit();
    sendSuccess(res, result, `Status promo berhasil diubah menjadi ${result?.status}`);
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

// DELETE /api/promos/:id — hapus promo (soft delete)
export const deletePromo = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    await deletePromoService(
      req.params['id'] as string,
      { user_id, role, email },
      t,
    );

    await t.commit();
    sendSuccess(res, null, 'Promo berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
