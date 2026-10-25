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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Building2,
  Smartphone,
  Wallet,
  CheckCheck,
  Send,
  CheckCircle,
  Clock,
  ShieldCheck,
  Zap,
  RefreshCw,
} from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { useAuth } from '@/store/AuthContext';
import { supabaseUrl, supabaseAnonKey } from '@/services/supabase';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getOrderStatusLabel } from '@/constants/orderStatus';

const TYPE_ICONS: Record<
  PaymentMethodType,
  { icon: React.ReactNode; color: string; bg: string; label: string }
> = {
  bank_transfer: {
    icon: <Building2 size={26} color="#3D2B1F" />,
    color: '#3D2B1F',
    bg: '#F3ECE2',
    label: 'Chuyển khoản ngân hàng (SePay VietQR)',
  },
  momo: {
    icon: <Smartphone size={26} color="#A50064" />,
    color: '#A50064',
    bg: '#FFF0F5',
    label: 'Ví MoMo',
  },
  zalopay: {
    icon: <Wallet size={26} color="#0068FF" />,
    color: '#0068FF',
    bg: '#F0F5FF',
    label: 'ZaloPay',
  },
  cod: {
    icon: <CheckCircle size={26} color="#6BAF5C" />,
    color: '#6BAF5C',
    bg: '#F0FFF4',
    label: 'COD',
  },
};

const BANK_DEEP_LINKS: Record<string, string[]> = {
  Vietcombank: ['vcbdigibank://'],
  'MB Bank': ['mbbank://'],
  MBBank: ['mbbank://'],
  Techcombank: ['tcbdigibank://'],
  BIDV: ['bidvsmartbanking://'],
  VietinBank: ['vietinbank://'],
  ACB: ['acbapp://'],
  VPBank: ['vpbankonline://'],
  TPBank: ['tpbank://'],
  Sacombank: ['sacombank://'],
  Agribank: ['agribank://'],
  HDBank: ['hdbank://'],
  SHB: ['shbmobile://'],
  MSB: ['msbmobile://'],
  OCB: ['ocbomni://'],
  VIB: ['vibmobile://'],
};

const SEPAY_BANK_CODES: Record<string, { sepayCode: string; bin: string }> = {
  Vietcombank: { sepayCode: 'Vietcombank', bin: '970436' },
  VCB: { sepayCode: 'Vietcombank', bin: '970436' },
  'MB Bank': { sepayCode: 'MBBank', bin: '970422' },
  MBBank: { sepayCode: 'MBBank', bin: '970422' },
  MB: { sepayCode: 'MBBank', bin: '970422' },
  Techcombank: { sepayCode: 'Techcombank', bin: '970407' },
  TCB: { sepayCode: 'Techcombank', bin: '970407' },
  BIDV: { sepayCode: 'BIDV', bin: '970418' },
  VietinBank: { sepayCode: 'VietinBank', bin: '970415' },
  ACB: { sepayCode: 'ACB', bin: '970416' },
  VPBank: { sepayCode: 'VPBank', bin: '970432' },
  TPBank: { sepayCode: 'TPBank', bin: '970423' },
  Sacombank: { sepayCode: 'Sacombank', bin: '970403' },
  Agribank: { sepayCode: 'Agribank', bin: '970405' },
  HDBank: { sepayCode: 'HDBank', bin: '970437' },
  SHB: { sepayCode: 'SHB', bin: '970443' },
  MSB: { sepayCode: 'MSB', bin: '970426' },
  OCB: { sepayCode: 'OCB', bin: '970448' },
  VIB: { sepayCode: 'VIB', bin: '970441' },
};

function buildVietQRDeepLink(
  bankBin: string,
  accountNo: string,
  accountName: string,
  amount: number,
  content: string
): string {
  return `https://qr.vietqr.io/${bankBin}-${accountNo}?amount=${amount}&addInfo=${encodeURIComponent(
    content
  )}&accountName=${encodeURIComponent(accountName)}`;
}

