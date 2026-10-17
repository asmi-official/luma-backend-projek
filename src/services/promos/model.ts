import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

// 3 tipe promo sesuai Figma:
// - percentage  : Diskon Persentase (contoh: 10%)
// - fixed       : Diskon Nominal (contoh: Rp 50.000)
// - special_price : Harga Spesial (harga tetap khusus, contoh: Rp 100.000)
export type DiscountType = 'percentage' | 'fixed' | 'special_price';

export interface PromoAttributes {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  discount_type: DiscountType;
  discount_value: number;       // untuk percentage → nilai %, untuk fixed → nominal potongan
  special_price?: number | null; // harga spesial (hanya diisi jika discount_type = 'special_price')
  min_purchase: number;
  max_discount?: number | null;  // batas maksimal diskon (relevan untuk percentage)
  start_date: Date;
  end_date: Date;
  usage_limit?: number | null;
  usage_count: number;
  active: boolean;
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
    | 'special_price'
    | 'min_purchase'
    | 'max_discount'
    | 'usage_limit'
    | 'usage_count'
    | 'active'
    | 'deleted_at'
    | 'deleted_by'
  > {}

class Promo extends Model<PromoAttributes, PromoCreationAttributes> implements PromoAttributes {
  declare id: string;
  declare code: string;
  declare name: string;
  declare description: string | null;
  declare discount_type: DiscountType;
  declare discount_value: number;
  declare special_price: number | null;
  declare min_purchase: number;
  declare max_discount: number | null;
  declare start_date: Date;
  declare end_date: Date;
  declare usage_limit: number | null;
  declare usage_count: number;
  declare active: boolean;
  declare user_id: string;
  declare owner_id: string;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

Promo.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
      validate: {
        notNull: { msg: 'Kode promo wajib diisi' },
        notEmpty: { msg: 'Kode promo tidak boleh kosong' },
      },
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
    discount_type: {
      type: DataTypes.ENUM('percentage', 'fixed', 'special_price'),
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
    special_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    },
    min_purchase: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: { args: [0], msg: 'Minimal pembelian tidak boleh negatif' },
      },
    },
    max_discount: {
      type: DataTypes.DECIMAL(12, 2),
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
    usage_limit: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: null,
    },
    usage_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
