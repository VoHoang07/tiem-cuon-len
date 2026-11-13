import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useOrders } from '@/store/OrderContext';
import { formatVND } from '@/utils/formatCurrency';
import {
    blockIpAddress,
    buildVisitorProfilesFromLogs,
    classifyAuditEntryTrafficSource,
    clearSecurityAuditLogs,
    fetchSecurityDashboardData,
    formatFriendlyDuration,
    parseFriendlyDeviceLabel,
    unblockIpAddress,
    type BlockedIpEntry,
    type SecurityAuditEntry,
    type VisitorProfileSummary,
} from '@/utils/securityGuard';
import { useRouter } from 'expo-router';
import {
    Activity,
    Ban,
    CheckCircle2,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    Clock,
    Eye,
    Globe,
    Home,
    Lock,
    Mail,
    Phone,
    RefreshCw,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    ShoppingBag,
    Smartphone,
    Trash2,
    UserCheck,
    Users,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DashboardTab = 'visitors' | 'raw_logs';
type VisitorFilter =
  | 'all'
  | 'online'
  | 'hot_leads'
  | 'ordered'
  | 'viewed_product'
  | 'identified';
type LogFilter = 'all' | 'alerts' | 'auth' | 'orders' | 'shopping' | 'visits';

function formatAuditTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function formatShortTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const now = new Date();
    const isSameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (isSameDay) {
      return d.toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatRelativeAgo(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms) || ms < 0) return 'Vừa xong';
    const sec = Math.floor(ms / 1000);
    if (sec < 45) return 'Vừa xong';
    const mins = Math.floor(sec / 60);
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
  } catch {
    return '';
  }
}

