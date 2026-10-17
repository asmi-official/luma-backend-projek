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

// cari semua produk yang saat ini terikat ke 1 promo.
// dipakai saat sync: produk lama yang tidak ada di daftar baru promonya dikosongkan
export const findProductsByPromoId = async (
  promo_id: string,
  owner_id: string,
  t?: Transaction,
) => {
  return Product.findAll({
    where: { promo_id, owner_id },
    transaction: t,
  });
};

// cari produk yang sudah terikat promo LAIN (promo_id terisi & bukan promo ini).
// status promonya dicek terpisah di service, supaya file ini tidak perlu
// meng-import model Promo (menghindari circular import)
export const findProductsWithOtherPromo = async (
  product_ids: string[],
  owner_id: string,
  excludePromoId: string | null,
  t?: Transaction,
) => {
  if (product_ids.length === 0) return [];

  return Product.findAll({
    where: {
      id: product_ids,
      owner_id,
      promo_id: {
        [Op.ne]: null,
        ...(excludePromoId && { [Op.notIn]: [excludePromoId] }),
      },
    },
    transaction: t,
  });
};

// ambil produk untuk banyak promo sekaligus (1 query IN, bukan N+1),
// dipakai saat listing promo supaya tiap promo bisa membawa daftar produknya
export const findProductsByPromoIds = async (
  promo_ids: string[],
  owner_id: string,
  t?: Transaction,
) => {
  if (promo_ids.length === 0) return [];

  return Product.findAll({
    where: { promo_id: promo_ids, owner_id },
    order: [['name', 'ASC']],
    transaction: t,
  });
};

// ambil produk berdasarkan kumpulan id, dibatasi owner (untuk validasi kepemilikan)
export const findProductsByIds = async (
  ids: string[],
  owner_id: string,
  t?: Transaction,
) => {
  if (ids.length === 0) return [];

  return Product.findAll({
    where: { id: ids, owner_id },
    transaction: t,
  });
};

// set promo ke banyak produk sekaligus, nilainya bisa beda-beda per produk
// (harga spesial tiap produk tidak sama).
// pakai bulkCreate + updateOnDuplicate supaya cukup 1 query, bukan N query update.
// promo_id / promo_discount null = melepas promo dari produk itu
export const bulkUpdateProductPromo = async (
  items: { id: string; promo_id: string | null; promo_discount: string | null }[],
  updated_by: string,
  t?: Transaction,
) => {
  if (items.length === 0) return [];

  return Product.bulkCreate(
    items.map((item) => ({
      id: item.id,
      promo_id: item.promo_id,
      promo_discount: item.promo_discount,
      updated_by,
    })) as unknown as ProductCreationAttributes[],
    {
      updateOnDuplicate: ['promo_id', 'promo_discount', 'updated_by'],
      transaction: t,
    },
  );
};

export const deleteProduct = async (
  id: string,
  deleted_by: string,
  t?: Transaction,
) => {
  await Product.update({ deleted_by }, { where: { id }, transaction: t });
  return Product.destroy({ where: { id }, transaction: t });
};
