import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
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
  Building2,
  Smartphone,
  Wallet,
  Copy,
  CheckCheck,
  Send,
  CheckCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getOrderStatusLabel } from '@/constants/orderStatus';

const TYPE_ICONS: Record<PaymentMethodType, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  bank_transfer: {
    icon: <Building2 size={28} color="#765341" />,
    color: '#765341',
    bg: '#F5EDE8',
    label: 'Chuyển khoản ngân hàng',
  },
  momo: {
    icon: <Smartphone size={28} color="#A50064" />,
    color: '#A50064',
    bg: '#FFF0F5',
    label: 'Ví MoMo',
  },
  zalopay: {
    icon: <Wallet size={28} color="#0068FF" />,
    color: '#0068FF',
    bg: '#F0F5FF',
    label: 'ZaloPay',
  },
  cod: {
    icon: <CheckCircle size={28} color="#6BAF5C" />,
    color: '#6BAF5C',
    bg: '#F0FFF4',
    label: 'COD',
  },
};

// Known bank deep links for common Vietnamese banking apps
const BANK_DEEP_LINKS: Record<string, string[]> = {
  'Vietcombank': ['vcbdigibank://'],
  'MB Bank': ['mbbank://'],
  'Techcombank': ['tcbdigibank://'],
  'BIDV': ['bidvsmartbanking://'],
  'VietinBank': ['vietinbank://'],
  'ACB': ['acbapp://'],
  'VPBank': ['vpbankonline://'],
  'TPBank': ['tpbank://'],
  'Sacombank': ['sacombank://'],
  'Agribank': ['agribank://'],
  'HDBank': ['hdbank://'],
  'SHB': ['shbmobile://'],
  'MSB': ['msbmobile://'],
  'OCB': ['ocbomni://'],
  'VIB': ['vibmobile://'],
};

