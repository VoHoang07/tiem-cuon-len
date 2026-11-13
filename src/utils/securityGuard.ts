import { supabase } from '@/services/supabase';
import { Dimensions, Platform } from 'react-native';

export type SecurityEventType =
  | 'PAGE_VISIT'
  | 'PRODUCT_VIEW'
  | 'PRODUCT_ENGAGED'
  | 'CART_ADD_ITEM'
  | 'CART_REMOVE_ITEM'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_ORDER_CREATED'
  | 'CHAT_OPENED'
  | 'CHAT_MESSAGE_SENT'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_REGISTER_FAILED'
  | 'RATE_LIMIT_TRIGGERED'
  | 'BOT_TRAP_TRIGGERED'
  | 'BLOCKED_IP_ATTEMPT'
  | 'ADMIN_SECURITY_ACTION'
  | 'SERVER_API_ERROR';

export type SecuritySeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface SecurityAuditEntry {
  id: string;
  ip: string;
  location: string;
  asn: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  path: string;
  method: string;
  userEmail: string;
  userId?: string | null;
  visitorId?: string;
  sessionId?: string;
  visitorNumber?: number;
  isAdminActor?: boolean;
  customerName?: string;
  customerPhone?: string;
  userAgent: string;
  screenSize: string;
  language: string;
  referer: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface BlockedIpEntry {
  id: string;
  ip: string;
  reason: string;
  blockedBy: string;
  createdAt: string;
}

export type VisitorStage =
  | 'ordered'
  | 'checkout_abandoned'
  | 'cart_added'
  | 'chatting'
  | 'viewing_product'
  | 'browsing';

export interface VisitorTimelineStep {
  id: string;
  timestamp: string;
  eventType: SecurityEventType;
  icon: string;
  title: string;
  subtitle?: string;
  highlightColor?: string;
  highlightBg?: string;
  durationSec?: number;
  path: string;
}

export interface VisitorProfileSummary {
  profileKey: string;
  visitorId: string;
  shortCode: string;
  displayName: string;
  isIdentified: boolean;
  isAdmin: boolean;
  email: string | null;
  phone: string | null;
  ip: string;
  allIps: string[];
  location: string;
  asn: string;
  deviceSummary: string;
  screenSize: string;
  userAgent: string;
  trafficSource: TrafficSourceClassification;
  visitCount: number;
  sessionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isOnlineNow: boolean;
  estimatedDurationSec: number;
  stage: VisitorStage;
  stageBadge: {
    label: string;
    bg: string;
    color: string;
  };
  viewedProducts: {
    id: string;
    name: string;
    variant?: string;
    price?: number;
    maxDurationSec: number;
    views: number;
  }[];
  cartProducts: {
    name: string;
    variant?: string;
    quantity: number;
    price?: number;
  }[];
  ordersCreated: {
    orderId: string;
    total: number;
    paymentMethod?: string;
    timestamp: string;
  }[];
  chatMessagesCount: number;
  alertEventsCount: number;
  timeline: VisitorTimelineStep[];
}

const LOCAL_AUDIT_KEY = 'tcl_security_audit_logs_v1';
const LOCAL_BLOCKLIST_KEY = 'tcl_security_blocklist_v1';
const LOCAL_RATE_LIMIT_PREFIX = 'tcl_ratelimit_v2_';
const LOCAL_TELEMETRY_CACHE_KEY = 'tcl_client_telemetry_v1';
const FIRST_TOUCH_SOURCE_KEY = 'tcl_first_touch_source_v2';
const SELF_REPORTED_SOURCE_KEY = 'tcl_self_reported_source_v1';

// Persistent Visitor & Session Identity Keys
const VISITOR_ID_STORAGE_KEY = 'tcl_visitor_id_v1';
const VISITOR_COUNT_STORAGE_KEY = 'tcl_visitor_visit_count_v1';
const VISITOR_LAST_SESSION_TS_KEY = 'tcl_visitor_last_session_ts_v1';
const VISITOR_KNOWN_IDENTITY_KEY = 'tcl_visitor_known_identity_v1';
const SESSION_ID_STORAGE_KEY = 'tcl_active_session_id_v1';

const KNOWN_ADMIN_EMAILS = new Set([
  'vohoang1327@gmail.com',
  'khanhly30072007@gmail.com',
]);

export function isKnownAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return KNOWN_ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}

export interface VisitorKnownIdentity {
  name?: string;
  email?: string;
  phone?: string;
  userId?: string;
}

export function getOrCreateVisitorIdentity(): {
  visitorId: string;
  sessionId: string;
  visitorNumber: number;
  known: VisitorKnownIdentity;
} {
  let visitorId = 'vis_guest';
  let sessionId = 'ses_default';
  let visitorNumber = 1;
  let known: VisitorKnownIdentity = {};

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedVid = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);
      if (savedVid && savedVid.startsWith('vis_')) {
        visitorId = savedVid;
      } else {
        const rand =
          Math.random().toString(36).slice(2, 6).toUpperCase() +
          Date.now().toString(36).slice(-4).toUpperCase();
        visitorId = `vis_${rand}`;
        window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
      }

      const rawCount = Number(
        window.localStorage.getItem(VISITOR_COUNT_STORAGE_KEY) || '0'
      );
      const lastTs = Number(
        window.localStorage.getItem(VISITOR_LAST_SESSION_TS_KEY) || '0'
      );
      const now = Date.now();

      const existingSid = window.sessionStorage?.getItem(SESSION_ID_STORAGE_KEY);
      if (existingSid && now - lastTs < 30 * 60 * 1000) {
        sessionId = existingSid;
        visitorNumber = Math.max(1, rawCount || 1);
        window.localStorage.setItem(VISITOR_LAST_SESSION_TS_KEY, String(now));
      } else {
        sessionId = `ses_${now.toString(36)}_${Math.random()
          .toString(36)
          .slice(2, 6)}`;
        visitorNumber = Math.max(1, rawCount + 1);
        window.sessionStorage?.setItem(SESSION_ID_STORAGE_KEY, sessionId);
        window.localStorage.setItem(
          VISITOR_COUNT_STORAGE_KEY,
          String(visitorNumber)
        );
        window.localStorage.setItem(VISITOR_LAST_SESSION_TS_KEY, String(now));
      }

      const rawKnown = window.localStorage.getItem(VISITOR_KNOWN_IDENTITY_KEY);
      if (rawKnown) {
        const parsed = JSON.parse(rawKnown);
        if (parsed && typeof parsed === 'object') {
          known = parsed as VisitorKnownIdentity;
        }
      }
    }
  } catch {
    // ignore storage errors
  }

  return { visitorId, sessionId, visitorNumber, known };
}

export function rememberVisitorKnownIdentity(
  partial: VisitorKnownIdentity
): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const raw = window.localStorage.getItem(VISITOR_KNOWN_IDENTITY_KEY);
    const prev: VisitorKnownIdentity = raw ? JSON.parse(raw) : {};
    const next: VisitorKnownIdentity = {
      name: partial.name?.trim() || prev.name,
      email:
        partial.email &&
        partial.email !== 'Khách (Guest)' &&
        partial.email.includes('@')
          ? partial.email.trim().toLowerCase()
          : prev.email,
      phone: partial.phone?.trim() || prev.phone,
      userId: partial.userId?.trim() || prev.userId,
    };
    window.localStorage.setItem(
      VISITOR_KNOWN_IDENTITY_KEY,
      JSON.stringify(next)
    );
  } catch {
    // ignore
  }
}

