import { supabase } from '@/services/supabase';
import { Dimensions, Platform } from 'react-native';

export type SecurityEventType =
  | 'PAGE_VISIT'
  | 'AUTH_LOGIN_SUCCESS'
  | 'AUTH_LOGIN_FAILED'
  | 'AUTH_REGISTER_SUCCESS'
  | 'AUTH_REGISTER_FAILED'
  | 'CHECKOUT_ORDER_CREATED'
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

const LOCAL_AUDIT_KEY = 'tcl_security_audit_logs_v1';
const LOCAL_BLOCKLIST_KEY = 'tcl_security_blocklist_v1';
const LOCAL_RATE_LIMIT_PREFIX = 'tcl_ratelimit_v2_';
const LOCAL_TELEMETRY_CACHE_KEY = 'tcl_client_telemetry_v1';
const FIRST_TOUCH_SOURCE_KEY = 'tcl_first_touch_source_v2';
const SELF_REPORTED_SOURCE_KEY = 'tcl_self_reported_source_v1';

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
 * so navigating internally (/ -> /login -> /checkout) never overwrites how they found the shop.
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

    // 1. Check URL query tags first (?s=tt1, ?s=tt2, ttclid, fbclid, gclid, utm_source)
    let detectedNow = '';
    if (
      urlSearch.includes('s=tt1') ||
      urlSearch.includes('tt=1') ||
      urlSearch.includes('tiktok1')
    ) {
      detectedNow = '🎵 TikTok Kênh 1 (?s=tt1)';
    } else if (
      urlSearch.includes('s=tt2') ||
      urlSearch.includes('tt=2') ||
      urlSearch.includes('tiktok2')
    ) {
      detectedNow = '🎵 TikTok Kênh 2 (?s=tt2)';
    } else if (urlSearch.includes('ttclid') || urlSearch.includes('tiktok')) {
      detectedNow = '🎵 TikTok (Bấm link từ TikTok)';
    } else if (
      urlSearch.includes('fbclid') ||
      urlSearch.includes('utm_source=fb') ||
      urlSearch.includes('facebook')
    ) {
      detectedNow = '📘 Facebook / Messenger';
    } else if (urlSearch.includes('gclid') || urlSearch.includes('utm_source=google')) {
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
        detectedNow = `🔍 Tìm kiếm Google (${rawRef.slice(0, 80)})`;
      } else if (
        refLower.includes('bing.com') ||
        refLower.includes('coccoc.com') ||
        refLower.includes('yahoo.com') ||
        refLower.includes('duckduckgo.com')
      ) {
        detectedNow = `🔍 Tìm kiếm Web (${rawRef.slice(0, 80)})`;
      } else if (refLower.includes('tiktok.com')) {
        detectedNow = `🎵 TikTok Web (${rawRef.slice(0, 80)})`;
      } else if (refLower.includes('facebook.com') || refLower.includes('fb.com')) {
        detectedNow = `📘 Facebook (${rawRef.slice(0, 80)})`;
      } else if (refLower.includes('instagram.com') || refLower.includes('threads.net')) {
        detectedNow = `🌸 Instagram / Threads (${rawRef.slice(0, 80)})`;
      } else if (refLower.includes('zalo.me')) {
        detectedNow = `💬 Zalo (${rawRef.slice(0, 80)})`;
      } else {
        detectedNow = `🌐 Web giới thiệu: ${rawRef.slice(0, 100)}`;
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

    // 5. No external referrer -> Visitor copied & pasted "tiemcuonlen.shop" (e.g. from TikTok text) or typed directly
    const isMobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
    const isIos = /iPhone|iPad|iPod/i.test(ua);
    const fallbackDirect = isMobileUa
      ? `📋 Copy/Dán link trên ĐT (${isIos ? 'iPhone Safari/Chrome' : 'Android Chrome'} — Thường copy từ chữ TikTok)`
      : '📋 Copy/Dán link hoặc Gõ trực tiếp trên Máy tính';

    window.localStorage?.setItem(FIRST_TOUCH_SOURCE_KEY, fallbackDirect);
    return selfReported
      ? `${fallbackDirect} • [Khách chọn: ${selfReported}]`
      : fallbackDirect;
  } catch {
    return 'Direct';
  }
}

