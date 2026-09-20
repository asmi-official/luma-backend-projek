import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

// nilai role khusus/reserved untuk pemilik grup usaha, wajib persis 'Owner' (kapital)
export const OWNER_ROLE = 'Owner';

export interface UserAttributes {
  id: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  role: string; // FK ke flex_params
  full_name: string;
  photo_id: string | null;
  photo_url: string | null;
  agree: boolean;
  company_id?: string | null;
  header_id?: string | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

export interface UserCreationAttributes
  extends Optional<UserAttributes, 'id' | 'photo_id' | 'photo_url' | 'company_id' | 'header_id' | 'deleted_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string;
  declare username: string;
  declare email: string;
  declare phone: string;
  declare password: string;
  declare role: string;
  declare full_name: string;
  declare photo_id: string | null;
  declare photo_url: string | null;
  declare agree: boolean;
  declare company_id: string | null;
  declare header_id: string | null;
  declare created_at: Date;
  declare updated_at: Date;
  declare deleted_at: Date | null;
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Username wajib diisi' },
        notEmpty: { msg: 'Username tidak boleh kosong' },
        len: { args: [3, 50], msg: 'Username harus antara 3-50 karakter' },
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Email wajib diisi' },
        notEmpty: { msg: 'Email tidak boleh kosong' },
        isEmail: { msg: 'Format email tidak valid' },
      },
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        notNull: { msg: 'Nomor telepon wajib diisi' },
        notEmpty: { msg: 'Nomor telepon tidak boleh kosong' },
        isNumeric: { msg: 'Nomor telepon hanya boleh angka' },
        len: { args: [10, 15], msg: 'Nomor telepon harus antara 10-15 digit' },
      },
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Password wajib diisi' },
        notEmpty: { msg: 'Password tidak boleh kosong' },
        len: { args: [8, 255], msg: 'Password minimal 8 karakter' },
      },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'user',
      validate: {
        notNull: { msg: 'Role wajib diisi' },
        notEmpty: { msg: 'Role tidak boleh kosong' },
      },
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: { msg: 'Nama lengkap wajib diisi' },
        notEmpty: { msg: 'Nama lengkap tidak boleh kosong' },
        len: { args: [2, 100], msg: 'Nama lengkap harus antara 2-100 karakter' },
      },
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
    agree: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      validate: {
        notNull: { msg: 'Persetujuan syarat dan ketentuan wajib diisi' },
        isTrue(value: boolean) {
          if (value !== true) {
            throw new Error('Anda harus menyetujui syarat dan ketentuan');
          }
        },
      },
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    header_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

export default User;