export type TrafficChannelCategory =
  | 'tiktok'
  | 'google_search'
  | 'copy_paste_direct'
  | 'social_zalo_fb_ig'
  | 'other_referral';

export interface TrafficSourceClassification {
  category: TrafficChannelCategory;
  badgeLabel: string;
  detailLabel: string;
  bg: string;
  color: string;
}

export function getVisitorSelfReportedSource(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(SELF_REPORTED_SOURCE_KEY) || '';
    }
  } catch {
    // ignore
  }
  return '';
}

export function setVisitorSelfReportedSource(sourceLabel: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(SELF_REPORTED_SOURCE_KEY, sourceLabel);
      window.localStorage.setItem(
        FIRST_TOUCH_SOURCE_KEY,
        `[Khách xác nhận: ${sourceLabel}]`
      );
    }
  } catch {
    // ignore
  }
}

/**
 * Captures and persists the visitor's VERY FIRST external entry source
 * so navigating internally (/ -> /product -> /checkout) never overwrites how they found the shop.
 */
export function getOrCaptureVisitorTrafficSource(): string {
  try {
    if (typeof window === 'undefined') return 'Direct';

    const selfReported = getVisitorSelfReportedSource();
    const urlSearch = (window.location?.search || '').toLowerCase();
    const ua = getClientUserAgent();
    const rawRef = (typeof document !== 'undefined' && document.referrer) || '';
    const refLower = rawRef.toLowerCase();
    const isInternalRef =
      refLower.includes('tiemcuonlen.shop') ||
      refLower.includes('localhost') ||
      refLower.includes('127.0.0.1');

    // 1. Check URL query tags if present (ttclid, fbclid, gclid, utm_source)
    let detectedNow = '';
    if (urlSearch.includes('ttclid') || urlSearch.includes('tiktok')) {
      detectedNow = '🎵 TikTok';
    } else if (
      urlSearch.includes('fbclid') ||
      urlSearch.includes('utm_source=fb') ||
      urlSearch.includes('facebook')
    ) {
      detectedNow = '📘 Facebook / Messenger';
    } else if (
      urlSearch.includes('gclid') ||
      urlSearch.includes('utm_source=google')
    ) {
      detectedNow = '🔍 Google Search / Đề xuất';
    } else if (urlSearch.includes('zalo')) {
      detectedNow = '💬 Zalo';
    }

    // 2. Check In-App Browser User-Agent signatures
    if (!detectedNow) {
      if (/BytedanceWebview|musical_ly|TikTok|ByteLocale/i.test(ua)) {
        detectedNow = '🎵 Mở trực tiếp trong App TikTok';
      } else if (/FBAN|FBAV|Messenger/i.test(ua)) {
        detectedNow = '📘 Mở trong App Facebook / Messenger';
      } else if (/Zalo/i.test(ua)) {
        detectedNow = '💬 Mở trong App Zalo';
      } else if (/Instagram|Barcelona/i.test(ua)) {
        detectedNow = '🌸 Mở trong App Instagram / Threads';
      } else if (/GSA\//i.test(ua)) {
        detectedNow = '🔍 App Google Search trên Điện thoại';
      }
    }

    // 3. Check external document.referrer (ignoring internal tiemcuonlen.shop pages)
    if (!detectedNow && rawRef && !isInternalRef) {
      if (refLower.includes('google.')) {
        detectedNow = '🔍 Tìm kiếm Google';
      } else if (
        refLower.includes('bing.com') ||
        refLower.includes('coccoc.com') ||
        refLower.includes('yahoo.com') ||
        refLower.includes('duckduckgo.com')
      ) {
        detectedNow = `🔍 Tìm kiếm Web (${rawRef.slice(0, 60)})`;
      } else if (refLower.includes('tiktok.com')) {
        detectedNow = '🎵 TikTok Web';
      } else if (
        refLower.includes('facebook.com') ||
        refLower.includes('fb.com')
      ) {
        detectedNow = '📘 Facebook';
      } else if (
        refLower.includes('instagram.com') ||
        refLower.includes('threads.net')
      ) {
        detectedNow = '🌸 Instagram / Threads';
      } else if (refLower.includes('zalo.me')) {
        detectedNow = '💬 Zalo';
      } else {
        detectedNow = `🌐 Web giới thiệu: ${rawRef.slice(0, 80)}`;
      }
    }

    if (detectedNow) {
      window.localStorage?.setItem(FIRST_TOUCH_SOURCE_KEY, detectedNow);
      return selfReported
        ? `${detectedNow} • [Khách chọn: ${selfReported}]`
        : detectedNow;
    }

    // 4. Read previously saved first-touch source from this visitor's browser
    const savedFirstTouch = window.localStorage?.getItem(FIRST_TOUCH_SOURCE_KEY);
    if (savedFirstTouch && !savedFirstTouch.includes('tiemcuonlen.shop')) {
      return selfReported && !savedFirstTouch.includes(selfReported)
        ? `${savedFirstTouch} • [Khách chọn: ${selfReported}]`
        : savedFirstTouch;
    }

    // 5. No external referrer -> Visitor typed/pasted "tiemcuonlen.shop" (e.g. saw domain text on TikTok video/comment)
    const isMobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const fallbackDirect = isMobileUa
      ? `📋 Gõ / Dán tên web trên Điện thoại (${
          isIos ? 'iPhone Safari/Chrome' : 'Android Chrome'
        } — Xem tên web từ video/bình luận TikTok)`
      : '📋 Gõ / Dán trực tiếp tên web trên Máy tính';

    window.localStorage?.setItem(FIRST_TOUCH_SOURCE_KEY, fallbackDirect);
    return selfReported
      ? `${fallbackDirect} • [Khách chọn: ${selfReported}]`
      : fallbackDirect;
  } catch {
    return 'Direct';
  }
}

/**
 * Classifies any SecurityAuditEntry into a human-friendly Traffic Source badge
 */
