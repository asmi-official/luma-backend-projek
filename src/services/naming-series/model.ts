import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

// modul asal penomoran, contoh: PRODUCT, INVOICE.
// dipakai supaya tiap modul punya counter sendiri walau prefix/tahun/company-nya sama
export type TypeNamingSeries = 'PRODUCT' | 'INVOICE';

export interface NamingSeriesAttributes {
  id: string;
  type_naming_series: TypeNamingSeries;
  owner_id: string;
  prefix: string;
  year: number;
  company_code: string;
  seq: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface NamingSeriesCreationAttributes
  extends Optional<NamingSeriesAttributes, 'id' | 'seq'> {}

class NamingSeries extends Model<NamingSeriesAttributes, NamingSeriesCreationAttributes> implements NamingSeriesAttributes {
  declare id: string;
  declare type_naming_series: TypeNamingSeries;
  declare owner_id: string;
  declare prefix: string;
  declare year: number;
  declare company_code: string;
  declare seq: number;
  declare created_at: Date;
  declare updated_at: Date;
}

NamingSeries.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      // format: TYPE_OWNERID_PREFIX_YEAR_COMPANY_CODE
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: { msg: 'Owner ID wajib diisi' },
        isUUID: { args: 4, msg: 'Owner ID harus berupa UUID valid' },
      },
    },
    type_naming_series: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notNull: { msg: 'Type naming series wajib diisi' },
        notEmpty: { msg: 'Type naming series tidak boleh kosong' },
      },
    },
    prefix: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notNull: { msg: 'Prefix wajib diisi' },
        notEmpty: { msg: 'Prefix tidak boleh kosong' },
      },
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        notNull: { msg: 'Tahun wajib diisi' },
        isInt: { msg: 'Tahun harus berupa angka' },
      },
    },
    company_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        notNull: { msg: 'Kode perusahaan wajib diisi' },
        notEmpty: { msg: 'Kode perusahaan tidak boleh kosong' },
      },
    },
    seq: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        isInt: { msg: 'Sequence harus berupa angka' },
        min: { args: [1], msg: 'Sequence minimal 1' },
      },
    },
  },
  {
    sequelize,
    tableName: 'naming_series',
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default NamingSeries;
