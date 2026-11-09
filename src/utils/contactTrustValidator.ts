export interface PhoneTrustValidation {
  valid: boolean;
  normalized: string;
  carrier?: string;
  error?: string;
}

export interface EmailTrustValidation {
  valid: boolean;
  normalized: string;
  suggestion?: string;
  error?: string;
}

const CARRIER_PREFIX_MAP: Record<string, string> = {
  // Viettel
  '032': 'Viettel',
  '033': 'Viettel',
  '034': 'Viettel',
  '035': 'Viettel',
  '036': 'Viettel',
  '037': 'Viettel',
  '038': 'Viettel',
  '039': 'Viettel',
  '086': 'Viettel',
  '096': 'Viettel',
  '097': 'Viettel',
  '098': 'Viettel',
  // Vinaphone
  '081': 'Vinaphone',
  '082': 'Vinaphone',
  '083': 'Vinaphone',
  '084': 'Vinaphone',
  '085': 'Vinaphone',
  '088': 'Vinaphone',
  '091': 'Vinaphone',
  '094': 'Vinaphone',
  // Mobifone
  '070': 'Mobifone',
  '076': 'Mobifone',
  '077': 'Mobifone',
  '078': 'Mobifone',
  '079': 'Mobifone',
  '089': 'Mobifone',
  '090': 'Mobifone',
  '093': 'Mobifone',
  // Vietnamobile
  '052': 'Vietnamobile',
  '056': 'Vietnamobile',
  '058': 'Vietnamobile',
  '092': 'Vietnamobile',
  // Wintel / Gmobile
  '055': 'Wintel',
  '059': 'Gmobile',
  '099': 'Gmobile',
};

const SEQUENTIAL_PATTERNS = [
  '012345',
  '123456',
  '234567',
  '345678',
  '456789',
  '987654',
  '876543',
  '765432',
  '654321',
  '543210',
];

/**
 * Validates whether a phone number is a real Vietnamese mobile carrier number
 * and rejects dummy/random patterns (e.g. 0999999999, 0912345678, 0900000000, invalid prefixes).
 */
export function validateVietnamRealPhone(
  rawPhone: string
): PhoneTrustValidation {
  let cleaned = String(rawPhone || '')
    .trim()
    .replace(/[\s.\-()]/g, '');
  if (cleaned.startsWith('+84')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('84') && cleaned.length === 11) {
    cleaned = '0' + cleaned.slice(2);
  }

  if (!cleaned) {
    return {
      valid: false,
      normalized: '',
      error: 'Vui lòng nhập số điện thoại nhận hàng.',
    };
  }

  if (!/^0\d{9}$/.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Số điện thoại phải gồm đúng 10 chữ số bắt đầu bằng số 0 (VD: 0912xxxxxx).',
    };
  }

  const prefix = cleaned.slice(0, 3);
  const carrier = CARRIER_PREFIX_MAP[prefix];
  if (!carrier) {
    return {
      valid: false,
      normalized: cleaned,
      error: `Đầu số "${prefix}" không thuộc nhà mạng di động nào tại Việt Nam (Viettel, Vina, Mobi...). Bạn kiểm tra lại giúp Tiệm nhé!`,
    };
  }

  const subscriber = cleaned.slice(3); // last 7 digits

  // 1. Reject 5+ identical consecutive digits (e.g. 0999999999, 0900000000, 0911111111)
  if (/(\d)\1{4,}/.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Số điện thoại có dãy số lặp bất thường. Bạn yên tâm nhập SĐT thật để Shipper gọi giao hàng nhé — Tiệm cam kết bảo mật 100%, không gọi quảng cáo!',
    };
  }

  // 2. Reject sequential ascending/descending numbers (e.g. 0912345678, 0987654321)
  for (const seq of SEQUENTIAL_PATTERNS) {
    if (cleaned.includes(seq)) {
      return {
        valid: false,
        normalized: cleaned,
        error:
          'Số điện thoại có dãy số đếm liên tiếp không hợp lệ. Bạn vui lòng nhập SĐT thật đang hoạt động để Bưu tá liên hệ giao hàng nhé!',
      };
    }
  }

  // 3. Reject repeating 2-digit pairs across the last 6 digits (e.g. 0912121212, 0909090909)
  if (/^(\d\d)\1\1/.test(subscriber) || /(\d\d)\1\1$/.test(subscriber)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Số điện thoại có dấu hiệu gõ thử/số ảo. Bạn yên tâm nhập SĐT thật nhé — Tiệm cho phép Mở hộp kiểm tra hàng trước khi thanh toán!',
    };
  }

  // 4. Reject if the last 7 digits contain only 1 or 2 distinct digits total (e.g. 0912112112)
  const uniqueSubscriberDigits = new Set(subscriber.split('')).size;
  if (uniqueSubscriberDigits <= 2) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Số điện thoại chưa chính xác. Bạn vui lòng nhập SĐT thật để Shipper gọi giao tận tay nhé!',
    };
  }

  return {
    valid: true,
    normalized: cleaned,
    carrier,
  };
}

