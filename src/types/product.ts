export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
  adminReply?: string;
  adminReplyDate?: string;
}

export interface ProductColorOption {
  id: string;
  name: string;
  hex: string;
  secondaryHex?: string;
  image?: string | null;
  price?: number;
}

export interface ProductAccessoryOption {
  id: string;
  name: string;
  emoji?: string;
  priceDelta?: number;
  description?: string;
  image?: string | null;
}

export interface ProductGalleryItem {
  id: string;
  label: string;
  angleTag: string;
  image: string | null;
  colorId?: string;
  accessoryId?: string;
  tintHex?: string;
  zoomMode?: 'normal' | 'closeup' | 'detail' | 'angleLeft' | 'angleRight';
}

export interface Product {
  id: string;
  baseProductId?: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  gallery?: ProductGalleryItem[];
  category: Category;
  subCategory?: Category;
  craftLine?: 'len' | 'kem_nhung';
  material: string;
  color: string;
  selectedColorId?: string;
  selectedColorName?: string;
  selectedColorHex?: string;
  selectedAccessoryId?: string;
  selectedAccessoryName?: string;
  selectedAccessoryEmoji?: string;
  giftCardNote?: string;
  colorOptions?: ProductColorOption[];
  accessoryOptions?: ProductAccessoryOption[];
  isMadeToOrder?: boolean;
  quantity: number;
  rating: number;
  reviews: Review[];
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
}

export type Category =
  | 'All'
  | 'VelvetWire'
  | 'VelvetPots'
  | 'VelvetFlowers'
  | 'VelvetAccessories'
  | 'VelvetStems'
  | 'Keychains'
  | 'Yarn'
  | 'Crochet'
  | 'Bags'
  | 'Dolls'
  | 'Accessories'
  | (string & {});

export interface ShopCategoryItem {
  id: string;
  label: string;
  emoji: string;
  craftLine: 'len' | 'kem_nhung';
}

export interface CartItem {
  product: Product;
  quantity: number;
  selectedColor?: string;
  selectedAccessory?: string;
  giftCardNote?: string;
}
