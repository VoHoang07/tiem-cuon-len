/**
 * Complete 63 Vietnam Provinces/Cities, Built-in Districts & Wards Catalog,
 * Live Open-API Administrative Fetcher, and Smart Vietnamese Address Parser.
 */

export interface AdminUnit {
  code: number | string;
  name: string;
}

export const QUICK_CITIES = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Khánh Hòa',
];

/**
 * Full canonical list of 63 Provinces / Centrally-governed Cities in Vietnam
 */
export const VIETNAM_PROVINCES: string[] = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
  'Đồng Nai',
  'Bà Rịa - Vũng Tàu',
  'Long An',
  'Khánh Hòa',
  'Lâm Đồng',
  'Thừa Thiên Huế',
  'Quảng Ninh',
  'Bắc Ninh',
  'Hải Dương',
  'Hưng Yên',
  'Vĩnh Phúc',
  'Thái Nguyên',
  'Bắc Giang',
  'Thanh Hóa',
  'Nghệ An',
  'Hà Tĩnh',
  'Quảng Bình',
  'Quảng Trị',
  'Quảng Nam',
  'Quảng Ngãi',
  'Bình Định',
  'Phú Yên',
  'Ninh Thuận',
  'Bình Thuận',
  'Tây Ninh',
  'Bình Phước',
  'Tiền Giang',
  'Bến Tre',
  'Vĩnh Long',
  'Trà Vinh',
  'Đồng Tháp',
  'An Giang',
  'Kiên Giang',
  'Hậu Giang',
  'Sóc Trăng',
  'Bạc Liêu',
  'Cà Mau',
  'Đắk Lắk',
  'Đắk Nông',
  'Gia Lai',
  'Kon Tum',
  'Nam Định',
  'Thái Bình',
  'Ninh Bình',
  'Hà Nam',
  'Phú Thọ',
  'Tuyên Quang',
  'Yên Bái',
  'Lào Cai',
  'Hà Giang',
  'Cao Bằng',
  'Bắc Kạn',
  'Lạng Sơn',
  'Hòa Bình',
  'Sơn La',
  'Điện Biên',
  'Lai Châu',
];

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

const PROVINCE_ALIASES: Record<string, string> = {
  'ho chi minh': 'TP. Hồ Chí Minh',
  'tp ho chi minh': 'TP. Hồ Chí Minh',
  'tp. ho chi minh': 'TP. Hồ Chí Minh',
  'thanh pho ho chi minh': 'TP. Hồ Chí Minh',
  tphcm: 'TP. Hồ Chí Minh',
  'tp.hcm': 'TP. Hồ Chí Minh',
  hcm: 'TP. Hồ Chí Minh',
  'sai gon': 'TP. Hồ Chí Minh',
  saigon: 'TP. Hồ Chí Minh',
  'ha noi': 'TP. Hồ Chí Minh' === '' ? '' : 'Hà Nội',
  hanoi: 'Hà Nội',
  'tp ha noi': 'Hà Nội',
  'thanh pho ha noi': 'Hà Nội',
  'da nang': 'Đà Nẵng',
  danang: 'Đà Nẵng',
  'tp da nang': 'Đà Nẵng',
  'can tho': 'Cần Thơ',
  cantho: 'Cần Thơ',
  'tp can tho': 'Cần Thơ',
  'hai phong': 'Hải Phòng',
  haiphong: 'Hải Phòng',
  'tp hai phong': 'Hải Phòng',
  hue: 'Thừa Thiên Huế',
  'tp hue': 'Thừa Thiên Huế',
  'thanh pho hue': 'Thừa Thiên Huế',
  'thua thien hue': 'Thừa Thiên Huế',
  'thua thien - hue': 'Thừa Thiên Huế',
  'ba ria vung tau': 'Bà Rịa - Vũng Tàu',
  'ba ria - vung tau': 'Bà Rịa - Vũng Tàu',
  brvt: 'Bà Rịa - Vũng Tàu',
  'vung tau': 'Bà Rịa - Vũng Tàu',
  'dak lak': 'Đắk Lắk',
  'dac lac': 'Đắk Lắk',
  'dak nong': 'Đắk Nông',
  'dac nong': 'Đắk Nông',
};

