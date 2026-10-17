import type { Request, Response } from 'express';
import sequelize from '../../databases';
import { createCompanyService, updateCompanyService, deleteCompanyService } from './service';
import { findAllCompanies, findCompanyById } from './repository';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { handleError, NotFoundError, ForbiddenError } from '../../utils/app-error';
import { parseFilterQuery, parseSortQuery, buildWhereFromFilters, buildOrderFromSort } from '../../utils/query-filter';
import { OWNER_ROLE } from '../users/model';

const COMPANY_FILTERABLE_KEYS = [
  'id',
  'company_name',
  'company_code',
  'company_cabang',
  'user_id',
  'header_id',
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

const buildCompanyQueryOptions = (req: Request) => {
  const { filter, sort, order: orderDirection } = req.query as { filter?: string; sort?: string; order?: string };
  const filters = parseFilterQuery(filter);
  const sortCondition = parseSortQuery(sort, orderDirection);

  return {
    where: buildWhereFromFilters(filters, COMPANY_FILTERABLE_KEYS),
    order: buildOrderFromSort(sortCondition, COMPANY_FILTERABLE_KEYS),
  };
};

export const createCompany = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    if (role !== OWNER_ROLE) {
      throw new ForbiddenError('Hanya owner yang dapat membuat company');
    }

    const result = await createCompanyService({
      ...req.body,
      user_id,
      created_by: email,
      updated_by: email,
    }, { user_id, role }, t);

    await t.commit();
    sendCreated(res, result, 'Company berhasil dibuat');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getAllCompanies = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { where, order } = buildCompanyQueryOptions(req);
    const result = await findAllCompanies(where, order, t);
    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil data companies');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getCompanyById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await findCompanyById(req.params['id'] as string, t);
    if (!result) throw new NotFoundError('Company tidak ditemukan');
    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil company');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await updateCompanyService(
      req.params['id'] as string,
      { ...req.body, updated_by: email },
      { user_id, role },
      t
    );

    await t.commit();
    sendSuccess(res, result, 'Company berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deleteCompany = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email } = req.user!;

    await deleteCompanyService(req.params['id'] as string, email, t);

    await t.commit();
    sendSuccess(res, null, 'Company berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