function buildVietQRDeepLink(bankBin: string, accountNo: string, accountName: string, amount: number, content: string): string {
  // VietQR universal deep link - opens banking app with pre-filled transfer info
  // Falls back to VietQR web page if no bank app installed
  return `https://qr.vietqr.io/${bankBin}-${accountNo}?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
}

export default function PaymentScreen() {
  const { orderId: paramOrderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus } = useOrders();
  const { enabledMethods } = usePaymentMethods();

  const order = orders.find((o) => o.id === paramOrderId);

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [bankOpened, setBankOpened] = useState(false);

  const paymentMethod: PaymentMethod | undefined = enabledMethods.find(
    (m) => m.title === order?.paymentMethod,
  ) ?? enabledMethods[0];

  const orderShortId = order?.id?.replace('CUONLEN-', '') ?? '';
  const transferPrefix = paymentMethod?.transfer_prefix ?? 'CUONLEN';
  const transferContent = `${transferPrefix}-${orderShortId}`;

  const accountNo = paymentMethod?.account_number ?? '';
  const accountName = paymentMethod?.account_name ?? '';
  const orderAmount = order?.total ?? 0;

  // Simple bank bin lookup - use known bank BINs
  let bankBin = '970436'; // default VCB
  if (paymentMethod?.bank_name) {
    const bankBins: Record<string, string> = {
      'Vietcombank': '970436', 'MB Bank': '970422', 'Techcombank': '970407',
      'BIDV': '970418', 'VietinBank': '970415', 'ACB': '970416',
      'VPBank': '970432', 'TPBank': '970423', 'Sacombank': '970403',
      'Agribank': '970405', 'HDBank': '970437', 'SHB': '970443',
      'MSB': '970426', 'OCB': '970448', 'VIB': '970441',
    };
    bankBin = bankBins[paymentMethod.bank_name] ?? bankBin;
  }

  const vietqrImageUrl = accountNo
    ? `https://img.vietqr.io/image/${bankBin}-${accountNo}-compact.png?accountName=${encodeURIComponent(accountName)}&amount=${orderAmount}&addInfo=${encodeURIComponent(transferContent)}`
    : '';

  const vietqrDeepLink = accountNo
    ? buildVietQRDeepLink(bankBin, accountNo, accountName, orderAmount, transferContent)
    : '';

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCopyAllAndOpenBank = async () => {
    // Copy all transfer info at once
    const transferInfo = [
      `Ngân hàng: ${paymentMethod?.bank_name ?? ''}`,
      `STK: ${accountNo}`,
      `Chủ TK: ${accountName}`,
      `Số tiền: ${formatVND(orderAmount)}`,
      `Nội dung: ${transferContent}`,
    ].join('\n');

    await Clipboard.setStringAsync(transferInfo);
    setBankOpened(true);

    // Try opening bank app via deep link first
    if (paymentMethod?.bank_name) {
      const schemes = BANK_DEEP_LINKS[paymentMethod.bank_name];
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

    // Fallback: try to open VietQR universal link
    if (vietqrDeepLink) {
      try {
        await Linking.openURL(vietqrDeepLink);
      } catch {
        // nothing we can do, info is already copied
      }
    }
  };

  const handleConfirmTransfer = async () => {
    if (!order) return;
    setShowConfirmModal(false);
    setConfirming(true);

    updateOrderStatus(order.id, 'awaiting_confirmation');

    setTimeout(() => {
      setConfirming(false);
      setConfirmed(true);
    }, 600);
  };

  useEffect(() => {
    if (order && order.status === 'awaiting_confirmation') {
      setConfirmed(true);
    }
  }, [order]);

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
              <ShieldCheck size={64} color={COLORS.success} />
            </View>
            <Text style={styles.confirmedTitle}>Cảm ơn bạn!</Text>
            <Text style={styles.confirmedText}>
              Tiệm Cuộn Len sẽ kiểm tra và xác nhận đơn hàng sớm.
            </Text>

            <View style={styles.orderSummary}>
              <Text style={styles.orderCode}>Mã đơn: {order.id}</Text>
              <Text style={styles.orderAmount}>
                {formatVND(order.total)}
              </Text>
              <View style={styles.statusBadge}>
                <Clock size={14} color={COLORS.primary} />
                <Text style={styles.statusBadgeText}>
                  {getOrderStatusLabel('awaiting_confirmation')}
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
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/orders');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thanh toán đơn hàng</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Order info card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Text style={styles.infoCardLabel}>Mã đơn</Text>
            <Text style={styles.infoCardCode}>{order.id}</Text>
            <View style={styles.infoCardAmountRow}>
              <Text style={styles.infoCardAmountLabel}>Số tiền</Text>
              <Text style={styles.infoCardAmount}>{formatVND(order.total)}</Text>
            </View>
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
              {typeInfo.icon}
              <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                {paymentMethod?.title}
              </Text>
            </View>
          </View>
        </View>

        {/* 1-tap transfer button */}
        {paymentMethod?.type === 'bank_transfer' && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.transferBtn}
              onPress={handleCopyAllAndOpenBank}
              activeOpacity={0.85}>
              <Building2 size={24} color={COLORS.white} />
              <View style={styles.transferBtnContent}>
                <Text style={styles.transferBtnTitle}>Chuyển khoản ngay</Text>
                <Text style={styles.transferBtnSub}>
                  Mở app ngân hàng • Thông tin đã được sao chép
                </Text>
              </View>
              <Send size={20} color={COLORS.white} />
            </TouchableOpacity>

            {bankOpened && (
              <View style={styles.copiedBanner}>
                <CheckCheck size={16} color={COLORS.success} />
                <Text style={styles.copiedBannerText}>
                  Đã sao chép toàn bộ thông tin. Dán vào app ngân hàng để chuyển khoản.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* MoMo / ZaloPay */}
        {(paymentMethod?.type === 'momo' || paymentMethod?.type === 'zalopay') && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.transferBtn}
              onPress={handleCopyAllAndOpenBank}
              activeOpacity={0.85}>
              {typeInfo.icon}
              <View style={styles.transferBtnContent}>
                <Text style={styles.transferBtnTitle}>Mở {typeInfo.label}</Text>
                <Text style={styles.transferBtnSub}>
                  Số tiền và nội dung đã được sao chép
                </Text>
              </View>
              <Send size={20} color={COLORS.white} />
            </TouchableOpacity>

            {bankOpened && (
              <View style={styles.copiedBanner}>
                <CheckCheck size={16} color={COLORS.success} />
                <Text style={styles.copiedBannerText}>
                  Đã sao chép. Mở app {typeInfo.label} và dán thông tin để thanh toán.
                </Text>
              </View>
            )}
          </View>
        )}

        {/* QR Code */}
        {vietqrImageUrl ? (
          <View style={styles.section}>
            <View style={styles.qrCard}>
              <Text style={styles.qrCardTitle}>Quét mã để thanh toán</Text>
              <Image
                source={{ uri: vietqrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              {paymentMethod?.type === 'bank_transfer' && (
                <Text style={styles.qrHint}>Hoặc mở app ngân hàng và quét mã này</Text>
              )}
            </View>
          </View>
        ) : null}

        {/* Transfer details */}
        <View style={styles.section}>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardTitle}>Thông tin chuyển khoản</Text>

            {paymentMethod?.bank_name ? (
              <DetailRow label="Ngân hàng" value={paymentMethod.bank_name} />
            ) : null}
            {accountName ? (
              <DetailRow label="Chủ tài khoản" value={accountName} />
            ) : null}
            {accountNo ? (
              <DetailRow
                label="Số tài khoản"
                value={accountNo}
                copyable
                copied={copiedField === 'account'}
                onCopy={() => handleCopy(accountNo, 'account')}
              />
            ) : null}
            <DetailRow
              label="Số tiền"
              value={formatVND(orderAmount)}
              highlight
            />
            <DetailRow
              label="Nội dung CK"
              value={transferContent}
              copyable
              copied={copiedField === 'content'}
              onCopy={() => handleCopy(transferContent, 'content')}
              highlight
              mono
            />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>📋 Hướng dẫn</Text>
            <Text style={styles.noteText}>
              1. Bấm <Text style={styles.noteBold}>"Chuyển khoản ngay"</Text> → thông tin tự động sao chép{'\n'}
              2. Mở app ngân hàng, dán thông tin hoặc quét mã QR{'\n'}
              3. Kiểm tra <Text style={styles.noteBold}>số tiền</Text> và <Text style={styles.noteBold}>nội dung CK</Text> chính xác{'\n'}
              4. Xác nhận chuyển khoản{'\n'}
              5. Quay lại đây → bấm <Text style={styles.noteBold}>"Tôi đã chuyển khoản"</Text>
            </Text>
          </View>
        </View>

        {/* Confirm button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.confirmBtn, confirming && styles.confirmBtnDisabled]}
            onPress={() => setShowConfirmModal(true)}
            disabled={confirming}
            activeOpacity={0.8}>
            {confirming ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Send size={20} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Tôi đã chuyển khoản</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.laterBtn}
            onPress={() => router.replace('/orders')}>
            <Text style={styles.laterBtnText}>Để sau, xem đơn hàng</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Send size={40} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Xác nhận thanh toán</Text>
            <Text style={styles.modalText}>
              Bạn đã chuyển khoản đúng số tiền{' '}
              <Text style={styles.modalHighlight}>{formatVND(orderAmount)}</Text>
              {'\n'}với nội dung{' '}
              <Text style={styles.modalHighlight}>{transferContent}</Text>
              {'\n'}chưa?
            </Text>

            <TouchableOpacity
              style={styles.modalConfirmBtn}
              onPress={handleConfirmTransfer}>
              <Text style={styles.modalConfirmBtnText}>
                Đúng, tôi đã chuyển khoản
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowConfirmModal(false)}>
              <Text style={styles.modalCancelBtnText}>Chưa, để sau</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
  copyable,
  copied,
  onCopy,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copied?: boolean;
  onCopy?: () => void;
  highlight?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        <Text
          style={[
            styles.detailValue,
            highlight && styles.detailValueHighlight,
            mono && styles.detailValueMono,
          ]}
          selectable>
          {value}
        </Text>
        {copyable && onCopy && (
          <TouchableOpacity onPress={onCopy} style={styles.copyBtn} hitSlop={8}>
            {copied ? (
              <CheckCheck size={16} color={COLORS.success} />
            ) : (
              <Copy size={16} color={COLORS.primary} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xxl,
  },
  notFoundText: { fontSize: 16, color: COLORS.mediumText, textAlign: 'center' },
  backBtnLarge: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: 14,
  },
  backBtnLargeText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

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
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.md },

  // Info card
  infoCard: {
    backgroundColor: COLORS.warmBrown,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  infoCardLabel: { fontSize: 11, color: COLORS.soft, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  infoCardCode: { fontSize: 20, color: COLORS.white, fontWeight: '800', marginTop: 2 },
  infoCardAmountRow: { marginTop: SPACING.md, alignItems: 'center' },
  infoCardAmountLabel: { fontSize: 11, color: COLORS.soft, fontWeight: '600' },
  infoCardAmount: { fontSize: 32, fontWeight: '900', color: COLORS.white, fontStyle: 'italic' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xs,
    borderRadius: 20,
    marginTop: SPACING.md,
  },
  typeBadgeText: { fontSize: 13, fontWeight: '700' },

  // Transfer button
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.success,
    borderRadius: 20,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.medium,
  },
  transferBtnContent: { flex: 1 },
  transferBtnTitle: { fontSize: 18, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  transferBtnSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  copiedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  copiedBannerText: { fontSize: 13, color: '#2D6A2E', flex: 1, lineHeight: 18 },

  // QR
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  qrCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: SPACING.md },
  qrImage: { width: 200, height: 200, borderRadius: 12 },
  qrHint: { fontSize: 12, color: COLORS.lightText, marginTop: SPACING.md, textAlign: 'center' },

  // Detail card
  detailCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  detailCardTitle: { fontSize: 16, fontWeight: '800', color: COLORS.darkText, marginBottom: SPACING.md },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  detailLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  detailValueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, flexShrink: 1 },
  detailValue: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  detailValueHighlight: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  detailValueMono: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    backgroundColor: COLORS.softBeige,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  copyBtn: { padding: 4 },

  // Note
  noteBox: {
    backgroundColor: COLORS.lightPurple,
    borderRadius: 14,
    padding: SPACING.lg,
  },
  noteTitle: { fontSize: 15, fontWeight: '700', color: COLORS.darkText, marginBottom: SPACING.sm },
  noteText: { fontSize: 13, color: COLORS.mediumText, lineHeight: 22 },
  noteBold: { fontWeight: '700', color: COLORS.primary },

  // Confirm
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 18,
    ...SHADOWS.medium,
  },
  confirmBtnDisabled: { opacity: 0.7 },
  confirmBtnText: { fontSize: 18, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  laterBtn: {
    alignItems: 'center',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  laterBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.mediumText },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
    ...SHADOWS.large,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText },
  modalText: { fontSize: 15, color: COLORS.mediumText, textAlign: 'center', lineHeight: 24 },
  modalHighlight: { fontWeight: '800', color: COLORS.primary },
  modalConfirmBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xxl,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalConfirmBtnText: { fontSize: 16, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  modalCancelBtn: { paddingVertical: SPACING.sm, width: '100%', alignItems: 'center' },
  modalCancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.mediumText },

  // Confirmed
  confirmedScroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  confirmedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.lg,
    ...SHADOWS.large,
  },
  confirmedIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FFF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmedTitle: { fontSize: 28, fontWeight: '900', color: COLORS.darkText },
  confirmedText: { fontSize: 15, color: COLORS.mediumText, textAlign: 'center', lineHeight: 22 },
  orderSummary: {
    backgroundColor: COLORS.cream,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  orderCode: { fontSize: 14, color: COLORS.mediumText, fontWeight: '600' },
  orderAmount: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: COLORS.primary },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.softBeige,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  statusBadgeText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  outlineBtn: {
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: SPACING.xxxl,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  outlineBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.mediumText },
});
