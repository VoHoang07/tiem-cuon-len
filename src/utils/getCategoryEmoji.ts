import { Category } from '@/types/product';

export function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'VelvetWire':
      return '🌸';
    case 'VelvetPots':
      return '🪴';
    case 'VelvetFlowers':
      return '💐';
    case 'VelvetAccessories':
      return '🎀';
    case 'VelvetStems':
      return '🧵';
    case 'Keychains':
      return '🔑';
    case 'Yarn':
      return '🧶';
    case 'Crochet':
      return '🌻';
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
    case 'VelvetWire':
      return 'Kẽm nhung';
    case 'VelvetPots':
      return 'Chậu hoa';
    case 'VelvetFlowers':
      return 'Hoa';
    case 'VelvetAccessories':
      return 'Phụ kiện kẽm nhung';
    case 'VelvetStems':
      return 'Sợi kẽm nhung';
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
