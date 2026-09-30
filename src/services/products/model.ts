import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

export interface ProductAttributes {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  description?: string | null;
  active: boolean;
  photo_id?: string | null;
  photo_url?: string | null;
  user_id: string;
  owner_id: string;
  company_id?: string | null;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface ProductCreationAttributes
  extends Optional<
    ProductAttributes,
    'id' | 'description' | 'active' | 'photo_id' | 'photo_url' | 'company_id' | 'deleted_at' | 'deleted_by'
  > {}

class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  declare id: string;
  declare sku: string;
  declare name: string;
  declare category: string;
  declare unit: string;
  declare cost_price: number;
  declare sell_price: number;
  declare stock: number;
  declare description: string | null;
  declare active: boolean;
  declare photo_id: string | null;
  declare photo_url: string | null;
  declare user_id: string;
  declare owner_id: string;
  declare company_id: string | null;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

Product.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sku: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
      validate: {
        notNull: { msg: 'Nama produk wajib diisi' },
        notEmpty: { msg: 'Nama produk tidak boleh kosong' },
      },
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: '',
      validate: {
        notNull: { msg: 'Kategori wajib diisi' },
        notEmpty: { msg: 'Kategori tidak boleh kosong' },
      },
    },
    unit: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: '',
      validate: {
        notNull: { msg: 'Satuan wajib diisi' },
        notEmpty: { msg: 'Satuan tidak boleh kosong' },
      },
    },
    cost_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    sell_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    photo_id: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    },
    photo_url: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
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
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
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
    tableName: 'products',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

export default Product;
