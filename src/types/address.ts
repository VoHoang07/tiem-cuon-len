export interface Address {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
  isDefault: boolean;
  addressTag?: 'home' | 'office';
  shippingMethod?: string;
  shippingFee?: number;
  shippingCarrier?: string;
  trackingCode?: string;
  shippedAt?: string;
  note?: string;
  promoCode?: string;
  discountAmount?: number;
  customerAuthProvider?: string;
  isVerifiedAccount?: boolean;
  emailNotifiedAt?: string;
  }
