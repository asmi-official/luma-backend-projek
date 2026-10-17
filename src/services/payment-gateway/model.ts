import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../databases';

// provider payment gateway yang didukung. ditambah di sini kalau nanti ada provider lain
export type PaymentGatewayProvider = 'MIDTRANS';

export interface PaymentGatewayAttributes {
  id: string;
  provider: PaymentGatewayProvider;
  merchant_id: string;
  client_key: string;
  server_key: string;
  is_connected: boolean;
  user_id: string;
  owner_id: string;
  created_at?: Date;
  created_by: string;
  updated_at?: Date;
  updated_by: string;
  deleted_at?: Date | null;
  deleted_by?: string | null;
}

export interface PaymentGatewayCreationAttributes
  extends Optional<
    PaymentGatewayAttributes,
    'id' | 'provider' | 'is_connected' | 'deleted_at' | 'deleted_by'
  > {}

class PaymentGateway
  extends Model<PaymentGatewayAttributes, PaymentGatewayCreationAttributes>
  implements PaymentGatewayAttributes
{
  declare id: string;
  declare provider: PaymentGatewayProvider;
  declare merchant_id: string;
  declare client_key: string;
  declare server_key: string;
  declare is_connected: boolean;
  declare user_id: string;
  declare owner_id: string;
  declare created_at: Date;
  declare created_by: string;
  declare updated_at: Date;
  declare updated_by: string;
  declare deleted_at: Date | null;
  declare deleted_by: string | null;
}

PaymentGateway.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    provider: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'MIDTRANS',
      validate: {
        notNull: { msg: 'Provider wajib diisi' },
        notEmpty: { msg: 'Provider tidak boleh kosong' },
      },
    },
    // ketiga credential disimpan TERENKRIPSI (AES-256-GCM), bukan plain text.
    // pakai TEXT karena ciphertext jauh lebih panjang dari nilai aslinya
    merchant_id: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notNull: { msg: 'Merchant ID wajib diisi' },
        notEmpty: { msg: 'Merchant ID tidak boleh kosong' },
      },
    },
    client_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notNull: { msg: 'Client Key wajib diisi' },
        notEmpty: { msg: 'Client Key tidak boleh kosong' },
      },
    },
    server_key: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notNull: { msg: 'Server Key wajib diisi' },
        notEmpty: { msg: 'Server Key tidak boleh kosong' },
      },
    },
    // penanda kredensial sudah terisi & siap dipakai; dipakai UI untuk
    // menampilkan peringatan "Midtrans belum terhubung" dan mengunci toggle metode pembayaran
    is_connected: {
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
      allowNull: false,
      validate: {
        notNull: { msg: 'Owner ID wajib diisi' },
        isUUID: { args: 4, msg: 'Owner ID harus berupa UUID valid' },
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
    tableName: 'payment_gateways',
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      {
        // 1 owner hanya boleh punya 1 kredensial per provider.
        // nama index ditulis manual & pendek supaya tidak kena batas 63 karakter postgres
        name: 'payment_gateways_owner_provider_unique',
        unique: true,
        fields: ['owner_id', 'provider'],
        where: { deleted_at: null },
      },
    ],
  }
);

export default PaymentGateway;
