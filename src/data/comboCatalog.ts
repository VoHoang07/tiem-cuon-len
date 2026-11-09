import { Product, ProductColorOption, ProductGalleryItem } from '@/types/product';

export interface CuratedComboPackage {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  hex: string;
  primaryProductId: string;
  secondaryProductId: string;
}

export interface CuratedComboDefinition {
  id: string;
  name: string;
  shortTitle: string;
  themeBadge: string;
  themeColor: string;
  themeBg: string;
  themeBorder: string;
  price: number;
  originalPrice: number;
  freeshipBadge?: boolean;
  category: string;
  material: string;
  description: string;
  primaryProductId: string;
  secondaryProductId: string;
  memberProductIds: string[];
  packages: CuratedComboPackage[];
}

export const CURATED_COMBO_DEFINITIONS: CuratedComboDefinition[] = [
  {
    id: 'combo_couple_zodiac_01',
    name: 'Combo "Couple Định Mệnh" (Cung Hoàng Đạo & Hoa)',
    shortTitle: 'Couple Định Mệnh',
    themeBadge: '💑 Chủ đề Couple',
    themeColor: '#BE123C',
    themeBg: '#FFF1F2',
    themeBorder: '#FECDD3',
    price: 139000,
    originalPrice: 150000,
    category: 'Keychains',
    material: 'Len Cotton Milk cao cấp',
    description:
      'Set đôi hoàn hảo cho các cặp đôi hoặc bạn thân: tự chọn 2 Móc Khoá 12 Cung Hoàng Đạo theo đúng cung của 2 người, hoặc phối 1 Cung Hoàng Đạo + 1 Bó Hoa Mini 7 bông không bao giờ tàn.',
    primaryProductId: 'user_1793721241087',
    secondaryProductId: 'user_1793956553782',
    memberProductIds: ['user_1793721241087', 'user_1793956553782'],
    packages: [
      {
        id: 'pkg_couple_2zodiac',
        name: '💑 Cặp Đôi 2 Cung Hoàng Đạo Tự Chọn',
        price: 139000,
        originalPrice: 150000,
        hex: '#E11D48',
        primaryProductId: 'user_1793721241087',
        secondaryProductId: 'user_1793721241087',
      },
      {
        id: 'pkg_couple_zodiac_flower',
        name: '🌸 1 Cung Hoàng Đạo + 1 Bó Hoa Mini 7 Bông',
        price: 129000,
        originalPrice: 144000,
        hex: '#F43F5E',
        primaryProductId: 'user_1793721241087',
        secondaryProductId: 'user_1793956553782',
      },
    ],
  },
  {
    id: 'combo_bestie_cute_02',
    name: 'Combo "Đôi Bạn Tri Kỷ — Siêu Lầy & Dễ Thương"',
    shortTitle: 'Đôi Bạn Dễ Thương',
    themeBadge: '🐣 Chủ đề Dễ Thương',
    themeColor: '#B45309',
    themeBg: '#FFFBEB',
    themeBorder: '#FDE68A',
    price: 85000,
    originalPrice: 98000,
    category: 'Keychains',
    material: 'Len Cotton Milk mềm mịn',
    description:
      'Mua lẻ 1 bé đã cưng, rủ bạn thân đeo cặp 2 bé còn tiết kiệm hơn! Tự do chọn 2 mẫu bất kỳ trong bộ sưu tập móc khoá lầy lội: Gà Béoo, Vịtt Banana, Đùi Gà Heo, Ốc Quế Kem Chảy, Zịtt hoặc Bé Ma Treo Gió.',
    primaryProductId: 'user_1793958733621',
    secondaryProductId: 'user_1793958181855',
    memberProductIds: [
      'user_1793958733621',
      'user_1793958181855',
      'user_1793804889048',
      'user_1793806143788',
      'user_1793809415860',
      'user_1793955545289',
    ],
    packages: [
      {
        id: 'pkg_bestie_duck_chicken',
        name: '🐣 Gà Béoo + Vịtt Banana (Cặp đôi lầy lội)',
        price: 85000,
        originalPrice: 98000,
        hex: '#F59E0B',
        primaryProductId: 'user_1793958733621',
        secondaryProductId: 'user_1793958181855',
      },
      {
        id: 'pkg_bestie_foodie',
        name: '🍗 Đùi Gà Heo + Ốc Quế Kem Chảy',
        price: 85000,
        originalPrice: 98000,
        hex: '#D97706',
        primaryProductId: 'user_1793804889048',
        secondaryProductId: 'user_1793806143788',
      },
      {
        id: 'pkg_bestie_any2',
        name: '✨ Tự chọn 2 mẫu bất kỳ nhóm Cute (Ghi chú mẫu)',
        price: 85000,
        originalPrice: 98000,
        hex: '#EA580C',
        primaryProductId: 'user_1793809415860',
        secondaryProductId: 'user_1793955545289',
      },
    ],
  },
  {
    id: 'combo_sweet_bakery_03',
    name: 'Combo "Tiệm Bánh Ngọt Ngào" (Donut & Kem)',
    shortTitle: 'Tiệm Bánh Ngọt Ngào',
    themeBadge: '🍩 Chủ đề Ngọt Ngào',
    themeColor: '#9D174D',
    themeBg: '#FDF2F8',
    themeBorder: '#FBCFE8',
    price: 99000,
    originalPrice: 114000,
    category: 'Keychains',
    material: 'Len Cotton Milk & Bông gòn bi',
    description:
      'Dành riêng cho những tâm hồn hảo ngọt và mê sắc màu pastel: kết hợp Móc Khoá Donut Mini cùng Ốc Quế Kem Chảy, hoặc nâng cấp lên bộ đôi "Mẹ Bồng Con" gồm Bánh Donut Size Vừa kèm Donut Mini.',
    primaryProductId: 'user_1793987529864',
    secondaryProductId: 'user_1793806143788',
    memberProductIds: [
      'user_1793987529864',
      'user_1793806143788',
      'user_1793981290544',
    ],
    packages: [
      {
        id: 'pkg_bakery_mini',
        name: '🍦 Set Mini: Móc Khoá Donut Mini + Ốc Quế Kem Chảy',
        price: 99000,
        originalPrice: 114000,
        hex: '#EC4899',
        primaryProductId: 'user_1793987529864',
        secondaryProductId: 'user_1793806143788',
      },
      {
        id: 'pkg_bakery_big',
        name: '🍩 Set Lớn: Donut Size Vừa + Móc Khoá Donut Mini',
        price: 289000,
        originalPrice: 314000,
        hex: '#DB2777',
        primaryProductId: 'user_1793981290544',
        secondaryProductId: 'user_1793987529864',
      },
    ],
  },
  {
    id: 'combo_muse_flower_plush_04',
    name: 'Combo "Nàng Thơ — Hoa Không Tàn & Thú Bông"',
    shortTitle: 'Nàng Thơ Hoa & Thú',
    themeBadge: '🌸 Quà Tặng Bạn Gái',
    themeColor: '#7E22CE',
    themeBg: '#FAF5FF',
    themeBorder: '#E9D5FF',
    price: 145000,
    originalPrice: 164000,
    category: 'Flowers',
    material: 'Len Cotton Milk & Kẽm Nhung Hàn Quốc',
    description:
      'Giải pháp quà tặng tinh tế điểm 10 cho dịp Sinh nhật, Kỷ niệm: vừa có Hoa thủ công vĩnh cửu không bao giờ héo, vừa có Móc Khoá Thú Bông đáng yêu để người nhận mang theo bên mình mỗi ngày.',
    primaryProductId: 'user_1793956553782',
    secondaryProductId: 'user_1794156959442',
    memberProductIds: [
      'user_1793956553782',
      'user_1794156959442',
      'vw_flower_hydrangea_03',
      'vw_pot_rose_01',
    ],
    packages: [
      {
        id: 'pkg_muse_delicate',
        name: '🌷 Gói Tinh Tế: Bó Hoa Mini 7 Bông + Móc Khoá Thú Bông',
        price: 145000,
        originalPrice: 164000,
        hex: '#A855F7',
        primaryProductId: 'user_1793956553782',
        secondaryProductId: 'user_1794156959442',
      },
      {
        id: 'pkg_muse_premium',
        name: '🌹 Gói Cao Cấp: Hoa Kẽm Nhung Để Bàn/Bó Lớn + Thú Bông',
        price: 199000,
        originalPrice: 230000,
        hex: '#7E22CE',
        primaryProductId: 'vw_flower_hydrangea_03',
        secondaryProductId: 'user_1794156959442',
      },
    ],
  },
  {
    id: 'combo_twinkle_universe_05',
    name: 'Combo "Vũ Trụ Twinkle Twinkle" (Freeship 0₫)',
    shortTitle: 'Vũ Trụ Twinkle',
    themeBadge: '⭐ Hot Trend • Freeship',
    themeColor: '#1D4ED8',
    themeBg: '#EFF6FF',
    themeBorder: '#BFDBFE',
    price: 379000,
    originalPrice: 418000,
    freeshipBadge: true,
    category: 'Keychains',
    material: 'Len Nhung Đũa & Cotton Milk cao cấp',
    description:
      'Bộ đôi Charm treo túi xách làm mưa làm gió: kết hợp 1 bé Charm Bông Twinkle Twinkle bản chuẩn cùng 1 bé Twinkle Noel (hoặc chọn 2 bé Twinkle bất kỳ). Tiết kiệm tới 39.000₫ và được Tự động Freeship toàn quốc!',
    primaryProductId: 'user_1794152247063',
    secondaryProductId: 'user_1794155402893',
    memberProductIds: ['user_1794152247063', 'user_1794155402893'],
    packages: [
      {
        id: 'pkg_twinkle_pair_mix',
        name: '🎄 1 Twinkle Thường + 1 Twinkle Noel (Freeship 0₫)',
        price: 379000,
        originalPrice: 418000,
        hex: '#2563EB',
        primaryProductId: 'user_1794152247063',
        secondaryProductId: 'user_1794155402893',
      },
      {
        id: 'pkg_twinkle_pair_regular',
        name: '🌟 2 Bé Charm Bông Twinkle Twinkle Tự Chọn (Freeship 0₫)',
        price: 469000,
        originalPrice: 498000,
        hex: '#1D4ED8',
        primaryProductId: 'user_1794152247063',
        secondaryProductId: 'user_1794152247063',
      },
    ],
  },
  {
    id: 'combo_winter_dalat_06',
    name: 'Combo "Đà Lạt Mùa Đông" (Chùm Tai/Nón & Thú Bông)',
    shortTitle: 'Đà Lạt Mùa Đông',
    themeBadge: '🧸 Mùa Đông OOTD',
    themeColor: '#5C4033',
    themeBg: '#FDFBF7',
    themeBorder: '#E5D5C5',
    price: 219000,
    originalPrice: 244000,
    category: 'Accessories',
    material: 'Len Lông Cừu & Len Cotton Milk ấm áp',
    description:
      'Set phụ kiện đồng điệu cho những chuyến vi vu Đà Lạt, Sapa hay ngày se lạnh: gồm 1 Băng Chùm Tai EarMuffs (hoặc Nón Tai Gấu) phối cùng 1 Móc Khoá Thú Bông xinh xắn.',
    primaryProductId: 'user_1793884910153',
    secondaryProductId: 'user_1794156959442',
    memberProductIds: [
      'user_1793884910153',
      'user_1793905231278',
      'user_1793885702524',
      'user_1794156959442',
    ],
    packages: [
      {
        id: 'pkg_winter_earmuff',
        name: '🎧 EarMuffs Băng Chùm Tai + Móc Khoá Thú Bông',
        price: 219000,
        originalPrice: 244000,
        hex: '#8C684C',
        primaryProductId: 'user_1793884910153',
        secondaryProductId: 'user_1794156959442',
      },
      {
        id: 'pkg_winter_bear_earmuff',
        name: '🐻 Earmuffs Tai Gấu + Móc Khoá Thú Bông',
        price: 229000,
        originalPrice: 254000,
        hex: '#6F4E37',
        primaryProductId: 'user_1793905231278',
        secondaryProductId: 'user_1794156959442',
      },
      {
        id: 'pkg_winter_beanie',
        name: '🧶 Nón Tai Gấu + Móc Khoá Thú Bông',
        price: 259000,
        originalPrice: 284000,
        hex: '#5C4033',
        primaryProductId: 'user_1793885702524',
        secondaryProductId: 'user_1794156959442',
      },
    ],
  },
];

