export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault: boolean;
  shippingMethod?: string;
  shippingFee?: number;
  shippingCarrier?: string;
  trackingCode?: string;
  shippedAt?: string;
}
