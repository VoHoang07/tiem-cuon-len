import { Category, ProductColorOption, ProductAccessoryOption } from '@/types/product';
import {
  GEN_CATEGORY_INTRO,
  GEN_ADJECTIVES,
  GEN_MATERIAL_PHRASES,
  GEN_CLOSING_PHRASES,
} from '@/constants/strings';

const COLOR_HEX_MAP: Record<string, string> = {
  kem: '#F5EBE0',
  trắng: '#FAF7F2',
  hồng: '#F4ACB7',
  đỏ: '#E63946',
  vàng: '#FDE047',
  cam: '#F4A261',
  xanh: '#B7E4C7',
  dương: '#93C5FD',
  tím: '#CDB4DB',
  nâu: '#A67B5B',
  đen: '#2B2D42',
  xám: '#9E9E9E',
  be: '#D8C3AD',
};

export function inferColorHex(colorName: string, index: number = 0): string {
  const lower = colorName.toLowerCase();
  for (const [kw, hex] of Object.entries(COLOR_HEX_MAP)) {
    if (lower.includes(kw)) return hex;
  }
  const fallbackPalette = ['#F5EBE0', '#F4ACB7', '#B7E4C7', '#FDE68A', '#CDB4DB', '#A67B5B'];
  return fallbackPalette[index % fallbackPalette.length];
}

export function parseColorOptionsInput(raw: string): ProductColorOption[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((name, idx) => ({
    id: `c_${idx + 1}`,
    name,
    hex: inferColorHex(name, idx),
  }));
}

export function parseAccessoryOptionsInput(raw: string): ProductAccessoryOption[] {
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultEmojis = ['🎀', '🍓', '🌼', '✨', '👑', '🧣'];
  return parts.map((item, idx) => {
    const plusMatch = item.match(/\(\+?(\d+)k?\)/i);
    const priceDelta = plusMatch
      ? Number(plusMatch[1]) < 1000
        ? Number(plusMatch[1]) * 1000
        : Number(plusMatch[1])
      : 0;
    const cleanName = item.replace(/\(\+?\d+k?\)/i, '').trim();
    return {
      id: `a_${idx + 1}`,
      name: cleanName || item,
      emoji: defaultEmojis[idx % defaultEmojis.length],
      priceDelta,
    };
  });
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Keychains: ['keychain', 'móc khoá', 'móc khóa', 'moc khoa', 'charm', 'treo balo', 'chìa khoá', 'chìa khóa'],
  Bags: ['bag', 'handbag', 'purse', 'tote', 'pouch', 'clutch', 'túi'],
  Dolls: ['doll', 'teddy', 'bear', 'frock', 'dress', 'toy', 'plush', 'thú bông', 'khủng long', 'gấu'],
  Crochet: ['tulip', 'sunflower', 'flower', 'bouquet', 'rose', 'lily', 'basket', 'hoa'],
  Yarn: ['yarn', 'thread', 'skein', 'wool', 'roll', 'cuộn len'],
  Accessories: ['scarf', 'shoe', 'hook', 'needle', 'hat', 'glove', 'sock', 'gương', 'phụ kiện'],
};

export function inferCategory(name: string): Category {
  const lower = name.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return category as Category;
    }
  }
  return 'Crochet';
}

function getMaterialPhrase(material: string): string {
  return (
    GEN_MATERIAL_PHRASES[material] ||
    `${material.toLowerCase()} chất lượng cao, tạo cảm giác thủ công ấm áp`
  );
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateProductDescription(product: {
  name: string;
  category: Category;
  material: string;
  color: string;
  tags: string[];
}): string {
  const categoryIntro =
    GEN_CATEGORY_INTRO[product.category] || 'This handmade crochet creation';
  const adjective = pickRandom(GEN_ADJECTIVES);
  const materialPhrase = getMaterialPhrase(product.material);
  const closing = pickRandom(GEN_CLOSING_PHRASES);

  const colorPhrase = product.color.toLowerCase().includes('multicolor')
    ? 'với tông màu đa sắc tươi vui'
    : product.color.toLowerCase().includes('mixed')
      ? 'với sự pha trộn tinh tế các gam pastel'
      : `với tông ${product.color.toLowerCase()} dịu dàng`;

  const templates = [
    `${categoryIntro} ${adjective} và được chăm chút tỉ mỉ từ ${materialPhrase}. ${product.name} nổi bật ${colorPhrase} cùng kết cấu thủ công duyên dáng, tạo nên vẻ đẹp độc nhất vô nhị. ${closing}`,
    `Được làm thủ công bằng tình yêu, ${product.name.toLowerCase()} ${adjective} này sử dụng ${materialPhrase}. ${colorPhrase.charAt(0).toUpperCase() + colorPhrase.slice(1)} cùng từng chi tiết tỉ mỉ tạo nên sản phẩm vừa cao cấp vừa cá nhân. ${closing}`,
    `${product.name.toLowerCase()} ${adjective} này là minh chứng cho vẻ đẹp của nghệ thuật crochet thủ công. Được làm từ ${materialPhrase}, sản phẩm nổi bật ${colorPhrase} và sự chú ý tinh tế đến từng chi tiết. ${closing}`,
    `Mỗi ${product.name.toLowerCase()} đều được làm thủ công bằng tình yêu với ${materialPhrase}. Thiết kế ${adjective}, ${colorPhrase} cùng từng đường móc cẩn thận tạo nên sản phẩm handmade nổi bật. ${closing}`,
  ];

  return pickRandom(templates);
}
