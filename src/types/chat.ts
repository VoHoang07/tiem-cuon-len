export interface PingedProduct {
  id: string;
  name: string;
  price: number;
  image: string | null | number;
  category: string;
}

export type VoucherMissionType = 'video_unbox_25k' | 'fb_follow_share_15k';

export interface VoucherProofPayload {
  missionType: VoucherMissionType;
  orderId: string;
  userId?: string;
  customerEmail?: string;
  customerName?: string;
  rating: number;
  reviewText: string;
  postUrl?: string;
  proofImage: string;
}

export interface IssuedVoucherBubblePayload {
  code: string;
  missionType: VoucherMissionType;
  discountAmount: number;
  minRetailSubtotal: number;
  title: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  customerName: string;
  customerEmail?: string;
  senderRole: 'customer' | 'admin';
  senderName: string;
  text: string;
  product?: PingedProduct | null;
  voucherProof?: VoucherProofPayload | null;
  issuedVoucher?: IssuedVoucherBubblePayload | null;
  createdAt: string;
  readByAdmin?: boolean;
  readByCustomer?: boolean;
}

export interface ChatConversation {
  conversationId: string;
  customerName: string;
  customerEmail?: string;
  lastMessage: ChatMessage;
  unreadForAdmin: number;
  unreadForCustomer: number;
  messages: ChatMessage[];
}
