import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

export interface PaymentMethodAttributes {
  id: string;
  user_id: string;
  owner_id: string;
  active: boolean;
  key_payment_param_id?: string | null;
  payment_gateway_id: string;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface PaymentMethodCreationAttributes
  extends Optional<
    PaymentMethodAttributes,
    'id' | 'active' | 'key_payment_param_id' | 'deleted_at' | 'deleted_by'
  > {}

class PaymentMethod
  extends Model<PaymentMethodAttributes, PaymentMethodCreationAttributes>
  implements PaymentMethodAttributes
{
  declare id: string;
  declare user_id: string;
  declare owner_id: string;
  declare active: boolean;
  declare key_payment_param_id: string | null;
  declare payment_gateway_id: string;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

PaymentMethod.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
      allowNull: false,
      validate: {
        notNull: { msg: 'Owner ID wajib diisi' },
        isUUID: { args: 4, msg: 'Owner ID harus berupa UUID valid' },
      },
    },
    // default false: metode pembayaran dibuat dalam keadaan non-aktif dulu,
    // baru diaktifkan lewat update setelah konfigurasinya siap
    active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    key_payment_param_id: {
      type: DataTypes.UUID,
      allowNull: true,
      defaultValue: null,
      validate: {
        isUUID: { args: 4, msg: 'Key payment param ID harus berupa UUID valid' },
      },
    },
    // FK ke payment_gateways: metode pembayaran ini diproses lewat gateway mana
    payment_gateway_id: {
      type: DataTypes.UUID,
      allowNull: false,
      validate: {
        notNull: { msg: 'Payment gateway ID wajib diisi' },
        isUUID: { args: 4, msg: 'Payment gateway ID harus berupa UUID valid' },
      },
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
    tableName: 'payment_methods',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      {
        // nama index dibuat manual & pendek supaya tidak melebihi batas 63 karakter postgres.
        // kalau terpotong, sync({ alter: true }) akan menganggap index belum ada
        // dan mencoba membuatnya lagi setiap restart
        name: 'payment_methods_owner_key_gateway_unique',
        unique: true,
        fields: ['owner_id', 'key_payment_param_id', 'payment_gateway_id'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default PaymentMethod;
