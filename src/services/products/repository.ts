import { Transaction, WhereOptions, OrderItem, Op } from "sequelize";
import Product, { ProductCreationAttributes } from "./model";

export const createProduct = async (
  data: ProductCreationAttributes,
  t?: Transaction,
) => {
  return Product.create(data, { transaction: t });
};

export const findAllProducts = async (
  where: WhereOptions,
  order: OrderItem[],
  page: number,
  limit: number,
  t?: Transaction,
) => {
  return Product.findAndCountAll({
    where,
    order: order.length ? order : [["created_at", "DESC"]],
    limit,
    offset: (page - 1) * limit,
    transaction: t,
  });
};

export const findProductById = async (id: string, t?: Transaction) => {
  return Product.findByPk(id, { transaction: t });
};

export const findProductByName = async (
  name: string,
  owner_id: string,
  t?: Transaction,
  excludeId?: string,
) => {
  return Product.findOne({
    where: {
      name: { [Op.iLike]: name },
      owner_id,
      ...(excludeId && { id: { [Op.ne]: excludeId } }),
    },
    transaction: t,
  });
};

export const updateProduct = async (
  id: string,
  data: Partial<ProductCreationAttributes>,
  t?: Transaction,
) => {
  return Product.update(data, { where: { id }, transaction: t });
};

export const deleteProduct = async (
  id: string,
  deleted_by: string,
  t?: Transaction,
) => {
  await Product.update({ deleted_by }, { where: { id }, transaction: t });
  return Product.destroy({ where: { id }, transaction: t });
};