/**
 * Matches a raw string to one of Vietnam's 63 canonical Provinces/Cities.
 * Safely avoids matching district-level cities like "Thành phố Thủ Đức" as a province.
 */
export function matchVietnamProvince(raw?: string): string {
  if (!raw) return '';
  const cleaned = raw
    .trim()
    .replace(/^(?:Tỉnh|Thành phố trực thuộc trung ương)\s+/i, '')
    .trim();
  if (!cleaned) return '';

  const ascii = removeVietnameseTones(cleaned)
    .replace(/^(?:tinh|thanh pho|tp\.?|tp)\s+/i, '')
    .replace(/\s+province$/i, '')
    .replace(/\s+city$/i, '')
    .trim();

  if (PROVINCE_ALIASES[ascii]) {
    return PROVINCE_ALIASES[ascii];
  }
  const fullAscii = removeVietnameseTones(raw.trim());
  if (PROVINCE_ALIASES[fullAscii]) {
    return PROVINCE_ALIASES[fullAscii];
  }

  for (const prov of VIETNAM_PROVINCES) {
    const provAscii = removeVietnameseTones(prov).replace(/^tp\.?\s+/i, '');
    if (ascii === provAscii || fullAscii === provAscii) {
      return prov;
    }
  }

  for (const prov of VIETNAM_PROVINCES) {
    const provAscii = removeVietnameseTones(prov).replace(/^tp\.?\s+/i, '');
    if (
      provAscii.length >= 5 &&
      (ascii.includes(provAscii) || fullAscii.includes(provAscii))
    ) {
      return prov;
    }
  }

  return '';
}

/**
 * Comprehensive offline fallback districts by province/city
 */
