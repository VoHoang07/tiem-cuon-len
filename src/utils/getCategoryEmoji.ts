import { ShopCategoryItem } from '@/types/product';

export const DEFAULT_SHOP_CATEGORIES: ShopCategoryItem[] = [
  { id: 'Keychains', label: 'Móc khoá', emoji: '🔑', craftLine: 'len' },
  { id: 'Yarn', label: 'Len cuộn', emoji: '🧶', craftLine: 'len' },
  { id: 'Crochet', label: 'Móc len', emoji: '🌻', craftLine: 'len' },
  { id: 'Bags', label: 'Túi len', emoji: '👜', craftLine: 'len' },
  { id: 'Dolls', label: 'Thú bông', emoji: '🧸', craftLine: 'len' },
  { id: 'Accessories', label: 'Phụ kiện', emoji: '🧣', craftLine: 'len' },
  { id: 'VelvetPots', label: 'Chậu hoa', emoji: '🪴', craftLine: 'kem_nhung' },
  { id: 'VelvetFlowers', label: 'Hoa', emoji: '💐', craftLine: 'kem_nhung' },
  {
    id: 'VelvetAccessories',
    label: 'Phụ kiện kẽm nhung',
    emoji: '🎀',
    craftLine: 'kem_nhung',
  },
  {
    id: 'VelvetStems',
    label: 'Sợi kẽm nhung',
    emoji: '🧵',
    craftLine: 'kem_nhung',
  },
];

const dynamicCategoryMap = new Map<string, ShopCategoryItem>(
  DEFAULT_SHOP_CATEGORIES.map((item) => [item.id, item])
);

export function setDynamicCategoriesRegistry(items: ShopCategoryItem[]) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (item && item.id) {
      dynamicCategoryMap.set(item.id, item);
    }
  }
}

export function getCategoryCraftLine(category: string): 'len' | 'kem_nhung' | null {
  const found = dynamicCategoryMap.get(category);
  if (found) return found.craftLine;
  if (
    category === 'VelvetWire' ||
    category === 'VelvetPots' ||
    category === 'VelvetFlowers' ||
    category === 'VelvetAccessories' ||
    category === 'VelvetStems'
  ) {
    return 'kem_nhung';
  }
  return null;
}

export function getCategoryEmoji(category: string): string {
  const custom = dynamicCategoryMap.get(category);
  if (custom?.emoji) return custom.emoji;
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
  if (category === 'All') return 'Tất cả';
  const custom = dynamicCategoryMap.get(category);
  if (custom?.label) return custom.label;
  switch (category) {
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
