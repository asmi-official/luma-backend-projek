import { Transaction, WhereOptions, OrderItem, Op } from 'sequelize';
import Promo, { PromoCreationAttributes } from './model';

export const createPromo = async (
  data: PromoCreationAttributes,
  t?: Transaction,
) => {
  return Promo.create(data, { transaction: t });
};

export const findAllPromos = async (
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t?: Transaction,
) => {
  return Promo.findAndCountAll({
    where,
    order: order.length ? order : [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    transaction: t,
  });
};

export const findPromoById = async (id: string, t?: Transaction) => {
  return Promo.findByPk(id, { transaction: t });
};

export const findPromoByCode = async (
  code: string,
  owner_id: string,
  t?: Transaction,
  excludeId?: string,
) => {
  return Promo.findOne({
    where: {
      code: { [Op.iLike]: code },
      owner_id,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });
};

export const findPromoByName = async (
  name: string,
  owner_id: string,
  t?: Transaction,
  excludeId?: string,
) => {
  return Promo.findOne({
    where: {
      name: { [Op.iLike]: name },
      owner_id,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });
};

export const findActivePromos = async (
  owner_id: string,
  t?: Transaction,
) => {
  const today = new Date().toISOString().split('T')[0];
  return Promo.findAll({
    where: {
      owner_id,
      active: true,
      start_date: { [Op.lte]: today },
      end_date: { [Op.gte]: today },
    },
    order: [['created_at', 'DESC']],
    transaction: t,
  });
};

export const updatePromo = async (
  id: string,
  data: Partial<PromoCreationAttributes>,
  t?: Transaction,
) => {
  return Promo.update(data, { where: { id }, transaction: t });
};

// toggle aktif / non-aktif
export const toggleActivePromo = async (
  id: string,
  active: boolean,
  updated_by: string,
  t?: Transaction,
) => {
  return Promo.update({ active, updated_by }, { where: { id }, transaction: t });
};

export const incrementUsageCount = async (
  id: string,
  t?: Transaction,
) => {
  return Promo.increment('usage_count', { by: 1, where: { id }, transaction: t });
};

export const deletePromo = async (
  id: string,
  deleted_by: string,
  t?: Transaction,
) => {
  await Promo.update({ deleted_by }, { where: { id }, transaction: t });
  return Promo.destroy({ where: { id }, transaction: t });
};