export function isCuratedComboProductId(id?: string | null): boolean {
  if (!id) return false;
  const baseId = String(id).split('__')[0];
  return CURATED_COMBO_DEFINITIONS.some((c) => c.id === baseId);
}

export function getCuratedComboDefinition(
  id?: string | null
): CuratedComboDefinition | undefined {
  if (!id) return undefined;
  const baseId = String(id).split('__')[0];
  return CURATED_COMBO_DEFINITIONS.find((c) => c.id === baseId);
}

/**
 * Dynamically builds the 6 Curated Combo `Product` objects using real images from `liveProducts`.
 */
export function buildCuratedComboProducts(liveProducts: Product[]): Product[] {
  const byId = new Map<string, Product>();
  for (const p of liveProducts) {
    if (p && p.id) byId.set(p.id, p);
  }

  return CURATED_COMBO_DEFINITIONS.map((def) => {
    const primaryProd = byId.get(def.primaryProductId);
    const secondaryProd = byId.get(def.secondaryProductId);
    const primaryImg =
      primaryProd?.image ||
      primaryProd?.colorOptions?.[0]?.image ||
      null;
    const secondaryImg =
      secondaryProd?.image ||
      secondaryProd?.colorOptions?.[0]?.image ||
      primaryImg;

    const colorOptions: ProductColorOption[] = def.packages.map((pkg) => {
      const p1 = byId.get(pkg.primaryProductId);
      const img =
        p1?.image || p1?.colorOptions?.[0]?.image || primaryImg || undefined;
      return {
        id: pkg.id,
        name: pkg.name,
        hex: pkg.hex,
        image: img,
        price: pkg.price,
      };
    });

    const gallery: ProductGalleryItem[] = [];
    for (const memberId of def.memberProductIds) {
      const mp = byId.get(memberId);
      if (!mp) continue;
      if (mp.image) {
        gallery.push({
          id: `g_${def.id}_${mp.id}_cover`,
          label: `${mp.name} (Trong ${def.shortTitle})`,
          angleTag: mp.name,
          image: mp.image,
          zoomMode: 'normal',
        });
      }
      if (Array.isArray(mp.colorOptions)) {
        for (const co of mp.colorOptions.slice(0, 6)) {
          if (co && co.image && co.image !== mp.image) {
            gallery.push({
              id: `g_${def.id}_${mp.id}_${co.id}`,
              label: `${mp.name} — Mẫu: ${co.name}`,
              angleTag: co.name || mp.name,
              image: co.image,
              zoomMode: 'normal',
            });
          }
        }
      }
      }

      return {
      id: def.id,
      name: def.name,
      price: def.price,
      category: def.category as any,
      image: primaryImg,
      description: def.description,
      material: def.material,
      color: def.packages[0]?.name || def.shortTitle,
      quantity: 20,
      isMadeToOrder: true,
      rating: 5.0,
      reviews: [],
      isFavorite: false,
      createdAt: '2026-04-01T00:00:00.000Z',
      tags: ['combo', def.themeBadge, def.shortTitle],
      colorOptions,
      gallery: gallery.length > 0 ? gallery : undefined,
      } as Product;
      });
      }

