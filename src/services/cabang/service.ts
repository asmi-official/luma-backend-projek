import {
  findAllCabangs,
  findCabangById,
  createCabangRepository,
  updateCabangRepository,
  deleteCabangRepository,
} from './repository';
import { NotFoundError } from '../../utils/app-error';

export const createCabangService = async (payload: any, userInfo: any, transaction?: any) => {
  const { user_id } = userInfo;
  return await createCabangRepository(
    {
      ...payload,
      user_id,
    },
    transaction
  );
};

export const updateCabangService = async (id: string, payload: any, userInfo: any, transaction?: any) => {
  const existing = await findCabangById(id, transaction);
  if (!existing) throw new NotFoundError('Cabang tidak ditemukan');

  return await updateCabangRepository(id, payload, transaction);
};

export const deleteCabangService = async (id: string, deletedBy: string, userInfo: any, transaction?: any) => {
  const existing = await findCabangById(id, transaction);
  if (!existing) throw new NotFoundError('Cabang tidak ditemukan');

  return await deleteCabangRepository(id, deletedBy, transaction);
};
