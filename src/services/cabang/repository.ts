import Cabang, { CabangCreationAttributes } from './model';
import { Transaction, WhereOptions, OrderItem, fn, col } from 'sequelize';

export const findAllCabangs = async (
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t?: Transaction
) => {
  return Cabang.findAndCountAll({
    where,
    order: order.length ? order : [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    transaction: t,
  });
};

export const countCabangsByActive = async (
  where: WhereOptions,
  t?: Transaction
): Promise<{ total_active: number; total_inactive: number }> => {
  const rows = (await Cabang.findAll({
    where,
    attributes: ['active', [fn('COUNT', col('id')), 'total']],
    group: ['active'],
    raw: true,
    transaction: t,
  })) as unknown as { active: boolean; total: string }[];

  let total_active = 0;
  let total_inactive = 0;

  for (const row of rows) {
    if (row.active) total_active = Number(row.total);
    else total_inactive = Number(row.total);
  }

  return { total_active, total_inactive };
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
