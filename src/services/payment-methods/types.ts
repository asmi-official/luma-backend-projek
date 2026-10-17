// key_payment_param_id menunjuk ke flex_params type_param=PAYMENT_METHODS
// (Tunai / QRIS / Virtual Account).
// payment_gateway_id tidak dikirim client — diisi server dari gateway milik owner
export interface CreatePaymentMethodInput {
  key_payment_param_id: string;
  active?: boolean;
}

// update hanya untuk mengaktifkan / menonaktifkan metode pembayaran.
// untuk metode selain TUNAI, payment_gateway_id ikut diisi otomatis saat
// diaktifkan pertama kali (kalau masih kosong)
export interface UpdatePaymentMethodInput {
  active: boolean;
}
