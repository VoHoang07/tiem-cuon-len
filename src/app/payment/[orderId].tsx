import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  Modal,
  ActivityIndicator,
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
  X,
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
  scheme: string;
  autofill: boolean;
}

const DIRECT_AUTOFILL_IDS = new Set(['mb', 'icb', 'bidv', 'acb', 'ocb']);

const DEFAULT_BANK_APPS: VietQRBankApp[] = [
  {
    appId: 'mb',
    shortName: 'MB Bank',
    appName: 'MB Bank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/mb-ios.webp',
    scheme: 'mbbank://',
    autofill: true,
  },
  {
    appId: 'icb',
    shortName: 'VietinBank iPay',
    appName: 'VietinBank iPay',
    logo: 'https://cdn.vietqr.io/bank-app-icon/icb-ios.webp',
    scheme: 'vietinbankipay://',
    autofill: true,
  },
  {
    appId: 'bidv',
    shortName: 'BIDV',
    appName: 'BIDV SmartBanking',
    logo: 'https://cdn.vietqr.io/bank-app-icon/bidv-ios.webp',
    scheme: 'bidv.smartbanking.partner://',
    autofill: true,
  },
  {
    appId: 'acb',
    shortName: 'ACB',
    appName: 'ACB ONE',
    logo: 'https://cdn.vietqr.io/bank-app-icon/acb-ios.webp',
    scheme: 'acbone://',
    autofill: true,
  },
  {
    appId: 'ocb',
    shortName: 'OCB',
    appName: 'OCB OMNI',
    logo: 'https://cdn.vietqr.io/bank-app-icon/ocb-ios.webp',
    scheme: 'newomni-app://',
    autofill: true,
  },
  {
    appId: 'vcb',
    shortName: 'Vietcombank',
    appName: 'VCB Digibank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vcb-ios.webp',
    scheme: 'vietcombankmobile://',
    autofill: false,
  },
  {
    appId: 'tcb',
    shortName: 'Techcombank',
    appName: 'Techcombank Mobile',
    logo: 'https://cdn.vietqr.io/bank-app-icon/tcb-ios.webp',
    scheme: 'tcb://',
    autofill: false,
  },
  {
    appId: 'vpb',
    shortName: 'VPBank',
    appName: 'VPBank NEO',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vpb-ios.webp',
    scheme: 'vpbankneo://',
    autofill: false,
  },
  {
    appId: 'tpb',
    shortName: 'TPBank',
    appName: 'TPBank Mobile',
    logo: 'https://cdn.vietqr.io/bank-app-icon/tpb-ios.webp',
    scheme: 'tpbankmobile://',
    autofill: false,
  },
  {
    appId: 'vba',
    shortName: 'Agribank',
    appName: 'Agribank Plus',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vba-ios.webp',
    scheme: 'agribankmobile://',
    autofill: false,
  },
  {
    appId: 'vib-2',
    shortName: 'VIB',
    appName: 'MyVIB',
    logo: 'https://cdn.vietqr.io/bank-app-icon/vib-2-ios.webp',
    scheme: 'myvib2://',
    autofill: false,
  },
  {
    appId: 'cake',
    shortName: 'CAKE',
    appName: 'CAKE Bank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/cake-ios.webp',
    scheme: 'cake.vn://',
    autofill: false,
  },
  {
    appId: 'hdb',
    shortName: 'HDBank',
    appName: 'HDBank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/hdb-ios.webp',
    scheme: 'hdbank://',
    autofill: false,
  },
  {
    appId: 'shb',
    shortName: 'SHB',
    appName: 'SHB SAHA',
    logo: 'https://cdn.vietqr.io/bank-app-icon/shb-ios.webp',
    scheme: 'shbsaha://',
    autofill: false,
  },
  {
    appId: 'lpb',
    shortName: 'LPBank',
    appName: 'LPBank',
    logo: 'https://cdn.vietqr.io/bank-app-icon/lpb-ios.webp',
    scheme: 'lv24h://',
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

const PREFERRED_BANK_STORAGE_KEY = '__tcl_preferred_bank_app_v1';

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
 * Native `<a href="...">` wrapper on Web for the 5 Auto-Fill banks (`MB Bank`, `VietinBank iPay`, `BIDV`, `ACB`, `OCB`)
 * so iOS Universal Links & Android App Links open straight into the bank's pre-filled Transfer screen.
 */
function DirectBankLink({
  deepLink,
  onPressBeforeNavigate,
  style,
  children,
}: {
  deepLink: string;
  onPressBeforeNavigate: () => void;
  style?: any;
  children: React.ReactNode;
}) {
  if (Platform.OS === 'web') {
    return React.createElement(
      'a',
      {
        href: deepLink,
        target: '_top',
        rel: 'noopener noreferrer',
        onClick: () => {
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
        Linking.openURL(deepLink).catch(() => {});
      }}
      activeOpacity={0.8}>
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

  const order = orders.find((o) => o.id === paramOrderId);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [autoVerifiedBySepay, setAutoVerifiedBySepay] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);
  const [simulatingSepay, setSimulatingSepay] = useState(false);

  // Bank Selector Modal state
  const [showBankModal, setShowBankModal] = useState(false);
  const [detectingBanks, setDetectingBanks] = useState(false);
  const [detectedBanks, setDetectedBanks] = useState<VietQRBankApp[]>(DEFAULT_BANK_APPS);
  const [selectedNonAutofillBank, setSelectedNonAutofillBank] =
    useState<VietQRBankApp | null>(null);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [qrSavedSuccess, setQrSavedSuccess] = useState(false);

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

  // Poll order status from Supabase every 2.5s
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

  // Detect & sort banking apps for the user's device when pressing "Chuyển khoản"
  const handleOpenBankSelector = async () => {
    setSelectedNonAutofillBank(null);
    setQrSavedSuccess(false);
    setShowBankModal(true);
    setDetectingBanks(true);

    // Copy transfer content immediately so user has it ready
    Clipboard.setStringAsync(transferContent).catch(() => {});

    try {
      let preferredAppId = '';
      if (typeof window !== 'undefined' && window.localStorage) {
        preferredAppId =
          window.localStorage.getItem(PREFERRED_BANK_STORAGE_KEY) || '';
      }

      // On Native iOS/Android, probe installed bank schemes via Linking.canOpenURL
      let list = [...DEFAULT_BANK_APPS];
      if (Platform.OS !== 'web') {
        const checks = await Promise.all(
          list.map(async (app) => {
            try {
              const installed = await Linking.canOpenURL(app.scheme);
              return { app, installed };
            } catch {
              return { app, installed: false };
            }
          })
        );
        const installedApps = checks.filter((c) => c.installed).map((c) => c.app);
        if (installedApps.length > 0) {
          list = installedApps;
        }
      } else {
        // On Mobile Web, fetch OS-matched VietQR app list (Android vs iOS)
        const isAndroid =
          typeof navigator !== 'undefined' &&
          /Android/i.test(navigator.userAgent);
        const endpoint = isAndroid
          ? 'https://api.vietqr.io/v2/android-app-deeplinks'
          : 'https://api.vietqr.io/v2/ios-app-deeplinks';
        try {
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data?.apps) && data.apps.length > 0) {
              const apiLogos = new Map<string, string>();
              data.apps.forEach((a: any) => {
                if (a?.appId && a?.appLogo) apiLogos.set(a.appId, a.appLogo);
              });
              list = list.map((item) => ({
                ...item,
                logo: apiLogos.get(item.appId) || item.logo,
              }));
            }
          }
        } catch {
          // keep default list
        }
      }

      // Put previously used bank on this phone at the top, followed by the 5 Auto-Fill banks
      list.sort((a, b) => {
        if (a.appId === preferredAppId) return -1;
        if (b.appId === preferredAppId) return 1;
        if (a.autofill !== b.autofill) return a.autofill ? -1 : 1;
        return 0;
      });

      setDetectedBanks(list);
    } finally {
      setTimeout(() => setDetectingBanks(false), 350);
    }
  };

  const rememberBankChoice = (appId: string) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(PREFERRED_BANK_STORAGE_KEY, appId);
      }
    } catch {
      // ignore
    }
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
    const filename = `VietQR-${order?.id || 'CUONLEN'}.png`;
    const proxyDownloadUrl = `/api/sepay-webhook?action=qr&url=${encodeURIComponent(
      sepayQrImageUrl
    )}&filename=${encodeURIComponent(filename)}`;

    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const res = await fetch(proxyDownloadUrl);
        if (!res.ok) throw new Error('Proxy fetch failed');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
      } else {
        await Linking.openURL(
          `https://tiem-cuon-len.vercel.app${proxyDownloadUrl}`
        );
      }
      setQrSavedSuccess(true);
    } catch {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const link = document.createElement('a');
        link.href = proxyDownloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      setQrSavedSuccess(true);
    } finally {
      setDownloadingQr(false);
    }
  };

  const handleManualCheckNow = async () => {
    setCheckingNow(true);
    await checkOrderPaymentStatus();
    await refetchOrders();
    setTimeout(() => setCheckingNow(false), 600);
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
              <ShieldCheck size={54} color={COLORS.success} />
            </View>
            <Text style={styles.confirmedTitle}>
              {autoVerifiedBySepay
                ? 'Thanh toán thành công!'
                : 'Đã ghi nhận đơn hàng!'}
            </Text>
            <Text style={styles.confirmedText}>
              {autoVerifiedBySepay
                ? 'Hệ thống SePay đã xác nhận chuyển khoản tự động. Tiệm Cuộn Len đang chuẩn bị đơn hàng cho bạn ngay!'
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

  // ── Minimalist Single-Card Payment Screen ──
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}>
        {/* Minimal Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/orders');
            }}
            style={styles.backBtn}
            activeOpacity={0.75}>
            <ChevronLeft size={20} color="#2C1E14" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán đơn {order.id}</Text>
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={handleManualCheckNow}
            disabled={checkingNow}
            activeOpacity={0.75}>
            {checkingNow ? (
              <ActivityIndicator size="small" color="#3D2B1F" />
            ) : (
              <RefreshCw size={15} color="#3D2B1F" />
            )}
          </TouchableOpacity>
        </View>

        {/* Single Compact Card: QR + Transfer Info + 1 Transfer Button */}
        <View style={styles.mainCard}>
          {/* Live auto-verify status pill */}
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.livePillText}>
              Tự động xác nhận sau 3–5 giây khi chuyển khoản
            </Text>
          </View>

          {/* 1. QR Code */}
          {sepayQrImageUrl ? (
            <View style={styles.qrBox}>
              <Image
                source={{ uri: sepayQrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>
          ) : null}

          {/* 2. Compact Transfer Info */}
          <View style={styles.infoBox}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ngân hàng</Text>
              <Text style={styles.infoValue}>
                {bankName} ({accountName})
              </Text>
            </View>

            <View style={styles.infoDivider} />

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => handleCopyText(accountNo, 'stk')}
              activeOpacity={0.7}>
              <Text style={styles.infoLabel}>Số tài khoản</Text>
              <View style={styles.infoValueCopy}>
                <Text style={styles.infoValueBold}>{accountNo}</Text>
                {copiedKey === 'stk' ? (
                  <CheckCheck size={14} color={COLORS.success} />
                ) : (
                  <Copy size={13} color="#5C4332" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => handleCopyText(String(orderAmount), 'amount')}
              activeOpacity={0.7}>
              <Text style={styles.infoLabel}>Số tiền</Text>
              <View style={styles.infoValueCopy}>
                <Text style={styles.infoValueAmount}>
                  {formatVND(orderAmount)}
                </Text>
                {copiedKey === 'amount' ? (
                  <CheckCheck size={14} color={COLORS.success} />
                ) : (
                  <Copy size={13} color="#5C4332" />
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.infoDivider} />

            <TouchableOpacity
              style={styles.infoRow}
              onPress={() => handleCopyText(transferContent, 'content')}
              activeOpacity={0.7}>
              <Text style={styles.infoLabel}>Nội dung CK</Text>
              <View style={styles.infoValueCopy}>
                <Text style={styles.infoValueCode}>{transferContent}</Text>
                {copiedKey === 'content' ? (
                  <CheckCheck size={14} color={COLORS.success} />
                ) : (
                  <Copy size={13} color="#3D2B1F" />
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* 3. Single Main Transfer Button */}
          <TouchableOpacity
            style={styles.singleTransferBtn}
            onPress={handleOpenBankSelector}
            activeOpacity={0.85}>
            <Smartphone size={19} color="#FAF5EE" />
            <Text style={styles.singleTransferBtnText}>Chuyển khoản ngay</Text>
          </TouchableOpacity>

          {/* Admin 1-Click Test Link (compact) */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminCompactBtn}
              onPress={handleSimulateSepayWebhook}
              disabled={simulatingSepay}
              activeOpacity={0.8}>
              {simulatingSepay ? (
                <ActivityIndicator size="small" color="#2E7D32" />
              ) : (
                <>
                  <Zap size={13} color="#2E7D32" />
                  <Text style={styles.adminCompactText}>
                    [Admin] Giả lập nhận tiền SePay
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={styles.laterLink}
          onPress={() => router.replace('/orders')}>
          <Text style={styles.laterLinkText}>Để sau, xem danh sách đơn hàng</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bank App Detector & Selector Modal */}
      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngân hàng</Text>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setShowBankModal(false)}>
                <X size={18} color="#3D2B1F" />
              </TouchableOpacity>
            </View>

            {detectingBanks ? (
              <View style={styles.detectingBox}>
                <ActivityIndicator size="large" color="#3D2B1F" />
              </View>
            ) : (
              <ScrollView
                style={styles.bankListScroll}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.bankListContent}>
                {detectedBanks.map((app) => {
                  const isDirectAutofill = DIRECT_AUTOFILL_IDS.has(app.appId);
                  const isSelectedOther =
                    selectedNonAutofillBank?.appId === app.appId;

                  if (isDirectAutofill) {
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
                      <DirectBankLink
                        key={app.appId}
                        deepLink={deepLink}
                        onPressBeforeNavigate={() => {
                          rememberBankChoice(app.appId);
                          setSelectedNonAutofillBank(null);
                          Clipboard.setStringAsync(transferContent).catch(
                            () => {}
                          );
                        }}
                        style={styles.bankOptionRow}>
                        <Image
                          source={{ uri: app.logo }}
                          style={styles.bankOptionLogo}
                          resizeMode="cover"
                        />
                        <Text style={styles.bankOptionName}>{app.appName}</Text>
                        <ArrowUpRight size={16} color="#5C4332" />
                      </DirectBankLink>
                    );
                  }

                  return (
                    <View key={app.appId} style={styles.otherBankWrapper}>
                      <TouchableOpacity
                        style={[
                          styles.bankOptionRow,
                          isSelectedOther && styles.bankOptionRowSelected,
                        ]}
                        onPress={() => {
                          rememberBankChoice(app.appId);
                          setQrSavedSuccess(false);
                          setSelectedNonAutofillBank(
                            isSelectedOther ? null : app
                          );
                        }}
                        activeOpacity={0.8}>
                        <Image
                          source={{ uri: app.logo }}
                          style={styles.bankOptionLogo}
                          resizeMode="cover"
                        />
                        <Text style={styles.bankOptionName}>{app.appName}</Text>
                        <ArrowUpRight size={16} color="#5C4332" />
                      </TouchableOpacity>

                      {isSelectedOther && (
                        <View style={styles.inlineSaveQrRow}>
                          <TouchableOpacity
                            style={[
                              styles.saveQrBtn,
                              qrSavedSuccess && styles.saveQrBtnDone,
                            ]}
                            onPress={handleDownloadQrImage}
                            disabled={downloadingQr}
                            activeOpacity={0.85}>
                            {downloadingQr ? (
                              <ActivityIndicator size="small" color="#FAF5EE" />
                            ) : qrSavedSuccess ? (
                              <>
                                <CheckCheck size={15} color="#FAF5EE" />
                                <Text style={styles.saveQrBtnText}>
                                  Đã lưu ảnh QR
                                </Text>
                              </>
                            ) : (
                              <>
                                <Download size={15} color="#FAF5EE" />
                                <Text style={styles.saveQrBtnText}>
                                  Lưu ảnh QR để chuyển khoản
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>

                          <DirectBankLink
                            deepLink={buildOfficialVietQRDeepLink(
                              app.appId,
                              accountNo,
                              bankMeta.vietqrAppId,
                              orderAmount,
                              transferContent,
                              accountName,
                              returnUrl
                            )}
                            onPressBeforeNavigate={() => {
                              rememberBankChoice(app.appId);
                            }}
                            style={styles.openOtherBankBtn}>
                            <Text style={styles.openOtherBankBtnText}>
                              Mở {app.shortName}
                            </Text>
                            <ArrowUpRight size={14} color="#3D2B1F" />
                          </DirectBankLink>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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
    maxWidth: 440,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 32,
  },

  /* Minimal Header */
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE5D8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  headerTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  checkBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFE5D8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },

  /* Single Main Card */
  mainCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#DFCBB5',
    ...SHADOWS.medium,
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#EBF7EE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFE3C8',
    marginBottom: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  livePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E5622',
  },

  /* QR Image */
  qrBox: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EFE6DC',
    marginBottom: 14,
  },
  qrImage: {
    width: 225,
    height: 274,
  },

  /* Compact Transfer Info Box */
  infoBox: {
    width: '100%',
    backgroundColor: '#FAF5EE',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: 8,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#EDE3D5',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6E533E',
  },
  infoValue: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#2C1E14',
    flexShrink: 1,
    textAlign: 'right',
  },
  infoValueCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoValueBold: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  infoValueAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#2C1E14',
  },
  infoValueCode: {
    fontSize: 13,
    fontWeight: '900',
    color: '#3D2B1F',
    backgroundColor: '#EFE5D8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  /* Single Main Transfer CTA */
  singleTransferBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#3D2B1F',
    paddingVertical: 15,
    borderRadius: 16,
    ...SHADOWS.small,
  },
  singleTransferBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },

  adminCompactBtn: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#EBF7EE',
  },
  adminCompactText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2E7D32',
  },

  laterLink: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  laterLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6E533E',
  },

  /* Bank Selector Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 18, 12, 0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FAF5EE',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '84%',
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFE5D8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  detectingBox: {
    paddingVertical: 36,
    alignItems: 'center',
  },

  otherBankWrapper: {
    gap: 8,
  },
  inlineSaveQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  saveQrBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  saveQrBtnDone: {
    backgroundColor: '#2E7D32',
  },
  saveQrBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  openOtherBankBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EFE5D8',
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9B29B',
  },
  openOtherBankBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2C1E14',
  },

  /* Bank Options List */
  bankListScroll: {
    maxHeight: 420,
  },
  bankListContent: {
    gap: 8,
    paddingBottom: 12,
  },
  bankOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5D5C3',
  },
  bankOptionRowSelected: {
    borderColor: '#3D2B1F',
    borderWidth: 1.5,
    backgroundColor: '#F5EFE6',
  },
  bankOptionLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EFE6DC',
  },
  bankOptionName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    color: '#2C1E14',
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
    maxWidth: 460,
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
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2C1E14',
  },
  confirmedText: {
    fontSize: 13.5,
    color: '#4A3525',
    textAlign: 'center',
    lineHeight: 20,
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
    fontSize: 13,
    color: '#5C4332',
    fontWeight: '700',
  },
  orderAmount: {
    fontSize: 24,
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
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  primaryBtn: {
    backgroundColor: '#3D2B1F',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  outlineBtn: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
  },
  outlineBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
});
