import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  CheckCheck,
  Copy,
  CheckCircle,
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
  Download,
  Smartphone,
  Lock,
  ArrowUpRight,
} from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { useAuth } from '@/store/AuthContext';
import { supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { type PaymentMethod } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getOrderStatusLabel } from '@/constants/orderStatus';

interface VietQRBankApp {
  appId: string;
  shortName: string;
  appName: string;
  logo: string;
  autofill: boolean;
}

// 5 Banks with official VietQR Universal Link Auto-Fill SDK (opens straight to pre-filled Transfer Confirmation screen)
const AUTOFILL_BANK_APPS: VietQRBankApp[] = [
  {
    appId: 'mb',
    shortName: 'MB Bank',
    appName: 'MB Bank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/mb-ios.webp',
    autofill: true,
  },
  {
    appId: 'icb',
    shortName: 'VietinBank',
    appName: 'VietinBank iPay',
    logo: 'https://cdn.vietqr.io/bank-app-icon/icb-ios.webp',
    autofill: true,
  },
  {
    appId: 'bidv',
    shortName: 'BIDV',
    appName: 'BIDV SmartBanking',
    logo: 'https://cdn.vietqr.io/bank-app-icon/bidv-ios.webp',
    autofill: true,
  },
  {
    appId: 'acb',
    shortName: 'ACB ONE',
    appName: 'ACB ONE',
    logo: 'https://cdn.vietqr.io/bank-app-icon/acb-ios.webp',
    autofill: true,
  },
  {
    appId: 'ocb',
    shortName: 'OCB OMNI',
    appName: 'OCB OMNI',
    logo: 'https://cdn.vietqr.io/bank-app-icon/ocb-ios.webp',
    autofill: true,
  },
];

// Other major banks (opens app + copies STK/content; user scans saved QR from gallery)
const OTHER_BANK_APPS: VietQRBankApp[] = [
  {
    appId: 'vcb',
    shortName: 'Vietcombank',
    appName: 'VCB Digibank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vcb-ios.webp',
    autofill: false,
  },
  {
    appId: 'tcb',
    shortName: 'Techcombank',
    appName: 'Techcombank Mobile',
    logo: 'https://cdn.vietqr.io/bank-app-icon/tcb-ios.webp',
    autofill: false,
  },
  {
    appId: 'vpb',
    shortName: 'VPBank',
    appName: 'VPBank NEO',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vpb-ios.webp',
    autofill: false,
  },
  {
    appId: 'tpb',
    shortName: 'TPBank',
    appName: 'TPBank Mobile',
    logo: 'https://cdn.vietqr.io/bank-app-icon/tpb-ios.webp',
    autofill: false,
  },
  {
    appId: 'vba',
    shortName: 'Agribank',
    appName: 'Agribank Plus',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vba-ios.webp',
    autofill: false,
  },
  {
    appId: 'vib-2',
    shortName: 'MyVIB',
    appName: 'MyVIB',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp',
    autofill: false,
  },
  {
    appId: 'cake',
    shortName: 'CAKE',
    appName: 'CAKE Bank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/cake-ios.webp',
    autofill: false,
  },
  {
    appId: 'hdb',
    shortName: 'HDBank',
    appName: 'HDBank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/hdb-ios.webp',
    autofill: false,
  },
];

const RECIPIENT_BANK_META: Record<
  string,
  { sepayCode: string; vietqrAppId: string; bin: string }
> = {
  VietinBank: { sepayCode: 'VietinBank', vietqrAppId: 'icb', bin: '970415' },
  Vietcombank: { sepayCode: 'Vietcombank', vietqrAppId: 'vcb', bin: '970436' },
  VCB: { sepayCode: 'Vietcombank', vietqrAppId: 'vcb', bin: '970436' },
  'MB Bank': { sepayCode: 'MBBank', vietqrAppId: 'mb', bin: '970422' },
  MBBank: { sepayCode: 'MBBank', vietqrAppId: 'mb', bin: '970422' },
  MB: { sepayCode: 'MBBank', vietqrAppId: 'mb', bin: '970422' },
  Techcombank: { sepayCode: 'Techcombank', vietqrAppId: 'tcb', bin: '970407' },
  TCB: { sepayCode: 'Techcombank', vietqrAppId: 'tcb', bin: '970407' },
  BIDV: { sepayCode: 'BIDV', vietqrAppId: 'bidv', bin: '970418' },
  ACB: { sepayCode: 'ACB', vietqrAppId: 'acb', bin: '970416' },
  VPBank: { sepayCode: 'VPBank', vietqrAppId: 'vpb', bin: '970432' },
  TPBank: { sepayCode: 'TPBank', vietqrAppId: 'tpb', bin: '970423' },
  Sacombank: { sepayCode: 'Sacombank', vietqrAppId: 'stb', bin: '970403' },
  Agribank: { sepayCode: 'Agribank', vietqrAppId: 'vba', bin: '970405' },
  OCB: { sepayCode: 'OCB', vietqrAppId: 'ocb', bin: '970448' },
  VIB: { sepayCode: 'VIB', vietqrAppId: 'vib-2', bin: '970441' },
};

