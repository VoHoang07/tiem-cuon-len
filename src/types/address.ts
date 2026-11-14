export type CraftingStageKey =
  | 'yarn_prep'
  | 'crocheting'
  | 'finishing_giftbox'
  | 'packed_waiting_spx'
  | 'handed_to_spx';

export interface GoshipHistoryEvent {
  status: number;
  statusText: string;
  description: string;
  timestamp: string;
}

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
  craftingStage?: CraftingStageKey | string;
  craftingNote?: string;
  craftingUpdatedAt?: string;
  goshipShipmentId?: string;
  goshipStatusText?: string;
  goshipHistory?: GoshipHistoryEvent[];
  note?: string;
  promoCode?: string;
  discountAmount?: number;
  bonusGiftProductId?: string;
  bonusGiftProductName?: string;
  bonusGiftValue?: number;
  customerAuthProvider?: string;
  isVerifiedAccount?: boolean;
  emailNotifiedAt?: string;
}
