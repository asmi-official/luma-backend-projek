export interface CreatePaymentMethodInput {
  key_payment_param_id: string;
  method_payment_param_id: string;
  active?: boolean;
}

export interface UpdatePaymentMethodInput {
  key_payment_param_id?: string;
  method_payment_param_id?: string;
  active?: boolean;
}
