export interface CreatePromoInput {
  name: string;
  discount_type: 'percentage' | 'fixed' | 'special_price';
  discount_value: number;       // untuk percentage → nilai %, untuk fixed → nominal potongan, untuk special_price → 0
  special_price?: number | null; // harga spesial (wajib jika discount_type = 'special_price')
  min_purchase?: number;
  max_discount?: number | null;  // batas maks diskon (relevan untuk percentage)
  start_date: string;
  end_date: string;
  usage_limit?: number | null;
  description?: string;
  active?: boolean;
}

export interface UpdatePromoInput {
  name?: string;
  discount_type?: 'percentage' | 'fixed' | 'special_price';
  discount_value?: number;
  special_price?: number | null;
  min_purchase?: number;
  max_discount?: number | null;
  start_date?: string;
  end_date?: string;
  usage_limit?: number | null;
  description?: string;
  active?: boolean;
}