export function classifyAuditEntryTrafficSource(
  entry: SecurityAuditEntry
): TrafficSourceClassification {
  const ref = String(entry.referer || '').trim();
  const refLower = ref.toLowerCase();
  const ua = String(entry.userAgent || '');
  const detailsSource = String(
    (entry.details && (entry.details as any).trafficSource) ||
      (entry.details && (entry.details as any).howFoundShop) ||
      ''
  ).toLowerCase();
  const combined = `${refLower} ${detailsSource}`;

  // 1. TikTok (In-App or customer self-reported TikTok)
  if (
    combined.includes('tiktok') ||
    /BytedanceWebview|musical_ly|TikTok|ByteLocale/i.test(ua)
  ) {
    return {
      category: 'tiktok',
      badgeLabel: '🎵 Nguồn: TikTok',
      detailLabel:
        ref && !refLower.includes('tiemcuonlen.shop')
          ? ref
          : 'Khách vào từ App TikTok hoặc xác nhận biết Tiệm qua kênh TikTok',
      bg: '#FCE7F3',
      color: '#9D174D',
    };
  }

  // 2. Google Search / Cốc Cốc / Bing Organic Search
  if (
    combined.includes('google') ||
    combined.includes('tìm kiếm') ||
    combined.includes('coccoc') ||
    combined.includes('bing.com') ||
    combined.includes('yahoo.com') ||
    /GSA\/|coc_coc_browser/i.test(ua)
  ) {
    return {
      category: 'google_search',
      badgeLabel: '🔍 Nguồn: Tìm kiếm Google / Cốc Cốc',
      detailLabel:
        ref && !refLower.includes('tiemcuonlen.shop')
          ? ref
          : 'Khách tự gõ tìm kiếm trên Google / Cốc Cốc rồi bấm vào web',
      bg: '#DCFCE7',
      color: '#166534',
    };
  }

  // 3. Zalo / Facebook / Instagram / Messenger
  if (
    combined.includes('facebook') ||
    combined.includes('zalo') ||
    combined.includes('instagram') ||
    combined.includes('threads') ||
    combined.includes('bạn bè') ||
    /FBAN|FBAV|Messenger|Zalo|Instagram|Barcelona/i.test(ua)
  ) {
    return {
      category: 'social_zalo_fb_ig',
      badgeLabel: '💬 Nguồn: Zalo / Facebook / IG',
      detailLabel:
        ref && !refLower.includes('tiemcuonlen.shop')
          ? ref
          : 'Mở từ tin nhắn Zalo, Facebook, Messenger hoặc Instagram',
      bg: '#E0F2FE',
      color: '#075985',
    };
  }

  // 4. External website referral (not tiemcuonlen.shop)
  if (
    ref &&
    ref !== 'Direct' &&
    !refLower.includes('tiemcuonlen.shop') &&
    !refLower.includes('localhost') &&
    !refLower.startsWith('📋')
  ) {
    return {
      category: 'other_referral',
      badgeLabel: '🌐 Nguồn: Web giới thiệu ngoài',
      detailLabel: ref,
      bg: '#F3E8FF',
      color: '#6B21A8',
    };
  }

  // 5. Typed or Pasted domain text (e.g. saw "tiemcuonlen.shop" in TikTok video/caption/comments)
  const isMobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  return {
    category: 'copy_paste_direct',
    badgeLabel: isMobileUa
      ? '📋 Gõ / Dán tên web trên Điện thoại'
      : '📋 Gõ / Dán tên web trên Máy tính',
    detailLabel: isMobileUa
      ? `Khách thấy tên web trên video/bình luận rồi gõ/dán vào ${
          isIos ? 'Safari/Chrome iPhone' : 'Chrome Android'
        }`
      : 'Khách gõ trực tiếp hoặc dán tiemcuonlen.shop trên trình duyệt máy tính',
    bg: '#FEF3C7',
    color: '#92400E',
  };
}

/**
 * Parses raw User-Agent + ScreenSize into a clear human-readable Vietnamese device string
 */
export function parseFriendlyDeviceLabel(
  userAgent: string,
  screenSize?: string
): string {
  const ua = String(userAgent || '');
  if (!ua) return 'Thiết bị Web';

  let device = 'Máy tính';
  if (/iPhone/i.test(ua)) {
    const iosMatch = ua.match(/OS (\d+)[._](\d+)/);
    const iosVer = iosMatch ? ` (iOS ${iosMatch[1]}.${iosMatch[2]})` : '';
    device = `📱 iPhone${iosVer}`;
  } else if (/iPad/i.test(ua)) {
    device = '📱 iPad';
  } else if (/Android/i.test(ua)) {
    const modelMatch = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|\))/i);
    const model = modelMatch?.[1]?.trim();
    if (model && model.length <= 28 && model !== 'K') {
      device = `📱 Android (${model})`;
    } else {
      device = '📱 Điện thoại Android';
    }
  } else if (/Macintosh|Mac OS X/i.test(ua)) {
    device = '💻 Máy Mac (macOS)';
  } else if (/Windows NT/i.test(ua)) {
    device = '💻 Máy tính Windows';
  } else if (/Linux/i.test(ua)) {
    device = '💻 Máy tính Linux';
  }

  let browser = 'Trình duyệt';
  if (/BytedanceWebview|musical_ly|TikTok/i.test(ua)) {
    browser = 'Mở trong App TikTok';
  } else if (/Zalo/i.test(ua)) {
    browser = 'Mở trong App Zalo';
  } else if (/FBAN|FBAV|Messenger/i.test(ua)) {
    browser = 'Mở trong App Facebook/Messenger';
  } else if (/Instagram/i.test(ua)) {
    browser = 'Mở trong App Instagram';
  } else if (/coc_coc_browser/i.test(ua)) {
    browser = 'Cốc Cốc';
  } else if (/Edg\//i.test(ua)) {
    browser = 'Edge';
  } else if (/CriOS|Chrome\//i.test(ua)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/Firefox\//i.test(ua)) {
    browser = 'Firefox';
  }

  const sizeSuffix =
    screenSize && screenSize !== 'unknown' ? ` • Màn ${screenSize}` : '';
  return `${device} • ${browser}${sizeSuffix}`;
}