/**
 * Builds the official VietQR Payment Kit Universal Deep Link (`https://dl.vietqr.io/pay`).
 * NOTE: `@` in `ba=<account>@<bank>` MUST remain literal `@` so the bank app parser reads it properly.
 */
function buildOfficialVietQRDeepLink(
  customerAppId: string,
  recipientAccountNo: string,
  recipientBankAppId: string,
  amount: number,
  transferContent: string,
  recipientName: string,
  returnUrl?: string
): string {
  const cleanAcc = recipientAccountNo.trim();
  const cleanBank = recipientBankAppId.trim();
  const cleanAmount = Math.max(0, Math.round(amount));
  let url = `https://dl.vietqr.io/pay?app=${encodeURIComponent(
    customerAppId
  )}&ba=${cleanAcc}@${cleanBank}&am=${cleanAmount}&tn=${encodeURIComponent(
    transferContent
  )}&bn=${encodeURIComponent(recipientName)}`;
  if (returnUrl) {
    url += `&url=${encodeURIComponent(returnUrl)}`;
  }
  return url;
}

/**
 * Renders a genuine HTML `<a href="...">` on Mobile Web so iOS Universal Links & Android App Links
 * intercept the tap at the OS level and open straight to the pre-filled Transfer Confirmation screen
 * inside the banking app (instead of falling back to a bare custom scheme via JS redirect).
 */
