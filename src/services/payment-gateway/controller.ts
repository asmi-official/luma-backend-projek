import type { Request, Response } from 'express';
import sequelize from '../../databases';
import {
  createPaymentGatewayService,
  getPaymentGatewayService,
  updatePaymentGatewayService,
  deletePaymentGatewayService,
} from './service';
import { sendSuccess, sendCreated } from '../../utils/api-response';
import { handleError } from '../../utils/app-error';

export const createPaymentGateway = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await createPaymentGatewayService(req.body, { user_id, role, email }, t);

    await t.commit();
    sendCreated(res, result, 'Midtrans berhasil dihubungkan');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const getPaymentGateway = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { user_id, role } = req.user!;
    // ?reveal=true → server_key ditampilkan utuh (dipakai tombol mata di form)
    const { reveal } = req.query as { reveal?: string };

    const result = await getPaymentGatewayService({ user_id, role }, t, reveal === 'true');

    await t.commit();
    sendSuccess(res, result, 'Berhasil mengambil status koneksi Midtrans');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const updatePaymentGateway = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    const result = await updatePaymentGatewayService(req.body, { user_id, role, email }, t);

    await t.commit();
    sendSuccess(res, result, 'Credential Midtrans berhasil diupdate');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};

export const deletePaymentGateway = async (req: Request, res: Response): Promise<void> => {
  const t = await sequelize.transaction();
  try {
    const { email, user_id, role } = req.user!;

    await deletePaymentGatewayService({ user_id, role, email }, t);

    await t.commit();
    sendSuccess(res, null, 'Koneksi Midtrans berhasil diputuskan');
  } catch (err) {
    await t.rollback();
    handleError(err, res);
  }
};
