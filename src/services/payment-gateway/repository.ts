import { Transaction } from 'sequelize';
import PaymentGateway, {
  PaymentGatewayCreationAttributes,
  PaymentGatewayProvider,
} from './model';

export const createPaymentGateway = async (
  data: PaymentGatewayCreationAttributes,
  t?: Transaction
) => {
  return PaymentGateway.create(data, { transaction: t });
};

// 1 owner hanya punya 1 kredensial per provider, jadi cukup findOne
export const findPaymentGatewayByOwner = async (
  owner_id: string,
  provider: PaymentGatewayProvider,
  t?: Transaction
) => {
  return PaymentGateway.findOne({
    where: { owner_id, provider },
    transaction: t,
  });
};

export const findPaymentGatewayById = async (id: string, t?: Transaction) => {
  return PaymentGateway.findByPk(id, { transaction: t });
};

// ambil banyak gateway sekaligus (1 query IN), dipakai listing payment-methods
export const findPaymentGatewaysByIds = async (ids: string[], t?: Transaction) => {
  if (ids.length === 0) return [];

  return PaymentGateway.findAll({ where: { id: ids }, transaction: t });
};

export const updatePaymentGateway = async (
  owner_id: string,
  provider: PaymentGatewayProvider,
  data: Partial<PaymentGatewayCreationAttributes>,
  t?: Transaction
) => {
  return PaymentGateway.update(data, {
    where: { owner_id, provider },
    transaction: t,
  });
};

// soft delete: deleted_by diisi dulu karena destroy() hanya mengisi deleted_at
export const deletePaymentGateway = async (
  owner_id: string,
  provider: PaymentGatewayProvider,
  deleted_by: string,
  t?: Transaction
) => {
  await PaymentGateway.update(
    { deleted_by },
    { where: { owner_id, provider }, transaction: t }
  );

  return PaymentGateway.destroy({
    where: { owner_id, provider },
    transaction: t,
  });
};