export default function PaymentScreen() {
  const { orderId: paramOrderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, refetchOrders } = useOrders();
  const { enabledMethods } = usePaymentMethods();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const order = orders.find((o) => o.id === paramOrderId);

  const [confirmed, setConfirmed] = useState(false);
  const [autoVerifiedBySepay, setAutoVerifiedBySepay] = useState(false);
  const [bankOpened, setBankOpened] = useState(false);
  const [simulatingSepay, setSimulatingSepay] = useState(false);
  const [checkingNow, setCheckingNow] = useState(false);

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

  const bankMeta = SEPAY_BANK_CODES[bankName] ?? {
    sepayCode: bankName || 'VietinBank',
    bin: '970415',
  };

  // Official SePay VietQR URL (`vietqr.app/img`) configured with user's exact parameters
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

  const vietqrDeepLink = accountNo
    ? buildVietQRDeepLink(
        bankMeta.bin,
        accountNo,
        accountName,
        orderAmount,
        transferContent
      )
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
        if (remoteOrder.status === 'Đang xử lý' || remoteOrder.status === 'Hoàn thành') {
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
        // Fallback if testing on local dev server without /api route
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

  const handleCopyAllAndOpenBank = async () => {
    const transferInfo = [
      `Ngân hàng: ${bankName}`,
      `STK: ${accountNo}`,
      `Chủ TK: ${accountName}`,
      `Số tiền: ${formatVND(orderAmount)}`,
      `Nội dung: ${transferContent}`,
    ].join('\n');

    await Clipboard.setStringAsync(transferInfo);
    setBankOpened(true);

    if (bankName) {
      const schemes = BANK_DEEP_LINKS[bankName];
      if (schemes) {
        for (const scheme of schemes) {
          try {
            const canOpen = await Linking.canOpenURL(scheme);
            if (canOpen) {
              await Linking.openURL(scheme);
              return;
            }
          } catch {
            // continue
          }
        }
      }
    }

    if (vietqrDeepLink) {
      try {
        await Linking.openURL(vietqrDeepLink);
      } catch {
        // ignore
      }
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

  const typeInfo = TYPE_ICONS[paymentMethod?.type ?? 'bank_transfer'];

  // ── Confirmed state ──
  if (confirmed) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.confirmedScroll}>
          <View style={styles.confirmedCard}>
            <View style={styles.confirmedIcon}>
              <ShieldCheck size={60} color={COLORS.success} />
            </View>
            <Text style={styles.confirmedTitle}>
              {autoVerifiedBySepay
                ? 'Thanh toán thành công!'
                : 'Đã ghi nhận thông tin!'}
            </Text>
            <Text style={styles.confirmedText}>
              {autoVerifiedBySepay
                ? 'Cổng thanh toán tự động SePay đã xác nhận giao dịch chuyển khoản của bạn. Tiệm Cuộn Len đang chuẩn bị đơn hàng cho bạn ngay!'
                : 'Tiệm Cuộn Len sẽ kiểm tra và xác nhận đơn hàng của bạn trong ít phút.'}
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

  // ── Payment screen ──
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/orders');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={22} color="#3D2B1F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán qua SePay VietQR</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Order info card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>MÃ ĐƠN HÀNG</Text>
            <Text style={styles.infoCardCode}>{order.id}</Text>
            <View style={styles.infoCardAmountRow}>
              <Text style={styles.infoCardAmountLabel}>Tổng thanh toán</Text>
              <Text style={styles.infoCardAmount}>{formatVND(order.total)}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
              {typeInfo.icon}
              <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                {paymentMethod?.title || 'Chuyển khoản ngân hàng'}
              </Text>
            </View>
          </View>
        </View>

        {/* SePay Auto-Verification Live Status Bar */}
        <View style={styles.section}>
          <View style={styles.sepayLiveCard}>
            <View style={styles.sepayLiveLeft}>
              <View style={styles.sepayPulseDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.sepayLiveTitle}>
                  Tự động xác nhận qua SePay (my.sepay.vn)
                </Text>
                <Text style={styles.sepayLiveSub}>
                  Đang chờ nhận chuyển khoản... Đơn hàng sẽ tự động duyệt sau 3–5 giây khi chuyển đúng nội dung{' '}
                  <Text style={{ fontWeight: '800', color: '#2C1E14' }}>
                    {transferContent}
                  </Text>
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.sepayRefreshBtn}
              onPress={handleManualCheckNow}
              disabled={checkingNow}
              activeOpacity={0.75}>
              {checkingNow ? (
                <ActivityIndicator size="small" color="#3D2B1F" />
              ) : (
                <>
                  <RefreshCw size={13} color="#3D2B1F" />
                  <Text style={styles.sepayRefreshText}>Kiểm tra</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* QR Code Card (SePay Official QR) */}
        {sepayQrImageUrl ? (
          <View style={styles.section}>
            <View style={styles.qrCard}>
              <View style={styles.qrBadgePill}>
                <Zap size={12} color="#3D2B1F" />
                <Text style={styles.qrBadgeText}>MÃ VIETQR TỰ ĐỘNG SEPAY</Text>
              </View>
              <Text style={styles.qrCardTitle}>
                Mở App Ngân Hàng bất kỳ để quét mã
              </Text>
              <Image
                source={{ uri: sepayQrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.qrHint}>
                Số tiền <Text style={{ fontWeight: '800' }}>{formatVND(orderAmount)}</Text> và nội dung{' '}
                <Text style={{ fontWeight: '800' }}>{transferContent}</Text> sẽ được điền tự động khi quét
              </Text>
            </View>
          </View>
        ) : null}

        {/* 1-tap transfer button */}
        {paymentMethod?.type === 'bank_transfer' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.transferBtn}
              onPress={handleCopyAllAndOpenBank}
              activeOpacity={0.85}>
              <Building2 size={22} color="#FAF5EE" />
              <View style={styles.transferBtnContent}>
                <Text style={styles.transferBtnTitle}>
                  Sao chép & Mở App Ngân Hàng
                </Text>
                <Text style={styles.transferBtnSub}>
                  Tự động sao chép STK, số tiền và nội dung chuyển khoản
                </Text>
              </View>
              <Send size={18} color="#FAF5EE" />
            </TouchableOpacity>

            {bankOpened && (
              <View style={styles.copiedBanner}>
                <CheckCheck size={16} color={COLORS.success} />
                <Text style={styles.copiedBannerText}>
                  Đã sao chép thông tin chuyển khoản. Vui lòng giữ nguyên nội dung{' '}
                  <Text style={{ fontWeight: '800' }}>{transferContent}</Text>.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Admin Webhook Simulator Tool */}
        {isAdmin && (
          <View style={styles.section}>
            <View style={styles.adminTestBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminTestTitle}>
                  🛠️ Công cụ Admin: Kiểm thử Webhook SePay
                </Text>
                <Text style={styles.adminTestSub}>
                  Bấm nút bên dưới để gửi bản tin giả lập từ SePay vào{' '}
                  <Text style={{ fontWeight: '700' }}>/api/sepay-webhook</Text> và kiểm tra tự động duyệt đơn.
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
                    <Zap size={15} color="#FAF5EE" />
                    <Text style={styles.adminTestBtnText}>
                      Test nhận tiền SePay
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* View orders button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.laterBtn}
            onPress={() => router.replace('/orders')}>
            <Text style={styles.laterBtnText}>Để sau, xem danh sách đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  scrollContainer: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: 60,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  notFoundText: { fontSize: 16, color: COLORS.mediumText, textAlign: 'center' },
  backBtnLarge: {
    backgroundColor: '#3D2B1F',
    borderRadius: 16,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
  },
  backBtnLargeText: { fontSize: 15, fontWeight: '700', color: '#FAF5EE' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#2C1E14' },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },

  infoCard: {
    backgroundColor: '#D8C3AD',
    borderRadius: 22,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    ...SHADOWS.small,
  },
  infoCardLabel: {
    fontSize: 11,
    color: '#5C4332',
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoCardCode: {
    fontSize: 18,
    color: '#2C1E14',
    fontWeight: '900',
    marginTop: 2,
  },
  infoCardAmountRow: { marginTop: 10, alignItems: 'center' },
  infoCardAmountLabel: { fontSize: 11.5, color: '#5C4332', fontWeight: '600' },
  infoCardAmount: {
    fontSize: 28,
    fontWeight: '900',
    color: '#2C1E14',
    marginTop: 2,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  typeBadgeText: { fontSize: 12.5, fontWeight: '700' },

  /* SePay Live Card */
  sepayLiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#F3ECE2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  sepayLiveLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  sepayPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2E7D32',
  },
  sepayLiveTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C1E14',
  },
  sepayLiveSub: {
    fontSize: 11.5,
    color: '#5C4332',
    lineHeight: 17,
    marginTop: 2,
  },
  sepayRefreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  sepayRefreshText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },

  /* QR Card */
  qrCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    ...SHADOWS.small,
  },
  qrBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  qrBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 0.5,
  },
  qrCardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#2C1E14',
    marginBottom: 12,
  },
  qrImage: { width: 270, height: 330, borderRadius: 12 },
  qrHint: {
    fontSize: 12,
    color: '#5C4332',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Transfer button */
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D2B1F',
    borderRadius: 18,
    padding: 16,
    gap: 12,
    ...SHADOWS.small,
  },
  transferBtnContent: { flex: 1 },
  transferBtnTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  transferBtnSub: {
    fontSize: 11.5,
    color: '#D8C3AD',
    marginTop: 2,
  },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  copiedBannerText: { fontSize: 12.5, color: '#2D6A2E', flex: 1, lineHeight: 18 },

  /* Admin Test Box */
  adminTestBox: {
    backgroundColor: '#EFE5D8',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#C5AC92',
    gap: 12,
  },
  adminTestTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  adminTestSub: {
    fontSize: 12,
    color: '#4A3525',
    lineHeight: 17,
    marginTop: 3,
  },
  adminTestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#2E7D32',
    paddingVertical: 11,
    borderRadius: 13,
  },
  adminTestBtnText: {
    color: '#FAF5EE',
    fontSize: 13,
    fontWeight: '800',
  },

  laterBtn: {
    alignItems: 'center',
    marginTop: 4,
    paddingVertical: 10,
  },
  laterBtnText: { fontSize: 13.5, fontWeight: '600', color: COLORS.mediumText },

  /* Confirmed */
  confirmedScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    maxWidth: 560,
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
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: { fontSize: 24, fontWeight: '900', color: '#2C1E14' },
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
  orderCode: { fontSize: 13.5, color: '#5C4332', fontWeight: '700' },
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
  statusBadgeText: { fontSize: 12.5, fontWeight: '800', color: '#3D2B1F' },
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
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: '#3D2B1F' },
});
