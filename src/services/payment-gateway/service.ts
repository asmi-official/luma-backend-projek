import { Transaction } from 'sequelize';
import {
  createPaymentGateway,
  findPaymentGatewayByOwner,
  updatePaymentGateway,
  deletePaymentGateway,
} from './repository';
import { OWNER_ROLE } from '../users/model';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../../utils/app-error';
import { encrypt, safeDecrypt } from '../../utils/encryption';
import { verifyMidtransCredential } from '../../clients/midtrans';
import PaymentGateway, { PaymentGatewayProvider } from './model';
import { CreatePaymentGatewayInput, UpdatePaymentGatewayInput } from './types';

const DEFAULT_PROVIDER: PaymentGatewayProvider = 'MIDTRANS';

// credential payment gateway hanya boleh diakses oleh role Owner.
// staff/hrd ditolak walau terikat ke owner, karena isinya kunci rahasia pembayaran.
// owner_id tidak pernah dikirim client — selalu user_id milik owner itu sendiri,
// jadi owner tidak bisa menyentuh credential owner lain
const resolveOwnerId = (requester: { user_id: string; role: string }): string => {
  if (requester.role !== OWNER_ROLE) {
    throw new ForbiddenError('Hanya Owner yang dapat mengakses credential payment gateway');
  }

  return requester.user_id;
};

// server_key disembunyikan sebagian saat tidak diminta secara eksplisit,
// supaya kunci rahasia tidak ikut terkirim di setiap pemuatan halaman
const maskSecret = (value: string): string => {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
};

// credential disimpan terenkripsi di DB, jadi di sini didekripsi dulu
// supaya user bisa mencocokkan dengan data di portal Midtrans.
// reveal=true → server_key ikut ditampilkan utuh (dipakai tombol mata di form)
const toResponse = (row: PaymentGateway, reveal = false) => {
  const plain = row.toJSON() as unknown as Record<string, unknown>;
  const serverKey = safeDecrypt(row.server_key);

  return {
    ...plain,
    merchant_id: safeDecrypt(row.merchant_id),
    client_key: safeDecrypt(row.client_key),
    server_key: reveal ? serverKey : maskSecret(serverKey),
  };
};

export const createPaymentGatewayService = async (
  input: CreatePaymentGatewayInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const errors: { field: string; message: string }[] = [];
  if (!input.merchant_id?.trim()) errors.push({ field: 'merchant_id', message: 'Merchant ID wajib diisi' });
  if (!input.client_key?.trim()) errors.push({ field: 'client_key', message: 'Client Key wajib diisi' });
  if (!input.server_key?.trim()) errors.push({ field: 'server_key', message: 'Server Key wajib diisi' });

  if (errors.length > 0) throw new BadRequestError('Validasi gagal', errors);

  const owner_id = resolveOwnerId(requester);

  // 1 owner hanya boleh menghubungkan sekali; selanjutnya wajib lewat update
  const existing = await findPaymentGatewayByOwner(owner_id, DEFAULT_PROVIDER, t);
  if (existing) {
    throw new ConflictError('Midtrans sudah terhubung, gunakan update untuk mengubah credential', [
      { field: 'merchant_id', message: 'Credential Midtrans sudah terdaftar untuk owner ini' },
    ]);
  }

  // credential diuji ke Midtrans dulu; kalau ditolak, tidak ada yang disimpan
  await verifyMidtransCredential(input.server_key.trim());

  // credential dienkripsi sebelum masuk DB, didekripsi lagi saat ditampilkan
  const created = await createPaymentGateway(
    {
      provider: DEFAULT_PROVIDER,
      merchant_id: encrypt(input.merchant_id.trim()),
      client_key: encrypt(input.client_key.trim()),
      server_key: encrypt(input.server_key.trim()),
      is_connected: true,
      user_id: requester.user_id,
      owner_id,
      created_by: requester.email,
      updated_by: requester.email,
    },
    t
  );

  return toResponse(created);
};

// dipakai halaman Metode Pembayaran untuk tahu apakah perlu menampilkan
// peringatan "Midtrans belum terhubung" dan mengunci toggle
export const getPaymentGatewayService = async (
  requester: { user_id: string; role: string },
  t: Transaction,
  reveal = false
) => {
  const owner_id = resolveOwnerId(requester);
  const row = await findPaymentGatewayByOwner(owner_id, DEFAULT_PROVIDER, t);

  // belum pernah dihubungkan bukan error — UI butuh tahu statusnya
  if (!row) {
    return {
      provider: DEFAULT_PROVIDER,
      is_connected: false,
      merchant_id: null,
      client_key: null,
      server_key: null,
    };
  }

  return toResponse(row, reveal);
};

export const updatePaymentGatewayService = async (
  input: UpdatePaymentGatewayInput,
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const owner_id = resolveOwnerId(requester);

  const existing = await findPaymentGatewayByOwner(owner_id, DEFAULT_PROVIDER, t);
  if (!existing) {
    throw new NotFoundError('Credential Midtrans belum terhubung');
  }

  // server key baru wajib lolos tes koneksi dulu sebelum menimpa yang lama
  const newServerKey = input.server_key?.trim();
  if (newServerKey) {
    await verifyMidtransCredential(newServerKey);
  }

  // field diambil eksplisit (bukan ...input) supaya owner_id/user_id/provider
  // tidak bisa ikut tertimpa lewat body request.
  // string kosong diabaikan: dianggap "tidak diubah", bukan "dikosongkan"
  const payload: Record<string, unknown> = { updated_by: requester.email };

  if (input.merchant_id?.trim()) payload['merchant_id'] = encrypt(input.merchant_id.trim());
  if (input.client_key?.trim()) payload['client_key'] = encrypt(input.client_key.trim());
  if (newServerKey) {
    payload['server_key'] = encrypt(newServerKey);
    // server key baru sudah terbukti valid barusan
    payload['is_connected'] = true;
  }
  if (input.is_connected !== undefined) payload['is_connected'] = input.is_connected;

  await updatePaymentGateway(owner_id, DEFAULT_PROVIDER, payload, t);

  const updated = await findPaymentGatewayByOwner(owner_id, DEFAULT_PROVIDER, t);
  return toResponse(updated!);
};

export const deletePaymentGatewayService = async (
  requester: { user_id: string; role: string; email: string },
  t: Transaction
) => {
  const owner_id = resolveOwnerId(requester);

  const existing = await findPaymentGatewayByOwner(owner_id, DEFAULT_PROVIDER, t);
  if (!existing) {
    throw new NotFoundError('Credential Midtrans belum terhubung');
  }

  await deletePaymentGateway(owner_id, DEFAULT_PROVIDER, requester.email, t);
};