function getEventLabel(eventType: SecurityAuditEntry['eventType']): {
  label: string;
  bg: string;
  color: string;
} {
  switch (eventType) {
    case 'BOT_TRAP_TRIGGERED':
      return { label: '🤖 Bẫy Bot (Hidden Field)', bg: '#FEE2E2', color: '#B91C1C' };
    case 'BLOCKED_IP_ATTEMPT':
      return { label: '⛔ IP bị chặn cố truy cập', bg: '#FEE2E2', color: '#991B1B' };
    case 'RATE_LIMIT_TRIGGERED':
      return {
        label: '⚡ Vượt giới hạn Request (Rate Limit)',
        bg: '#FEF3C7',
        color: '#B45309',
      };
    case 'AUTH_LOGIN_FAILED':
      return { label: '⚠️ Đăng nhập thất bại', bg: '#FFEDD5', color: '#C2410C' };
    case 'AUTH_LOGIN_SUCCESS':
      return { label: '✅ Đăng nhập thành công', bg: '#DCFCE7', color: '#15803D' };
    case 'AUTH_REGISTER_SUCCESS':
      return { label: '✨ Đăng ký tài khoản mới', bg: '#DCFCE7', color: '#15803D' };
    case 'AUTH_REGISTER_FAILED':
      return { label: '⚠️ Đăng ký thất bại', bg: '#FFEDD5', color: '#C2410C' };
    case 'PRODUCT_VIEW':
      return { label: '🧶 Xem chi tiết sản phẩm', bg: '#FEF3C7', color: '#92400E' };
    case 'PRODUCT_ENGAGED':
      return { label: '⏱️ Đứng xem kỹ sản phẩm', bg: '#FDE68A', color: '#78350F' };
    case 'CART_ADD_ITEM':
      return { label: '🛒 Thêm vào giỏ hàng', bg: '#E0F2FE', color: '#0369A1' };
    case 'CART_REMOVE_ITEM':
      return { label: '🗑️ Xoá khỏi giỏ hàng', bg: '#F1F5F9', color: '#475569' };
    case 'CHECKOUT_STARTED':
      return { label: '💳 Mở trang Thanh toán', bg: '#FFEDD5', color: '#C2410C' };
    case 'CHECKOUT_ORDER_CREATED':
      return { label: '🎉 Đặt đơn hàng thành công', bg: '#DCFCE7', color: '#15803D' };
    case 'CHAT_OPENED':
      return { label: '💬 Mở khung Chat', bg: '#F3E8FF', color: '#6B21A8' };
    case 'CHAT_MESSAGE_SENT':
      return { label: '✉️ Khách nhắn tin Chat', bg: '#F3E8FF', color: '#6B21A8' };
    case 'ADMIN_SECURITY_ACTION':
      return { label: '🛡️ Thao tác Bảo mật Admin', bg: '#F3E8FF', color: '#6B21A8' };
    case 'SERVER_API_ERROR':
      return {
        label: '🚨 Lỗi API Hệ thống (Global Handler)',
        bg: '#FEE2E2',
        color: '#991B1B',
      };
    case 'PAGE_VISIT':
    default:
      return { label: '👣 Mở trang trên Web', bg: '#F3EFEA', color: '#5C4332' };
  }
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
  const { orders } = useOrders();
  const { conversations } = useChat();
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  const isMobile = windowWidth < 640;
  const isAdmin = role === 'admin';

  const [loading, setLoading] = useState(false);
  const [currentIp, setCurrentIp] = useState('Đang kiểm tra...');
  const [currentLocation, setCurrentLocation] = useState('VN');
  const [currentAsn, setCurrentAsn] = useState('');
  const [logs, setLogs] = useState<SecurityAuditEntry[]>([]);
  const [blocklist, setBlocklist] = useState<BlockedIpEntry[]>([]);

  // View modes & filters
  const [activeTab, setActiveTab] = useState<DashboardTab>('visitors');
  const [hideAdminVisits, setHideAdminVisits] = useState(true);
  const [visitorFilter, setVisitorFilter] = useState<VisitorFilter>('all');
  const [expandedProfiles, setExpandedProfiles] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<LogFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [manualIpInput, setManualIpInput] = useState('');
  const [manualReasonInput, setManualReasonInput] = useState('');

  const loadDashboard = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const data = await fetchSecurityDashboardData();
      setCurrentIp(data.telemetry.ip);
      setCurrentLocation(data.telemetry.location);
      setCurrentAsn(data.telemetry.asn);
      setLogs(data.logs);
      setBlocklist(data.blocklist);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      void loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  const blockedIpSet = useMemo(
    () => new Set(blocklist.map((b) => b.ip.trim())),
    [blocklist]
  );

  // Build stitched per-human Visitor Profiles (combining Logs + Orders + Live Chat)
  const allVisitorProfiles = useMemo(
    () =>
      buildVisitorProfilesFromLogs(logs, {
        orders,
        conversations,
      }),
    [logs, orders, conversations]
  );

  const customerVisitorProfiles = useMemo(() => {
    if (!hideAdminVisits) return allVisitorProfiles;
    return allVisitorProfiles.filter(
      (p) => !p.isAdmin && p.ip !== currentIp
    );
  }, [allVisitorProfiles, hideAdminVisits, currentIp]);

  const hiddenAdminCount = Math.max(
    0,
    allVisitorProfiles.length - customerVisitorProfiles.length
  );

  // High-signal Visitor Metrics
  const visitorStats = useMemo(() => {
    let onlineNow = 0;
    let viewedProduct = 0;
    let hotLeads = 0; // Added to cart or started checkout or sent chat without ordering yet
    let ordered = 0;
    let identified = 0;

    for (const p of customerVisitorProfiles) {
      if (p.isOnlineNow) onlineNow += 1;
      if (p.viewedProducts.length > 0) viewedProduct += 1;
      if (
        p.stage === 'checkout_abandoned' ||
        p.stage === 'cart_added' ||
        p.stage === 'chatting'
      ) {
        hotLeads += 1;
      }
      if (p.stage === 'ordered') ordered += 1;
      if (p.isIdentified) identified += 1;
    }

    return {
      totalVisitors: customerVisitorProfiles.length,
      onlineNow,
      viewedProduct,
      hotLeads,
      ordered,
      identified,
    };
  }, [customerVisitorProfiles]);

  // Traffic Source Breakdown counted per UNIQUE VISITOR (not inflated by raw clicks!)
  const trafficBreakdown = useMemo(() => {
    let typedMobile = 0;
    let typedDesktop = 0;
    let googleSearch = 0;
    let tiktokAppOrConfirmed = 0;
    let socialZaloFbIg = 0;

    for (const p of customerVisitorProfiles) {
      const cat = p.trafficSource.category;
      if (cat === 'google_search') {
        googleSearch += 1;
      } else if (cat === 'tiktok') {
        tiktokAppOrConfirmed += 1;
      } else if (cat === 'social_zalo_fb_ig') {
        socialZaloFbIg += 1;
      } else {
        const isMobileUa = /iPhone|iPad|iPod|Android/i.test(p.userAgent || '');
        if (isMobileUa) typedMobile += 1;
        else typedDesktop += 1;
      }
    }

    return {
      typedMobile,
      typedDesktop,
      googleSearch,
      tiktokAppOrConfirmed,
      socialZaloFbIg,
    };
  }, [customerVisitorProfiles]);

  // Top Viewed Products across real visitors
  const topViewedProducts = useMemo(() => {
    const map = new Map<
      string,
      { name: string; viewerCount: number; cartCount: number; maxDwellSec: number }
    >();
    for (const p of customerVisitorProfiles) {
      for (const vp of p.viewedProducts) {
        const prev = map.get(vp.name) || {
          name: vp.name,
          viewerCount: 0,
          cartCount: 0,
          maxDwellSec: 0,
        };
        prev.viewerCount += 1;
        prev.maxDwellSec = Math.max(prev.maxDwellSec, vp.maxDurationSec);
        map.set(vp.name, prev);
      }
      for (const cp of p.cartProducts) {
        const prev = map.get(cp.name) || {
          name: cp.name,
          viewerCount: 0,
          cartCount: 0,
          maxDwellSec: 0,
        };
        prev.cartCount += cp.quantity;
        map.set(cp.name, prev);
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.viewerCount - a.viewerCount || b.cartCount - a.cartCount)
      .slice(0, 6);
  }, [customerVisitorProfiles]);

  const filteredVisitors = useMemo(() => {
    return customerVisitorProfiles.filter((p) => {
      if (visitorFilter === 'online' && !p.isOnlineNow) return false;
      if (
        visitorFilter === 'hot_leads' &&
        p.stage !== 'checkout_abandoned' &&
        p.stage !== 'cart_added' &&
        p.stage !== 'chatting'
      ) {
        return false;
      }
      if (visitorFilter === 'ordered' && p.stage !== 'ordered') return false;
      if (
        visitorFilter === 'viewed_product' &&
        p.viewedProducts.length === 0
      ) {
        return false;
      }
      if (visitorFilter === 'identified' && !p.isIdentified) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const productNames = p.viewedProducts.map((v) => v.name).join(' ');
        const cartNames = p.cartProducts.map((c) => c.name).join(' ');
        const hay = `${p.displayName} ${p.shortCode} ${p.email || ''} ${
          p.phone || ''
        } ${p.ip} ${p.location} ${p.asn} ${p.deviceSummary} ${
          p.trafficSource.badgeLabel
        } ${productNames} ${cartNames}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [customerVisitorProfiles, visitorFilter, searchQuery]);

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
      if (hideAdminVisits && (item.isAdminActor || item.ip === currentIp)) {
        if (item.eventType !== 'ADMIN_SECURITY_ACTION') return false;
      }
      if (filter === 'alerts') {
        if (
          item.severity === 'INFO' &&
          item.eventType !== 'AUTH_LOGIN_FAILED' &&
          item.eventType !== 'RATE_LIMIT_TRIGGERED' &&
          item.eventType !== 'BOT_TRAP_TRIGGERED' &&
          item.eventType !== 'BLOCKED_IP_ATTEMPT'
        ) {
          return false;
        }
      } else if (filter === 'auth') {
        if (!item.eventType.startsWith('AUTH_')) return false;
      } else if (filter === 'orders') {
        if (item.eventType !== 'CHECKOUT_ORDER_CREATED') return false;
      } else if (filter === 'shopping') {
        if (
          ![
            'PRODUCT_VIEW',
            'PRODUCT_ENGAGED',
            'CART_ADD_ITEM',
            'CART_REMOVE_ITEM',
            'CHECKOUT_STARTED',
            'CHAT_OPENED',
            'CHAT_MESSAGE_SENT',
          ].includes(item.eventType)
        ) {
          return false;
        }
      } else if (filter === 'visits') {
        if (item.eventType !== 'PAGE_VISIT') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const srcInfo = classifyAuditEntryTrafficSource(item);
        const hay = `${item.ip} ${item.location} ${item.userEmail} ${
          item.customerName || ''
        } ${item.customerPhone || ''} ${item.path} ${item.eventType} ${
          item.userAgent
        } ${JSON.stringify(item.details || {})} ${srcInfo.badgeLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, filter, searchQuery, hideAdminVisits, currentIp]);

  const alertCount = useMemo(
    () =>
      logs.filter(
        (l) =>
          l.severity !== 'INFO' ||
          l.eventType === 'AUTH_LOGIN_FAILED' ||
          l.eventType === 'RATE_LIMIT_TRIGGERED' ||
          l.eventType === 'BOT_TRAP_TRIGGERED' ||
          l.eventType === 'BLOCKED_IP_ATTEMPT'
      ).length,
    [logs]
  );

  const toggleExpandProfile = (key: string) => {
    setExpandedProfiles((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleManualBlockIp = async () => {
    const clean = manualIpInput.trim();
    if (!clean) {
      Alert.alert('Thiếu IP', 'Vui lòng nhập địa chỉ IP cần chặn.');
      return;
    }
    if (clean === currentIp) {
      Alert.alert(
        'Cảnh báo',
        'Đây là địa chỉ IP hiện tại của bạn. Bạn không nên tự chặn IP quản trị của mình.'
      );
      return;
    }
    await blockIpAddress(
      clean,
      manualReasonInput.trim() || 'Chặn thủ công bởi Quản trị viên',
      user?.email
    );
    setManualIpInput('');
    setManualReasonInput('');
    await loadDashboard();
  };

  const handleToggleBlockIp = async (ip: string) => {
    const clean = ip.trim();
    if (!clean || clean === 'unknown') return;
    if (blockedIpSet.has(clean)) {
      await unblockIpAddress(clean, user?.email);
      await loadDashboard();
      return;
    }
    if (clean === currentIp) {
      Alert.alert(
        'IP Quản trị viên',
        'Đây là IP thiết bị hiện tại của bạn, không thể tự khóa.'
      );
      return;
    }
    await blockIpAddress(
      clean,
      'Phát hiện bất thường trong Nhật ký truy cập',
      user?.email
    );
    await loadDashboard();
  };

  const handleClearLogs = async () => {
    await clearSecurityAuditLogs();
    await loadDashboard();
  };

  const renderVisitorCard = (profile: VisitorProfileSummary, index: number) => {
    const isBlocked = blockedIpSet.has(profile.ip);
    const isExpanded =
      expandedProfiles[profile.profileKey] !== undefined
        ? expandedProfiles[profile.profileKey]
        : index < 3; // Auto-open the 3 most recent visitors so Admin sees full details immediately!

    return (
      <View
        key={profile.profileKey}
        style={[
          styles.visitorCard,
          profile.stage === 'ordered' && styles.visitorCardOrdered,
          profile.stage === 'checkout_abandoned' && styles.visitorCardHotLead,
          isBlocked && styles.logCardCritical,
        ]}>
        {/* Top Row: Avatar/Badge + Identity + Last Seen */}
        <View style={styles.visitorHeaderRow}>
          <View style={styles.visitorIdentityLeft}>
            <View
              style={[
                styles.visitorAvatar,
                profile.isIdentified
                  ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                  : { backgroundColor: '#F5EFE6', borderColor: '#E2D6C5' },
              ]}>
              <Text style={styles.visitorAvatarEmoji}>
                {profile.isAdmin
                  ? '👑'
                  : profile.stage === 'ordered'
                    ? '🛍️'
                    : profile.isIdentified
                      ? '👤'
                      : '🕵️'}
              </Text>
              {profile.isOnlineNow && <View style={styles.visitorOnlineDot} />}
            </View>

            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.visitorNameLine}>
                <Text style={styles.visitorNameText} numberOfLines={1}>
                  {profile.displayName}
                </Text>
                {profile.isOnlineNow && (
                  <View style={styles.onlinePill}>
                    <Text style={styles.onlinePillText}>● Đang xem web</Text>
                  </View>
                )}
                {profile.visitCount > 1 && (
                  <View style={styles.returningPill}>
                    <Text style={styles.returningPillText}>
                      Quay lại lần {profile.visitCount}
                    </Text>
                  </View>
                )}
              </View>

              <Text style={styles.visitorSubMeta}>
                {profile.deviceSummary}
              </Text>
            </View>
          </View>

          <View style={styles.visitorRightTimeBox}>
            <Text style={styles.visitorRelativeTime}>
              {formatRelativeAgo(profile.lastSeenAt)}
            </Text>
            <Text style={styles.visitorExactTime}>
              {formatAuditTime(profile.lastSeenAt)}
            </Text>
          </View>
        </View>

        {/* Contact Info Box if Identified (Logged in / Chatted / Ordered) */}
        {(profile.email || profile.phone) && (
          <View style={styles.contactBanner}>
            <UserCheck size={14} color="#047857" />
            <View style={styles.contactItemsWrap}>
              {profile.phone && (
                <View style={styles.contactInlineItem}>
                  <Phone size={12} color="#065F46" />
                  <Text style={styles.contactValueBold}>{profile.phone}</Text>
                </View>
              )}
              {profile.email && (
                <View style={styles.contactInlineItem}>
                  <Mail size={12} color="#065F46" />
                  <Text style={styles.contactValueText}>{profile.email}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Stage + Traffic Source + Stay Duration Badges */}
        <View style={styles.badgesWrapRow}>
          <View
            style={[
              styles.stagePill,
              { backgroundColor: profile.stageBadge.bg },
            ]}>
            <Text
              style={[
                styles.stagePillText,
                { color: profile.stageBadge.color },
              ]}>
              {profile.stageBadge.label}
            </Text>
          </View>

          <View
            style={[
              styles.stagePill,
              { backgroundColor: profile.trafficSource.bg },
            ]}>
            <Text
              style={[
                styles.stagePillText,
                { color: profile.trafficSource.color },
              ]}>
              {profile.trafficSource.badgeLabel}
            </Text>
          </View>

          <View style={styles.durationPill}>
            <Clock size={11} color="#5C4332" />
            <Text style={styles.durationPillText}>
              Ở lại: {formatFriendlyDuration(profile.estimatedDurationSec)}
            </Text>
          </View>

          <View style={styles.networkPill}>
            <Globe size={11} color="#5C4332" />
            <Text style={styles.durationPillText}>
              {profile.location} • IP {profile.ip}
              {profile.asn ? ` (${profile.asn})` : ''}
            </Text>
          </View>
        </View>

        {/* Quick Shopping Summary: Which exact products they viewed / added to cart / ordered */}
        {(profile.viewedProducts.length > 0 ||
          profile.cartProducts.length > 0 ||
          profile.ordersCreated.length > 0) && (
          <View style={styles.interestBox}>
            {profile.viewedProducts.length > 0 && (
              <View style={styles.interestGroup}>
                <Text style={styles.interestLabel}>
                  🧶 Sản phẩm đã bấm vào xem ({profile.viewedProducts.length}):
                </Text>
                <View style={styles.productChipsRow}>
                  {profile.viewedProducts.map((vp) => (
                    <TouchableOpacity
                      key={vp.id}
                      style={styles.viewedProdChip}
                      onPress={() => {
                        if (vp.id && !vp.id.startsWith('/')) {
                          router.push(`/product/${vp.id}` as any);
                        }
                      }}
                      activeOpacity={0.8}>
                      <Text style={styles.viewedProdName}>
                        {vp.name}
                        {vp.variant ? ` (${vp.variant})` : ''}
                      </Text>
                      {vp.maxDurationSec >= 10 && (
                        <Text style={styles.viewedProdDwell}>
                          • xem {formatFriendlyDuration(vp.maxDurationSec)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {profile.cartProducts.length > 0 && (
              <View style={styles.interestGroup}>
                <Text style={[styles.interestLabel, { color: '#0369A1' }]}>
                  🛒 Đã thêm vào giỏ hàng:
                </Text>
                <View style={styles.productChipsRow}>
                  {profile.cartProducts.map((cp, idx) => (
                    <View key={`${cp.name}_${idx}`} style={styles.cartProdChip}>
                      <Text style={styles.cartProdText}>
                        {cp.name}
                        {cp.variant ? ` (${cp.variant})` : ''} ×{cp.quantity}
                        {cp.price ? ` • ${formatVND(cp.price)}` : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {profile.ordersCreated.length > 0 && (
              <View style={styles.interestGroup}>
                <Text style={[styles.interestLabel, { color: '#15803D' }]}>
                  🎉 Đơn hàng đã chốt:
                </Text>
                <View style={styles.productChipsRow}>
                  {profile.ordersCreated.map((ord) => (
                    <TouchableOpacity
                      key={ord.orderId}
                      style={styles.orderProdChip}
                      onPress={() =>
                        router.push(`/orders/${ord.orderId}` as any)
                      }
                      activeOpacity={0.8}>
                      <Text style={styles.orderProdText}>
                        #{ord.orderId} — {formatVND(ord.total)}
                        {ord.paymentMethod ? ` (${ord.paymentMethod})` : ''} ›
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* Expandable Step-by-Step Journey Timeline */}
        <View style={styles.visitorFooterActions}>
          <TouchableOpacity
            style={styles.timelineToggleBtn}
            onPress={() => toggleExpandProfile(profile.profileKey)}
            activeOpacity={0.8}>
            {isExpanded ? (
              <ChevronUp size={15} color={COLORS.primary} />
            ) : (
              <ChevronDown size={15} color={COLORS.primary} />
            )}
            <Text style={styles.timelineToggleText}>
              {isExpanded
                ? `Thu gọn hành trình (${profile.timeline.length} bước)`
                : `Xem chi tiết từng bước khách bấm (${profile.timeline.length} bước)`}
            </Text>
          </TouchableOpacity>

          {profile.ip && profile.ip !== 'unknown' && !profile.isAdmin && (
            <TouchableOpacity
              style={[
                styles.ipActionBtn,
                isBlocked && styles.ipActionBtnUnblock,
              ]}
              onPress={() => handleToggleBlockIp(profile.ip)}
              activeOpacity={0.8}>
              <Ban size={12} color={isBlocked ? '#15803D' : '#B91C1C'} />
              <Text
                style={[
                  styles.ipActionBtnText,
                  isBlocked && { color: '#15803D' },
                ]}>
                {isBlocked ? 'Bỏ chặn IP' : 'Chặn IP này'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {isExpanded && (
          <View style={styles.timelineContainer}>
            <Text style={styles.timelineHeaderTitle}>
              📍 Hành trình từ lúc vào web đến lúc rời đi:
            </Text>
            {profile.timeline.map((step, sIdx) => {
              const isLast = sIdx === profile.timeline.length - 1;
              return (
                <View key={step.id} style={styles.timelineRow}>
                  <View style={styles.timelineLeftRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        step.highlightBg
                          ? {
                              backgroundColor: step.highlightBg,
                              borderColor: step.highlightColor || '#D8C3AD',
                            }
                          : undefined,
                      ]}>
                      <Text style={{ fontSize: 11 }}>{step.icon}</Text>
                    </View>
                    {!isLast && <View style={styles.timelineVerticalLine} />}
                  </View>

                  <View style={styles.timelineContentBox}>
                    <View style={styles.timelineStepHeader}>
                      <Text
                        style={[
                          styles.timelineStepTitle,
                          step.highlightColor
                            ? { color: step.highlightColor }
                            : undefined,
                        ]}>
                        {step.title}
                      </Text>
                      <Text style={styles.timelineStepTime}>
                        {formatShortTimeOnly(step.timestamp)}
                      </Text>
                    </View>
                    {step.subtitle ? (
                      <Text style={styles.timelineStepSub}>{step.subtitle}</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, isMobile && styles.headerMobile]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}
                style={styles.backBtn}>
                <ChevronLeft size={24} color={COLORS.darkText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.homeBtn}
                onPress={() => router.replace('/')}>
                <Home size={20} color={COLORS.darkText} />
              </TouchableOpacity>
            </View>
            <Text
              style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
              {isAdmin
                ? 'Khách Truy Cập & Bảo Mật Hệ Thống'
                : 'Bảo Mật & Quyền Riêng Tư'}
            </Text>
            {isAdmin ? (
              <TouchableOpacity
                style={styles.refreshIconBtn}
                onPress={loadDashboard}
                activeOpacity={0.75}>
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.primary} />
                ) : (
                  <RefreshCw size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {isAdmin && (
            <>
              {/* Active Protection Banner + Admin Exclusion Toggle */}
              <View style={[styles.shieldBanner, isMobile && styles.cardMobile]}>
                <View style={styles.shieldBannerTop}>
                  <View style={styles.shieldIconWrap}>
                    <ShieldCheck size={24} color="#15803D" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.shieldTitle}>
                      Theo dõi hành trình khách thật & Phòng thủ đa lớp
                    </Text>
                    <Text style={styles.shieldSub}>
                      IP thiết bị của bạn: {currentIp} ({currentLocation}
                      {currentAsn ? ` • ${currentAsn}` : ''}) — Tự động không ghi lượt lướt thử của Admin
                    </Text>
                  </View>
                </View>

                <View style={styles.adminFilterToggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.adminExcludePill,
                      hideAdminVisits && styles.adminExcludePillActive,
                    ]}
                    onPress={() => setHideAdminVisits((v) => !v)}
                    activeOpacity={0.8}>
                    <CheckCircle2
                      size={14}
                      color={hideAdminVisits ? '#FFFFFF' : '#166534'}
                    />
                    <Text
                      style={[
                        styles.adminExcludeText,
                        hideAdminVisits && { color: '#FFFFFF' },
                      ]}>
                      {hideAdminVisits
                        ? `Đang lọc sạch lượt của Admin (${hiddenAdminCount} thiết bị Admin đã ẩn)`
                        : 'Đang hiện cả lượt truy cập của Admin'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* High-Clarity Customer Funnel Metrics */}
              <View style={[styles.metricsGrid, isMobile && styles.cardMobile]}>
                <TouchableOpacity
                  style={[
                    styles.metricCard,
                    visitorFilter === 'all' && styles.metricCardSelected,
                  ]}
                  onPress={() => {
                    setActiveTab('visitors');
                    setVisitorFilter('all');
                  }}
                  activeOpacity={0.8}>
                  <Users size={18} color={COLORS.primary} />
                  <Text style={styles.metricValue}>
                    {visitorStats.totalVisitors}
                  </Text>
                  <Text style={styles.metricLabel}>Khách truy cập thật</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.metricCard,
                    visitorFilter === 'online' && styles.metricCardSelected,
                  ]}
                  onPress={() => {
                    setActiveTab('visitors');
                    setVisitorFilter('online');
                  }}
                  activeOpacity={0.8}>
                  <Activity size={18} color="#15803D" />
                  <Text style={[styles.metricValue, { color: '#15803D' }]}>
                    {visitorStats.onlineNow}
                  </Text>
                  <Text style={styles.metricLabel}>Đang xem (5 phút qua)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.metricCard,
                    visitorFilter === 'viewed_product' &&
                      styles.metricCardSelected,
                  ]}
                  onPress={() => {
                    setActiveTab('visitors');
                    setVisitorFilter('viewed_product');
                  }}
                  activeOpacity={0.8}>
                  <Eye size={18} color="#B45309" />
                  <Text style={[styles.metricValue, { color: '#B45309' }]}>
                    {visitorStats.viewedProduct}
                  </Text>
                  <Text style={styles.metricLabel}>Có bấm xem SP</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.metricCard,
                    visitorFilter === 'hot_leads' && styles.metricCardSelected,
                  ]}
                  onPress={() => {
                    setActiveTab('visitors');
                    setVisitorFilter('hot_leads');
                  }}
                  activeOpacity={0.8}>
                  <ShoppingBag size={18} color="#C2410C" />
                  <Text style={[styles.metricValue, { color: '#C2410C' }]}>
                    {visitorStats.hotLeads}
                  </Text>
                  <Text style={styles.metricLabel}>Bỏ giỏ / Sắp mua</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.metricCard,
                    visitorFilter === 'ordered' && styles.metricCardSelected,
                  ]}
                  onPress={() => {
                    setActiveTab('visitors');
                    setVisitorFilter('ordered');
                  }}
                  activeOpacity={0.8}>
                  <UserCheck size={18} color="#0369A1" />
                  <Text style={[styles.metricValue, { color: '#0369A1' }]}>
                    {visitorStats.ordered}
                  </Text>
                  <Text style={styles.metricLabel}>Đã đặt đơn</Text>
                </TouchableOpacity>
              </View>

              {/* Top Products Customers Actually Looked At */}
              {topViewedProducts.length > 0 && (
                <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleWrap}>
                      <ShoppingBag size={18} color="#B45309" />
                      <Text style={styles.sectionTitle}>
                        🔥 Sản Phẩm Được Khách Bấm Xem Nhiều Nhất
                      </Text>
                    </View>
                  </View>

                  <View style={styles.topProductsWrap}>
                    {topViewedProducts.map((tp, idx) => (
                      <View key={tp.name} style={styles.topProductPill}>
                        <Text style={styles.topProductRank}>#{idx + 1}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.topProductName} numberOfLines={1}>
                            {tp.name}
                          </Text>
                          <Text style={styles.topProductMeta}>
                            {tp.viewerCount} khách xem
                            {tp.cartCount > 0
                              ? ` • ${tp.cartCount} lần thêm giỏ`
                              : ''}
                            {tp.maxDwellSec >= 10
                              ? ` • xem lâu nhất ${formatFriendlyDuration(
                                  tp.maxDwellSec
                                )}`
                              : ''}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Traffic Source Attribution Card (Counted by Unique People, No Bio Link Needed) */}
              <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <Globe size={18} color="#047857" />
                    <Text style={styles.sectionTitle}>
                      📊 Nguồn Khách Vào Web (Tính Theo Số Người Thật)
                    </Text>
                  </View>
                </View>

                <View style={styles.trafficCardsRow}>
                  <View
                    style={[
                      styles.trafficSourceBox,
                      { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
                    ]}>
                    <Text style={[styles.trafficCountText, { color: '#92400E' }]}>
                      {trafficBreakdown.typedMobile} người
                    </Text>
                    <Text style={[styles.trafficTitleText, { color: '#78350F' }]}>
                      📱 Gõ / Dán tên web trên ĐT
                    </Text>
                    <Text style={[styles.trafficDescText, { color: '#92400E' }]}>
                      Khách xem video/bình luận TikTok thấy tên tiemcuonlen.shop rồi gõ vào Safari/Chrome
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.trafficSourceBox,
                      { backgroundColor: '#FDF2F8', borderColor: '#FBCFE8' },
                    ]}>
                    <Text style={[styles.trafficCountText, { color: '#9D174D' }]}>
                      {trafficBreakdown.tiktokAppOrConfirmed} người
                    </Text>
                    <Text style={[styles.trafficTitleText, { color: '#831843' }]}>
                      🎵 Xác nhận từ kênh TikTok
                    </Text>
                    <Text style={[styles.trafficDescText, { color: '#9D174D' }]}>
                      Khách mở từ tin nhắn TikTok hoặc bấm chọn "Xem từ kênh TikTok" lúc thanh toán
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.trafficSourceBox,
                      { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
                    ]}>
                    <Text style={[styles.trafficCountText, { color: '#065F46' }]}>
                      {trafficBreakdown.googleSearch} người
                    </Text>
                    <Text style={[styles.trafficTitleText, { color: '#064E3B' }]}>
                      🔍 Tự tìm kiếm Google / Cốc Cốc
                    </Text>
                    <Text style={[styles.trafficDescText, { color: '#047857' }]}>
                      Khách tự tìm từ khóa đồ len handmade trên Google và bấm vào trang của tiệm
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.trafficSourceBox,
                      { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
                    ]}>
                    <Text style={[styles.trafficCountText, { color: '#075985' }]}>
                      {trafficBreakdown.socialZaloFbIg +
                        trafficBreakdown.typedDesktop}{' '}
                      người
                    </Text>
                    <Text style={[styles.trafficTitleText, { color: '#0C4A6E' }]}>
                      💻 Máy tính & Zalo / FB / IG
                    </Text>
                    <Text style={[styles.trafficDescText, { color: '#0369A1' }]}>
                      {trafficBreakdown.typedDesktop} người trên Máy tính •{' '}
                      {trafficBreakdown.socialZaloFbIg} người từ Zalo/FB/IG
                    </Text>
                  </View>
                </View>
              </View>

              {/* Main Switcher: Visitor Profiles vs Raw Security Logs + IP Blocklist */}
              <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                <View style={styles.modeSwitchBar}>
                  <TouchableOpacity
                    style={[
                      styles.modeSwitchBtn,
                      activeTab === 'visitors' && styles.modeSwitchBtnActive,
                    ]}
                    onPress={() => setActiveTab('visitors')}
                    activeOpacity={0.85}>
                    <Users
                      size={16}
                      color={
                        activeTab === 'visitors' ? COLORS.white : COLORS.darkText
                      }
                    />
                    <Text
                      style={[
                        styles.modeSwitchText,
                        activeTab === 'visitors' && styles.modeSwitchTextActive,
                      ]}>
                      👤 Hồ Sơ Từng Khách ({customerVisitorProfiles.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeSwitchBtn,
                      activeTab === 'raw_logs' && styles.modeSwitchBtnActive,
                    ]}
                    onPress={() => setActiveTab('raw_logs')}
                    activeOpacity={0.85}>
                    <ShieldAlert
                      size={16}
                      color={
                        activeTab === 'raw_logs' ? COLORS.white : COLORS.darkText
                      }
                    />
                    <Text
                      style={[
                        styles.modeSwitchText,
                        activeTab === 'raw_logs' && styles.modeSwitchTextActive,
                      ]}>
                      🛡️ Nhật Ký Kỹ Thuật & Chặn IP ({logs.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Shared Search Bar + Refresh / Clear Buttons */}
                <View style={styles.toolbarRow}>
                  <View style={[styles.searchBar, { flex: 1, marginBottom: 0 }]}>
                    <Search size={16} color={COLORS.mediumText} />
                    <TextInput
                      style={styles.searchInput}
                      placeholder={
                        activeTab === 'visitors'
                          ? 'Tìm theo tên khách, SĐT, email, tên sản phẩm đã xem, tỉnh thành, iPhone...'
                          : 'Tìm theo IP, email, đường dẫn (/product, /checkout), thiết bị...'
                      }
                      placeholderTextColor={COLORS.lightText}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      autoCapitalize="none"
                    />
                  </View>

                  <View style={styles.headerActionBtns}>
                    <TouchableOpacity
                      style={styles.smallActionBtn}
                      onPress={loadDashboard}
                      activeOpacity={0.8}>
                      <RefreshCw size={13} color={COLORS.primary} />
                      <Text style={styles.smallActionBtnText}>Làm mới</Text>
                    </TouchableOpacity>
                    {logs.length > 0 && (
                      <TouchableOpacity
                        style={[styles.smallActionBtn, styles.clearLogsBtn]}
                        onPress={handleClearLogs}
                        activeOpacity={0.8}>
                        <Trash2 size={13} color="#B91C1C" />
                        <Text
                          style={[
                            styles.smallActionBtnText,
                            { color: '#B91C1C' },
                          ]}>
                          Xóa log
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {activeTab === 'visitors' ? (
                  <>
                    {/* Visitor Funnel Filter Chips */}
                    <View style={styles.filterTabsRow}>
                      {(
                        [
                          {
                            id: 'all',
                            label: `Tất cả khách (${visitorStats.totalVisitors})`,
                          },
                          {
                            id: 'online',
                            label: `🟢 Đang online (${visitorStats.onlineNow})`,
                          },
                          {
                            id: 'hot_leads',
                            label: `🔥 Bỏ giỏ / Vào thanh toán (${visitorStats.hotLeads})`,
                          },
                          {
                            id: 'viewed_product',
                            label: `🧶 Đã xem SP (${visitorStats.viewedProduct})`,
                          },
                          {
                            id: 'ordered',
                            label: `🎉 Đã đặt đơn (${visitorStats.ordered})`,
                          },
                          {
                            id: 'identified',
                            label: `👤 Đã rõ Tên/SĐT/Email (${visitorStats.identified})`,
                          },
                        ] as { id: VisitorFilter; label: string }[]
                      ).map((tab) => {
                        const active = visitorFilter === tab.id;
                        return (
                          <TouchableOpacity
                            key={tab.id}
                            style={[
                              styles.filterChip,
                              active && styles.filterChipActive,
                            ]}
                            onPress={() => setVisitorFilter(tab.id)}
                            activeOpacity={0.8}>
                            <Text
                              style={[
                                styles.filterChipText,
                                active && styles.filterChipTextActive,
                              ]}>
                              {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {filteredVisitors.length === 0 ? (
                      <View style={styles.emptyBox}>
                        <Text style={styles.emptyBoxTitle}>
                          Chưa có khách truy cập nào khớp với bộ lọc này
                        </Text>
                        <Text style={styles.emptyBoxSub}>
                          Khi có khách mới mở web từ điện thoại hoặc máy tính khác, hồ sơ thiết bị, sản phẩm họ bấm xem và thời gian ở lại sẽ hiện chi tiết ngay tại đây.
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.logList}>
                        {filteredVisitors
                          .slice(0, 50)
                          .map((profile, idx) => renderVisitorCard(profile, idx))}
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    {/* IP Blocklist Management inside Technical Security Tab */}
                    <View style={styles.inlineBlocklistBox}>
                      <View style={styles.sectionTitleWrap}>
                        <Lock size={16} color="#B91C1C" />
                        <Text style={styles.inlineBlockTitle}>
                          Danh sách chặn IP thủ công ({blocklist.length})
                        </Text>
                      </View>

                      <View style={[styles.blockInputRow, { marginTop: 8 }]}>
                        <TextInput
                          style={[styles.blockInput, { flex: 1, minWidth: 140 }]}
                          placeholder="Nhập IP cần chặn (VD: 103.199.x.x)"
                          placeholderTextColor={COLORS.lightText}
                          value={manualIpInput}
                          onChangeText={setManualIpInput}
                          autoCapitalize="none"
                        />
                        <TextInput
                          style={[
                            styles.blockInput,
                            { flex: 1.4, minWidth: 170 },
                          ]}
                          placeholder="Lý do chặn (tùy chọn)"
                          placeholderTextColor={COLORS.lightText}
                          value={manualReasonInput}
                          onChangeText={setManualReasonInput}
                        />
                        <TouchableOpacity
                          style={styles.blockAddBtn}
                          onPress={handleManualBlockIp}
                          activeOpacity={0.8}>
                          <Ban size={14} color={COLORS.white} />
                          <Text style={styles.blockAddBtnText}>Chặn IP</Text>
                        </TouchableOpacity>
                      </View>

                      {blocklist.length > 0 && (
                        <View style={styles.blockedListWrap}>
                          {blocklist.map((b) => (
                            <View key={b.id} style={styles.blockedItemRow}>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text style={styles.blockedIpText}>
                                  ⛔ {b.ip}
                                </Text>
                                <Text style={styles.blockedReasonText}>
                                  {b.reason} • {formatAuditTime(b.createdAt)}
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={styles.unblockBtn}
                                onPress={() => handleToggleBlockIp(b.ip)}
                                activeOpacity={0.8}>
                                <Text style={styles.unblockBtnText}>
                                  Bỏ chặn
                                </Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Raw Event Filter Tabs */}
                    <View style={styles.filterTabsRow}>
                      {(
                        [
                          { id: 'all', label: `Tất cả (${filteredLogs.length})` },
                          {
                            id: 'shopping',
                            label: '🧶 Xem SP / Giỏ hàng / Chat',
                          },
                          {
                            id: 'alerts',
                            label: `⚠️ Cảnh báo / Bot (${alertCount})`,
                          },
                          { id: 'auth', label: '🔑 Đăng nhập / ĐK' },
                          { id: 'orders', label: '🎉 Đơn hàng' },
                          { id: 'visits', label: '👣 Chuyển trang' },
                        ] as { id: LogFilter; label: string }[]
                      ).map((tab) => {
                        const active = filter === tab.id;
                        return (
                          <TouchableOpacity
                            key={tab.id}
                            style={[
                              styles.filterChip,
                              active && styles.filterChipActive,
                            ]}
                            onPress={() => setFilter(tab.id)}
                            activeOpacity={0.8}>
                            <Text
                              style={[
                                styles.filterChipText,
                                active && styles.filterChipTextActive,
                              ]}>
                              {tab.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {filteredLogs.length === 0 ? (
                      <Text style={styles.emptyHintText}>
                        Không có bản ghi nhật ký kỹ thuật nào khớp với bộ lọc hiện tại.
                      </Text>
                    ) : (
                      <View style={styles.logList}>
                        {filteredLogs.slice(0, 80).map((item) => {
                          const badge = getEventLabel(item.eventType);
                          const isBlocked = blockedIpSet.has(item.ip);
                          const detailKeys = Object.keys(item.details || {});

                          return (
                            <View
                              key={item.id}
                              style={[
                                styles.logCard,
                                item.severity === 'CRITICAL' &&
                                  styles.logCardCritical,
                                item.severity === 'WARNING' &&
                                  styles.logCardWarning,
                              ]}>
                              <View style={styles.logTopRow}>
                                <View
                                  style={[
                                    styles.eventBadge,
                                    { backgroundColor: badge.bg },
                                  ]}>
                                  <Text
                                    style={[
                                      styles.eventBadgeText,
                                      { color: badge.color },
                                    ]}>
                                    {badge.label}
                                  </Text>
                                </View>
                                <View style={styles.timeRow}>
                                  <Clock size={12} color={COLORS.mediumText} />
                                  <Text style={styles.timeText}>
                                    {formatAuditTime(item.timestamp)}
                                  </Text>
                                </View>
                              </View>

                              <View style={styles.logGrid}>
                                <View style={styles.logField}>
                                  <Globe size={13} color={COLORS.primary} />
                                  <Text style={styles.logFieldLabel}>
                                    IP & Mạng:
                                  </Text>
                                  <Text style={styles.logFieldValueBold}>
                                    {item.ip}
                                  </Text>
                                  <Text style={styles.logFieldSub}>
                                    ({item.location}
                                    {item.asn ? ` • ${item.asn}` : ''})
                                  </Text>
                                </View>

                                <View style={styles.logField}>
                                  <Activity size={13} color={COLORS.primary} />
                                  <Text style={styles.logFieldLabel}>
                                    Đường dẫn:
                                  </Text>
                                  <Text style={styles.logFieldValue}>
                                    [{item.method}] {item.path}
                                  </Text>
                                </View>

                                <View style={styles.logField}>
                                  <Shield size={13} color={COLORS.primary} />
                                  <Text style={styles.logFieldLabel}>
                                    Khách:
                                  </Text>
                                  <Text style={styles.logFieldValue}>
                                    {item.customerName
                                      ? `${item.customerName} (${item.userEmail})`
                                      : item.userEmail}
                                    {item.customerPhone
                                      ? ` • ${item.customerPhone}`
                                      : ''}
                                  </Text>
                                </View>

                                <View style={styles.logField}>
                                  <Smartphone size={13} color={COLORS.primary} />
                                  <Text style={styles.logFieldLabel}>
                                    Thiết bị:
                                  </Text>
                                  <Text
                                    style={styles.logFieldSub}
                                    numberOfLines={2}>
                                    {parseFriendlyDeviceLabel(
                                      item.userAgent,
                                      item.screenSize
                                    )}
                                  </Text>
                                </View>
                              </View>

                              {detailKeys.length > 0 && (
                                <View style={styles.detailsBox}>
                                  <Text style={styles.detailsText}>
                                    Chi tiết: {JSON.stringify(item.details)}
                                  </Text>
                                </View>
                              )}

                              <View style={styles.logBottomActions}>
                                {(() => {
                                  const srcBadge =
                                    classifyAuditEntryTrafficSource(item);
                                  return (
                                    <View
                                      style={{
                                        flex: 1,
                                        minWidth: 0,
                                        gap: 3,
                                      }}>
                                      <View
                                        style={{
                                          alignSelf: 'flex-start',
                                          backgroundColor: srcBadge.bg,
                                          paddingHorizontal: 9,
                                          paddingVertical: 4,
                                          borderRadius: 999,
                                        }}>
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: '800',
                                            color: srcBadge.color,
                                          }}>
                                          {srcBadge.badgeLabel}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                })()}
                                {item.ip && item.ip !== 'unknown' && (
                                  <TouchableOpacity
                                    style={[
                                      styles.ipActionBtn,
                                      isBlocked && styles.ipActionBtnUnblock,
                                    ]}
                                    onPress={() => handleToggleBlockIp(item.ip)}
                                    activeOpacity={0.8}>
                                    <Ban
                                      size={12}
                                      color={isBlocked ? '#15803D' : '#B91C1C'}
                                    />
                                    <Text
                                      style={[
                                        styles.ipActionBtnText,
                                        isBlocked && { color: '#15803D' },
                                      ]}>
                                      {isBlocked
                                        ? 'Bỏ chặn IP này'
                                        : 'Chặn IP này'}
                                    </Text>
                                  </TouchableOpacity>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </>
                )}
              </View>
            </>
          )}

          {/* Privacy Policy Content */}
          <View style={[styles.content, isMobile && styles.cardMobile]}>
            <Text style={styles.policyHeaderTitle}>
              Chính Sách Quyền Riêng Tư & Bảo Vệ Dữ Liệu
            </Text>
            <Text style={styles.paragraph}>
              Tiệm Cuộn Len cam kết tôn trọng và bảo vệ quyền riêng tư của khách hàng.
              Chúng tôi chỉ thu thập những thông tin cần thiết để xử lý đơn hàng, giao
              nhận sản phẩm và chăm sóc khách hàng tốt nhất.
            </Text>

            <Text style={styles.subheading}>1. Thông tin thu thập</Text>
            <Text style={styles.paragraph}>
              - Họ tên, email, số điện thoại và địa chỉ giao hàng khi bạn đặt đơn.{'\n'}
              - Lịch sử đơn hàng và danh sách sản phẩm yêu thích của bạn tại tiệm.
            </Text>

            <Text style={styles.subheading}>2. Mục đích sử dụng & Cam kết bảo mật</Text>
            <Text style={styles.paragraph}>
              - Xác nhận đơn hàng, thông báo tình trạng vận chuyển và hỗ trợ đổi trả.{'\n'}
              - Thông tin cá nhân của khách hàng được bảo mật tuyệt đối và không chia sẻ
              cho bên thứ ba ngoài đơn vị vận chuyển phục vụ giao đơn hàng của bạn.
            </Text>

            <Text style={styles.subheading}>3. Liên hệ</Text>
            <Text style={styles.paragraph}>
              Nếu bạn có câu hỏi về chính sách quyền riêng tư hoặc cần hỗ trợ đơn hàng,
              vui lòng liên hệ:{'\n'}
              Website: https://www.tiemcuonlen.shop{'\n'}
              Email: vohoang1327@gmail.com
            </Text>
          </View>

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
  },
  container: {
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: 8,
  },
  headerMobile: {
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  refreshIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  headerTitleMobile: {
    fontSize: 15.5,
  },
  cardMobile: {
    marginHorizontal: 12,
  },
  shieldBanner: {
    backgroundColor: '#F4FBF6',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...SHADOWS.small,
  },
  shieldBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shieldIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#14532D',
  },
  shieldSub: {
    fontSize: 12,
    color: '#166534',
    marginTop: 2,
    fontWeight: '600',
    lineHeight: 17,
  },
  adminFilterToggleRow: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminExcludePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  adminExcludePillActive: {
    backgroundColor: '#15803D',
    borderColor: '#15803D',
  },
  adminExcludeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
  },

  /* Metrics Grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  metricCard: {
    flex: 1,
    minWidth: 102,
    backgroundColor: COLORS.white,
    borderRadius: 15,
    paddingVertical: 11,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EADFD2',
    ...SHADOWS.small,
  },
  metricCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#FAF4EC',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.darkText,
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.mediumText,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },

  /* Cards */
  adminCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: '#EADFD2',
    ...SHADOWS.small,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.darkText,
    flexShrink: 1,
  },

  /* Top Viewed Products */
  topProductsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  topProductPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 220,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#EDE0D1',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  topProductRank: {
    fontSize: 13,
    fontWeight: '900',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  topProductName: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  topProductMeta: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    marginTop: 1,
  },

  /* Traffic Source Cards */
  trafficCardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trafficSourceBox: {
    flex: 1,
    minWidth: 165,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  trafficCountText: {
    fontSize: 20,
    fontWeight: '900',
  },
  trafficTitleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  trafficDescText: {
    fontSize: 11,
    lineHeight: 15,
  },

  /* Mode Switcher */
  modeSwitchBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    backgroundColor: '#F5EFE6',
    padding: 5,
    borderRadius: 14,
  },
  modeSwitchBtn: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  modeSwitchBtnActive: {
    backgroundColor: '#3D2B1F',
    ...SHADOWS.small,
  },
  modeSwitchText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  modeSwitchTextActive: {
    color: COLORS.white,
  },

  toolbarRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F6F1EA',
    borderWidth: 1,
    borderColor: '#E5D8C8',
  },
  clearLogsBtn: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  smallActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* Visitor Profile Card */
  visitorCard: {
    backgroundColor: '#FCF9F5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#E6DDD0',
    gap: 10,
  },
  visitorCardOrdered: {
    backgroundColor: '#F6FEF9',
    borderColor: '#86EFAC',
  },
  visitorCardHotLead: {
    backgroundColor: '#FFFDF5',
    borderColor: '#FCD34D',
  },
  visitorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  visitorIdentityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 200,
  },
  visitorAvatar: {
    position: 'relative',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorAvatarEmoji: {
    fontSize: 19,
  },
  visitorOnlineDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16A34A',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  visitorNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  visitorNameText: {
    fontSize: 15,
    fontWeight: '900',
    color: COLORS.darkText,
  },
  onlinePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  onlinePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
  returningPill: {
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  returningPillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6D28D9',
  },
  visitorSubMeta: {
    fontSize: 12,
    color: COLORS.mediumText,
    fontWeight: '600',
    marginTop: 2,
  },
  visitorRightTimeBox: {
    alignItems: 'flex-end',
  },
  visitorRelativeTime: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },
  visitorExactTime: {
    fontSize: 11,
    color: COLORS.lightText,
    marginTop: 1,
  },

  contactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  contactItemsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    flex: 1,
  },
  contactInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactValueBold: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#065F46',
  },
  contactValueText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#047857',
  },

  badgesWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stagePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stagePillText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  durationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3EFEA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  durationPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4332',
  },

  /* Product Interest Summary inside Visitor Card */
  interestBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#EBE0D2',
    gap: 8,
  },
  interestGroup: {
    gap: 5,
  },
  interestLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#78350F',
  },
  productChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  viewedProdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  viewedProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#78350F',
  },
  viewedProdDwell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  cartProdChip: {
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  cartProdText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0369A1',
  },
  orderProdChip: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  orderProdText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#15803D',
  },

  visitorFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(61,43,31,0.08)',
  },
  timelineToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 4,
  },
  timelineToggleText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  /* Timeline Steps */
  timelineContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8DDD0',
    gap: 2,
  },
  timelineHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  timelineLeftRail: {
    width: 24,
    alignItems: 'center',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineVerticalLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E8DDD0',
    minHeight: 12,
  },
  timelineContentBox: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 10,
  },
  timelineStepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  timelineStepTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.darkText,
    lineHeight: 17,
  },
  timelineStepTime: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.lightText,
  },
  timelineStepSub: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    marginTop: 2,
    lineHeight: 16,
  },

  emptyBox: {
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EADFD2',
  },
  emptyBoxTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
  },
  emptyBoxSub: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  /* Technical Blocklist & Raw Logs */
  inlineBlocklistBox: {
    backgroundColor: '#FFFDFB',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F3D8D8',
    marginBottom: 12,
  },
  inlineBlockTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  blockInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  blockInput: {
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E2D6C5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    color: COLORS.darkText,
    minWidth: 0,
  },
  blockAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#B91C1C',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  blockAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  blockedListWrap: {
    gap: 8,
    marginTop: 4,
  },
  blockedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  blockedIpText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#991B1B',
  },
  blockedReasonText: {
    fontSize: 11.5,
    color: '#7F1D1D',
    marginTop: 2,
  },
  unblockBtn: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unblockBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  filterTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  filterChipTextActive: {
    color: COLORS.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E2D6C5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 12,
    minWidth: 200,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.darkText,
    minWidth: 0,
  },
  emptyHintText: {
    fontSize: 13,
    color: COLORS.mediumText,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  logList: {
    gap: 12,
  },
  logCard: {
    backgroundColor: '#FCF9F5',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    gap: 8,
  },
  logCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  logCardCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  logTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  eventBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  eventBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    fontWeight: '600',
  },
  logGrid: {
    gap: 5,
  },
  logField: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  logFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  logFieldValueBold: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  logFieldValue: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  logFieldSub: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    flexShrink: 1,
  },
  detailsBox: {
    backgroundColor: 'rgba(61,43,31,0.05)',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  detailsText: {
    fontSize: 11.5,
    color: '#4B382A',
    fontFamily: 'monospace',
  },
  logBottomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(61,43,31,0.08)',
  },
  ipActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ipActionBtnUnblock: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  ipActionBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#B91C1C',
  },
  content: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 18,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#EADFD2',
    ...SHADOWS.small,
  },
  policyHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    fontSize: 13.5,
    lineHeight: 21,
    color: COLORS.mediumText,
  },
});