/**
 * Returns quick-pick model names from the member products of a Curated Combo
 * so customers can tap which models they want to combine.
 */
export function getCuratedComboMemberModelChips(
  comboId: string,
  liveProducts: Product[]
): string[] {
  const def = getCuratedComboDefinition(comboId);
  if (!def) return [];
  const chips: string[] = [];
  const seen = new Set<string>();

  for (const memberId of def.memberProductIds) {
    const mp = liveProducts.find((p) => p.id === memberId);
    if (!mp) continue;
    const rawColors = (mp.colorOptions ?? []).filter((c) => {
      const lower = (c.name || '').toLowerCase();
      return (
        !lower.includes('combo') &&
        !lower.includes('hộp quà') &&
        !lower.includes('thư tay') &&
        !lower.includes('set quà')
      );
    });
    if (rawColors.length >= 2) {
      for (const c of rawColors) {
        const clean = (c.name || '').trim();
        if (clean && !seen.has(clean.toLowerCase())) {
          seen.add(clean.toLowerCase());
          chips.push(clean);
        }
      }
    } else {
      const cleanName = mp.name
        .replace(/^Móc [Kk]hoá\s+/i, '')
        .replace(/^Charm Bông Treo Túi\s+/i, '')
        .trim();
      if (cleanName && !seen.has(cleanName.toLowerCase())) {
        seen.add(cleanName.toLowerCase());
        chips.push(cleanName);
      }
    }
  }
  return chips.slice(0, 18);
}