export function formatFriendlyDuration(totalSec: number): string {
  const sec = Math.max(0, Math.round(totalSec));
  if (sec <= 5) return 'Vừa mở trang';
  if (sec < 60) return `${sec} giây`;
  const mins = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (mins < 60) {
    return remSec > 0 ? `${mins} phút ${remSec}s` : `${mins} phút`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours} giờ ${remMins} phút`;
}

function describeRouteFriendly(path: string): string {
  const clean = (path || '/').split('?')[0];
  if (clean === '/' || clean === '') return 'Trang chủ cửa hàng';
  if (clean === '/cart') return 'Trang Giỏ hàng';
  if (clean === '/checkout') return 'Trang Thanh toán đơn hàng';
  if (clean === '/login') return 'Trang Đăng nhập';
  if (clean === '/register') return 'Trang Đăng ký tài khoản';
  if (clean === '/favorites') return 'Danh sách Yêu thích';
  if (clean === '/orders' || clean.startsWith('/orders/')) return 'Lịch sử Đơn hàng';
  if (clean.startsWith('/payment/')) return 'Trang Quét mã QR Thanh toán';
  if (clean.startsWith('/product/')) return 'Trang Chi tiết Sản phẩm';
  if (clean === '/addresses' || clean.startsWith('/addresses/'))
    return 'Sổ địa chỉ nhận hàng';
  if (clean === '/profile' || clean.startsWith('/profile/'))
    return 'Trang Tài khoản cá nhân';
  if (clean === '/help') return 'Trang Hỗ trợ';
  if (clean === '/privacy') return 'Trung tâm Bảo mật';
  return clean;
}

function buildTimelineStepFromEntry(
  entry: SecurityAuditEntry
): VisitorTimelineStep {
  const d = (entry.details || {}) as Record<string, any>;
  const productName = d.productName ? String(d.productName) : '';
  const variant = d.variant ? String(d.variant) : '';
  const priceNum = Number(d.price || d.total || 0);
  const priceStr =
    priceNum > 0 ? `${priceNum.toLocaleString('vi-VN')}₫` : '';
  const durationSec = Number(d.durationSec || 0) || undefined;

  switch (entry.eventType) {
    case 'PRODUCT_VIEW':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🧶',
        title: productName
          ? `Xem sản phẩm: ${productName}`
          : 'Xem chi tiết sản phẩm',
        subtitle: [
          variant ? `Mẫu đang xem: ${variant}` : '',
          priceStr ? `Giá: ${priceStr}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        highlightBg: '#FEF3C7',
        highlightColor: '#92400E',
        path: entry.path,
      };

    case 'PRODUCT_ENGAGED':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '⏱️',
        title: productName
          ? `Đứng xem kỹ "${productName}" (${formatFriendlyDuration(
              durationSec || 15
            )})`
          : `Đứng xem sản phẩm (${formatFriendlyDuration(durationSec || 15)})`,
        subtitle: variant ? `Đã bấm xem mẫu: ${variant}` : undefined,
        durationSec,
        path: entry.path,
      };

    case 'CART_ADD_ITEM':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🛒',
        title: productName
          ? `Thêm vào giỏ: ${productName} (×${Number(d.quantity || 1)})`
          : 'Thêm sản phẩm vào giỏ hàng',
        subtitle: [
          variant ? `Phân loại: ${variant}` : '',
          d.packaging ? String(d.packaging) : '',
          priceStr ? `Đơn giá: ${priceStr}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        highlightBg: '#E0F2FE',
        highlightColor: '#0369A1',
        path: entry.path,
      };

    case 'CART_REMOVE_ITEM':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🗑️',
        title: productName
          ? `Bỏ khỏi giỏ: ${productName}`
          : 'Xoá 1 sản phẩm khỏi giỏ hàng',
        path: entry.path,
      };

    case 'CHECKOUT_STARTED':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '💳',
        title: `Mở trang Thanh toán (${Number(d.itemCount || 1)} sản phẩm${
          priceStr ? ` • ${priceStr}` : ''
        })`,
        subtitle: d.summary ? String(d.summary) : undefined,
        highlightBg: '#FFEDD5',
        highlightColor: '#C2410C',
        path: entry.path,
      };

    case 'CHECKOUT_ORDER_CREATED':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🎉',
        title: `Đặt đơn hàng thành công ${
          d.orderId ? `#${String(d.orderId)}` : ''
        }${priceStr ? ` — ${priceStr}` : ''}`,
        subtitle: [
          d.paymentMethod ? String(d.paymentMethod) : '',
          d.shippingMethod ? String(d.shippingMethod) : '',
          d.howFoundShop ? `Nguồn khách chọn: ${String(d.howFoundShop)}` : '',
        ]
          .filter(Boolean)
          .join(' • '),
        highlightBg: '#DCFCE7',
        highlightColor: '#15803D',
        path: entry.path,
      };

    case 'CHAT_OPENED':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '💬',
        title: productName
          ? `Mở khung Chat hỏi về: ${productName}`
          : 'Mở khung Chat tư vấn với Tiệm',
        path: entry.path,
      };

    case 'CHAT_MESSAGE_SENT':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '✉️',
        title: 'Gửi tin nhắn cho Tiệm trong khung Chat',
        subtitle: d.preview
          ? `"${String(d.preview)}"`
          : productName
            ? `Đính kèm SP: ${productName}`
            : undefined,
        highlightBg: '#F3E8FF',
        highlightColor: '#6B21A8',
        path: entry.path,
      };

    case 'AUTH_LOGIN_SUCCESS':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🔑',
        title: `Đăng nhập tài khoản (${entry.userEmail})`,
        path: entry.path,
      };

    case 'AUTH_REGISTER_SUCCESS':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '✨',
        title: `Đăng ký tài khoản mới (${entry.userEmail})`,
        highlightBg: '#DCFCE7',
        highlightColor: '#15803D',
        path: entry.path,
      };

    case 'AUTH_LOGIN_FAILED':
    case 'AUTH_REGISTER_FAILED':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '⚠️',
        title:
          entry.eventType === 'AUTH_LOGIN_FAILED'
            ? 'Nhập sai mật khẩu / Đăng nhập thất bại'
            : 'Đăng ký thất bại',
        subtitle: d.reason ? String(d.reason) : entry.userEmail,
        highlightBg: '#FEE2E2',
        highlightColor: '#B91C1C',
        path: entry.path,
      };

    case 'BOT_TRAP_TRIGGERED':
    case 'RATE_LIMIT_TRIGGERED':
    case 'BLOCKED_IP_ATTEMPT':
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '🛡️',
        title: `Cảnh báo bảo mật: ${entry.eventType}`,
        subtitle: d.reason ? String(d.reason) : undefined,
        highlightBg: '#FEE2E2',
        highlightColor: '#991B1B',
        path: entry.path,
      };

    case 'PAGE_VISIT':
    default:
      return {
        id: entry.id,
        timestamp: entry.timestamp,
        eventType: entry.eventType,
        icon: '👣',
        title: `Mở ${describeRouteFriendly(entry.path)}`,
        subtitle:
          entry.path && entry.path !== '/' ? `Đường dẫn: ${entry.path}` : undefined,
        path: entry.path,
      };
  }
}

/**
 * Aggregates raw audit logs + orders + live chat conversations into clean, stitched per-human Visitor Profiles
 */
export function buildVisitorProfilesFromLogs(
  logs: SecurityAuditEntry[],
  options?: {
    orders?: {
      id: string;
      userId?: string;
      total: number;
      paymentMethod?: string;
      createdAt: string;
      shippingAddress?: {
        fullName?: string;
        phone?: string;
        email?: string;
      };
    }[];
    conversations?: {
      conversationId: string;
      customerName: string;
      customerEmail?: string;
      messages: { senderRole: string; text: string; createdAt: string }[];
    }[];
  }
): VisitorProfileSummary[] {
  const orders = options?.orders || [];
  const conversations = options?.conversations || [];

  // Map email/userId -> real customer identity from Orders & Chat
  const identityByEmail = new Map<
    string,
    { name?: string; phone?: string; email: string }
  >();
  const identityByUserId = new Map<
    string,
    { name?: string; phone?: string; email?: string }
  >();

  for (const ord of orders) {
    const email = ord.shippingAddress?.email?.trim().toLowerCase();
    const fullName = ord.shippingAddress?.fullName?.trim();
    const phone = ord.shippingAddress?.phone?.trim();
    if (email) {
      identityByEmail.set(email, {
        email,
        name: fullName || identityByEmail.get(email)?.name,
        phone: phone || identityByEmail.get(email)?.phone,
      });
    }
    if (ord.userId) {
      identityByUserId.set(String(ord.userId), {
        name: fullName || identityByUserId.get(String(ord.userId))?.name,
        phone: phone || identityByUserId.get(String(ord.userId))?.phone,
        email: email || identityByUserId.get(String(ord.userId))?.email,
      });
    }
  }

  for (const conv of conversations) {
    const email = conv.customerEmail?.trim().toLowerCase();
    const cname =
      conv.customerName && conv.customerName !== 'Khách hàng'
        ? conv.customerName.trim()
        : undefined;
    if (email && !identityByEmail.has(email)) {
      identityByEmail.set(email, { email, name: cname });
    }
  }

  // Group logs by persistent visitorId (or fallback IP + Device fingerprint for older logs without visitorId)
  // Also stitch together if two visitorIds logged into the exact same real userEmail!
  const visitorIdToCanonicalKey = new Map<string, string>();
  const emailToCanonicalKey = new Map<string, string>();

  // Chronological pass (oldest -> newest) so first visitorId becomes canonical key
  const sortedAsc = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const getRawGroupKey = (entry: SecurityAuditEntry): string => {
    if (entry.visitorId && entry.visitorId.trim()) {
      return entry.visitorId.trim();
    }
    const shortUa = String(entry.userAgent || '')
      .replace(/\s+/g, '')
      .slice(0, 48);
    return `legacy_${entry.ip || 'unknown'}_${entry.screenSize || ''}_${shortUa}`;
  };

  for (const entry of sortedAsc) {
    const rawKey = getRawGroupKey(entry);
    const cleanEmail =
      entry.userEmail &&
      entry.userEmail !== 'Khách (Guest)' &&
      entry.userEmail.includes('@')
        ? entry.userEmail.trim().toLowerCase()
        : '';

    let canonical = visitorIdToCanonicalKey.get(rawKey);
    if (!canonical && cleanEmail && emailToCanonicalKey.has(cleanEmail)) {
      canonical = emailToCanonicalKey.get(cleanEmail)!;
    }
    if (!canonical) {
      canonical = rawKey;
    }
    visitorIdToCanonicalKey.set(rawKey, canonical);
    if (cleanEmail) {
      emailToCanonicalKey.set(cleanEmail, canonical);
    }
  }

  const grouped = new Map<string, SecurityAuditEntry[]>();
  for (const entry of sortedAsc) {
    if (entry.eventType === 'ADMIN_SECURITY_ACTION') continue;
    const rawKey = getRawGroupKey(entry);
    const canonical = visitorIdToCanonicalKey.get(rawKey) || rawKey;
    const list = grouped.get(canonical) || [];
    list.push(entry);
    grouped.set(canonical, list);
  }

  const nowMs = Date.now();
  const profiles: VisitorProfileSummary[] = [];

  for (const [profileKey, entries] of grouped.entries()) {
    if (entries.length === 0) continue;

    const firstEntry = entries[0];
    const latestEntry = entries[entries.length - 1];

    let resolvedEmail: string | null = null;
    let resolvedName: string | null = null;
    let resolvedPhone: string | null = null;
    let resolvedUserId: string | null = null;
    let isAdmin = false;
    let maxVisitorNum = 1;
    const sessionSet = new Set<string>();
    const ipSet = new Set<string>();

    const viewedMap = new Map<
      string,
      {
        id: string;
        name: string;
        variant?: string;
        price?: number;
        maxDurationSec: number;
        views: number;
      }
    >();
    const cartMap = new Map<
      string,
      { name: string; variant?: string; quantity: number; price?: number }
    >();
    const ordersCreated: {
      orderId: string;
      total: number;
      paymentMethod?: string;
      timestamp: string;
    }[] = [];
    let chatMessagesCount = 0;
    let alertEventsCount = 0;
    let sawCheckoutPage = false;

    for (const e of entries) {
      if (e.ip && e.ip !== 'unknown') ipSet.add(e.ip);
      if (e.sessionId) sessionSet.add(e.sessionId);
      if (e.visitorNumber && e.visitorNumber > maxVisitorNum) {
        maxVisitorNum = e.visitorNumber;
      }
      if (e.isAdminActor || isKnownAdminEmail(e.userEmail)) {
        isAdmin = true;
      }
      if (
        e.userEmail &&
        e.userEmail !== 'Khách (Guest)' &&
        e.userEmail.includes('@')
      ) {
        resolvedEmail = e.userEmail.trim().toLowerCase();
      }
      if (e.userId) {
        resolvedUserId = e.userId;
      }
      if (e.customerName && e.customerName.trim()) {
        resolvedName = e.customerName.trim();
      }
      if (e.customerPhone && e.customerPhone.trim()) {
        resolvedPhone = e.customerPhone.trim();
      }

      const d = (e.details || {}) as Record<string, any>;
      if (d.customerName && String(d.customerName).trim()) {
        resolvedName = String(d.customerName).trim();
      }
      if (d.customerPhone && String(d.customerPhone).trim()) {
        resolvedPhone = String(d.customerPhone).trim();
      }
      if (
        d.customerEmail &&
        String(d.customerEmail).includes('@') &&
        !resolvedEmail
      ) {
        resolvedEmail = String(d.customerEmail).trim().toLowerCase();
      }

      if (e.path === '/checkout' || e.eventType === 'CHECKOUT_STARTED') {
        sawCheckoutPage = true;
      }

      if (
        e.eventType === 'PRODUCT_VIEW' ||
        e.eventType === 'PRODUCT_ENGAGED'
      ) {
        const pid = String(d.productId || e.path || 'unknown');
        const pname = String(d.productName || pid);
        const prev = viewedMap.get(pid);
        const dur = Number(d.durationSec || 0);
        viewedMap.set(pid, {
          id: pid,
          name: pname,
          variant: d.variant ? String(d.variant) : prev?.variant,
          price: Number(d.price || prev?.price || 0) || undefined,
          maxDurationSec: Math.max(prev?.maxDurationSec || 0, dur),
          views:
            (prev?.views || 0) + (e.eventType === 'PRODUCT_VIEW' ? 1 : 0),
        });
      }

      if (e.eventType === 'CART_ADD_ITEM') {
        const key = `${d.productId || d.productName || 'item'}_${
          d.variant || ''
        }`;
        const prev = cartMap.get(key);
        cartMap.set(key, {
          name: String(d.productName || 'Sản phẩm len'),
          variant: d.variant ? String(d.variant) : prev?.variant,
          quantity: (prev?.quantity || 0) + Math.max(1, Number(d.quantity || 1)),
          price: Number(d.price || prev?.price || 0) || undefined,
        });
      }

      if (e.eventType === 'CHECKOUT_ORDER_CREATED') {
        ordersCreated.push({
          orderId: String(d.orderId || 'Đơn mới'),
          total: Number(d.total || 0),
          paymentMethod: d.paymentMethod ? String(d.paymentMethod) : undefined,
          timestamp: e.timestamp,
        });
      }

      if (e.eventType === 'CHAT_MESSAGE_SENT') {
        chatMessagesCount += 1;
      }

      if (
        e.severity !== 'INFO' ||
        e.eventType === 'AUTH_LOGIN_FAILED' ||
        e.eventType === 'BOT_TRAP_TRIGGERED' ||
        e.eventType === 'RATE_LIMIT_TRIGGERED' ||
        e.eventType === 'BLOCKED_IP_ATTEMPT'
      ) {
        alertEventsCount += 1;
      }
    }

    // Enrich identity from Orders / Chat tables if matched by userId or email
    if (resolvedUserId && identityByUserId.has(resolvedUserId)) {
      const info = identityByUserId.get(resolvedUserId)!;
      if (!resolvedName && info.name) resolvedName = info.name;
      if (!resolvedPhone && info.phone) resolvedPhone = info.phone;
      if (!resolvedEmail && info.email) resolvedEmail = info.email;
    }
    if (resolvedEmail && identityByEmail.has(resolvedEmail)) {
      const info = identityByEmail.get(resolvedEmail)!;
      if (!resolvedName && info.name) resolvedName = info.name;
      if (!resolvedPhone && info.phone) resolvedPhone = info.phone;
    }
    if (isKnownAdminEmail(resolvedEmail)) {
      isAdmin = true;
    }

    // Estimate active browsing time across sessions (capping idle gaps > 10 mins to 30s)
    let estimatedDurationSec = 0;
    for (let i = 1; i < entries.length; i++) {
      const gapSec =
        (new Date(entries[i].timestamp).getTime() -
          new Date(entries[i - 1].timestamp).getTime()) /
        1000;
      if (gapSec > 0 && gapSec <= 10 * 60) {
        estimatedDurationSec += gapSec;
      } else if (gapSec > 10 * 60) {
        estimatedDurationSec += 20;
      }
    }
    for (const vp of viewedMap.values()) {
      if (vp.maxDurationSec > estimatedDurationSec) {
        estimatedDurationSec = vp.maxDurationSec;
      }
    }

    const lastSeenMs = new Date(latestEntry.timestamp).getTime();
    const isOnlineNow = nowMs - lastSeenMs <= 5 * 60 * 1000;

    // Short human-memorable code from visitorId or IP
    const cleanCodeSeed = (
      latestEntry.visitorId ||
      profileKey.replace(/^legacy_/, '')
    )
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-4)
      .toUpperCase();
    const shortCode = `#${cleanCodeSeed || '0001'}`;

    const isIdentified = Boolean(resolvedName || resolvedEmail || resolvedPhone);
    const displayName = isAdmin
      ? `👑 Quản trị viên (${resolvedName || resolvedEmail || 'Bạn'})`
      : resolvedName
        ? resolvedName
        : resolvedEmail
          ? resolvedEmail.split('@')[0]
          : `Khách ẩn danh ${shortCode}`;

    // Determine Funnel Stage
    let stage: VisitorStage = 'browsing';
    let stageBadge = {
      label: '👀 Chỉ dạo trang chủ',
      bg: '#F3EFEA',
      color: '#5C4332',
    };

    if (ordersCreated.length > 0) {
      stage = 'ordered';
      stageBadge = {
        label: `🎉 Đã đặt ${ordersCreated.length} đơn hàng`,
        bg: '#DCFCE7',
        color: '#15803D',
      };
    } else if (sawCheckoutPage) {
      stage = 'checkout_abandoned';
      stageBadge = {
        label: '🔥 Đã vào Thanh toán nhưng chưa đặt',
        bg: '#FFEDD5',
        color: '#C2410C',
      };
    } else if (cartMap.size > 0) {
      stage = 'cart_added';
      stageBadge = {
        label: `🛒 Đã bỏ ${cartMap.size} mẫu vào giỏ`,
        bg: '#E0F2FE',
        color: '#0369A1',
      };
    } else if (chatMessagesCount > 0) {
      stage = 'chatting';
      stageBadge = {
        label: `💬 Đã nhắn ${chatMessagesCount} tin Chat`,
        bg: '#F3E8FF',
        color: '#6B21A8',
      };
    } else if (viewedMap.size > 0) {
      stage = 'viewing_product';
      stageBadge = {
        label: `🧶 Đã xem ${viewedMap.size} sản phẩm`,
        bg: '#FEF3C7',
        color: '#92400E',
      };
    }

    // Pick best traffic source across entries (prefer external/specific source over generic Direct)
    let chosenSource = classifyAuditEntryTrafficSource(firstEntry);
    for (const e of entries) {
      const candidate = classifyAuditEntryTrafficSource(e);
      if (candidate.category !== 'copy_paste_direct') {
        chosenSource = candidate;
        break;
      }
    }

    // Build reverse-chronological timeline (newest step at top or chronological — let's keep chronological step 1 -> N for easy story reading!)
    const timeline = entries.map(buildTimelineStepFromEntry);

    profiles.push({
      profileKey,
      visitorId: latestEntry.visitorId || profileKey,
      shortCode,
      displayName,
      isIdentified,
      isAdmin,
      email: resolvedEmail,
      phone: resolvedPhone,
      ip: latestEntry.ip || firstEntry.ip || 'unknown',
      allIps: Array.from(ipSet),
      location: latestEntry.location || firstEntry.location || 'Việt Nam',
      asn: latestEntry.asn || firstEntry.asn || '',
      deviceSummary: parseFriendlyDeviceLabel(
        latestEntry.userAgent || firstEntry.userAgent,
        latestEntry.screenSize || firstEntry.screenSize
      ),
      screenSize: latestEntry.screenSize || firstEntry.screenSize || '',
      userAgent: latestEntry.userAgent || firstEntry.userAgent || '',
      trafficSource: chosenSource,
      visitCount: Math.max(maxVisitorNum, sessionSet.size || 1),
      sessionCount: Math.max(1, sessionSet.size),
      firstSeenAt: firstEntry.timestamp,
      lastSeenAt: latestEntry.timestamp,
      isOnlineNow,
      estimatedDurationSec,
      stage,
      stageBadge,
      viewedProducts: Array.from(viewedMap.values()).map((vp) => ({
        ...vp,
        views: Math.max(1, vp.views),
      })),
      cartProducts: Array.from(cartMap.values()),
      ordersCreated,
      chatMessagesCount,
      alertEventsCount,
      timeline,
    });
  }

  // Sort by most recently active visitor first
  return profiles.sort(
    (a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime()
  );
}

