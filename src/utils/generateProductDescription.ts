import { Category } from '@/types/product';
import {
  GEN_CATEGORY_INTRO,
  GEN_ADJECTIVES,
  GEN_MATERIAL_PHRASES,
  GEN_CLOSING_PHRASES,
} from '@/constants/strings';

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Bags: ['bag', 'handbag', 'purse', 'tote', 'pouch', 'clutch'],
  Dolls: ['doll', 'teddy', 'bear', 'frock', 'dress', 'toy', 'plush'],
  Crochet: ['tulip', 'sunflower', 'flower', 'bouquet', 'rose', 'lily', 'basket'],
  Yarn: ['yarn', 'thread', 'skein', 'wool', 'roll'],
  Accessories: ['scarf', 'shoe', 'hook', 'needle', 'hat', 'glove', 'sock'],
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
