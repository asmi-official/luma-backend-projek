import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../databases";

export interface CabangAttributes {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  manager_name?: string | null;
  active: boolean;
  user_id: string;
  owner_id?: string | null;
  company_id?: string | null;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface CabangCreationAttributes extends Optional<
  CabangAttributes,
  | "id"
  | "address"
  | "phone"
  | "email"
  | "manager_name"
  | "active"
  | "owner_id"
  | "company_id"
  | "deleted_at"
  | "deleted_by"
> {}

class Cabang
  extends Model<CabangAttributes, CabangCreationAttributes>
  implements CabangAttributes
{
  declare id: string;
  declare name: string;
  declare code: string;
  declare address: string | null;
  declare phone: string | null;
  declare email: string | null;
  declare manager_name: string | null;

  declare active: boolean;
  declare user_id: string;
  declare owner_id: string | null;
  declare company_id: string | null;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

Cabang.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notNull: { msg: "Nama cabang wajib diisi" },
        notEmpty: { msg: "Nama cabang tidak boleh kosong" },
      },
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: {
        name: "cabang_code_unique",
        msg: "Kode cabang sudah terdaftar",
      },
      validate: {
        notNull: { msg: "Kode cabang wajib diisi" },
        notEmpty: { msg: "Kode cabang tidak boleh kosong" },
      },
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: { msg: "Format email tidak valid" },
      },
    },
    manager_name: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    updated_by: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deleted_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "cabangs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    paranoid: true,
    deletedAt: "deleted_at",
  },
);

export default Cabang;
