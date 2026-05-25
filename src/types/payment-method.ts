export type PaymentMethodType = 'bank_transfer' | 'momo' | 'zalopay' | 'cod';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  title: string;
  enabled: boolean;
  is_default: boolean;
  bank_name?: string;
  account_name?: string;
  account_number?: string;
  qr_image?: string;
  transfer_prefix?: string;
  phone_number?: string;
  created_at: string;
  updated_at?: string;
}

export type PaymentMethodInput = Omit<PaymentMethod, 'id' | 'created_at' | 'updated_at'>;
