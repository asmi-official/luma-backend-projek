// ketiganya wajib saat menghubungkan pertama kali (sesuai form "Hubungkan Midtrans")
export interface CreatePaymentGatewayInput {
  merchant_id: string;
  client_key: string;
  server_key: string;
}

// semua opsional: user boleh update sebagian, misal hanya mengganti server_key.
// server_key yang dikirim kosong/undefined berarti "jangan ubah", bukan "kosongkan"
export interface UpdatePaymentGatewayInput {
  merchant_id?: string;
  client_key?: string;
  server_key?: string;
  is_connected?: boolean;
}
