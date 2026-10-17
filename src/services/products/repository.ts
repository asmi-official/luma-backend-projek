import { Transaction, WhereOptions, OrderItem, Op, fn, col } from "sequelize";
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

// hitung jumlah produk aktif & tidak aktif dalam 1 query (GROUP BY active).
// where yang dipakai sama dengan listing tapi tanpa kondisi `active`,
// supaya angka ringkasan tidak ikut terpotong saat user memfilter by active
export const countProductsByActive = async (
  where: WhereOptions,
  t?: Transaction
): Promise<{ total_active: number; total_inactive: number }> => {
  const rows = (await Product.findAll({
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
