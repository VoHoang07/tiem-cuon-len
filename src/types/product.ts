export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
  category: Category;
  material: string;
  color: string;
  quantity: number;
  rating: number;
  reviews: Review[];
  isFavorite: boolean;
  tags: string[];
  createdAt: string;
}

export type Category =
  | 'All'
  | 'Yarn'
  | 'Crochet'
  | 'Bags'
  | 'Dolls'
  | 'Accessories';

export interface CartItem {
  product: Product;
  quantity: number;
}
