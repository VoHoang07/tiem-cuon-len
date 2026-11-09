import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import {
    blockIpAddress,
    classifyAuditEntryTrafficSource,
    clearSecurityAuditLogs,
    fetchSecurityDashboardData,
    unblockIpAddress,
    type BlockedIpEntry,
    type SecurityAuditEntry,
} from '@/utils/securityGuard';
import { useRouter } from 'expo-router';
import {
    Activity,
    Ban,
    CheckCircle2,
    ChevronLeft,
    Clock,
    Globe,
    Home,
    Lock,
    RefreshCw,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Smartphone,
    Trash2,
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

type LogFilter = 'all' | 'alerts' | 'auth' | 'orders' | 'visits';

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
      return { label: '⚡ Vượt giới hạn Request (Rate Limit)', bg: '#FEF3C7', color: '#B45309' };
    case 'AUTH_LOGIN_FAILED':
      return { label: '⚠️ Đăng nhập thất bại', bg: '#FFEDD5', color: '#C2410C' };
    case 'AUTH_LOGIN_SUCCESS':
      return { label: '✅ Đăng nhập thành công', bg: '#DCFCE7', color: '#15803D' };
    case 'AUTH_REGISTER_SUCCESS':
      return { label: '✨ Đăng ký tài khoản mới', bg: '#DCFCE7', color: '#15803D' };
    case 'AUTH_REGISTER_FAILED':
      return { label: '⚠️ Đăng ký thất bại', bg: '#FFEDD5', color: '#C2410C' };
    case 'CHECKOUT_ORDER_CREATED':
      return { label: '🛍️ Đặt đơn hàng thành công', bg: '#E0F2FE', color: '#0369A1' };
    case 'ADMIN_SECURITY_ACTION':
      return { label: '🛡️ Thao tác Bảo mật Admin', bg: '#F3E8FF', color: '#6B21A8' };
    case 'SERVER_API_ERROR':
      return { label: '🚨 Lỗi API Hệ thống (Global Handler)', bg: '#FEE2E2', color: '#991B1B' };
    case 'PAGE_VISIT':
    default:
      return { label: '🌐 Truy cập phiên (Session Visit)', bg: '#F3EFEA', color: '#5C4332' };
  }
}

