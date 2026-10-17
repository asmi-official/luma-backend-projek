export interface CreatePaymentMethodInput {
  key_payment_param_id?: string | null;
  payment_gateway_id: string;
  active?: boolean;
}

export interface UpdatePaymentMethodInput {
  key_payment_param_id?: string | null;
  payment_gateway_id?: string;
  active?: boolean;
}