export const BUILTIN_DISTRICTS_BY_CITY: Record<string, string[]> = {
  'TP. Hồ Chí Minh': [
    'Quận 1',
    'Quận 3',
    'Quận 4',
    'Quận 5',
    'Quận 6',
    'Quận 7',
    'Quận 8',
    'Quận 10',
    'Quận 11',
    'Quận 12',
    'TP. Thủ Đức',
    'Quận Bình Thạnh',
    'Quận Phú Nhuận',
    'Quận Gò Vấp',
    'Quận Tân Bình',
    'Quận Tân Phú',
    'Quận Bình Tân',
    'Huyện Bình Chánh',
    'Huyện Hóc Môn',
    'Huyện Nhà Bè',
    'Huyện Củ Chi',
    'Huyện Cần Giờ',
  ],
  'Hà Nội': [
    'Quận Hoàn Kiếm',
    'Quận Ba Đình',
    'Quận Đống Đa',
    'Quận Hai Bà Trưng',
    'Quận Cầu Giấy',
    'Quận Thanh Xuân',
    'Quận Tây Hồ',
    'Quận Hoàng Mai',
    'Quận Long Biên',
    'Quận Nam Từ Liêm',
    'Quận Bắc Từ Liêm',
    'Quận Hà Đông',
    'Huyện Gia Lâm',
    'Huyện Đông Anh',
    'Huyện Thanh Trì',
    'Huyện Hoài Đức',
    'Huyện Đan Phượng',
    'Huyện Thường Tín',
    'Huyện Sóc Sơn',
    'Thị xã Sơn Tây',
  ],
  'Đà Nẵng': [
    'Quận Hải Châu',
    'Quận Thanh Khê',
    'Quận Sơn Trà',
    'Quận Ngũ Hành Sơn',
    'Quận Liên Chiểu',
    'Quận Cẩm Lệ',
    'Huyện Hòa Vang',
  ],
  'Cần Thơ': [
    'Quận Ninh Kiều',
    'Quận Cái Răng',
    'Quận Bình Thủy',
    'Quận Ô Môn',
    'Quận Thốt Nốt',
    'Huyện Phong Điền',
    'Huyện Thới Lai',
    'Huyện Cờ Đỏ',
    'Huyện Vĩnh Thạnh',
  ],
  'Hải Phòng': [
    'Quận Hồng Bàng',
    'Quận Ngô Quyền',
    'Quận Lê Chân',
    'Quận Hải An',
    'Quận Kiến An',
    'Quận Đồ Sơn',
    'Quận Dương Kinh',
    'TP. Thủy Nguyên',
    'Quận An Dương',
    'Huyện An Lão',
    'Huyện Kiến Thụy',
    'Huyện Tiên Lãng',
    'Huyện Vĩnh Bảo',
  ],
  'Bình Dương': [
    'TP. Thủ Dầu Một',
    'TP. Dĩ An',
    'TP. Thuận An',
    'TP. Tân Uyên',
    'TP. Bến Cát',
    'Huyện Bàu Bàng',
    'Huyện Bắc Tân Uyên',
    'Huyện Dầu Tiếng',
    'Huyện Phú Giáo',
  ],
  'Đồng Nai': [
    'TP. Biên Hòa',
    'TP. Long Khánh',
    'Huyện Long Thành',
    'Huyện Nhơn Trạch',
    'Huyện Trảng Bom',
    'Huyện Vĩnh Cửu',
    'Huyện Thống Nhất',
    'Huyện Cẩm Mỹ',
    'Huyện Xuân Lộc',
    'Huyện Định Quán',
    'Huyện Tân Phú',
  ],
  'Bà Rịa - Vũng Tàu': [
    'TP. Vũng Tàu',
    'TP. Bà Rịa',
    'TP. Phú Mỹ',
    'Huyện Long Điền',
    'Huyện Đất Đỏ',
    'Huyện Châu Đức',
    'Huyện Xuyên Mộc',
    'Huyện Côn Đảo',
  ],
  'Long An': [
    'TP. Tân An',
    'Huyện Bến Lức',
    'Huyện Đức Hòa',
    'Huyện Cần Giuộc',
    'Huyện Cần Đước',
    'Huyện Châu Thành',
    'Huyện Tân Trụ',
    'Thị xã Kiến Tường',
  ],
  'Khánh Hòa': [
    'TP. Nha Trang',
    'TP. Cam Ranh',
    'Thị xã Ninh Hòa',
    'Huyện Diên Khánh',
    'Huyện Cam Lâm',
    'Huyện Vạn Ninh',
  ],
  'Lâm Đồng': [
    'TP. Đà Lạt',
    'TP. Bảo Lộc',
    'Huyện Đức Trọng',
    'Huyện Di Linh',
    'Huyện Lâm Hà',
    'Huyện Đơn Dương',
    'Huyện Lạc Dương',
  ],
  'Thừa Thiên Huế': [
    'Quận Thuận Hóa',
    'Quận Phú Xuân',
    'Thị xã Hương Thủy',
    'Thị xã Hương Trà',
    'Thị xã Phong Điền',
    'Huyện Phú Vang',
    'Huyện Quảng Điền',
    'Huyện Phú Lộc',
  ],
  'Quảng Ninh': [
    'TP. Hạ Long',
    'TP. Cẩm Phả',
    'TP. Uông Bí',
    'TP. Móng Cái',
    'TP. Đông Triều',
    'Thị xã Quảng Yên',
    'Huyện Vân Đồn',
  ],
  'Bắc Ninh': [
    'TP. Bắc Ninh',
    'TP. Từ Sơn',
    'Thị xã Thuận Thành',
    'Thị xã Quế Võ',
    'Huyện Yên Phong',
    'Huyện Tiên Du',
    'Huyện Gia Bình',
    'Huyện Lương Tài',
  ],
  'Hải Dương': [
    'TP. Hải Dương',
    'TP. Chí Linh',
    'Thị xã Kinh Môn',
    'Huyện Cẩm Giàng',
    'Huyện Bình Giang',
    'Huyện Nam Sách',
    'Huyện Kim Thành',
    'Huyện Gia Lộc',
  ],
  'Thanh Hóa': [
    'TP. Thanh Hóa',
    'TP. Sầm Sơn',
    'Thị xã Bỉm Sơn',
    'Thị xã Nghi Sơn',
    'Huyện Quảng Xương',
    'Huyện Hoằng Hóa',
    'Huyện Đông Sơn',
    'Huyện Thọ Xuân',
  ],
  'Nghệ An': [
    'TP. Vinh',
    'Thị xã Cửa Lò',
    'Thị xã Hoàng Mai',
    'Thị xã Thái Hòa',
    'Huyện Nghi Lộc',
    'Huyện Diễn Châu',
    'Huyện Hưng Nguyên',
    'Huyện Quỳnh Lưu',
  ],
  'Quảng Nam': [
    'TP. Tam Kỳ',
    'TP. Hội An',
    'Thị xã Điện Bàn',
    'Huyện Duy Xuyên',
    'Huyện Thăng Bình',
    'Huyện Núi Thành',
    'Huyện Đại Lộc',
  ],
  'Bình Định': [
    'TP. Quy Nhơn',
    'Thị xã An Nhơn',
    'Thị xã Hoài Nhơn',
    'Huyện Tuy Phước',
    'Huyện Phù Cát',
    'Huyện Phù Mỹ',
    'Huyện Tây Sơn',
  ],
  'Đắk Lắk': [
    'TP. Buôn Ma Thuột',
    'Thị xã Buôn Hồ',
    'Huyện Cư Mgar',
    'Huyện Krông Pắc',
    'Huyện Ea Hleo',
    'Huyện Krông Năng',
  ],
  'Gia Lai': [
    'TP. Pleiku',
    'Thị xã An Khê',
    'Thị xã Ayun Pa',
    'Huyện Chư Sê',
    'Huyện Đak Đoa',
    'Huyện Chư Prông',
  ],
  'Tiền Giang': [
    'TP. Mỹ Tho',
    'TP. Gò Công',
    'Thị xã Cai Lậy',
    'Huyện Châu Thành',
    'Huyện Chợ Gạo',
    'Huyện Cái Bè',
  ],
  'Bến Tre': [
    'TP. Bến Tre',
    'Huyện Châu Thành',
    'Huyện Giồng Trôm',
    'Huyện Mỏ Cày Nam',
    'Huyện Mỏ Cày Bắc',
    'Huyện Chợ Lách',
    'Huyện Ba Tri',
    'Huyện Bình Đại',
  ],
  'Vĩnh Long': [
    'TP. Vĩnh Long',
    'Thị xã Bình Minh',
    'Huyện Long Hồ',
    'Huyện Mang Thít',
    'Huyện Vũng Liêm',
    'Huyện Tam Bình',
  ],
  'An Giang': [
    'TP. Long Xuyên',
    'TP. Châu Đốc',
    'Thị xã Tân Châu',
    'Thị xã Tịnh Biên',
    'Huyện Châu Phú',
    'Huyện Châu Thành',
    'Huyện Chợ Mới',
    'Huyện Thoại Sơn',
  ],
  'Kiên Giang': [
    'TP. Rạch Giá',
    'TP. Phú Quốc',
    'TP. Hà Tiên',
    'Huyện Kiên Lương',
    'Huyện Hòn Đất',
    'Huyện Châu Thành',
    'Huyện Tân Hiệp',
    'Huyện An Biên',
  ],
};