export default function PrivacyScreen() {
  const router = useRouter();
  const { user, role } = useAuth();
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
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  const blockedIpSet = useMemo(
    () => new Set(blocklist.map((b) => b.ip.trim())),
    [blocklist]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((item) => {
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
      } else if (filter === 'visits') {
        if (item.eventType !== 'PAGE_VISIT') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const srcInfo = classifyAuditEntryTrafficSource(item);
        const hay = `${item.ip} ${item.location} ${item.userEmail} ${item.path} ${item.eventType} ${item.userAgent} ${item.referer} ${srcInfo.badgeLabel} ${srcInfo.detailLabel}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
      });
      }, [logs, filter, searchQuery]);

      const trafficBreakdown = useMemo(() => {
      let copyPasteMobile = 0;
      let copyPasteDesktop = 0;
      let googleSearch = 0;
      let tiktokDirect = 0;
      let socialZaloFbIg = 0;

      for (const l of logs) {
      const classified = classifyAuditEntryTrafficSource(l);
      if (classified.category === 'google_search') {
        googleSearch += 1;
      } else if (classified.category === 'tiktok') {
        tiktokDirect += 1;
      } else if (classified.category === 'social_zalo_fb_ig') {
        socialZaloFbIg += 1;
      } else {
        const isMobileUa = /iPhone|iPad|iPod|Android/i.test(l.userAgent || '');
        if (isMobileUa) copyPasteMobile += 1;
        else copyPasteDesktop += 1;
      }
      }

      return {
      copyPasteMobile,
      copyPasteDesktop,
      googleSearch,
      tiktokDirect,
      socialZaloFbIg,
      };
      }, [logs]);

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
            <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}>
              {isAdmin ? 'Trung Tâm Bảo Mật & Nhật Ký IP' : 'Bảo Mật & Quyền Riêng Tư'}
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

          {/* ADMIN ONLY: Active Protection Layers, Request Audit Logger & IP Blocklist */}
          {isAdmin && (
            <>
              <View style={[styles.shieldBanner, isMobile && styles.cardMobile]}>
                <View style={styles.shieldBannerTop}>
                  <View style={styles.shieldIconWrap}>
                    <ShieldCheck size={26} color="#15803D" />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.shieldTitle}>
                      Hệ thống phòng thủ đa lớp đang hoạt động
                    </Text>
                    <Text style={styles.shieldSub}>
                      IP hiện tại của bạn: {currentIp} ({currentLocation}
                      {currentAsn ? ` • ${currentAsn}` : ''})
                    </Text>
                  </View>
                </View>

                <View style={styles.layersGrid}>
                  {[
                    { label: 'HTTP CSP & HSTS', desc: 'Chống XSS & Clickjacking' },
                    { label: 'CORS & CSRF Guard', desc: 'Chỉ nhận từ tiemcuonlen.shop' },
                    { label: 'Rate Limiter', desc: 'Chống Brute-force & Spam đơn' },
                    { label: 'Hidden Bot Trap', desc: 'Lọc tự động Script / Bot AI' },
                    { label: 'Supabase RLS & Anti-IDOR', desc: 'Phân quyền dữ liệu theo vai trò' },
                    { label: 'Magic Bytes & Global Error', desc: 'Kiểm định ảnh & ẩn lỗi hệ thống' },
                  ].map((layer) => (
                    <View key={layer.label} style={styles.layerBadge}>
                      <CheckCircle2 size={14} color="#15803D" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.layerBadgeTitle}>{layer.label}</Text>
                        <Text style={styles.layerBadgeDesc}>{layer.desc}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Summary Metrics */}
              <View style={[styles.metricsRow, isMobile && styles.cardMobile]}>
                <View style={styles.metricCard}>
                  <Activity size={18} color={COLORS.primary} />
                  <Text style={styles.metricValue}>{logs.length}</Text>
                  <Text style={styles.metricLabel}>Tổng bản ghi</Text>
                </View>
                <View style={styles.metricCard}>
                  <ShieldAlert size={18} color="#C2410C" />
                  <Text style={[styles.metricValue, { color: '#C2410C' }]}>
                    {alertCount}
                  </Text>
                  <Text style={styles.metricLabel}>Cảnh báo / Bot</Text>
                </View>
                <View style={styles.metricCard}>
                  <Ban size={18} color="#B91C1C" />
                  <Text style={[styles.metricValue, { color: '#B91C1C' }]}>
                    {blocklist.length}
                  </Text>
                  <Text style={styles.metricLabel}>IP đang bị chặn</Text>
                </View>
                </View>

                {/* Traffic Source Attribution Card (Where Customers Come From) */}
                <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <Globe size={18} color="#047857" />
                    <Text style={styles.sectionTitle}>
                      📊 Phân Tích Nguồn Khách Truy Cập (Khách Vào Web Bằng Cách Nào?)
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 10,
                  }}>
                  <View
                    style={{
                      flex: 1,
                      minWidth: 165,
                      backgroundColor: '#FFFBEB',
                      borderWidth: 1,
                      borderColor: '#FDE68A',
                      borderRadius: 12,
                      padding: 12,
                      gap: 4,
                    }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '900',
                        color: '#92400E',
                      }}>
                      {trafficBreakdown.copyPasteMobile} lượt
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#78350F',
                      }}>
                      📋 Copy/Dán link trên Điện thoại
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#92400E',
                        lineHeight: 15,
                      }}>
                      Khách copy chữ "tiemcuonlen.shop" từ TikTok rồi dán vào Safari/Chrome ĐT
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      minWidth: 165,
                      backgroundColor: '#ECFDF5',
                      borderWidth: 1,
                      borderColor: '#A7F3D0',
                      borderRadius: 12,
                      padding: 12,
                      gap: 4,
                    }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '900',
                        color: '#065F46',
                      }}>
                      {trafficBreakdown.googleSearch} lượt
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#064E3B',
                      }}>
                      🔍 Tự tìm kiếm Google / Cốc Cốc
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#047857',
                        lineHeight: 15,
                      }}>
                      Khách search từ khóa sản phẩm len trên Google & bấm vào đề xuất của shop
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      minWidth: 165,
                      backgroundColor: '#FDF2F8',
                      borderWidth: 1,
                      borderColor: '#FBCFE8',
                      borderRadius: 12,
                      padding: 12,
                      gap: 4,
                    }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '900',
                        color: '#9D174D',
                      }}>
                      {trafficBreakdown.tiktokDirect} lượt
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#831843',
                      }}>
                      🎵 TikTok (Mở từ App / Xác nhận)
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#9D174D',
                        lineHeight: 15,
                      }}>
                      Khách mở trong App TikTok, link ?s=tt1 / ?s=tt2 hoặc chọn TikTok khi đặt đơn
                    </Text>
                  </View>

                  <View
                    style={{
                      flex: 1,
                      minWidth: 165,
                      backgroundColor: '#F0F9FF',
                      borderWidth: 1,
                      borderColor: '#BAE6FD',
                      borderRadius: 12,
                      padding: 12,
                      gap: 4,
                    }}>
                    <Text
                      style={{
                        fontSize: 20,
                        fontWeight: '900',
                        color: '#075985',
                      }}>
                      {trafficBreakdown.socialZaloFbIg +
                        trafficBreakdown.copyPasteDesktop}{' '}
                      lượt
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '800',
                        color: '#0C4A6E',
                      }}>
                      💻 Máy tính & Zalo / FB / IG
                    </Text>
                    <Text
                      style={{
                        fontSize: 11,
                        color: '#0369A1',
                        lineHeight: 15,
                      }}>
                      {trafficBreakdown.copyPasteDesktop} lượt gõ/dán trên Máy tính •{' '}
                      {trafficBreakdown.socialZaloFbIg} lượt từ Zalo/FB/IG
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    marginTop: 10,
                    backgroundColor: '#F8F5F0',
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderWidth: 1,
                    borderColor: '#E6D9C8',
                  }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      color: '#5C4332',
                      lineHeight: 17,
                    }}>
                    💡 <Text style={{ fontWeight: '800' }}>Mẹo phân biệt chính xác 2 kênh TikTok của bạn (dạng chữ thường):</Text> Kênh 1 bạn có thể ghi <Text style={{ fontWeight: '800' }}>tiemcuonlen.shop</Text>, Kênh 2 ghi <Text style={{ fontWeight: '800' }}>tiemcuonlen.shop?s=tt2</Text> — hoặc xem mục khách tự chọn <Text style={{ fontWeight: '800' }}>"Biết Tiệm qua đâu"</Text> ngay trong chi tiết mỗi đơn hàng bên dưới!
                  </Text>
                </View>
                </View>

              {/* IP Blocklist Management Card */}
              <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <Lock size={18} color="#B91C1C" />
                    <Text style={styles.sectionTitle}>
                      Danh sách chặn IP (IP Blocklist)
                    </Text>
                  </View>
                </View>

                <View style={styles.blockInputRow}>
                  <TextInput
                    style={[styles.blockInput, { flex: 1, minWidth: 140 }]}
                    placeholder="Nhập IP cần chặn (VD: 103.199.x.x)"
                    placeholderTextColor={COLORS.lightText}
                    value={manualIpInput}
                    onChangeText={setManualIpInput}
                    autoCapitalize="none"
                  />
                  <TextInput
                    style={[styles.blockInput, { flex: 1.4, minWidth: 170 }]}
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

                {blocklist.length === 0 ? (
                  <Text style={styles.emptyHintText}>
                    Hiện chưa có địa chỉ IP nào trong danh sách bị chặn.
                  </Text>
                ) : (
                  <View style={styles.blockedListWrap}>
                    {blocklist.map((b) => (
                      <View key={b.id} style={styles.blockedItemRow}>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.blockedIpText}>⛔ {b.ip}</Text>
                          <Text style={styles.blockedReasonText}>
                            {b.reason} • {formatAuditTime(b.createdAt)}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.unblockBtn}
                          onPress={() => handleToggleBlockIp(b.ip)}
                          activeOpacity={0.8}>
                          <Text style={styles.unblockBtnText}>Bỏ chặn</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Detailed Request Audit Log Viewer */}
              <View style={[styles.adminCard, isMobile && styles.cardMobile]}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.sectionTitleWrap}>
                    <Shield size={18} color={COLORS.primary} />
                    <Text style={styles.sectionTitle}>
                      Nhật ký truy cập & Sự kiện bảo mật chi tiết
                    </Text>
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
                        <Text style={[styles.smallActionBtnText, { color: '#B91C1C' }]}>
                          Xóa log
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Filter Tabs */}
                <View style={styles.filterTabsRow}>
                  {(
                    [
                      { id: 'all', label: `Tất cả (${logs.length})` },
                      { id: 'alerts', label: `Cảnh báo / Bot (${alertCount})` },
                      { id: 'auth', label: 'Đăng nhập / ĐK' },
                      { id: 'orders', label: 'Đơn hàng' },
                      { id: 'visits', label: 'Truy cập' },
                    ] as { id: LogFilter; label: string }[]
                  ).map((tab) => {
                    const active = filter === tab.id;
                    return (
                      <TouchableOpacity
                        key={tab.id}
                        style={[styles.filterChip, active && styles.filterChipActive]}
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

                {/* Search Input */}
                <View style={styles.searchBar}>
                  <Search size={16} color={COLORS.mediumText} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Tìm theo IP, email, đường dẫn (/login, /checkout), thiết bị..."
                    placeholderTextColor={COLORS.lightText}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCapitalize="none"
                  />
                </View>

                {filteredLogs.length === 0 ? (
                  <Text style={styles.emptyHintText}>
                    Không có bản ghi nhật ký nào khớp với bộ lọc hiện tại.
                  </Text>
                ) : (
                  <View style={styles.logList}>
                    {filteredLogs.slice(0, 60).map((item) => {
                      const badge = getEventLabel(item.eventType);
                      const isBlocked = blockedIpSet.has(item.ip);
                      const detailKeys = Object.keys(item.details || {});

                      return (
                        <View
                          key={item.id}
                          style={[
                            styles.logCard,
                            item.severity === 'CRITICAL' && styles.logCardCritical,
                            item.severity === 'WARNING' && styles.logCardWarning,
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
                              <Text style={styles.logFieldLabel}>IP & Mạng:</Text>
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
                              <Text style={styles.logFieldLabel}>Đường dẫn:</Text>
                              <Text style={styles.logFieldValue}>
                                [{item.method}] {item.path}
                              </Text>
                            </View>

                            <View style={styles.logField}>
                              <Shield size={13} color={COLORS.primary} />
                              <Text style={styles.logFieldLabel}>Tài khoản:</Text>
                              <Text style={styles.logFieldValue}>
                                {item.userEmail}
                              </Text>
                            </View>

                            <View style={styles.logField}>
                              <Smartphone size={13} color={COLORS.primary} />
                              <Text style={styles.logFieldLabel}>Thiết bị:</Text>
                              <Text
                                style={styles.logFieldSub}
                                numberOfLines={2}>
                                {item.screenSize ? `[${item.screenSize}] ` : ''}
                                {item.userAgent}
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
                              const srcBadge = classifyAuditEntryTrafficSource(item);
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
                                  <Text
                                    style={styles.refererText}
                                    numberOfLines={2}>
                                    Chi tiết nguồn: {srcBadge.detailLabel}
                                  </Text>
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
                                  {isBlocked ? 'Bỏ chặn IP này' : 'Chặn IP này'}
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
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
    maxWidth: 960,
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
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  headerTitleMobile: {
    fontSize: 16,
  },
  cardMobile: {
    marginHorizontal: 12,
  },
  shieldBanner: {
    backgroundColor: '#F4FBF6',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    ...SHADOWS.small,
  },
  shieldBannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  shieldIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#14532D',
  },
  shieldSub: {
    fontSize: 12.5,
    color: '#166534',
    marginTop: 2,
    fontWeight: '600',
  },
  layersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  layerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    minWidth: 150,
    flex: 1,
  },
  layerBadgeTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  layerBadgeDesc: {
    fontSize: 11,
    color: COLORS.mediumText,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EADFD2',
    ...SHADOWS.small,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: 4,
  },
  metricLabel: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  adminCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 18,
    padding: 16,
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
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  headerActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  blockInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  blockInput: {
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E2D6C5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
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
    marginBottom: 10,
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
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
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
    gap: 10,
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
  refererText: {
    fontSize: 11,
    color: COLORS.lightText,
    flex: 1,
    minWidth: 120,
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