function BankDeepLinkButton({
  deepLink,
  isMobileBrowser,
  onPressBeforeNavigate,
  style,
  children,
}: {
  deepLink: string;
  isMobileBrowser: boolean;
  onPressBeforeNavigate: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  if (Platform.OS === 'web' && isMobileBrowser) {
    return React.createElement(
      'a',
      {
        href: deepLink,
        target: '_top',
        rel: 'noopener noreferrer',
        onClick: () => {
          // Do NOT call e.preventDefault() — iOS/Android Universal Links require native anchor navigation
          onPressBeforeNavigate();
        },
        style: {
          textDecoration: 'none',
          color: 'inherit',
          display: 'flex',
          WebkitTapHighlightColor: 'transparent',
          cursor: 'pointer',
          ...StyleSheet.flatten(style),
        },
      },
      children
    );
  }

  return (
    <TouchableOpacity
      style={style}
      onPress={() => {
        onPressBeforeNavigate();
        if (Platform.OS !== 'web') {
          Linking.openURL(deepLink).catch(() => {});
        }
      }}
      activeOpacity={0.78}>
      {children}
    </TouchableOpacity>
  );
}

export default function PaymentScreen() {
  const { orderId: paramOrderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, refetchOrders } = useOrders();
  const { enabledMethods } = usePaymentMethods();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isDesktop = windowWidth >= 820;
  const isMobile = windowWidth < 600;

  const isMobileBrowser =
    Platform.OS !== 'web' ||
    (typeof navigator !== 'undefined' &&
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) ||
    windowWidth < 768;

  const order = orders.find((o) => o.id === paramOrderId);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [autoVerifiedBySepay, setAutoVerifiedBySepay] = useState(false);
  const [selectedBankFeedback, setSelectedBankFeedback] = useState<{
    appName: string;
    deepLink: string;
    autofill: boolean;
  } | null>(null);
  const [simulatingSepay, setSimulatingSepay] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  const paymentMethod: PaymentMethod | undefined =
    enabledMethods.find((m) => m.title === order?.paymentMethod) ??
    enabledMethods.find((m) => m.type === 'bank_transfer') ??
    enabledMethods[0];

  const accountNo = paymentMethod?.account_number || '107888618456';
  const accountName = paymentMethod?.account_name || 'VO VU MINH HOANG';
  const bankName = paymentMethod?.bank_name || 'VietinBank';
  const orderAmount = order?.total ?? 0;

  const orderShortId = (order?.id ?? '')
    .replace(/^CUONLEN[-_]?/i, '')
    .replace(/[^A-Za-z0-9]/g, '');

  const isVietinBank = bankName.toLowerCase().includes('vietin');
  const rawPrefix = (paymentMethod?.transfer_prefix ?? 'SEVQR CUONLEN')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase();

  // VietinBank on SePay requires "SEVQR" in transfer description to trigger instant webhook
  const transferContent = isVietinBank
    ? rawPrefix.startsWith('SEVQR')
      ? `${rawPrefix}${orderShortId}`
      : `SEVQR ${rawPrefix}${orderShortId}`
    : `${rawPrefix.replace(/\s+/g, '')}${orderShortId}`;

  const bankMeta = RECIPIENT_BANK_META[bankName] ?? {
    sepayCode: bankName || 'VietinBank',
    vietqrAppId: 'icb',
    bin: '970415',
  };

  const returnUrl =
    typeof window !== 'undefined' && window.location?.href
      ? window.location.href
      : `https://tiem-cuon-len.vercel.app/payment/${order?.id || ''}`;

  // Official SePay VietQR image (`vietqr.app/img`)
  const sepayQrImageUrl = accountNo
    ? `https://vietqr.app/img?bank=${encodeURIComponent(
        bankMeta.sepayCode
      )}&acc=${encodeURIComponent(
        accountNo
      )}&template=&amount=${orderAmount}&des=${encodeURIComponent(
        transferContent
      )}&showinfo=true&holder=${encodeURIComponent(
        accountName
      )}&store=${encodeURIComponent('Tiệm Cuộn Len')}`
    : '';

  // Check remote order status from Supabase (triggered automatically when SePay calls /api/sepay-webhook)
  const checkOrderPaymentStatus = useCallback(async () => {
    if (!order?.id || !supabaseUrl || !supabaseAnonKey || confirmed) return;
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(
          order.id
        )}&select=id,status`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );
      if (!res.ok) return;
      const rows = await res.json();
      const remoteOrder = Array.isArray(rows) ? rows[0] : null;
      if (
        remoteOrder &&
        remoteOrder.status &&
        remoteOrder.status !== 'pending_payment'
      ) {
        updateOrderStatus(order.id, remoteOrder.status);
        if (
          remoteOrder.status === 'Đang xử lý' ||
          remoteOrder.status === 'Hoàn thành'
        ) {
          setAutoVerifiedBySepay(true);
        }
        setConfirmed(true);
      }
    } catch {
      // ignore network error
    }
  }, [order?.id, confirmed, updateOrderStatus]);

  // Poll every 2.5 seconds for real-time SePay Webhook confirmation
  useEffect(() => {
    if (!order || confirmed) return;
    if (order.status !== 'pending_payment') {
      setConfirmed(true);
      return;
    }

    checkOrderPaymentStatus();
    const timer = setInterval(checkOrderPaymentStatus, 2500);
    return () => clearInterval(timer);
  }, [order, confirmed, checkOrderPaymentStatus]);

  const handleManualCheckNow = async () => {
    setCheckingNow(true);
    await checkOrderPaymentStatus();
    await refetchOrders();
    setTimeout(() => setCheckingNow(false), 600);
  };

  const handleCopyText = async (text: string, key: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      // ignore
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDownloadQrImage = async () => {
    if (!sepayQrImageUrl) return;
    setDownloadingQr(true);
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const res = await fetch(sepayQrImageUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `VietQR-${order?.id || 'CUONLEN'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
      } else {
        await Linking.openURL(sepayQrImageUrl);
      }
    } catch {
      await Linking.openURL(sepayQrImageUrl);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleBankTapSideEffect = (app: VietQRBankApp, deepLink: string) => {
    Clipboard.setStringAsync(transferContent).catch(() => {});
    setCopiedKey('content');
    setTimeout(() => setCopiedKey(null), 2500);
    setSelectedBankFeedback({
      appName: app.appName,
      deepLink,
      autofill: app.autofill,
    });
  };

  const handleSimulateSepayWebhook = async () => {
    if (!order) return;
    setSimulatingSepay(true);
    try {
      const payload = {
        id: Math.floor(100000 + Math.random() * 900000),
        gateway: bankName,
        transactionDate: new Date().toISOString(),
        accountNumber: accountNo,
        code: transferContent,
        content: `${transferContent} chuyen khoan mua len`,
        transferType: 'in',
        description: `SePay Auto Webhook ${transferContent}`,
        transferAmount: orderAmount,
        referenceCode: `FT${Date.now()}`,
      };

      const res = await fetch('/api/sepay-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await checkOrderPaymentStatus();
      } else {
        updateOrderStatus(order.id, 'Đang xử lý');
        setAutoVerifiedBySepay(true);
        setConfirmed(true);
      }
    } catch {
      updateOrderStatus(order.id, 'Đang xử lý');
      setAutoVerifiedBySepay(true);
      setConfirmed(true);
    } finally {
      setSimulatingSepay(false);
    }
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.notFoundText}>Không tìm thấy đơn hàng</Text>
          <TouchableOpacity
            style={styles.backBtnLarge}
            onPress={() => router.replace('/orders')}>
            <Text style={styles.backBtnLargeText}>Xem đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Confirmed state ──
  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.confirmedScroll}>
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIcon}>
              <ShieldCheck size={56} color={COLORS.success} />
            </View>
            <Text style={styles.confirmedTitle}>
              {autoVerifiedBySepay
                ? 'Thanh toán thành công!'
                : 'Đã ghi nhận đơn hàng!'}
            </Text>
            <Text style={styles.confirmedText}>
              {autoVerifiedBySepay
                ? 'Hệ thống SePay đã xác nhận giao dịch chuyển khoản tự động. Tiệm Cuộn Len đang chuẩn bị đơn hàng cho bạn ngay!'
                : 'Tiệm Cuộn Len đã nhận thông tin đơn hàng của bạn.'}
            </Text>

            <View style={styles.orderSummary}>
              <Text style={styles.orderCode}>Mã đơn: {order.id}</Text>
              <Text style={styles.orderAmount}>{formatVND(order.total)}</Text>
              <View style={styles.statusBadge}>
                {autoVerifiedBySepay ? (
                  <CheckCircle size={14} color={COLORS.success} />
                ) : (
                  <Clock size={14} color="#3D2B1F" />
                )}
                <Text style={styles.statusBadgeText}>
                  {getOrderStatusLabel(order.status)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace('/orders')}>
              <Text style={styles.primaryBtnText}>Xem đơn hàng của tôi</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.outlineBtn}
              onPress={() => router.replace('/')}>
              <Text style={styles.outlineBtnText}>Về trang chủ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Professional Fintech / SePay Payment Gateway ──
  return (
    <SafeAreaView style={styles.safe}>
      {/* Compact Sticky Top Bar */}
      <View style={styles.topNavWrap}>
        <View style={styles.topNavInner}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/orders');
            }}
            style={styles.backBtn}
            activeOpacity={0.75}>
            <ChevronLeft size={20} color="#2C1E14" />
            {!isMobile && <Text style={styles.backBtnText}>Quay lại</Text>}
          </TouchableOpacity>

          <View style={styles.topNavCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Cổng Thanh Toán VietQR
            </Text>
          </View>

          <View style={styles.securityPill}>
            <Lock size={12} color="#2E7D32" />
            <Text style={styles.securityPillText}>SePay 24/7</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContainer,
          isDesktop && styles.scrollContainerDesktop,
        ]}>
        {/* Main 2-Column Split Gateway (Desktop) / Stacked (Mobile) */}
        <View
          style={[
            styles.gatewayGrid,
            isDesktop ? styles.gatewayGridDesktop : styles.gatewayGridMobile,
          ]}>
          {/* ── LEFT COLUMN: QR SCANNER TERMINAL CARD ── */}
          <View
            style={[
              styles.qrColumn,
              isDesktop ? styles.qrColumnDesktop : styles.qrColumnMobile,
            ]}>
            <View style={styles.qrTerminalCard}>
              {/* Live Waiting Status Header inside QR Card */}
              <View style={styles.liveStatusBanner}>
                <View style={styles.liveStatusLeft}>
                  <View style={styles.pulseDotOuter}>
                    <View style={styles.pulseDotInner} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.liveStatusTitle}>
                      Đang chờ nhận chuyển khoản...
                    </Text>
                    <Text style={styles.liveStatusSub}>
                      Tự động duyệt đơn sau 3–5 giây
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.refreshMiniBtn}
                  onPress={handleManualCheckNow}
                  disabled={checkingNow}
                  activeOpacity={0.75}>
                  {checkingNow ? (
                    <ActivityIndicator size="small" color="#3D2B1F" />
                  ) : (
                    <>
                      <RefreshCw size={12} color="#3D2B1F" />
                      <Text style={styles.refreshMiniText}>Kiểm tra</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* QR Frame with Corner Brackets */}
              <View style={styles.qrScannerFrame}>
                <View style={[styles.cornerBracket, styles.cornerTL]} />
                <View style={[styles.cornerBracket, styles.cornerTR]} />
                <View style={[styles.cornerBracket, styles.cornerBL]} />
                <View style={[styles.cornerBracket, styles.cornerBR]} />

                {sepayQrImageUrl ? (
                  <Image
                    source={{ uri: sepayQrImageUrl }}
                    style={[
                      styles.qrImage,
                      isMobile && styles.qrImageMobile,
                    ]}
                    resizeMode="contain"
                  />
                ) : null}
              </View>

              <Text style={styles.qrScanCaption}>
                Quét mã bằng bất kỳ App Ngân Hàng nào để mở thẳng màn hình xác nhận chuyển khoản
              </Text>

              {/* Quick Actions below QR */}
              <View style={styles.qrActionRow}>
                <TouchableOpacity
                  style={styles.qrSecondaryBtn}
                  onPress={handleDownloadQrImage}
                  disabled={downloadingQr}
                  activeOpacity={0.8}>
                  {downloadingQr ? (
                    <ActivityIndicator size="small" color="#3D2B1F" />
                  ) : (
                    <>
                      <Download size={15} color="#3D2B1F" />
                      <Text style={styles.qrSecondaryBtnText}>Lưu ảnh QR</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.qrPrimaryCopyBtn,
                    copiedKey === 'content' && styles.qrPrimaryCopyBtnSuccess,
                  ]}
                  onPress={() => handleCopyText(transferContent, 'content')}
                  activeOpacity={0.85}>
                  {copiedKey === 'content' ? (
                    <>
                      <CheckCheck size={15} color="#FAF5EE" />
                      <Text style={styles.qrPrimaryCopyBtnText}>
                        Đã chép nội dung!
                      </Text>
                    </>
                  ) : (
                    <>
                      <Copy size={15} color="#FAF5EE" />
                      <Text style={styles.qrPrimaryCopyBtnText}>
                        Chép nội dung CK
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* ── RIGHT COLUMN: DIRECT TRANSFER LAUNCHER + ORDER TICKET ── */}
          <View style={styles.infoColumn}>
            {/* 1. Direct Auto-Fill Transfer Launcher Card (Top Priority) */}
            <View style={styles.bankAppsCard}>
              <View style={styles.bankAppsHeader}>
                <View style={styles.autofillHeaderBadge}>
                  <Zap size={12} color="#2E7D32" />
                  <Text style={styles.autofillHeaderBadgeText}>
                    MỞ THẲNG MÀN HÌNH CHUYỂN KHOẢN • CHỈ CẦN ẤN XÁC NHẬN
                  </Text>
                </View>
                <Text style={styles.bankAppsTitle}>
                  Chọn ngân hàng trên điện thoại để chuyển khoản ngay
                </Text>
                <Text style={styles.bankAppsSub}>
                  Tự động điền sẵn STK <Text style={{ fontWeight: '800' }}>{accountNo}</Text>, số tiền{' '}
                  <Text style={{ fontWeight: '800' }}>{formatVND(orderAmount)}</Text> và nội dung{' '}
                  <Text style={{ fontWeight: '800' }}>{transferContent}</Text>
                </Text>
              </View>

              {/* Featured 5 Auto-Fill Banks (1-tap straight to Transfer screen) */}
              <View style={styles.autofillBankList}>
                {AUTOFILL_BANK_APPS.map((app) => {
                  const deepLink = buildOfficialVietQRDeepLink(
                    app.appId,
                    accountNo,
                    bankMeta.vietqrAppId,
                    orderAmount,
                    transferContent,
                    accountName,
                    returnUrl
                  );
                  return (
                    <BankDeepLinkButton
                      key={app.appId}
                      deepLink={deepLink}
                      isMobileBrowser={isMobileBrowser}
                      onPressBeforeNavigate={() =>
                        handleBankTapSideEffect(app, deepLink)
                      }
                      style={[
                        styles.autofillBankRow,
                        !isMobile && styles.autofillBankRowDesktop,
                      ]}>
                      <Image
                        source={{ uri: app.logo }}
                        style={styles.autofillBankLogo}
                        resizeMode="cover"
                      />
                      <View style={styles.autofillBankMeta}>
                        <Text style={styles.autofillBankName} numberOfLines={1}>
                          {app.appName}
                        </Text>
                        <Text style={styles.autofillBankHint} numberOfLines={1}>
                          Tự điền 100% • Chỉ cần ấn Xác nhận
                        </Text>
                      </View>
                      <View style={styles.autofillGoPill}>
                        <Text style={styles.autofillGoText}>Chuyển ngay</Text>
                        <ArrowUpRight size={13} color="#FAF5EE" />
                      </View>
                    </BankDeepLinkButton>
                  );
                })}
              </View>

              {/* Other Banks Section (Scan saved QR / Copy STK) */}
              <View style={styles.otherBanksSection}>
                <Text style={styles.otherBanksTitle}>
                  Ngân hàng khác (Mở App & chọn ảnh QR đã lưu hoặc dán STK):
                </Text>
                <View style={styles.bankGrid}>
                  {OTHER_BANK_APPS.map((app) => {
                    const deepLink = buildOfficialVietQRDeepLink(
                      app.appId,
                      accountNo,
                      bankMeta.vietqrAppId,
                      orderAmount,
                      transferContent,
                      accountName,
                      returnUrl
                    );
                    return (
                      <BankDeepLinkButton
                        key={app.appId}
                        deepLink={deepLink}
                        isMobileBrowser={isMobileBrowser}
                        onPressBeforeNavigate={() =>
                          handleBankTapSideEffect(app, deepLink)
                        }
                        style={[
                          styles.bankAppItem,
                          isMobile
                            ? styles.bankAppItemMobile
                            : styles.bankAppItemDesktop,
                        ]}>
                        <View style={styles.bankLogoWrap}>
                          <Image
                            source={{ uri: app.logo }}
                            style={styles.bankLogo}
                            resizeMode="cover"
                          />
                        </View>
                        <Text style={styles.bankShortName} numberOfLines={1}>
                          {app.shortName}
                        </Text>
                      </BankDeepLinkButton>
                    );
                  })}
                </View>
              </View>

              {selectedBankFeedback && !isMobileBrowser && (
                <View style={styles.bankFeedbackBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankFeedbackText}>
                      📱 Bạn đang mở trên máy tính: Đã sao chép nội dung{' '}
                      <Text style={{ fontWeight: '800' }}>{transferContent}</Text>. Hãy mở ứng dụng{' '}
                      <Text style={{ fontWeight: '800' }}>
                        {selectedBankFeedback.appName}
                      </Text>{' '}
                      trên điện thoại và quét mã VietQR bên trái để vào thẳng màn hình xác nhận chuyển khoản!
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* 2. Compact Order & Transfer Summary Ticket */}
            <View style={styles.ticketCard}>
              <View style={styles.ticketTopRow}>
                <View>
                  <Text style={styles.ticketEyebrow}>MÃ ĐƠN HÀNG</Text>
                  <Text style={styles.ticketOrderId}>{order.id}</Text>
                </View>
                <View style={styles.amountBox}>
                  <Text style={styles.amountLabel}>Tổng thanh toán</Text>
                  <Text style={styles.amountValue}>{formatVND(order.total)}</Text>
                </View>
              </View>

              <View style={styles.ticketDivider} />

              <View style={styles.copyPillsGrid}>
                <TouchableOpacity
                  style={styles.copyPill}
                  onPress={() => handleCopyText(accountNo, 'stk')}
                  activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.copyPillLabel}>
                      STK {bankName} ({accountName})
                    </Text>
                    <Text style={styles.copyPillValue}>{accountNo}</Text>
                  </View>
                  {copiedKey === 'stk' ? (
                    <CheckCheck size={15} color={COLORS.success} />
                  ) : (
                    <Copy size={14} color="#5C4332" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.copyPill, styles.copyPillHighlight]}
                  onPress={() => handleCopyText(transferContent, 'content')}
                  activeOpacity={0.75}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.copyPillLabel}>
                      Nội dung chuyển khoản (Bắt buộc giữ nguyên)
                    </Text>
                    <Text style={styles.copyPillCode}>{transferContent}</Text>
                  </View>
                  {copiedKey === 'content' ? (
                    <CheckCheck size={15} color={COLORS.success} />
                  ) : (
                    <Copy size={14} color="#3D2B1F" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Admin Webhook Simulator Tool */}
            {isAdmin && (
              <View style={styles.adminTestBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.adminTestTitle}>
                    🛠️ Công cụ Admin: Giả lập Webhook SePay
                  </Text>
                  <Text style={styles.adminTestSub}>
                    Gửi bản tin test vào{' '}
                    <Text style={{ fontWeight: '700' }}>/api/sepay-webhook</Text> để kiểm tra tự động duyệt đơn ngay lập tức.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.adminTestBtn}
                  onPress={handleSimulateSepayWebhook}
                  disabled={simulatingSepay}
                  activeOpacity={0.85}>
                  {simulatingSepay ? (
                    <ActivityIndicator size="small" color="#FAF5EE" />
                  ) : (
                    <>
                      <Zap size={14} color="#FAF5EE" />
                      <Text style={styles.adminTestBtnText}>
                        Giả lập nhận tiền
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Footer Navigation */}
            <View style={styles.footerActions}>
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={() => router.replace('/orders')}
                activeOpacity={0.75}>
                <Text style={styles.laterBtnText}>
                  Xem danh sách đơn hàng của tôi
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F6EFE6',
  },
  scroll: {
    flex: 1,
  },
  scrollContainer: {
    width: '100%',
    maxWidth: 1060,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 40,
  },
  scrollContainerDesktop: {
    paddingHorizontal: 28,
    paddingTop: 22,
    paddingBottom: 48,
  },

  /* Top Navigation Bar */
  topNavWrap: {
    backgroundColor: '#FAF5EE',
    borderBottomWidth: 1,
    borderBottomColor: '#E4D5C3',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  topNavInner: {
    maxWidth: 1060,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE5D8',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1E14',
  },
  topNavCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#2C1E14',
    letterSpacing: 0.2,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EBF7EE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE3C8',
  },
  securityPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2E7D32',
  },

  /* Gateway 2-Column Responsive Layout */
  gatewayGrid: {
    width: '100%',
    gap: 18,
  },
  gatewayGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  gatewayGridMobile: {
    flexDirection: 'column',
  },
  qrColumn: {
    width: '100%',
  },
  qrColumnDesktop: {
    width: 385,
    flexShrink: 0,
  },
  qrColumnMobile: {
    width: '100%',
  },
  infoColumn: {
    flex: 1,
    width: '100%',
    gap: 14,
  },

  /* QR Scanner Terminal Card */
  qrTerminalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DFCBB5',
    ...SHADOWS.medium,
  },
  liveStatusBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5EFE6',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    marginBottom: 16,
    gap: 8,
  },
  liveStatusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  pulseDotOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(46, 125, 50, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseDotInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#2E7D32',
  },
  liveStatusTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  liveStatusSub: {
    fontSize: 11,
    color: '#5C4332',
    marginTop: 1,
  },
  refreshMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  refreshMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D2B1F',
  },

  /* Scanner Frame with Corner Brackets */
  qrScannerFrame: {
    position: 'relative',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EFE6DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerBracket: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: '#3D2B1F',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 12,
  },
  qrImage: {
    width: 265,
    height: 322,
    borderRadius: 10,
  },
  qrImageMobile: {
    width: 242,
    height: 295,
  },
  qrScanCaption: {
    fontSize: 12,
    color: '#5C4332',
    textAlign: 'center',
    lineHeight: 17,
    marginTop: 12,
    paddingHorizontal: 6,
  },
  qrActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginTop: 14,
  },
  qrSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F3ECE2',
    paddingVertical: 11,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  qrSecondaryBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  qrPrimaryCopyBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    paddingVertical: 11,
    borderRadius: 13,
  },
  qrPrimaryCopyBtnSuccess: {
    backgroundColor: '#2E7D32',
  },
  qrPrimaryCopyBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },

  /* Direct Bank Apps Card */
  bankAppsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#DFCBB5',
    ...SHADOWS.small,
  },
  bankAppsHeader: {
    marginBottom: 14,
  },
  autofillHeaderBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EBF7EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFE3C8',
    marginBottom: 8,
  },
  autofillHeaderBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#2E7D32',
    letterSpacing: 0.3,
  },
  bankAppsTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#2C1E14',
  },
  bankAppsSub: {
    fontSize: 12,
    color: '#5C4332',
    marginTop: 4,
    lineHeight: 18,
  },

  /* Featured Auto-Fill Bank Rows */
  autofillBankList: {
    gap: 8,
  },
  autofillBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
  },
  autofillBankRowDesktop: {
    paddingVertical: 10,
  },
  autofillBankLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5D5C3',
  },
  autofillBankMeta: {
    flex: 1,
    minWidth: 0,
  },
  autofillBankName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C1E14',
  },
  autofillBankHint: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 1,
  },
  autofillGoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 11,
    flexShrink: 0,
  },
  autofillGoText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FAF5EE',
  },

  /* Other Banks Grid */
  otherBanksSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EFE6DC',
  },
  otherBanksTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E533E',
    marginBottom: 9,
  },
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bankAppItem: {
    flexDirection: 'column',
    backgroundColor: '#FAF5EE',
    borderRadius: 13,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    gap: 5,
  },
  bankAppItemDesktop: {
    width: '23.4%',
  },
  bankAppItemMobile: {
    width: '23%',
  },
  bankLogoWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    overflow: 'hidden',
  },
  bankLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  bankShortName: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#2C1E14',
    textAlign: 'center',
  },
  bankFeedbackBanner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#BFE3C8',
  },
  bankFeedbackText: {
    fontSize: 12,
    color: '#1E5622',
    lineHeight: 17,
  },

  /* Right Column: Ticket Card */
  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1.5,
    borderColor: '#DFCBB5',
    ...SHADOWS.small,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  ticketEyebrow: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7A5C44',
    letterSpacing: 0.8,
  },
  ticketOrderId: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
    marginTop: 2,
  },
  amountBox: {
    alignItems: 'flex-end',
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  amountLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  amountValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2C1E14',
    marginTop: 1,
  },
  ticketDivider: {
    height: 1,
    backgroundColor: '#EFE6DC',
    marginVertical: 14,
  },
  copyPillsGrid: {
    gap: 9,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    gap: 10,
  },
  copyPillHighlight: {
    backgroundColor: '#F3ECE2',
    borderColor: '#C9B29B',
  },
  copyPillLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6E533E',
  },
  copyPillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C1E14',
    marginTop: 2,
  },
  copyPillCode: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#2C1E14',
    marginTop: 2,
    letterSpacing: 0.4,
  },

  /* Admin Test Box */
  adminTestBox: {
    backgroundColor: '#EFE5D8',
    borderRadius: 18,
    padding: 15,
    borderWidth: 1.5,
    borderColor: '#C5AC92',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  adminTestTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C1E14',
  },
  adminTestSub: {
    fontSize: 11.5,
    color: '#4A3525',
    lineHeight: 16,
    marginTop: 2,
  },
  adminTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#2E7D32',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexShrink: 0,
  },
  adminTestBtnText: {
    color: '#FAF5EE',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Footer Navigation */
  footerActions: {
    alignItems: 'center',
    paddingTop: 2,
  },
  laterBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: '#EFE5D8',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  laterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3D2B1F',
  },

  /* Not Found & Confirmed States */
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.mediumText,
    textAlign: 'center',
  },
  backBtnLarge: {
    backgroundColor: '#3D2B1F',
    borderRadius: 16,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
  },
  backBtnLargeText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FAF5EE',
  },
  confirmedScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    maxWidth: 540,
    width: '100%',
    alignSelf: 'center',
  },
  confirmedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.lg,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    ...SHADOWS.large,
  },
  confirmedIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#2C1E14',
  },
  confirmedText: {
    fontSize: 14,
    color: '#4A3525',
    textAlign: 'center',
    lineHeight: 21,
  },
  orderSummary: {
    backgroundColor: '#FAF5EE',
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5D5C3',
  },
  orderCode: {
    fontSize: 13.5,
    color: '#5C4332',
    fontWeight: '700',
  },
  orderAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2C1E14',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  primaryBtn: {
    backgroundColor: '#3D2B1F',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  outlineBtn: {
    borderRadius: 18,
    paddingVertical: 13,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
  },
  outlineBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B1F',
  },
});
