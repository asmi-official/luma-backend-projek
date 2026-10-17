import axios, { AxiosError } from 'axios';
import { BadRequestError, InternalServerError } from '../utils/app-error';

const REQUEST_TIMEOUT_MS = 10000;

// base url diatur lewat MIDTRANS_BASE_URL di .env.
// sandbox: https://api.sandbox.midtrans.com | production: https://api.midtrans.com
const getBaseUrl = (): string => {
  const baseUrl = process.env.MIDTRANS_BASE_URL?.trim();

  if (!baseUrl) {
    throw new InternalServerError('MIDTRANS_BASE_URL belum diatur di .env');
  }

  return baseUrl.replace(/\/+$/, '');
};

// Midtrans memakai HTTP Basic Auth: server key sebagai username, password kosong
const buildAuthHeader = (serverKey: string): string =>
  `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;

/**
 * Tes kredensial dengan memanggil endpoint status transaksi memakai order id dummy.
 *
 * Yang dinilai adalah STATUS CODE-nya, bukan isi response:
 * - 401 → server key salah / tidak dikenali
 * - 404 → server key VALID, transaksi dummy-nya saja yang tidak ada (ini yang diharapkan)
 *
 * Endpoint ini dipilih karena read-only — tidak membuat transaksi apa pun di akun user.
 */
export const verifyMidtransCredential = async (serverKey: string): Promise<void> => {
  const dummyOrderId = `luma-conn-test-${Date.now()}`;
  const url = `${getBaseUrl()}/v2/${dummyOrderId}/status`;

  try {
    await axios.get(url, {
      headers: {
        Authorization: buildAuthHeader(serverKey),
        Accept: 'application/json',
      },
      timeout: REQUEST_TIMEOUT_MS,
      // 404 ikut dianggap sukses: artinya auth lolos, hanya order id-nya tidak ada
      validateStatus: (status) => status === 404 || (status >= 200 && status < 300),
    });
  } catch (err) {
    const axiosErr = err as AxiosError;

    if (axiosErr.response) {
      const status = axiosErr.response.status;

      if (status === 401) {
        throw new BadRequestError('Credential Midtrans tidak valid', [
          { field: 'server_key', message: 'Server Key ditolak Midtrans, periksa kembali credential Anda' },
        ]);
      }

      if (status === 403) {
        throw new BadRequestError('Credential Midtrans tidak memiliki akses', [
          {
            field: 'server_key',
            message: 'Server Key ditolak Midtrans (403). Pastikan environment dan akun Anda sudah aktif',
          },
        ]);
      }

      throw new InternalServerError(`Midtrans menolak permintaan verifikasi (HTTP ${status})`);
    }

    // tidak ada response: timeout, DNS gagal, atau tidak ada koneksi internet
    if (axiosErr.code === 'ECONNABORTED') {
      throw new InternalServerError('Koneksi ke Midtrans timeout, silakan coba lagi');
    }

    throw new InternalServerError('Tidak dapat terhubung ke Midtrans, periksa koneksi internet server');
  }
};
