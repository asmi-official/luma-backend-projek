import { Transaction, WhereOptions, OrderItem, Op, fn, col } from 'sequelize';
import Promo, { PromoCreationAttributes, PromoStatus } from './model';
import Product from '../products/model';

// kolom produk yang ikut di response promo — secukupnya untuk ditampilkan di list
const PRODUCT_ATTRIBUTES = [
  'id',
  'sku',
  'name',
  'category',
  'category_id',
  'unit',
  'cost_price',
  'sell_price',
  'stock',
  'photo_url',
  'active',
  'promo_discount',
];

// separate: true → produk diambil lewat query terpisah, bukan JOIN langsung.
// ini penting untuk listing berpaginasi: kalau di-JOIN, 1 promo dengan 5 produk
// jadi 5 baris dan limit akan memotong di tengah
const includeProducts = {
  model: Product,
  as: 'products',
  attributes: PRODUCT_ATTRIBUTES,
  separate: true,
  order: [['name', 'ASC']] as OrderItem[],
};

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
    include: [includeProducts],
    distinct: true,
    transaction: t,
  });
};

// hitung jumlah promo per status dalam 1 query (GROUP BY status).
// where-nya sama dengan listing tapi tanpa kondisi `status`, supaya angka ringkasan
// tidak ikut terpotong saat user memfilter by status
export const countPromosByStatus = async (
  where: WhereOptions,
  t?: Transaction,
): Promise<{
  total_promo: number;
  total_aktif: number;
  total_terjadwal: number;
  total_selesai: number;
  total_nonaktif: number;
}> => {
  const rows = (await Promo.findAll({
    where,
    attributes: ['status', [fn('COUNT', col('id')), 'total']],
    group: ['status'],
    raw: true,
    transaction: t,
  })) as unknown as { status: PromoStatus; total: string }[];

  const summary = {
    total_promo: 0,
    total_aktif: 0,
    total_terjadwal: 0,
    total_selesai: 0,
    total_nonaktif: 0,
  };

  for (const row of rows) {
    const total = Number(row.total);
    summary.total_promo += total;

    if (row.status === 'Aktif') summary.total_aktif = total;
    else if (row.status === 'Terjadwal') summary.total_terjadwal = total;
    else if (row.status === 'Selesai') summary.total_selesai = total;
    else if (row.status === 'Nonaktif') summary.total_nonaktif = total;
  }

  return summary;
};

export const findPromoById = async (id: string, t?: Transaction) => {
  return Promo.findByPk(id, {
    include: [includeProducts],
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

/**
 * Cari promo yang SEHARUSNYA berjalan pada tanggal (dan jam) tertentu.
 * Dipakai worker untuk menyelaraskan kolom `status` dengan periode promo.
 *
 * - start_time / end_time OPSIONAL:
 *   diisi  → jam ikut dicek, promo hanya cocok kalau waktunya masuk rentang jam
 *   kosong → cukup tanggal saja, promo berlaku sepanjang hari
 *
 * - promo yang start_time/end_time-nya NULL di DB selalu lolos cek jam,
 *   karena memang berlaku kapan saja sepanjang hari
 *
 * - status `Nonaktif` sengaja DIKECUALIKAN: itu disetel manual oleh user,
 *   worker tidak boleh menghidupkannya kembali
 */
export const findPromosInPeriod = async (
  params: {
    date: string;          // 'YYYY-MM-DD'
    start_time?: string | null;  // 'HH:mm:ss'
    end_time?: string | null;
    owner_id?: string;
  },
  t?: Transaction,
) => {
  const { date, start_time, end_time, owner_id } = params;

  const timeConditions = [];

  // promo yang punya start_time harus sudah lewat jam mulainya
  if (start_time) {
    timeConditions.push({
      [Op.or]: [
        { start_time: null },
        { start_time: { [Op.lte]: start_time } },
      ],
    });
  }

  // promo yang punya end_time belum boleh lewat jam selesainya
  if (end_time) {
    timeConditions.push({
      [Op.or]: [
        { end_time: null },
        { end_time: { [Op.gte]: end_time } },
      ],
    });
  }

  return Promo.findAll({
    where: {
      ...(owner_id && { owner_id }),
      status: { [Op.ne]: 'Nonaktif' },
      start_date: { [Op.lte]: date },
      end_date: { [Op.gte]: date },
      ...(timeConditions.length > 0 && { [Op.and]: timeConditions }),
    },
    order: [['start_date', 'ASC']],
    transaction: t,
  });
};

/**
 * Kebalikannya: promo yang SUDAH TIDAK berjalan pada tanggal tertentu —
 * entah karena belum mulai (start_date > date) atau sudah lewat (end_date < date).
 * Dipakai worker untuk menandai promo jadi `Terjadwal` / `Selesai`.
 *
 * `Nonaktif` juga dikecualikan, dengan alasan yang sama.
 */
export const findPromosOutsidePeriod = async (
  params: { date: string; owner_id?: string },
  t?: Transaction,
) => {
  const { date, owner_id } = params;

  return Promo.findAll({
    where: {
      ...(owner_id && { owner_id }),
      status: { [Op.ne]: 'Nonaktif' },
      [Op.or]: [
        { start_date: { [Op.gt]: date } },
        { end_date: { [Op.lt]: date } },
      ],
    },
    order: [['start_date', 'ASC']],
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
      status: 'Aktif',
      start_date: { [Op.lte]: today },
      end_date: { [Op.gte]: today },
    },
    include: [includeProducts],
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

// ubah status banyak promo sekaligus (1 query UPDATE ... WHERE id IN (...)),
// dipakai worker supaya tidak update satu per satu
export const bulkUpdatePromoStatus = async (
  ids: string[],
  status: PromoStatus,
  updated_by: string,
  t?: Transaction,
) => {
  if (ids.length === 0) return [0];

  return Promo.update(
    { status, updated_by },
    { where: { id: ids }, transaction: t },
  );
};

// ubah status promo (Aktif / Terjadwal / Nonaktif / Selesai)
export const toggleActivePromo = async (
  id: string,
  status: PromoStatus,
  updated_by: string,
  t?: Transaction,
) => {
  return Promo.update({ status, updated_by }, { where: { id }, transaction: t });
};

export const deletePromo = async (
  id: string,
  deleted_by: string,
  t?: Transaction,
) => {
  await Promo.update({ deleted_by }, { where: { id }, transaction: t });
  return Promo.destroy({ where: { id }, transaction: t });
};
