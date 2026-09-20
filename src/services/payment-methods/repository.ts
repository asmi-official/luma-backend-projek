import { Transaction, WhereOptions, OrderItem, Op } from 'sequelize';
import PaymentMethod, { PaymentMethodCreationAttributes } from './model';

export const createPaymentMethod = async (
  data: PaymentMethodCreationAttributes,
  t?: Transaction
) => {
  return PaymentMethod.create(data, { transaction: t });
};

export const findAllPaymentMethods = async (
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t?: Transaction
) => {
  return PaymentMethod.findAndCountAll({
    where,
    order: order.length ? order : [['created_at', 'DESC']],
    limit,
    offset: (page - 1) * limit,
    transaction: t,
  });
};

export const findPaymentMethodById = async (id: string, t?: Transaction) => {
  return PaymentMethod.findByPk(id, { transaction: t });
};

export const findDuplicatePaymentMethod = async (
  owner_id: string,
  key_payment_param_id: string,
  method_payment_param_id: string,
  t?: Transaction,
  excludeId?: string
) => {
  return PaymentMethod.findOne({
    where: {
      owner_id,
      key_payment_param_id,
      method_payment_param_id,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });
};

export const updatePaymentMethod = async (
  id: string,
  data: Partial<PaymentMethodCreationAttributes>,
  t?: Transaction
) => {
  return PaymentMethod.update(data, { where: { id }, transaction: t });
};

export const deletePaymentMethod = async (
  id: string,
  deleted_by: string,
  t?: Transaction
) => {
  await PaymentMethod.update(
    { deleted_by },
    { where: { id }, transaction: t }
  );

  return PaymentMethod.destroy({ where: { id }, transaction: t });
};