/**
 * Classifies any SecurityAuditEntry (including historical logs) into a human-friendly Traffic Source badge
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

  // 1. TikTok (In-App, URL param, or customer self-reported TikTok)
  if (
    combined.includes('tiktok') ||
    combined.includes('tt1') ||
    combined.includes('tt2') ||
    /BytedanceWebview|musical_ly|TikTok|ByteLocale/i.test(ua)
  ) {
    return {
      category: 'tiktok',
      badgeLabel: '🎵 Nguồn: TikTok',
      detailLabel:
        ref && !refLower.includes('tiemcuonlen.shop')
          ? ref
          : 'Khách vào từ TikTok (App TikTok hoặc xác nhận từ kênh TikTok)',
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
      badgeLabel: '🔍 Nguồn: Tìm kiếm Google / Web',
      detailLabel:
        ref && !refLower.includes('tiemcuonlen.shop')
          ? ref
          : 'Khách tự tìm kiếm từ khóa len trên Google / Cốc Cốc rồi bấm vào shop',
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
      badgeLabel: '🌐 Nguồn: Link giới thiệu ngoài',
      detailLabel: ref,
      bg: '#F3E8FF',
      color: '#6B21A8',
    };
  }

  // 5. Copy/Paste text link (e.g. copied text "tiemcuonlen.shop" from TikTok bio/caption) or Direct type
  const isMobileUa = /iPhone|iPad|iPod|Android/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  return {
    category: 'copy_paste_direct',
    badgeLabel: isMobileUa
      ? '📋 Copy/Dán link trên Điện thoại (Từ text TikTok / Gõ trực tiếp)'
      : '📋 Copy/Dán link hoặc Gõ trực tiếp trên Máy tính',
    detailLabel: isMobileUa
      ? `Khách copy chữ "tiemcuonlen.shop" (từ TikTok) rồi dán vào ${
          isIos ? 'Safari/Chrome iPhone' : 'Chrome Android'
        }`
      : 'Khách dán link hoặc gõ trực tiếp tiemcuonlen.shop trên trình duyệt máy tính',
    bg: '#FEF3C7',
    color: '#92400E',
  };
}

interface ClientTelemetryCache {
  ip: string;
  location: string;
  asn: string;
  fetchedAt: number;
}

let cachedTelemetry: ClientTelemetryCache | null = null;
const memoryRateBuckets = new Map<string, { timestamps: number[]; lockedUntil: number }>();

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
        if (parsed?.ip && now - Number(parsed.fetchedAt || 0) < 10 * 60 * 1000) {
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
              [t.city, t.region, t.country].filter(Boolean).join(', ') || 'Việt Nam',
            asn: t.asn ? `AS${String(t.asn).replace(/^AS/i, '')}` : '',
            fetchedAt: now,
          };
          cachedTelemetry = resolved;
          try {
            window.localStorage?.setItem(LOCAL_TELEMETRY_CACHE_KEY, JSON.stringify(resolved));
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
          asn: data.connection?.isp || (data.connection?.asn ? `AS${data.connection.asn}` : ''),
          fetchedAt: now,
        };
        cachedTelemetry = resolved;
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(LOCAL_TELEMETRY_CACHE_KEY, JSON.stringify(resolved));
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
  let state = memoryRateBuckets.get(bucketKey) || { timestamps: [], lockedUntil: 0 };

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
    const retryAfterSec = Math.max(1, Math.ceil((state.lockedUntil - now) / 1000));
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
      reason: `Form submitted abnormally fast (${Date.now() - formMountedAtMs}ms < ${minFillTimeMs}ms)`,
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
      window.localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(logs.slice(0, 120)));
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
  // Fast path: if local blocklist is empty, do not block checkout on external IP lookup
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

/**
 * Records a detailed Request Audit Log entry via the Server API (`/api/security-audit`)
 */
export async function recordSecurityAudit(params: {
  eventType: SecurityEventType;
  severity?: SecuritySeverity;
  path?: string;
  method?: string;
  userEmail?: string | null;
  userId?: string | null;
  hiddenTrap?: string;
  details?: Record<string, unknown>;
}): Promise<SecurityAuditEntry> {
  const telemetry = await resolveClientIpTelemetry();
  const nowIso = new Date().toISOString();
  const id = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const entry: SecurityAuditEntry = {
    id,
    ip: telemetry.ip,
    location: telemetry.location,
    asn: telemetry.asn,
    eventType: params.eventType,
    severity: params.severity || 'INFO',
    path: params.path || getCurrentPath(),
    method: params.method || 'WEB_ACTION',
    userEmail: params.userEmail || 'Khách (Guest)',
    userId: params.userId || null,
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

  // 2. Dispatch to server API (`/api/security-audit`) so server handles storage
  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/security-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log',
          eventType: entry.eventType,
          severity: entry.severity,
          path: entry.path,
          method: entry.method,
          userEmail: entry.userEmail,
          actorUserId: entry.userId,
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
        eventType: (parsed.eventType || row.city || 'PAGE_VISIT') as SecurityEventType,
        severity: (parsed.severity || row.ward || 'INFO') as SecuritySeverity,
        path: String(parsed.path || '/'),
        method: String(parsed.method || 'WEB_ACTION'),
        userEmail: String(parsed.userEmail || 'Khách (Guest)'),
        userId: parsed.userId ? String(parsed.userId) : null,
        userAgent: String(parsed.userAgent || ''),
        screenSize: String(parsed.screenSize || ''),
        language: String(parsed.language || 'vi-VN'),
        referer: String(parsed.referer || 'Direct'),
        details: (parsed.details as Record<string, unknown>) || {},
        timestamp: String(parsed.timestamp || row.district || new Date().toISOString()),
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
        reason: String(parsed.reason || row.city || 'Chặn bởi Quản trị viên'),
        blockedBy: String(parsed.blockedBy || 'Admin'),
        createdAt: String(parsed.createdAt || row.district || new Date().toISOString()),
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
            .filter((x: SecurityAuditEntry | null): x is SecurityAuditEntry => x !== null);
        }
        if (Array.isArray(data?.blocklist)) {
          remoteBlocks = data.blocklist
            .map((r: unknown) => parseBlockedIpRow(r as Record<string, unknown>))
            .filter((x: BlockedIpEntry | null): x is BlockedIpEntry => x !== null && Boolean(x.ip));
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

  const finalBlocks = remoteBlocks.length > 0 ? remoteBlocks : readLocalBlockedIps();

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
    details: { blockedIp: cleanIp, reason: entry.reason },
  });

  return entry;
}

export async function unblockIpAddress(ip: string, adminEmail?: string): Promise<void> {
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
