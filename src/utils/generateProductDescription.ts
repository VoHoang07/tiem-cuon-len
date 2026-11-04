import { Category, ProductColorOption, ProductAccessoryOption } from '@/types/product';

const COLOR_HEX_MAP: Record<string, string> = {
  'kem sữa': '#F5EBE0',
  'trắng ngà': '#FDFBF7',
  'trắng tinh': '#FAF7F2',
  'be hạnh nhân': '#E6D5C3',
  'hồng phấn': '#F4ACB7',
  'hồng đào': '#FFB5A7',
  'hồng sen': '#EC4899',
  'hồng đất': '#C98A8B',
  'đỏ dâu': '#E63946',
  'đỏ rượu': '#881337',
  'đỏ cam': '#F97316',
  'cam đào': '#F4A261',
  'cam đất': '#C26D4A',
  'vàng bơ': '#FDE047',
  'vàng chanh': '#FEF08A',
  'vàng mù tạt': '#D97706',
  'xanh bơ': '#B7E4C7',
  'xanh mint': '#A7F3D0',
  'xanh lá mạ': '#86EFAC',
  'xanh rêu': '#4D7C5D',
  'xanh dương': '#93C5FD',
  'xanh da trời': '#7DD3FC',
  'xanh navy': '#1E3A8A',
  'xanh cổ vịt': '#0F766E',
  'tím khoai môn': '#CDB4DB',
  'tím lavender': '#DDD6FE',
  'tím huế': '#9333EA',
  'nâu caramel': '#A67B5B',
  'nâu socola': '#5C3A21',
  'nâu cafe': '#785A46',
  'xám khói': '#9CA3AF',
  'đen tuyền': '#1F2937',
  'bạch dương': '#FDE047',
  'kim ngưu': '#B45309',
  'song tử': '#F4ACB7',
  'cự giải': '#DC2626',
  'sư tử': '#F59E0B',
  'xử nữ': '#C084FC',
  'thiên bình': '#2563EB',
  'thiên yết': '#9333EA',
  'nhân mã': '#38BDF8',
  'ma kết': '#16A34A',
  'bảo bình': '#2DD4BF',
  'song ngư': '#FB923C',
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
  VelvetPots: ['chậu hoa kẽm nhung', 'chậu sen đá kẽm nhung'],
  VelvetFlowers: ['hoa kẽm nhung', 'bó hoa kẽm nhung'],
  VelvetAccessories: ['kẹp tóc kẽm nhung', 'bờm kẽm nhung', 'cài áo kẽm nhung', 'vòng tay kẽm nhung'],
  VelvetStems: ['sợi kẽm nhung', 'bó kẽm nhung', 'set kẽm nhung'],
  VelvetWire: ['kẽm nhung', 'kem nhung', 'kẻm nhung', 'pipe cleaner'],
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

const PROFESSIONAL_CATEGORY_SPECS: Record<
  string,
  {
    summary: string;
    craftsmanship: string;
    usage: string;
    care: string;
  }
> = {
  Keychains: {
    summary: 'Mẫu móc khoá đan móc thủ công nhỏ gọn, form đứng chắc chắn và giữ dáng tốt khi sử dụng lâu dài.',
    craftsmanship: 'Mũi móc đều tay, nhồi bông gòn bi kháng khuẩn độ đàn hồi cao, đi kèm khoen kim loại chống gỉ.',
    usage: 'Treo chìa khoá, balo, túi xách hoặc làm quà tặng tinh tế.',
    care: 'Vệ sinh nhẹ bằng khăn ẩm hoặc giặt tay nhanh với nước lạnh, phơi nơi thoáng mát.',
  },
  Bags: {
    summary: 'Túi đan móc thủ công thiết kế chuẩn form, kết cấu sợi đan dày dặn và chịu lực tốt.',
    craftsmanship: 'Đường móc chắc chắn, quai đeo êm vai, tỉ mỉ từng mối nối để không bị dão khi đựng đồ.',
    usage: 'Đựng điện thoại, ví tiền, phụ kiện cá nhân khi đi dạo phố, cà phê hoặc du lịch.',
    care: 'Giặt tay nhẹ nhàng với xà phòng dịu nhẹ, phơi phẳng tự nhiên, tránh vắt xoắn mạnh.',
  },
  Dolls: {
    summary: 'Thú bông amigurumi đan móc thủ công 100%, bề mặt sợi mềm mịn và an toàn khi tiếp xúc.',
    craftsmanship: 'Các chi tiết được khâu ráp thủ công chắc chắn, nhồi bông gòn cao cấp giữ form căng tròn.',
    usage: 'Trang trí góc làm việc, phòng ngủ hoặc làm quà tặng dịp đặc biệt.',
    care: 'Giặt tay nhẹ hoặc vệ sinh bề mặt bằng bọt xà phòng dịu nhẹ, phơi khô nơi thoáng gió.',
  },
  Crochet: {
    summary: 'Sản phẩm hoa & đồ trang trí đan móc thủ công, giữ trọn màu sắc tươi sáng theo thời gian.',
    craftsmanship: 'Cánh hoa và lá được định hình kẽm bọc sợi chắc chắn, dễ dàng điều chỉnh dáng hoa theo ý thích.',
    usage: 'Trang trí bàn làm việc, kệ sách, chụp ảnh decor hoặc làm quà tặng kỷ niệm bền đẹp.',
    care: 'Phủi bụi nhẹ bằng cọ mềm hoặc khăn khô sạch, hạn chế ngâm nước trực tiếp.',
  },
  Yarn: {
    summary: 'Cuộn len sợi tuyển chọn chuyên dụng cho đan móc thủ công, sợi đều và lên màu chuẩn.',
    craftsmanship: 'Sợi mềm mại, ít xù lông, độ xoắn ổn định giúp dễ dàng đi kim và rõ mũi móc.',
    usage: 'Phù hợp móc thú bông, móc khoá, túi xách, khăn choàng và các dự án DIY.',
    care: 'Bảo quản nơi khô ráo, thoáng mát, tránh ẩm ướt và ánh nắng gắt trực tiếp.',
  },
  Accessories: {
    summary: 'Phụ kiện thủ công thiết kế gọn đẹp, tính ứng dụng cao và dễ phối cùng trang phục hằng ngày.',
    craftsmanship: 'Hoàn thiện tỉ mỉ từng đường kim mũi chỉ, chất liệu êm nhẹ tạo cảm giác thoải mái khi dùng.',
    usage: 'Sử dụng hằng ngày, phối đồ chụp ảnh hoặc làm quà tặng nhỏ gọn.',
    care: 'Giặt tay nhẹ nhàng với nước lạnh, phơi khô tự nhiên ở nơi thoáng mát.',
  },
  VelvetWire: {
    summary: 'Sản phẩm tạo hình từ kẽm nhung (pipe cleaner) dày mịn, màu sắc sắc nét và giữ form bền bỉ.',
    craftsmanship: 'Lớp nhung dày phủ đều lõi kẽm dẻo dai, uốn nắn tỉ mỉ và cố định keo chắc chắn.',
    usage: 'Trang trí không gian sống, bàn học hoặc làm quà tặng thủ công độc đáo.',
    care: 'Bảo quản nơi khô ráo, dùng cọ mềm phủi bụi định kỳ, tránh đè nén mạnh.',
  },
  VelvetPots: {
    summary: 'Chậu hoa kẽm nhung để bàn thiết kế cân đối, màu sắc hài hoà giúp không gian thêm sinh động.',
    craftsmanship: 'Từng cánh hoa và tán lá được uốn thủ công từ kẽm nhung loại dày, gắn cố định vững vàng trong chậu.',
    usage: 'Đặt trang trí bàn làm việc, quầy thu ngân, kệ sách hoặc làm quà tặng khai trương, sinh nhật.',
    care: 'Vệ sinh bụi bằng cọ mềm hoặc máy thổi bụi mini, tránh tiếp xúc trực tiếp với nước.',
  },
  VelvetFlowers: {
    summary: 'Hoa kẽm nhung thủ công phối màu trang nhã, giữ nguyên vẻ đẹp lâu dài mà không lo héo úa.',
    craftsmanship: 'Cánh hoa uốn nắn đều đặn từ sợi kẽm nhung mịn, cành hoa cứng cáp và giấy gói chỉnh chu.',
    usage: 'Làm quà tặng lễ tốt nghiệp, sinh nhật, kỷ niệm hoặc cắm bình trang trí phòng.',
    care: 'Tránh nơi ẩm ướt, dùng cọ mềm làm sạch bụi nhẹ nhàng trên bề mặt nhung.',
  },
  VelvetAccessories: {
    summary: 'Phụ kiện kẽm nhung thủ công nhỏ xinh, điểm nhấn nổi bật cho tóc và trang phục.',
    craftsmanship: 'Khung kẹp/cài chắc chắn kết hợp chi tiết kẽm nhung uốn gọn gàng, không lộ mối kẽm.',
    usage: 'Phối phụ kiện đi học, đi chơi, chụp ảnh hoặc làm quà tặng bạn bè.',
    care: 'Cất giữ nơi khô thoáng, hạn chế tì đè vật nặng lên phần tạo hình nhung.',
  },
  VelvetStems: {
    summary: 'Set nguyên liệu sợi kẽm nhung loại 1, lông nhung dày mịn và bảng màu chuẩn đẹp.',
    craftsmanship: 'Lõi thép dẻo dễ uốn gập nhiều lần mà không gãy, mật độ sợi nhung dày không lộ lõi.',
    usage: 'Dùng làm hoa kẽm nhung, thú mini, phụ kiện trang trí và đồ thủ công DIY tại nhà.',
    care: 'Bảo quản trong túi kín nơi khô ráo để sợi nhung luôn sạch và bông mịn.',
  },
};

export function generateProductDescription(product: {
  name: string;
  category: Category;
  material: string;
  color: string;
  tags: string[];
}): string {
  const spec =
    PROFESSIONAL_CATEGORY_SPECS[product.category] ||
    PROFESSIONAL_CATEGORY_SPECS.Crochet;

  const cleanName = product.name.trim() || 'Sản phẩm thủ công';
  const cleanMaterial = product.material.trim() || 'Len Cotton Milk loại 1';
  const cleanColor = product.color.trim() || 'Chuẩn theo phân loại';

  return [
    `${cleanName} — ${spec.summary}`,
    `• Chất liệu: ${cleanMaterial} (Tông màu: ${cleanColor}).`,
    `• Độ hoàn thiện: ${spec.craftsmanship}`,
    `• Công dụng: ${spec.usage}`,
    `• Thời gian chuẩn bị: Hàng đặt làm thủ công mới trong 5–6 ngày (hoặc giao ngay nếu có sẵn tại tiệm).`,
    `• Bảo quản: ${spec.care}`,
  ].join('\n');
}
