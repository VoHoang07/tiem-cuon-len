import { isCuratedComboProductId } from '@/data/comboCatalog';
import { Product, ProductColorOption } from '@/types/product';

export const DEFAULT_COMBO_OPTION_ID = 'c_combo_2';

const EXACT_COMBO2_PRICE_MAP: Record<number, number> = {
  35000: 65000,
  39000: 69000,
  45000: 79000,
  49000: 89000,
  55000: 99000,
  59000: 109000,
  65000: 119000,
  69000: 129000,
  75000: 139000,
  79000: 145000,
  85000: 155000,
  89000: 159000,
  95000: 175000,
  99000: 179000,
  115000: 209000,
  125000: 229000,
  129000: 239000,
  130000: 239000,
  135000: 249000,
  139000: 259000,
  145000: 269000,
  149000: 279000,
  155000: 289000,
  159000: 295000,
  165000: 309000,
  169000: 315000,
  170000: 319000,
  179000: 329000,
  189000: 349000,
  199000: 369000,
  229000: 429000,
  249000: 469000,
  255000: 479000,
  269000: 499000,
  270000: 499000,
  289000: 539000,
  345000: 649000,
  365000: 689000,
};

/**
 * Computes an attractive, profit-safe "Combo 2 items" price (~7–10% off 2x unit price, rounded to ...9.000₫)
 */
export function calculateSmartCombo2Price(unitPrice: number): number {
  const cleanUnit = Math.max(1000, Math.round(Number(unitPrice) || 0));
  if (EXACT_COMBO2_PRICE_MAP[cleanUnit]) {
    return EXACT_COMBO2_PRICE_MAP[cleanUnit];
  }
  const twoTotal = cleanUnit * 2;
  if (twoTotal <= 40000) {
    return Math.max(1000, twoTotal - 3000);
  }
  const discounted = Math.round((twoTotal * 0.925) / 10000) * 10000 - 1000;
  if (discounted >= twoTotal) {
    return Math.max(1000, twoTotal - 9000);
  }
  return Math.max(1000, discounted);
}

export function isComboColorOption(opt?: ProductColorOption | null): boolean {
  if (!opt) return false;
  if (opt.id === DEFAULT_COMBO_OPTION_ID || opt.id.startsWith('pkg_')) {
    return true;
  }
  const lower = (opt.name || '').toLowerCase();
  return lower.includes('combo');
}

/**
 * Returns the product's color/model options PLUS an automatic "🎁 Combo 2 Mẫu Tự Chọn" option
 * if the Admin has not already added a custom Combo option.
 */
export function getProductColorOptionsWithCombo(
  product?: Product | null
): ProductColorOption[] {
  if (!product) return [];

  const rawColors = (product.colorOptions ?? []).filter((c) => {
    const lower = (c.name || '').toLowerCase();
    return (
      !lower.includes('hộp quà') &&
      !lower.includes('thư tay') &&
      !lower.includes('set quà')
    );
  });

  if (isCuratedComboProductId(product.id)) {
    return rawColors;
  }

  const baseList: ProductColorOption[] =
    rawColors.length > 0
      ? rawColors
      : [
          {
            id: 'c1',
            name: product.color || 'Mẫu tiêu chuẩn',
            hex: '#D4A373',
            image: product.image || undefined,
            price: product.price,
          },
        ];

  const hasCustomCombo = baseList.some((c) => isComboColorOption(c));
  if (hasCustomCombo) {
    return baseList;
  }

  const singleUnitPrice =
    baseList[0]?.price && Number(baseList[0].price) > 0
      ? Number(baseList[0].price)
      : Number(product.price) || 0;
  const comboPrice = calculateSmartCombo2Price(singleUnitPrice);
  const label =
    baseList.length >= 2
      ? '🎁 Combo 2 Mẫu Tự Chọn'
      : '🎁 Combo 2 Sản Phẩm (Tiết kiệm)';

  return [
    ...baseList,
    {
      id: DEFAULT_COMBO_OPTION_ID,
      name: label,
      hex: '#D97706',
      image: product.image || baseList[0]?.image,
      price: comboPrice,
    },
  ];
}
