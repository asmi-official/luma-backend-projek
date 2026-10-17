import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

// 3 tipe promo sesuai Figma:
// - percentage  : Diskon Persentase (contoh: 10%)
// - fixed       : Diskon Nominal (contoh: Rp 50.000)
// - special_price : Harga Spesial (harga tetap khusus, contoh: Rp 100.000)
export type DiscountType = 'percentage' | 'fixed' | 'special_price';

// status promo:
// - Aktif      : sedang berjalan
// - Terjadwal  : belum mulai, menunggu tanggal mulai
// - Nonaktif   : dimatikan manual
// - Selesai    : masa berlakunya sudah lewat
export type PromoStatus = 'Aktif' | 'Terjadwal' | 'Nonaktif' | 'Selesai';

export const PROMO_STATUSES: PromoStatus[] = ['Aktif', 'Terjadwal', 'Nonaktif', 'Selesai'];

// kolom DECIMAL dikembalikan Sequelize sebagai string supaya presisi tidak hilang,
// jadi tipenya string — bukan number
export interface PromoAttributes {
  id: string;
  name: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: string;          // percentage → nilai %, fixed → nominal, special_price → harga tetap
  discount_text?: string | null;        // label diskon yang ditampilkan, contoh: 'Diskon 20%'
  discount_description?: string | null;  // keterangan tambahan soal diskonnya
  start_date: string;              // DATEONLY → 'YYYY-MM-DD'
  end_date: string;
  start_time?: string | null;      // TIME → 'HH:mm:ss', null = tanpa batas jam
  end_time?: string | null;
  status: PromoStatus;
  user_id: string;
  owner_id: string;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface PromoCreationAttributes
  extends Optional<
    PromoAttributes,
    | 'id'
    | 'description'
    | 'discount_text'
    | 'discount_description'
    | 'start_time'
    | 'end_time'
    | 'status'
    | 'deleted_at'
    | 'deleted_by'
  > {}

class Promo extends Model<PromoAttributes, PromoCreationAttributes> implements PromoAttributes {
  declare id: string;
  declare name: string;
  declare description: string | null;
  declare discount_type: DiscountType;
  declare discount_value: string;
  declare start_date: string;
  declare end_date: string;
  declare discount_text: string | null;
  declare discount_description: string | null;
  declare start_time: string | null;
  declare end_time: string | null;
  declare status: PromoStatus;
  declare user_id: string;
  declare owner_id: string;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;

  // dipanggil loader di databases/index.ts setelah semua model ter-import.
  // model diakses lewat parameter `models`, bukan import, supaya tidak circular
  static associate(models: Record<string, any>): void {
    // constraints: false → asosiasi hanya dipakai untuk include/query,
    // foreign key-nya dikelola manual di DB. sync({ alter: true }) gagal
    // membuat FK di postgres (syntax error at or near "REFERENCES")
    Promo.hasMany(models['Product'], {
      foreignKey: 'promo_id',
      sourceKey: 'id',
      as: 'products',
      constraints: false,
    });
  }
}

Promo.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
      validate: {
        notNull: { msg: 'Nama promo wajib diisi' },
        notEmpty: { msg: 'Nama promo tidak boleh kosong' },
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    // pakai STRING + isIn, bukan ENUM: menambah nilai ENUM baru lewat
    // sync({ alter: true }) sering gagal di postgres
    discount_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notNull: { msg: 'Tipe diskon wajib diisi' },
        isIn: {
          args: [['percentage', 'fixed', 'special_price']],
          msg: "Tipe diskon harus 'percentage', 'fixed', atau 'special_price'",
        },
      },
    },
    discount_value: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        notNull: { msg: 'Nilai diskon wajib diisi' },
        min: { args: [0], msg: 'Nilai diskon tidak boleh negatif' },
      },
    },
    // label & keterangan diskon untuk ditampilkan di UI
    discount_text: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    discount_description: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Tanggal mulai wajib diisi' },
        isDate: { args: true, msg: 'Format tanggal mulai tidak valid' },
      },
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      validate: {
        notNull: { msg: 'Tanggal selesai wajib diisi' },
        isDate: { args: true, msg: 'Format tanggal selesai tidak valid' },
      },
    },
    // jam berlaku promo dalam 1 hari. null = berlaku kapan saja sepanjang hari
    start_time: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: null,
    },
    end_time: {
      type: DataTypes.TIME,
      allowNull: true,
      defaultValue: null,
    },
    // pakai STRING + isIn, bukan ENUM: menambah nilai ENUM baru lewat
    // sync({ alter: true }) sering gagal di postgres
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'Terjadwal',
      validate: {
        notNull: { msg: 'Status wajib diisi' },
        isIn: {
          args: [PROMO_STATUSES],
          msg: `Status harus salah satu dari: ${PROMO_STATUSES.join(', ')}`,
        },
      },
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: '00000000-0000-0000-0000-000000000000',
      validate: {
        notNull: { msg: 'User ID wajib diisi' },
        isUUID: { args: 4, msg: 'User ID harus berupa UUID valid' },
      },
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: '00000000-0000-0000-0000-000000000000',
      validate: {
        notNull: { msg: 'Owner ID wajib diisi' },
        isUUID: { args: 4, msg: 'Owner ID harus berupa UUID valid' },
      },
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    updated_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    deleted_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'promos',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

export default Promo;
