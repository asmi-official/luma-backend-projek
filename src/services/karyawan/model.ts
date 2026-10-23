import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

export interface KaryawanAttributes {
  id: string;
  user_id?: string | null;
  owner_id: string;
  branch_id: string;
  name: string;
  email: string;
  phone: string;
  employee_id: string;
  role: string;
  active: boolean;
  last_login?: Date | null;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface KaryawanCreationAttributes
  extends Optional<
    KaryawanAttributes,
    | 'id'
    | 'user_id'
    | 'active'
    | 'last_login'
    | 'deleted_at'
    | 'deleted_by'
  > {}

class Karyawan
  extends Model<KaryawanAttributes, KaryawanCreationAttributes>
  implements KaryawanAttributes
{
  declare id: string;
  declare user_id: string | null;
  declare owner_id: string;
  declare branch_id: string;
  declare name: string;
  declare email: string;
  declare phone: string;
  declare employee_id: string;
  declare role: string;
  declare active: boolean;
  declare last_login: Date | null;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;

  static associate(models: Record<string, any>): void {
    Karyawan.belongsTo(models['Cabang'], {
      foreignKey: 'branch_id',
      targetKey: 'id',
      as: 'branch',
      constraints: false,
    });
  }
}

Karyawan.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: { notNull: { msg: 'Owner ID wajib diisi' } },
    },
    branch_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: { notNull: { msg: 'Cabang wajib diisi' } },
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Nama lengkap wajib diisi' },
        notEmpty: { msg: 'Nama lengkap tidak boleh kosong' },
      },
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Email wajib diisi' },
        isEmail: { msg: 'Format email tidak valid' },
      },
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notNull: { msg: 'Nomor HP wajib diisi' },
        is: { args: /^\d{10,15}$/, msg: 'Nomor HP harus 10-15 digit angka' },
      },
    },
    employee_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notNull: { msg: 'ID karyawan wajib diisi' },
        notEmpty: { msg: 'ID karyawan tidak boleh kosong' },
      },
    },
    role: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notNull: { msg: 'Role wajib diisi' },
        notEmpty: { msg: 'Role tidak boleh kosong' },
      },
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    last_login: {
      type: DataTypes.DATE,
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
    tableName: 'karyawans',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      { unique: true, fields: ['owner_id', 'employee_id'] },
      { unique: true, fields: ['owner_id', 'email'] },
      { unique: true, fields: ['user_id'] },
      { fields: ['owner_id', 'active'] },
      { fields: ['owner_id', 'branch_id'] },
    ],
  },
);

export default Karyawan;
