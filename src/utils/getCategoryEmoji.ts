import { Category } from '@/types/product';

export function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'Keychains':
      return '🔑';
    case 'Bags':
      return '👜';
    case 'Dolls':
      return '🧸';
    case 'Accessories':
      return '🧣';
    default:
      return '🧶';
  }
}

export function getCategoryLabel(category: string): string {
  switch (category) {
    case 'All':
      return 'Tất cả';
    case 'Keychains':
      return 'Móc khoá';
    case 'Yarn':
      return 'Len cuộn';
    case 'Crochet':
      return 'Móc len';
    case 'Bags':
      return 'Túi len';
    case 'Dolls':
      return 'Thú bông';
    case 'Accessories':
      return 'Phụ kiện';
    default:
      return category;
  }
}
