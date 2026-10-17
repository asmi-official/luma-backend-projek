import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

export interface CompanyAttributes {
  id: string;
  company_name: string;
  company_code: string;
  company_cabang: boolean;
  user_id: string;
  owner_id?: string | null;
  header_id?: string | null;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface CompanyCreationAttributes
  extends Optional<CompanyAttributes, 'id' | 'company_cabang' | 'owner_id' | 'header_id' | 'deleted_at' | 'deleted_by'> {}

class Company extends Model<CompanyAttributes, CompanyCreationAttributes> implements CompanyAttributes {
  declare id: string;
  declare company_name: string;
  declare company_code: string;
  declare company_cabang: boolean;
  declare user_id: string;
  declare owner_id: string | null;
  declare header_id: string | null;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

Company.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Nama perusahaan wajib diisi' },
        notEmpty: { msg: 'Nama perusahaan tidak boleh kosong' },
      },
    },
    // kode singkat perusahaan, dipakai sebagai bagian nomor dokumen (SKU, invoice, dll).
    // digenerate acak oleh server (4 karakter A-Z/0-9), bukan dikirim client
    company_code: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        notNull: { msg: 'Kode perusahaan wajib diisi' },
        notEmpty: { msg: 'Kode perusahaan tidak boleh kosong' },
        is: {
          args: /^[A-Z0-9]{4}$/,
          msg: 'Kode perusahaan harus 4 karakter huruf kapital atau angka',
        },
      },
    },
    company_cabang: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: { msg: 'User ID wajib diisi' },
        isUUID: { args: 4, msg: 'User ID harus berupa UUID valid' },
      },
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    header_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Created by wajib diisi' },
        notEmpty: { msg: 'Created by tidak boleh kosong' },
      },
    },
    updated_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: 'Updated by wajib diisi' },
        notEmpty: { msg: 'Updated by tidak boleh kosong' },
      },
    },
    deleted_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    tableName: 'companies',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

export default Company;