/**
 * Built-in popular wards by district so common urban areas work instantly offline
 */
export const BUILTIN_WARDS_BY_DISTRICT: Record<string, string[]> = {
  'Quận 1': [
    'Phường Bến Nghé',
    'Phường Bến Thành',
    'Phường Đa Kao',
    'Phường Tân Định',
    'Phường Nguyễn Thái Bình',
    'Phường Phạm Ngũ Lão',
    'Phường Nguyễn Cư Trinh',
    'Phường Cô Giang',
    'Phường Cầu Kho',
    'Phường Cầu Ông Lãnh',
  ],
  'Quận 3': [
    'Phường Võ Thị Sáu',
    'Phường 1',
    'Phường 2',
    'Phường 3',
    'Phường 4',
    'Phường 5',
    'Phường 9',
    'Phường 10',
    'Phường 11',
    'Phường 12',
    'Phường 14',
  ],
  'Quận 7': [
    'Phường Tân Phong',
    'Phường Tân Phú',
    'Phường Tân Hưng',
    'Phường Tân Kiểng',
    'Phường Tân Quy',
    'Phường Tân Thuận Đông',
    'Phường Tân Thuận Tây',
    'Phường Bình Thuận',
    'Phường Phú Mỹ',
    'Phường Phú Thuận',
  ],
  'Quận Bình Thạnh': [
    'Phường 1',
    'Phường 2',
    'Phường 5',
    'Phường 7',
    'Phường 11',
    'Phường 12',
    'Phường 13',
    'Phường 14',
    'Phường 17',
    'Phường 19',
    'Phường 21',
    'Phường 22',
    'Phường 24',
    'Phường 25',
    'Phường 26',
    'Phường 27',
    'Phường 28',
  ],
  'TP. Thủ Đức': [
    'Phường Thảo Điền',
    'Phường An Phú',
    'Phường An Khánh',
    'Phường Bình Thọ',
    'Phường Linh Chiểu',
    'Phường Linh Trung',
    'Phường Linh Tây',
    'Phường Linh Đông',
    'Phường Hiệp Bình Chánh',
    'Phường Hiệp Bình Phước',
    'Phường Hiệp Phú',
    'Phường Tăng Nhơn Phú A',
    'Phường Tăng Nhơn Phú B',
    'Phường Phước Long A',
    'Phường Phước Long B',
    'Phường Long Thạnh Mỹ',
  ],
  'Quận Phú Nhuận': [
    'Phường 1',
    'Phường 2',
    'Phường 4',
    'Phường 5',
    'Phường 7',
    'Phường 8',
    'Phường 9',
    'Phường 10',
    'Phường 11',
    'Phường 13',
    'Phường 15',
    'Phường 17',
  ],
  'Quận Gò Vấp': [
    'Phường 1',
    'Phường 3',
    'Phường 4',
    'Phường 5',
    'Phường 6',
    'Phường 7',
    'Phường 8',
    'Phường 9',
    'Phường 10',
    'Phường 11',
    'Phường 12',
    'Phường 13',
    'Phường 14',
    'Phường 15',
    'Phường 16',
    'Phường 17',
  ],
  'Quận Tân Bình': [
    'Phường 1',
    'Phường 2',
    'Phường 3',
    'Phường 4',
    'Phường 5',
    'Phường 6',
    'Phường 7',
    'Phường 8',
    'Phường 9',
    'Phường 10',
    'Phường 11',
    'Phường 12',
    'Phường 13',
    'Phường 14',
    'Phường 15',
  ],
  'Quận Tân Phú': [
    'Phường Tân Sơn Nhì',
    'Phường Tây Thạnh',
    'Phường Sơn Kỳ',
    'Phường Tân Quý',
    'Phường Tân Thành',
    'Phường Phú Thọ Hòa',
    'Phường Phú Thạnh',
    'Phường Phú Trung',
    'Phường Hòa Thạnh',
    'Phường Hiệp Tân',
    'Phường Tân Thới Hòa',
  ],
  'Quận 10': [
    'Phường 1',
    'Phường 2',
    'Phường 4',
    'Phường 6',
    'Phường 8',
    'Phường 9',
    'Phường 10',
    'Phường 12',
    'Phường 13',
    'Phường 14',
    'Phường 15',
  ],
  'Quận Hoàn Kiếm': [
    'Phường Hàng Bạc',
    'Phường Hàng Bài',
    'Phường Hàng Bồ',
    'Phường Hàng Bông',
    'Phường Hàng Buồm',
    'Phường Hàng Đào',
    'Phường Hàng Gai',
    'Phường Hàng Mã',
    'Phường Hàng Trống',
    'Phường Tràng Tiền',
    'Phường Trần Hưng Đạo',
    'Phường Lý Thái Tổ',
  ],
  'Quận Cầu Giấy': [
    'Phường Dịch Vọng',
    'Phường Dịch Vọng Hậu',
    'Phường Mai Dịch',
    'Phường Nghĩa Đô',
    'Phường Nghĩa Tân',
    'Phường Quan Hoa',
    'Phường Trung Hòa',
    'Phường Yên Hòa',
  ],
  'Quận Đống Đa': [
    'Phường Cát Linh',
    'Phường Hàng Bột',
    'Phường Khâm Thiên',
    'Phường Khương Thượng',
    'Phường Kim Liên',
    'Phường Láng Hạ',
    'Phường Láng Thượng',
    'Phường Nam Đồng',
    'Phường Ô Chợ Dừa',
    'Phường Phương Liên',
    'Phường Quang Trung',
    'Phường Trung Liệt',
    'Phường Văn Miếu',
  ],
  'Quận Ba Đình': [
    'Phường Cống Vị',
    'Phường Điện Biên',
    'Phường Đội Cấn',
    'Phường Giảng Võ',
    'Phường Kim Mã',
    'Phường Liễu Giai',
    'Phường Ngọc Hà',
    'Phường Ngọc Khánh',
    'Phường Nguyễn Trung Trực',
    'Phường Phúc Xá',
    'Phường Quán Thánh',
    'Phường Thành Công',
  ],
  'Quận Hải Châu': [
    'Phường Hải Châu 1',
    'Phường Hải Châu 2',
    'Phường Thạch Thang',
    'Phường Thanh Bình',
    'Phường Thuận Phước',
    'Phường Hòa Thuận Tây',
    'Phường Hòa Cường Bắc',
    'Phường Hòa Cường Nam',
    'Phường Bình Hiên',
    'Phường Phước Ninh',
  ],
  'Quận Ninh Kiều': [
    'Phường Tân An',
    'Phường An Hòa',
    'Phường Cái Khế',
    'Phường Thới Bình',
    'Phường Xuân Khánh',
    'Phường Hưng Lợi',
    'Phường An Khánh',
    'Phường An Bình',
  ],
};