const FAKE_EMAIL_LOCAL_PARTS = new Set([
  'abc',
  'abcd',
  'abcde',
  'abcdef',
  'abcdefg',
  '123',
  '1234',
  '12345',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'test',
  'testing',
  'tester',
  'admin',
  'user',
  'guest',
  'khach',
  'khachhang',
  'fake',
  'none',
  'null',
  'asdf',
  'asdfg',
  'asdfgh',
  'asdfghjkl',
  'qwer',
  'qwerty',
  'qwertyuiop',
  'zxcv',
  'zxcvb',
  'zxcvbnm',
  'khongco',
  'khongbiet',
  'ahihi',
  'hahaha',
  'hehehe',
  'hihihi',
]);

const DOMAIN_TYPO_SUGGESTIONS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.vn': 'gmail.com',
  'gmail.con': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'outlok.com': 'outlook.com',
};

const BLOCKED_FAKE_DOMAINS = new Set([
  'test.com',
  'abc.com',
  '123.com',
  'example.com',
  'fake.com',
  'none.com',
  'mailinator.com',
  'yopmail.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
]);

const ALLOWED_TRUSTED_DOMAINS = new Set([
  'gmail.com',
  'icloud.com',
  'yahoo.com',
  'yahoo.com.vn',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'proton.me',
  'protonmail.com',
]);

/**
 * Validates that a customer email is a real, deliverable email address
 * and blocks random keyboard-mashed or dummy Gmails (e.g. abc@gmail.com, 123456@gmail.com, asdf@gmail.com).
 */
export function validateRealCustomerEmail(
  rawEmail: string
): EmailTrustValidation {
  const cleaned = String(rawEmail || '')
    .trim()
    .toLowerCase();

  if (!cleaned) {
    return {
      valid: false,
      normalized: '',
      error: 'Vui lòng nhập địa chỉ Email (Gmail) của bạn.',
    };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleaned)) {
    return {
      valid: false,
      normalized: cleaned,
      error: 'Định dạng Email chưa đúng (VD: tenban@gmail.com).',
    };
  }

  const [localPart, domain] = cleaned.split('@');
  if (!localPart || !domain) {
    return {
      valid: false,
      normalized: cleaned,
      error: 'Địa chỉ Email không hợp lệ.',
    };
  }

  if (DOMAIN_TYPO_SUGGESTIONS[domain]) {
    const fixed = `${localPart}@${DOMAIN_TYPO_SUGGESTIONS[domain]}`;
    return {
      valid: false,
      normalized: cleaned,
      suggestion: fixed,
      error: `Hình như bạn gõ nhầm tên miền "@${domain}". Ý bạn là "${fixed}" đúng không?`,
    };
  }

  if (BLOCKED_FAKE_DOMAINS.has(domain)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Tên miền Email này không tồn tại. Bạn vui lòng nhập Gmail thật để nhận mã vận đơn & thông báo đơn hàng nhé!',
    };
  }

  // Only allow trusted email providers or valid corporate/educational domains (.vn, .edu.vn, .com.vn)
  const isEduOrCorpVn =
    domain.endsWith('.edu.vn') ||
    domain.endsWith('.com.vn') ||
    domain.endsWith('.gov.vn') ||
    domain.endsWith('.org.vn') ||
    domain.endsWith('.edu');
  if (!ALLOWED_TRUSTED_DOMAINS.has(domain) && !isEduOrCorpVn) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Vui lòng sử dụng tài khoản Gmail (@gmail.com), iCloud, Outlook hoặc Email trường/cơ quan hợp lệ.',
    };
  }

  const cleanLocal = localPart.replace(/[._+-]/g, '');

  // Google strictly requires @gmail.com usernames to be at least 6 characters long
  if (domain === 'gmail.com' && cleanLocal.length < 6) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Tài khoản @gmail.com thật của Google luôn có từ 6 ký tự trở lên trước dấu @. Bạn vui lòng nhập đúng Gmail thật của mình nhé!',
    };
  }

  if (
    FAKE_EMAIL_LOCAL_PARTS.has(localPart) ||
    FAKE_EMAIL_LOCAL_PARTS.has(cleanLocal)
  ) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Email này có dấu hiệu là email gõ thử. Bạn yên tâm nhập Gmail thật nhé — Tiệm cam kết bảo mật 100%, chỉ gửi thông báo đơn hàng & phản hồi tư vấn!',
    };
  }

  // Reject all-identical characters (e.g. aaaaaa@gmail.com, 111111@gmail.com)
  if (/^(.)\1{4,}$/.test(cleanLocal)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Email có ký tự lặp bất thường. Bạn vui lòng nhập đúng Gmail thật đang sử dụng nhé!',
    };
  }

  // Reject pure digits without any letters on @gmail.com (e.g. 0912345678@gmail.com or 12345678@gmail.com)
  if (domain === 'gmail.com' && /^\d+$/.test(cleanLocal)) {
    return {
      valid: false,
      normalized: cleaned,
      error:
        'Tài khoản @gmail.com luôn phải có chữ cái (không thể chỉ toàn chữ số). Bạn kiểm tra lại Gmail giúp Tiệm nhé!',
    };
  }

  // Reject sequential keyboard mashes
  for (const seq of SEQUENTIAL_PATTERNS) {
    if (cleanLocal === seq || cleanLocal === `a${seq}`) {
      return {
        valid: false,
        normalized: cleaned,
        error:
          'Email chưa chính xác. Bạn yên tâm nhập Gmail thật để theo dõi hành trình đơn hàng nhé!',
      };
    }
  }

  return {
    valid: true,
    normalized: cleaned,
  };
}
