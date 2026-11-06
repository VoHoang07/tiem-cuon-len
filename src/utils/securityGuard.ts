import { Platform, Dimensions } from 'react-native';
import { supabase } from '@/services/supabase';

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
  const telemetry = await resolveClientIpTelemetry();
  const currentIp = telemetry.ip;
  const localList = readLocalBlockedIps();
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
    referer:
      typeof document !== 'undefined' && document.referrer
        ? document.referrer.slice(0, 180)
        : 'Direct',
    details: params.details || {},
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