// In-memory cache for live administrative tree fetched from Open API
interface CachedProvinceNode {
  code: number;
  name: string;
  districts?: Array<{
    code: number;
    name: string;
    wards?: Array<{ code: number; name: string }>;
  }>;
}

let cachedProvincesList: CachedProvinceNode[] | null = null;
const cachedProvinceDetailMap = new Map<number, CachedProvinceNode>();
const cachedDistrictWardsMap = new Map<number, string[]>();

async function ensureProvincesLoaded(): Promise<CachedProvinceNode[]> {
  if (cachedProvincesList && cachedProvincesList.length > 0) {
    return cachedProvincesList;
  }
  try {
    const res = await fetch('https://provinces.open-api.vn/api/?depth=1');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        cachedProvincesList = data;
        return data;
      }
    }
  } catch {
    // ignore network error, fallback to built-in data
  }
  return [];
}

/**
 * Returns districts for a given province/city name (combining built-in instant list + live API)
 */
export function getBuiltinDistrictsForCity(cityName: string): string[] {
  const canonical = matchVietnamProvince(cityName) || cityName.trim();
  if (BUILTIN_DISTRICTS_BY_CITY[canonical]) {
    return BUILTIN_DISTRICTS_BY_CITY[canonical];
  }
  // Also try matching without "TP. "
  for (const [key, list] of Object.entries(BUILTIN_DISTRICTS_BY_CITY)) {
    if (removeVietnameseTones(key) === removeVietnameseTones(canonical)) {
      return list;
    }
  }
  return [];
}

