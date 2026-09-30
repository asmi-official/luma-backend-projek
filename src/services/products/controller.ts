import type { Request, Response } from 'express';
import sequelize from '../../databases';
import {
  createProductService,
  getAllProductsService,
  getProductByIdService,
  updateProductService,
  deleteProductService,
} from './service';
import { sendSuccess, sendCreated, sendPaginated, parsePagination } from '../../utils/api-response';
import { handleError } from '../../utils/app-error';
import { parseFilterQuery, parseSortQuery, buildWhereFromFilters, buildOrderFromSort } from '../../utils/query-filter';

const PRODUCT_FILTERABLE_KEYS = [
  'id',
  'sku',
  'name',
  'category',
  'unit',
  'cost_price',
  'sell_price',
  'stock',
  'description',
  'active',
  'user_id',
  'owner_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

const buildProductQueryOptions = (req: Request) => {
  const { filter, sort, order: orderDirection } = req.query as { filter?: string; sort?: string; order?: string };
  const filters = parseFilterQuery(filter);
  const sortCondition = parseSortQuery(sort, orderDirection);

  return {
    where: buildWhereFromFilters(filters, PRODUCT_FILTERABLE_KEYS),
    order: buildOrderFromSort(sortCondition, PRODUCT_FILTERABLE_KEYS),
  };
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await createProductService(
      req.body,
      { user_id, role, email },
      t,
      req.file
    );

    await t.commit();
    sendCreated(res, result, 'Produk berhasil dibuat');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const { where, order } = buildProductQueryOptions(req);
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);

    const { rows, count } = await getAllProductsService(
      { user_id, role },
      where,
      order,
      page,
      limit,
      t
    );

    await t.commit();
    sendPaginated(res, rows, count, { page, limit }, 'Berhasil mengambil data produk');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    const result = await getProductByIdService(
      req.params['id'] as string,
      { user_id, role },
      t
    );

    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil detail produk');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await updateProductService(
      req.params['id'] as string,
      req.body,
      { user_id, role, email },
      t,
      req.file
    );

    await t.commit();
    sendSuccess(res, result, 'Produk berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    await deleteProductService(
      req.params['id'] as string,
      { user_id, role, email },
      t
    );

    await t.commit();
    sendSuccess(res, null, 'Produk berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