interface ClientTelemetryCache {
  ip: string;
  location: string;
  asn: string;
  fetchedAt: number;
}

let cachedTelemetry: ClientTelemetryCache | null = null;
const memoryRateBuckets = new Map<
  string,
  { timestamps: number[]; lockedUntil: number }
>();

async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // ignore
  }
  return headers;
}

function getDeviceScreenSize(): string {
  try {
    if (typeof window !== 'undefined' && window.innerWidth > 0) {
      return `${window.innerWidth}x${window.innerHeight}`;
    }
    const { width, height } = Dimensions.get('window');
    return `${Math.round(width)}x${Math.round(height)}`;
  } catch {
    return 'unknown';
  }
}

function getClientUserAgent(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent.slice(0, 260);
    }
  } catch {
    // ignore
  }
  return `ReactNative/${Platform.OS}`;
}

function getClientLanguage(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }
  } catch {
    // ignore
  }
  return 'vi-VN';
}

function getCurrentPath(): string {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.pathname}${window.location.search || ''}`;
    }
  } catch {
    // ignore
  }
  return '/';
}

export async function resolveClientIpTelemetry(): Promise<ClientTelemetryCache> {
  const now = Date.now();
  if (cachedTelemetry && now - cachedTelemetry.fetchedAt < 10 * 60 * 1000) {
    return cachedTelemetry;
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_TELEMETRY_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ClientTelemetryCache;
        if (
          parsed?.ip &&
          now - Number(parsed.fetchedAt || 0) < 10 * 60 * 1000
        ) {
          cachedTelemetry = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // ignore
  }

  // 1. Try our own Vercel edge endpoint first (/api/security-audit?action=whoami)
  try {
    if (typeof window !== 'undefined') {
      const res = await fetch('/api/security-audit?action=whoami', {
        method: 'GET',
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        const t = data?.telemetry;
        if (t && t.ip && t.ip !== 'unknown') {
          const resolved: ClientTelemetryCache = {
            ip: String(t.ip),
            location:
              [t.city, t.region, t.country].filter(Boolean).join(', ') ||
              'Việt Nam',
            asn: t.asn ? `AS${String(t.asn).replace(/^AS/i, '')}` : '',
            fetchedAt: now,
          };
          cachedTelemetry = resolved;
          try {
            window.localStorage?.setItem(
              LOCAL_TELEMETRY_CACHE_KEY,
              JSON.stringify(resolved)
            );
          } catch {
            // ignore
          }
          return resolved;
        }
      }
    }
  } catch {
    // fallback to public IP lookup
  }

  // 2. Fallback to ipwho.is
  try {
    const res = await fetch('https://ipwho.is/', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ip) {
        const resolved: ClientTelemetryCache = {
          ip: String(data.ip),
          location:
            [data.city, data.region, data.country_code || data.country]
              .filter(Boolean)
              .join(', ') || 'VN',
          asn:
            data.connection?.isp ||
            (data.connection?.asn ? `AS${data.connection.asn}` : ''),
          fetchedAt: now,
        };
        cachedTelemetry = resolved;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(
              LOCAL_TELEMETRY_CACHE_KEY,
              JSON.stringify(resolved)
            );
          }
        } catch {
          // ignore
        }
        return resolved;
      }
    }
  } catch {
    // ignore
  }

  return (
    cachedTelemetry || {
      ip: '127.0.0.1',
      location: 'VN',
      asn: '',
      fetchedAt: now,
    }
  );
}

/**
 * Sliding-window Rate Limiter with temporary lockout
 */
export function checkRateLimit(
  bucketKey: string,
  maxAttempts: number = 5,
  windowMs: number = 60_000,
  lockoutMs: number = 60_000
): { allowed: boolean; retryAfterSec: number; remaining: number } {
  const now = Date.now();
  const storageKey = `${LOCAL_RATE_LIMIT_PREFIX}${bucketKey}`;
  let state = memoryRateBuckets.get(bucketKey) || {
    timestamps: [],
    lockedUntil: 0,
  };

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.timestamps)) {
          state = {
            timestamps: parsed.timestamps.map(Number).filter(Number.isFinite),
            lockedUntil: Number(parsed.lockedUntil || 0),
          };
        }
      }
    }
  } catch {
    // ignore
  }

  if (state.lockedUntil > now) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((state.lockedUntil - now) / 1000)
    );
    return { allowed: false, retryAfterSec, remaining: 0 };
  }

  const recent = state.timestamps.filter((t) => now - t < windowMs);
  if (recent.length >= maxAttempts) {
    const lockedUntil = now + lockoutMs;
    const nextState = { timestamps: recent, lockedUntil };
    memoryRateBuckets.set(bucketKey, nextState);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(storageKey, JSON.stringify(nextState));
      }
    } catch {
      // ignore
    }
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(lockoutMs / 1000)),
      remaining: 0,
    };
  }

  recent.push(now);
  const nextState = { timestamps: recent, lockedUntil: 0 };
  memoryRateBuckets.set(bucketKey, nextState);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(nextState));
    }
  } catch {
    // ignore
  }

  return {
    allowed: true,
    retryAfterSec: 0,
    remaining: Math.max(0, maxAttempts - recent.length),
  };
}

/**
 * Validates hidden form field (bot trap) & minimum human interaction time
 */
export function validateHiddenBotField(
  trapValue: string,
  formMountedAtMs?: number,
  minFillTimeMs: number = 600
): { valid: boolean; reason?: string } {
  if (trapValue && String(trapValue).trim().length > 0) {
    return {
      valid: false,
      reason: 'Hidden bot-trap field was populated by automated script',
    };
  }
  if (formMountedAtMs && Date.now() - formMountedAtMs < minFillTimeMs) {
    return {
      valid: false,
      reason: `Form submitted abnormally fast (${
        Date.now() - formMountedAtMs
      }ms < ${minFillTimeMs}ms)`,
    };
  }
  return { valid: true };
}

function readLocalAuditLogs(): SecurityAuditEntry[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_AUDIT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as SecurityAuditEntry[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalAuditLogs(logs: SecurityAuditEntry[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        LOCAL_AUDIT_KEY,
        JSON.stringify(logs.slice(0, 200))
      );
    }
  } catch {
    // ignore
  }
}

export function readLocalBlockedIps(): BlockedIpEntry[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LOCAL_BLOCKLIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as BlockedIpEntry[];
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function writeLocalBlockedIps(items: BlockedIpEntry[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(LOCAL_BLOCKLIST_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore
  }
}

export async function isCurrentIpBlocked(): Promise<{
  blocked: boolean;
  ip: string;
  reason?: string;
}> {
  const localList = readLocalBlockedIps();
  if (localList.length === 0) {
    return { blocked: false, ip: cachedTelemetry?.ip || '127.0.0.1' };
  }
  const telemetry = await resolveClientIpTelemetry();
  const currentIp = telemetry.ip;
  const matched = localList.find((b) => b.ip === currentIp);
  if (matched) {
    return { blocked: true, ip: currentIp, reason: matched.reason };
  }
  return { blocked: false, ip: currentIp };
}

// Per-session dedupe map so rapid re-renders never spam identical tracking calls
const recentEventDedupeMap = new Map<string, number>();

/**
 * Records a detailed Request Audit Log & Visitor Journey entry via `/api/security-audit`
 */
export async function recordSecurityAudit(params: {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  path?: string;
  method?: string;
  userEmail?: string | null;
  userId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  isAdminActor?: boolean;
  hiddenTrap?: string;
  dedupeKey?: string;
  dedupeWindowMs?: number;
  details?: Record<string, unknown>;
}): Promise<SecurityAuditEntry | null> {
  const nowMs = Date.now();
  if (params.dedupeKey) {
    const prevTs = recentEventDedupeMap.get(params.dedupeKey) || 0;
    const win = params.dedupeWindowMs ?? 12_000;
    if (nowMs - prevTs < win) {
      return null;
    }
    recentEventDedupeMap.set(params.dedupeKey, nowMs);
  }

  const { visitorId, sessionId, visitorNumber, known } =
    getOrCreateVisitorIdentity();

  if (params.userEmail || params.customerName || params.customerPhone || params.userId) {
    rememberVisitorKnownIdentity({
      email: params.userEmail || undefined,
      name: params.customerName || undefined,
      phone: params.customerPhone || undefined,
      userId: params.userId || undefined,
    });
  }

  const resolvedEmail =
    (params.userEmail && params.userEmail !== 'Khách (Guest)'
      ? params.userEmail
      : known.email) || 'Khách (Guest)';
  const resolvedName = params.customerName || known.name || undefined;
  const resolvedPhone = params.customerPhone || known.phone || undefined;
  const resolvedUserId = params.userId || known.userId || null;
  const isAdminActor = Boolean(
    params.isAdminActor || isKnownAdminEmail(resolvedEmail)
  );

  // Skip noisy passive browsing logs when Admin is testing their own shop!
  // (Still log security/admin actions if explicitly triggered)
  const passiveEvents: SecurityEventType[] = [
    'PAGE_VISIT',
    'PRODUCT_VIEW',
    'PRODUCT_ENGAGED',
    'CART_ADD_ITEM',
    'CART_REMOVE_ITEM',
    'CHECKOUT_STARTED',
    'CHAT_OPENED',
  ];
  if (isAdminActor && passiveEvents.includes(params.eventType)) {
    return null;
  }

  const telemetry = await resolveClientIpTelemetry();
  const nowIso = new Date().toISOString();
  const id = `audit_${nowMs}_${Math.random().toString(36).slice(2, 7)}`;

  const entry: SecurityAuditEntry = {
    id,
    ip: telemetry.ip,
    location: telemetry.location,
    asn: telemetry.asn,
    eventType: params.eventType,
    severity: params.severity || 'INFO',
    path: params.path || getCurrentPath(),
    method: params.method || 'WEB_ACTION',
    userEmail: resolvedEmail,
    userId: resolvedUserId,
    visitorId,
    sessionId,
    visitorNumber,
    isAdminActor,
    customerName: resolvedName,
    customerPhone: resolvedPhone,
    userAgent: getClientUserAgent(),
    screenSize: getDeviceScreenSize(),
    language: getClientLanguage(),
    referer: getOrCaptureVisitorTrafficSource(),
    details: {
      ...(params.details || {}),
      trafficSource: getOrCaptureVisitorTrafficSource(),
    },
    timestamp: nowIso,
  };

  // 1. Save immediately to local audit log cache
  const existing = readLocalAuditLogs();
  writeLocalAuditLogs([entry, ...existing]);

  // 2. Dispatch to server API (`/api/security-audit`)
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/security-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          action: 'log',
          eventType: entry.eventType,
          severity: entry.severity,
          path: entry.path,
          method: entry.method,
          userEmail: entry.userEmail,
          actorUserId: entry.userId,
          visitorId: entry.visitorId,
          sessionId: entry.sessionId,
          visitorNumber: entry.visitorNumber,
          isAdminActor: entry.isAdminActor,
          customerName: entry.customerName,
          customerPhone: entry.customerPhone,
          ip: entry.ip,
          location: entry.location,
          asn: entry.asn,
          userAgent: entry.userAgent,
          screenSize: entry.screenSize,
          language: entry.language,
          referer: entry.referer,
          details: entry.details,
          hiddenTrap: params.hiddenTrap,
        }),
      });
    } catch {
      // ignore network error
    }
  }

  return entry;
}

function parseAuditRow(row: Record<string, unknown>): SecurityAuditEntry | null {
  if (!row) return null;
  try {
    const detailRaw = String(row.detailAddress || '');
    if (detailRaw.startsWith('{')) {
      const parsed = JSON.parse(detailRaw);
      return {
        id: String(row.id || parsed.id || `audit_${Date.now()}`),
        ip: String(parsed.ip || row.phone || 'unknown'),
        location: String(parsed.location || 'VN'),
        asn: String(parsed.asn || ''),
        eventType: (parsed.eventType ||
          row.city ||
          'PAGE_VISIT') as SecurityEventType,
        severity: (parsed.severity || row.ward || 'INFO') as SecuritySeverity,
        path: String(parsed.path || '/'),
        method: String(parsed.method || 'WEB_ACTION'),
        userEmail: String(parsed.userEmail || 'Khách (Guest)'),
        userId: parsed.userId ? String(parsed.userId) : null,
        visitorId: parsed.visitorId ? String(parsed.visitorId) : undefined,
        sessionId: parsed.sessionId ? String(parsed.sessionId) : undefined,
        visitorNumber: parsed.visitorNumber
          ? Number(parsed.visitorNumber)
          : undefined,
        isAdminActor: Boolean(
          parsed.isAdminActor || isKnownAdminEmail(parsed.userEmail)
        ),
        customerName: parsed.customerName
          ? String(parsed.customerName)
          : undefined,
        customerPhone: parsed.customerPhone
          ? String(parsed.customerPhone)
          : undefined,
        userAgent: String(parsed.userAgent || ''),
        screenSize: String(parsed.screenSize || ''),
        language: String(parsed.language || 'vi-VN'),
        referer: String(parsed.referer || 'Direct'),
        details: (parsed.details as Record<string, unknown>) || {},
        timestamp: String(
          parsed.timestamp || row.district || new Date().toISOString()
        ),
      };
    }
  } catch {
    // ignore parse error
  }
  return null;
}

function parseBlockedIpRow(row: Record<string, unknown>): BlockedIpEntry | null {
  if (!row) return null;
  try {
    const detailRaw = String(row.detailAddress || '');
    if (detailRaw.startsWith('{')) {
      const parsed = JSON.parse(detailRaw);
      return {
        id: String(row.id),
        ip: String(parsed.ip || row.phone || '').trim(),
        reason: String(
          parsed.reason || row.city || 'Chặn bởi Quản trị viên'
        ),
        blockedBy: String(parsed.blockedBy || 'Admin'),
        createdAt: String(
          parsed.createdAt || row.district || new Date().toISOString()
        ),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Fetches security dashboard data via `/api/security-audit` (requires Admin Bearer JWT)
 */
export async function fetchSecurityDashboardData(): Promise<{
  telemetry: ClientTelemetryCache;
  logs: SecurityAuditEntry[];
  blocklist: BlockedIpEntry[];
}> {
  const telemetry = await resolveClientIpTelemetry();
  let remoteLogs: SecurityAuditEntry[] = [];
  let remoteBlocks: BlockedIpEntry[] = [];

  if (typeof window !== 'undefined') {
    try {
      const headers = await getAdminAuthHeaders();
      const res = await fetch(`/api/security-audit?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.logs)) {
          remoteLogs = data.logs
            .map((r: unknown) => parseAuditRow(r as Record<string, unknown>))
            .filter(
              (x: SecurityAuditEntry | null): x is SecurityAuditEntry =>
                x !== null
            );
        }
        if (Array.isArray(data?.blocklist)) {
          remoteBlocks = data.blocklist
            .map((r: unknown) =>
              parseBlockedIpRow(r as Record<string, unknown>)
            )
            .filter(
              (x: BlockedIpEntry | null): x is BlockedIpEntry =>
                x !== null && Boolean(x.ip)
            );
          writeLocalBlockedIps(remoteBlocks);
        }
      }
    } catch {
      // fallback to local cache
    }
  }

  const localLogs = readLocalAuditLogs();
  const mergedMap = new Map<string, SecurityAuditEntry>();
  for (const item of [...remoteLogs, ...localLogs]) {
    if (!mergedMap.has(item.id)) {
      mergedMap.set(item.id, item);
    }
  }

  const mergedLogs = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  writeLocalAuditLogs(mergedLogs);

  const finalBlocks =
    remoteBlocks.length > 0 ? remoteBlocks : readLocalBlockedIps();

  return {
    telemetry,
    logs: mergedLogs,
    blocklist: finalBlocks,
  };
}

