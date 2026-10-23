import type { Request, Response } from 'express';
import sequelize from '../../databases';
import { handleError } from '../../utils/app-error';
import { parsePagination, sendCreated, sendPaginated, sendSuccess } from '../../utils/api-response';
import {
  createKaryawanService,
  deleteKaryawanService,
  getAllKaryawansService,
  getKaryawanByIdService,
  resetKaryawanPasswordService,
  toggleKaryawanActiveService,
  updateKaryawanService,
} from './service';
import type {
  CreateKaryawanInput,
  KaryawanListQuery,
  ResetKaryawanPasswordInput,
  UpdateKaryawanInput,
} from './types';

const requesterFrom = (req: Request) => {
  const { user_id, role, email } = req.user!;
  return { user_id, role, email };
};

export const createKaryawan = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await createKaryawanService(
      req.body as CreateKaryawanInput,
      requesterFrom(req),
      t,
    );
    await t.commit();
    sendCreated(res, result, 'Karyawan berhasil ditambahkan');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getAllKaryawans = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { page, limit } = parsePagination(req.query as Record<string, unknown>);
    const { rows, count, total_active, total_inactive } = await getAllKaryawansService(
      req.query as KaryawanListQuery,
      requesterFrom(req),
      page,
      limit,
      t,
    );
    await t.commit();
    sendPaginated(res, rows, count, { page, limit }, 'Berhasil mengambil data karyawan', {
      total_active,
      total_inactive,
    });
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getKaryawanById = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await getKaryawanByIdService(
      req.params['id'] as string,
      requesterFrom(req),
      t,
    );
    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil detail karyawan');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updateKaryawan = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await updateKaryawanService(
      req.params['id'] as string,
      req.body as UpdateKaryawanInput,
      requesterFrom(req),
      t,
    );
    await t.commit();
    sendSuccess(res, result, 'Karyawan berhasil diubah');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const toggleKaryawanActive = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const result = await toggleKaryawanActiveService(
      req.params['id'] as string,
      requesterFrom(req),
      t,
    );
    await t.commit();
    sendSuccess(
      res,
      result,
      result.active ? 'Karyawan berhasil diaktifkan' : 'Karyawan berhasil dinonaktifkan',
    );
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const resetKaryawanPassword = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    await resetKaryawanPasswordService(
      req.params['id'] as string,
      req.body as ResetKaryawanPasswordInput,
      requesterFrom(req),
      t,
    );
    await t.commit();
    sendSuccess(res, null, 'Password karyawan berhasil diubah');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deleteKaryawan = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    await deleteKaryawanService(req.params['id'] as string, requesterFrom(req), t);
    await t.commit();
    sendSuccess(res, null, 'Karyawan berhasil dihapus');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
