import { Category } from '@/types/product';

export function getCategoryEmoji(category: string): string {
  switch (category) {
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