export async function blockIpAddress(
  ip: string,
  reason: string,
  adminEmail?: string
): Promise<BlockedIpEntry | null> {
  const cleanIp = ip.trim();
  if (!cleanIp) return null;

  const nowIso = new Date().toISOString();
  const entry: BlockedIpEntry = {
    id: `block_${cleanIp.replace(/[^a-zA-Z0-9]/g, '_')}`,
    ip: cleanIp,
    reason: reason.trim() || 'Hành vi truy cập bất thường / Nghi vấn Bot',
    blockedBy: adminEmail || 'Admin',
    createdAt: nowIso,
  };

  const current = readLocalBlockedIps().filter((b) => b.ip !== cleanIp);
  writeLocalBlockedIps([entry, ...current]);

  if (typeof window !== 'undefined') {
    try {
      const headers = await getAdminAuthHeaders();
      await fetch('/api/security-audit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'block_ip',
          ip: cleanIp,
          reason: entry.reason,
        }),
      });
    } catch {
      // ignore
    }
  }

  await recordSecurityAudit({
    eventType: 'ADMIN_SECURITY_ACTION',
    severity: 'WARNING',
    method: 'IP_BLOCK',
    userEmail: adminEmail || 'Admin',
    isAdminActor: true,
    details: { blockedIp: cleanIp, reason: entry.reason },
  });

  return entry;
}

export async function unblockIpAddress(
  ip: string,
  adminEmail?: string
): Promise<void> {
  const cleanIp = ip.trim();
  const next = readLocalBlockedIps().filter((b) => b.ip !== cleanIp);
  writeLocalBlockedIps(next);

  if (typeof window !== 'undefined') {
    try {
      const headers = await getAdminAuthHeaders();
      await fetch('/api/security-audit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'unblock_ip',
          ip: cleanIp,
        }),
      });
    } catch {
      // ignore
    }
  }

  await recordSecurityAudit({
    eventType: 'ADMIN_SECURITY_ACTION',
    severity: 'INFO',
    method: 'IP_UNBLOCK',
    userEmail: adminEmail || 'Admin',
    isAdminActor: true,
    details: { unblockedIp: cleanIp },
  });
}

export async function clearSecurityAuditLogs(): Promise<void> {
  writeLocalAuditLogs([]);
  if (typeof window !== 'undefined') {
    try {
      const headers = await getAdminAuthHeaders();
      await fetch('/api/security-audit', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'clear_logs',
        }),
      });
    } catch {
      // ignore
    }
  }
}
