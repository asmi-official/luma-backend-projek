import { col, fn, Op, OrderItem, Transaction, WhereOptions } from 'sequelize';
import Cabang from '../cabang/model';
import Karyawan, { KaryawanCreationAttributes } from './model';

const includeBranch = {
  model: Cabang,
  as: 'branch',
  attributes: ['id', 'name'],
  required: false,
};

export const createKaryawan = async (
  data: KaryawanCreationAttributes,
  t: Transaction,
) => Karyawan.create(data, { transaction: t });

export const findAllKaryawans = async (
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t: Transaction,
) =>
  Karyawan.findAndCountAll({
    where,
    include: [includeBranch],
    distinct: true,
    order: order.length ? order : [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    transaction: t,
  });

export const findKaryawanById = async (id: string, t: Transaction) =>
  Karyawan.findByPk(id, { include: [includeBranch], transaction: t });

export const findKaryawanByUserId = async (userId: string, t?: Transaction) =>
  Karyawan.findOne({ where: { user_id: userId }, transaction: t });

export const findKaryawanByEmployeeId = async (
  ownerId: string,
  employeeId: string,
  t: Transaction,
  excludeId?: string,
) =>
  Karyawan.findOne({
    where: {
      owner_id: ownerId,
      employee_id: { [Op.iLike]: employeeId },
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });

export const findKaryawanByEmail = async (
  ownerId: string,
  email: string,
  t: Transaction,
  excludeId?: string,
) =>
  Karyawan.findOne({
    where: {
      owner_id: ownerId,
      email: { [Op.iLike]: email },
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });

export const updateKaryawan = async (
  id: string,
  data: Partial<KaryawanCreationAttributes>,
  t: Transaction,
) => Karyawan.update(data, { where: { id }, transaction: t });

export const deleteKaryawan = async (
  id: string,
  deletedBy: string,
  t: Transaction,
) => {
  await Karyawan.update({ deleted_by: deletedBy }, { where: { id }, transaction: t });
  return Karyawan.destroy({ where: { id }, transaction: t });
};

export const touchKaryawanLastLogin = async (userId: string, t: Transaction) =>
  Karyawan.update(
    { last_login: new Date() },
    { where: { user_id: userId }, transaction: t },
  );

export const countKaryawansByActive = async (
  where: WhereOptions,
  t: Transaction,
): Promise<{ total_active: number; total_inactive: number }> => {
  const rows = (await Karyawan.findAll({
    where,
    attributes: ['active', [fn('COUNT', col('id')), 'total']],
    group: ['active'],
    raw: true,
    transaction: t,
  })) as unknown as { active: boolean; total: string }[];

  return rows.reduce(
    (summary, row) => {
      if (row.active) summary.total_active = Number(row.total);
      else summary.total_inactive = Number(row.total);
      return summary;
    },
    { total_active: 0, total_inactive: 0 },
  );
};