export async function fetchDistrictsForCity(cityName: string): Promise<string[]> {
  const builtin = getBuiltinDistrictsForCity(cityName);
  const canonical = matchVietnamProvince(cityName) || cityName.trim();
  if (!canonical) return builtin;

  try {
    const provinces = await ensureProvincesLoaded();
    const targetAscii = removeVietnameseTones(canonical).replace(/^tp\.?\s+/i, '');
    const matched = provinces.find((p) => {
      const pAscii = removeVietnameseTones(p.name)
        .replace(/^(?:tinh|thanh pho|tp\.?)\s+/i, '')
        .trim();
      return pAscii === targetAscii || pAscii.includes(targetAscii) || targetAscii.includes(pAscii);
    });

    if (matched) {
      let detail = cachedProvinceDetailMap.get(matched.code);
      if (!detail) {
        const res = await fetch(`https://provinces.open-api.vn/api/p/${matched.code}?depth=2`);
        if (res.ok) {
          detail = (await res.json()) as CachedProvinceNode;
          cachedProvinceDetailMap.set(matched.code, detail);
        }
      }
      if (detail && Array.isArray(detail.districts) && detail.districts.length > 0) {
        return detail.districts.map((d) =>
          d.name.replace(/^Thành phố\s+/i, 'TP. ')
        );
      }
    }
  } catch {
    // fallback to builtin
  }

  return builtin;
}

