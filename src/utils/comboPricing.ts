import { isCuratedComboProductId } from '@/data/comboCatalog';
import { CartItem, Product, ProductColorOption } from '@/types/product';

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
  279000: 519000,
  289000: 539000,
  345000: 649000,
  350000: 659000,
  359000: 669000,
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

/**
 * Computes dynamic Combo price for ANY two selected models based on their true individual retail prices (`price1 + price2`).
 * Fixes mixed-tier products (e.g., Twinkle Noel 179k vs 249k, Bó Hoa Hồng 159k vs 279k vs 359k) so the shop never loses money.
 */
export function calculateDynamicPairComboPrice(
  price1: number,
  price2: number
): { comboPrice: number; originalPairTotal: number; savings: number } {
  const u1 = Math.max(1000, Math.round(Number(price1) || 0));
  const u2 = Math.max(1000, Math.round(Number(price2) || 0));
  const originalPairTotal = u1 + u2;

  if (u1 === u2) {
    const samePrice = calculateSmartCombo2Price(u1);
    return {
      comboPrice: samePrice,
      originalPairTotal,
      savings: Math.max(0, originalPairTotal - samePrice),
    };
  }

  if (originalPairTotal <= 40000) {
    const cp = Math.max(1000, originalPairTotal - 3000);
    return {
      comboPrice: cp,
      originalPairTotal,
      savings: Math.max(0, originalPairTotal - cp),
    };
  }

  let comboPrice = Math.round((originalPairTotal * 0.925) / 10000) * 10000 - 1000;
  if (comboPrice >= originalPairTotal) {
    comboPrice = Math.max(1000, originalPairTotal - 9000);
  }
  // Guardrail: never discount more than 12% of the true pair sum
  const minSafeFloor = Math.round((originalPairTotal * 0.88) / 1000) * 1000;
  if (comboPrice < minSafeFloor) {
    comboPrice = minSafeFloor + 9000 < originalPairTotal ? minSafeFloor : originalPairTotal - 9000;
  }

  return {
    comboPrice: Math.max(1000, comboPrice),
    originalPairTotal,
    savings: Math.max(0, originalPairTotal - comboPrice),
  };
}

export function isComboColorOption(opt?: ProductColorOption | null): boolean {
  if (!opt) return false;
  const optId = String(opt.id || '');
  if (optId === DEFAULT_COMBO_OPTION_ID || optId.startsWith('pkg_')) {
    return true;
  }
  const lower = String(opt.name || '').toLowerCase();
  return lower.includes('combo');
}

/**
 * Checks whether a CartItem / CheckoutItem is already enjoying a discounted Combo price
 * (so promo vouchers are NEVER double-stacked on top of Combo discounts).
 */
export function isDiscountedComboCartItem(item?: CartItem | null): boolean {
  if (!item || !item.product) return false;
  const p = item.product;
  const baseId = String(p.baseProductId || p.id || '').split('__')[0];
  if (isCuratedComboProductId(baseId)) return true;

  const parts = String(p.id || '').split('__');
  const colorId = String(p.selectedColorId || (parts.length >= 2 ? parts[1] : ''));
  if (
    colorId === DEFAULT_COMBO_OPTION_ID ||
    colorId.startsWith('pkg_') ||
    Boolean(p.comboSlot1Id || p.comboSlot2Id)
  ) {
    return true;
  }

  const labelLower = `${p.selectedColorName || ''} ${p.color || ''} ${
    item.selectedColor || ''
  }`.toLowerCase();
  return labelLower.includes('combo');
}

/**
 * Computes the subtotal of ONLY non-Combo retail items eligible for Promo Vouchers.
 */
export function computeRetailEligibleSubtotal(items: CartItem[]): {
  eligibleRetailSubtotal: number;
  comboSubtotal: number;
  hasComboItems: boolean;
} {
  let eligibleRetailSubtotal = 0;
  let comboSubtotal = 0;
  let hasComboItems = false;

  for (const ci of items || []) {
    if (!ci || !ci.product) continue;
    const lineTotal = (Number(ci.product.price) || 0) * (Number(ci.quantity) || 1);
    if (isDiscountedComboCartItem(ci)) {
      hasComboItems = true;
      comboSubtotal += lineTotal;
    } else {
      eligibleRetailSubtotal += lineTotal;
    }
  }

  return {
    eligibleRetailSubtotal,
    comboSubtotal,
    hasComboItems,
  };
}

/**
 * Returns the product's color/model options PLUS an automatic "🎁 Combo 2 Mẫu Tự Chọn" option
 * if the Admin has not already added a custom Combo option.
 */
export function getProductColorOptionsWithCombo(
  product?: Product | null
): ProductColorOption[] {
  if (!product) return [];

  const rawColors = (Array.isArray(product.colorOptions) ? product.colorOptions : [])
    .filter((c) => {
      if (!c) return false;
      const lower = String(c.name || '').toLowerCase();
      return (
        !lower.includes('hộp quà') &&
        !lower.includes('thư tay') &&
        !lower.includes('set quà')
      );
    })
    .map((c, idx) => ({
      ...c,
      id: String(c.id || `c_${idx + 1}`),
      name: String(c.name || `Mẫu ${idx + 1}`),
      hex: String(c.hex || '#D4A373'),
    }));

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

  const p1 =
    baseList[0]?.price && Number(baseList[0].price) > 0
      ? Number(baseList[0].price)
      : Number(product.price) || 0;
  const secondItem = baseList[1] || baseList[0];
  const p2 =
    secondItem?.price && Number(secondItem.price) > 0
      ? Number(secondItem.price)
      : p1;

  const { comboPrice } = calculateDynamicPairComboPrice(p1, p2);
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
