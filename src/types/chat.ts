export interface PingedProduct {
  id: string;
  name: string;
  price: number;
  image: string | null | number;
  category: string;
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