export function getBuiltinWardsForDistrict(districtName: string): string[] {
  const trimmed = districtName.trim();
  if (!trimmed) return [];
  if (BUILTIN_WARDS_BY_DISTRICT[trimmed]) {
    return BUILTIN_WARDS_BY_DISTRICT[trimmed];
  }
  const targetAscii = removeVietnameseTones(trimmed)
    .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
    .trim();

  for (const [key, list] of Object.entries(BUILTIN_WARDS_BY_DISTRICT)) {
    const keyAscii = removeVietnameseTones(key)
      .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
      .trim();
    if (keyAscii === targetAscii) {
      return list;
    }
  }
  return [];
}

export async function fetchWardsForDistrict(
  cityName: string,
  districtName: string
): Promise<string[]> {
  const builtin = getBuiltinWardsForDistrict(districtName);
  const canonicalCity = matchVietnamProvince(cityName) || cityName.trim();
  const cleanDistrict = districtName.trim();
  if (!canonicalCity || !cleanDistrict) return builtin;

  try {
    const provinces = await ensureProvincesLoaded();
    const cityAscii = removeVietnameseTones(canonicalCity).replace(/^tp\.?\s+/i, '');
    const matchedProvince = provinces.find((p) => {
      const pAscii = removeVietnameseTones(p.name)
        .replace(/^(?:tinh|thanh pho|tp\.?)\s+/i, '')
        .trim();
      return pAscii === cityAscii || pAscii.includes(cityAscii) || cityAscii.includes(pAscii);
    });

    if (matchedProvince) {
      let detail = cachedProvinceDetailMap.get(matchedProvince.code);
      if (!detail) {
        const res = await fetch(
          `https://provinces.open-api.vn/api/p/${matchedProvince.code}?depth=2`
        );
        if (res.ok) {
          detail = (await res.json()) as CachedProvinceNode;
          cachedProvinceDetailMap.set(matchedProvince.code, detail);
        }
      }

      const distAscii = removeVietnameseTones(cleanDistrict)
        .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
        .trim();

      const matchedDist = detail?.districts?.find((d) => {
        const dAscii = removeVietnameseTones(d.name)
          .replace(/^(?:quan|huyen|thi xa|thanh pho|tp\.?)\s+/i, '')
          .trim();
        return dAscii === distAscii || dAscii.includes(distAscii) || distAscii.includes(dAscii);
      });

      if (matchedDist) {
        const cachedWards = cachedDistrictWardsMap.get(matchedDist.code);
        if (cachedWards) return cachedWards;

        const wRes = await fetch(
          `https://provinces.open-api.vn/api/d/${matchedDist.code}?depth=2`
        );
        if (wRes.ok) {
          const wData = await wRes.json();
          if (wData && Array.isArray(wData.wards) && wData.wards.length > 0) {
            const wardsList = wData.wards.map((w: { name: string }) => w.name);
            cachedDistrictWardsMap.set(matchedDist.code, wardsList);
            return wardsList;
          }
        }
      }
    }
  } catch {
    // fallback to builtin
  }

  return builtin;
}

