import Cabang, { CabangCreationAttributes } from './model';
import { Transaction, WhereOptions } from 'sequelize';

export const findAllCabangs = async (where: WhereOptions, order: any[], t?: Transaction) => {
  const result = await Cabang.findAndCountAll({
    where,
    order: order.length ? order : [['created_at', 'DESC']],
    transaction: t,
  });

  return {
    status: 'success',
    message: 'Berhasil mengambil data cabang',
    data: result.rows,
    meta: {
      total: result.count,
    },
  };
};

export const findCabangById = async (id: string, t?: Transaction) => {
  return await Cabang.findByPk(id, { transaction: t });
};

export const createCabangRepository = async (data: CabangCreationAttributes, t?: Transaction) => {
  return await Cabang.create(data, { transaction: t });
};

export const updateCabangRepository = async (id: string, data: Partial<CabangCreationAttributes>, t?: Transaction) => {
  const cabang = await findCabangById(id, t);
  if (!cabang) return null;

  await cabang.update(data, { transaction: t });
  return cabang;
};

export const deleteCabangRepository = async (id: string, deletedBy: string, t?: Transaction) => {
  const cabang = await findCabangById(id, t);
  if (!cabang) return null;

  cabang.deleted_by = deletedBy;
  await cabang.save({ transaction: t });
  await cabang.destroy({ transaction: t });

  return true;
};
