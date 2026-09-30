export interface CreateProductInput {
  name: string;
  category: string;
  unit: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  description?: string;
  active?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  category?: string;
  unit?: string;
  cost_price?: number;
  sell_price?: number;
  stock?: number;
  description?: string;
  active?: boolean;
}