/**
 * Parses a pasted or typed Vietnamese full address string into structured fields:
 * `{ detailAddress, ward, district, city }`
 * Example: "123 Nguyễn Huệ, P. Bến Nghé, Quận 1, TP.HCM"
 */
export function parseSmartVietnameseAddress(rawInput: string): {
  city: string;
  district: string;
  ward: string;
  detailAddress: string;
} {
  const cleaned = rawInput
    .replace(/\r?\n/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { city: '', district: '', ward: '', detailAddress: '' };
  }

  const rawParts = cleaned
    .split(/[,;-]+/)
    .map((p) => p.trim())
    .filter(
      (p) =>
        p.length > 0 &&
        !/^\d{5,6}$/.test(p) &&
        !['việt nam', 'viet nam', 'vietnam', 'vn'].includes(p.toLowerCase())
    );

  let city = '';
  let district = '';
  let ward = '';
  const remainingParts: string[] = [];

  // Scan from right to left (most specific admin level at the end)
  for (let i = rawParts.length - 1; i >= 0; i--) {
    const part = rawParts[i];
    const lower = part.toLowerCase();
    const ascii = removeVietnameseTones(part);

    if (!city) {
      const matchedProv = matchVietnamProvince(part);
      if (matchedProv) {
        city = matchedProv;
        continue;
      }
    }

    if (
      !district &&
      (/^(?:quận|huyện|thị xã|tx\.?|tp\.?|thành phố|q\.?|h\.?)\s+/i.test(lower) ||
        ascii.includes('thu duc') ||
        (city &&
          getBuiltinDistrictsForCity(city).some(
            (d) =>
              removeVietnameseTones(d).replace(/^(?:quan|huyen|thi xa|tp\.?)\s+/i, '') ===
              ascii.replace(/^(?:quan|huyen|thi xa|tp\.?|q\.?|h\.?)\s+/i, '')
          )))
    ) {
      district = part
        .replace(/^q\.?\s*(\d+)/i, 'Quận $1')
        .replace(/^q\.?\s+/i, 'Quận ')
        .replace(/^h\.?\s+/i, 'Huyện ')
        .replace(/^tx\.?\s+/i, 'Thị xã ')
        .replace(/^Thành phố\s+/i, 'TP. ');
      continue;
    }

    if (
      !ward &&
      /^(?:phường|xã|thị trấn|p\.?|x\.?|tt\.?)\s*/i.test(lower) &&
      i > 0
    ) {
      ward = part
        .replace(/^p\.?\s*(\d+)/i, 'Phường $1')
        .replace(/^p\.?\s+/i, 'Phường ')
        .replace(/^x\.?\s+/i, 'Xã ')
        .replace(/^tt\.?\s+/i, 'Thị trấn ');
      continue;
    }

    remainingParts.unshift(part);
  }

  return {
    city,
    district,
    ward,
    detailAddress: remainingParts.join(', '),
  };
}
