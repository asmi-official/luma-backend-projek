import type { PromoStatus } from './model';

// produk yang dikenai promo ini. promo_discount boleh beda-beda tiap produk
// (mis. harga spesial per produk). dikirim sebagai array penuh:
// produk yang tidak ada di array akan dilepas dari promo ini saat update
export interface PromoProductInput {
  id: string;
  promo_discount?: number | string | null;
}

export interface CreatePromoInput {
  name: string;
  discount_type: 'percentage' | 'fixed' | 'special_price';
  // percentage → nilai %, fixed → nominal potongan, special_price → harga tetap
  discount_value: number;
  discount_text?: string | null;
  discount_description?: string | null;
  start_date: string;            // 'YYYY-MM-DD'
  end_date: string;
  start_time?: string | null;    // 'HH:mm' atau 'HH:mm:ss', null = tanpa batas jam
  end_time?: string | null;
  description?: string;
  status?: PromoStatus;
  // wajib minimal 1 produk: promo tanpa produk tidak ada gunanya
  products: PromoProductInput[];
}

export interface UpdatePromoInput {
  name?: string;
  discount_type?: 'percentage' | 'fixed' | 'special_price';
  discount_value?: number;
  discount_text?: string | null;
  discount_description?: string | null;
  start_date?: string;
  end_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  description?: string;
  status?: PromoStatus;
  // wajib minimal 1: sync penuh, produk di luar array ini dilepas dari promo.
  // promo tanpa produk tidak ada gunanya, jadi tidak boleh dikosongkan
  products: PromoProductInput[];
}
