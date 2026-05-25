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
  ExternalLink,
  Download,
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

const TYPE_ICONS: Record<PaymentMethodType, { icon: React.ReactNode; color: string; bg: string }> = {
  bank_transfer: {
    icon: <Building2 size={28} color="#765341" />,
    color: '#765341',
    bg: '#F5EDE8',
  },
  momo: {
    icon: <Smartphone size={28} color="#A50064" />,
    color: '#A50064',
    bg: '#FFF0F5',
  },
  zalopay: {
    icon: <Wallet size={28} color="#0068FF" />,
    color: '#0068FF',
    bg: '#F0F5FF',
  },
  cod: {
    icon: <CheckCircle size={28} color="#6BAF5C" />,
    color: '#6BAF5C',
    bg: '#F0FFF4',
  },
  };

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

  const paymentMethod: PaymentMethod | undefined = enabledMethods.find(
    (m) => m.title === order?.paymentMethod,
  ) ?? enabledMethods[0];

  const orderShortId = order?.id?.replace('CUONLEN-', '') ?? '';
  const transferPrefix = paymentMethod?.transfer_prefix ?? 'CUONLEN';
  const transferContent = `${transferPrefix}-${orderShortId}`;

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenBankApp = async () => {
    if (!paymentMethod) return;
    // Try VietQR deep link first, then QR image, then fallback
    const urls: string[] = [];
    if (paymentMethod.qr_image) urls.push(paymentMethod.qr_image);
    // Generic banking deep link patterns
    urls.push('vietqr://');
    urls.push('vcbdigibank://'); // Vietcombank
    urls.push('https://www.vietcombank.com.vn');

    for (const url of urls) {
      try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // continue to next
      }
    }

    Alert.alert(
      'Không mở được app',
      'Vui lòng mở app ngân hàng và quét mã QR để thanh toán.',
    );
  };

  const handleConfirmTransfer = async () => {
    if (!order) return;
    setShowConfirmModal(false);
    setConfirming(true);

    updateOrderStatus(order.id, 'awaiting_confirmation');

    // Small delay for UX
    setTimeout(() => {
      setConfirming(false);
      setConfirmed(true);
    }, 800);
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
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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

        {/* Order Code Card */}
        <View style={styles.section}>
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>Mã đơn hàng</Text>
            <Text style={styles.codeValue}>{order.id}</Text>
          </View>
        </View>

        {/* Amount Card */}
        <View style={styles.section}>
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Số tiền cần thanh toán</Text>
            <Text style={styles.amountValue}>{formatVND(order.total)}</Text>
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.bg }]}>
              {typeInfo.icon}
              <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
                {paymentMethod?.title}
              </Text>
            </View>
          </View>
        </View>

        {/* QR Card */}
        <View style={styles.section}>
          <View style={styles.qrCard}>
            {paymentMethod?.qr_image ? (
              <Image
                source={{ uri: paymentMethod.qr_image }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.qrPlaceholder}>
                {typeInfo.icon}
                <Text style={[styles.qrPlaceholderText, { color: typeInfo.color }]}>
                  QR thanh toán
                </Text>
                <Text style={styles.qrSubtext}>Quét mã để thanh toán</Text>
              </View>
            )}
          </View>
        </View>

        {/* Bank Info Card (for bank_transfer) */}
        {paymentMethod?.type === 'bank_transfer' && (
          <View style={styles.section}>
            <View style={styles.bankCard}>
              <Text style={styles.bankCardTitle}>Thông tin tài khoản</Text>

              {paymentMethod.bank_name && (
                <InfoRow label="Ngân hàng" value={paymentMethod.bank_name} />
              )}
              {paymentMethod.account_name && (
                <InfoRow label="Chủ tài khoản" value={paymentMethod.account_name} />
              )}
              {paymentMethod.account_number && (
                <InfoRow
                  label="Số tài khoản"
                  value={paymentMethod.account_number}
                  copyable
                  copied={copiedField === 'account'}
                  onCopy={() => handleCopy(paymentMethod.account_number!, 'account')}
                />
              )}
              <InfoRow
                label="Nội dung CK"
                value={transferContent}
                copyable
                copied={copiedField === 'content'}
                onCopy={() => handleCopy(transferContent, 'content')}
                highlight
              />
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.section}>
          <View style={styles.actionGrid}>
            {/* Bank app button */}
            {paymentMethod?.type === 'bank_transfer' && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleOpenBankApp}>
                <ExternalLink size={20} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>Mở app{'\n'}ngân hàng</Text>
              </TouchableOpacity>
            )}

            {/* Copy account number */}
            {paymentMethod?.account_number && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleCopy(paymentMethod.account_number!, 'account')}>
                {copiedField === 'account' ? (
                  <CheckCheck size={20} color={COLORS.success} />
                ) : (
                  <Copy size={20} color={COLORS.primary} />
                )}
                <Text style={styles.actionBtnText}>Sao chép{'\n'}STK</Text>
              </TouchableOpacity>
            )}

            {/* Copy transfer content */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleCopy(transferContent, 'content')}>
              {copiedField === 'content' ? (
                <CheckCheck size={20} color={COLORS.success} />
              ) : (
                <Copy size={20} color={COLORS.primary} />
              )}
              <Text style={styles.actionBtnText}>Sao chép{'\n'}nội dung CK</Text>
            </TouchableOpacity>

            {/* Download QR */}
            {paymentMethod?.qr_image && (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => Linking.openURL(paymentMethod.qr_image!)}>
                <Download size={20} color={COLORS.primary} />
                <Text style={styles.actionBtnText}>Tải mã{'\n'}QR</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          <View style={styles.noteBox}>
            <Text style={styles.noteTitle}>Hướng dẫn thanh toán</Text>
            {paymentMethod?.type === 'bank_transfer' ? (
              <Text style={styles.noteText}>
                1. Mở app ngân hàng hoặc quét mã QR{'\n'}
                2. Nhập số tài khoản và số tiền chính xác{'\n'}
                3. Nhập đúng nội dung chuyển khoản{'\n'}
                4. Xác nhận và hoàn tất chuyển khoản{'\n'}
                5. Quay lại đây và nhấn "Tôi đã chuyển khoản"
              </Text>
            ) : (
              <Text style={styles.noteText}>
                1. Mở app {paymentMethod?.title}{'\n'}
                2. Quét mã QR bên trên{'\n'}
                3. Xác nhận số tiền và thanh toán{'\n'}
                4. Quay lại đây và nhấn "Tôi đã chuyển khoản"
              </Text>
            )}
          </View>
        </View>

        {/* Confirm Transfer Button */}
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

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Send size={40} color={COLORS.primary} />
            <Text style={styles.modalTitle}>Xác nhận thanh toán</Text>
            <Text style={styles.modalText}>
              Bạn đã chuyển khoản đúng số tiền{'\n'}
              <Text style={styles.modalAmount}>{formatVND(order.total)}</Text>
              {'\n'}và nội dung{'\n'}
              <Text style={styles.modalContent}>{transferContent}</Text>
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

// ── Sub-components ──

function InfoRow({
  label,
  value,
  copyable,
  copied,
  onCopy,
  highlight,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  copied?: boolean;
  onCopy?: () => void;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text
          style={[styles.infoValue, highlight && styles.infoValueHighlight]}
          selectable>
          {value}
        </Text>
        {copyable && onCopy && (
          <TouchableOpacity onPress={onCopy} style={styles.copyBtn}>
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

// ── Styles ──

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
  backBtnLargeText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Header
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

  // Code card
  codeCard: {
    backgroundColor: COLORS.warmBrown,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  codeLabel: { fontSize: 12, color: COLORS.soft, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  codeValue: { fontSize: 22, color: COLORS.white, fontWeight: '800', marginTop: SPACING.xs },

  // Amount card
  amountCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.xl,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  amountLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  amountValue: { fontSize: 36, fontWeight: '900', color: COLORS.primary, marginTop: SPACING.xs, fontStyle: 'italic' },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    marginTop: SPACING.md,
  },
  typeBadgeText: { fontSize: 14, fontWeight: '700' },

  // QR card
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.xxl,
    alignItems: 'center',
    ...SHADOWS.medium,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 16,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 16,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  qrPlaceholderText: { fontSize: 16, fontWeight: '700' },
  qrSubtext: { fontSize: 12, color: COLORS.mediumText, textAlign: 'center' },

  // Bank card
  bankCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
    gap: SPACING.xs,
  },
  bankCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  infoLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  infoValue: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  infoValueHighlight: {
    color: COLORS.primary,
    fontSize: 15,
    backgroundColor: COLORS.softBeige,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  copyBtn: { padding: 4 },

  // Action grid
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    gap: SPACING.xs,
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.darkText,
    textAlign: 'center',
  },

  // Note box
  noteBox: {
    backgroundColor: COLORS.lightPurple,
    borderRadius: 14,
    padding: SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  noteTitle: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: SPACING.sm },
  noteText: { fontSize: 13, color: COLORS.mediumText, lineHeight: 22 },

  // Confirm button
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.success,
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
  modalText: {
    fontSize: 15,
    color: COLORS.mediumText,
    textAlign: 'center',
    lineHeight: 24,
  },
  modalAmount: { fontWeight: '800', color: COLORS.primary, fontSize: 18 },
  modalContent: { fontWeight: '700', color: COLORS.primary, backgroundColor: COLORS.softBeige, paddingHorizontal: 8, borderRadius: 4 },
  modalConfirmBtn: {
    backgroundColor: COLORS.success,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: SPACING.xxl,
    width: '100%',
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  modalConfirmBtnText: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  modalCancelBtn: {
    paddingVertical: SPACING.sm,
    width: '100%',
    alignItems: 'center',
  },
  modalCancelBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.mediumText },

  // Confirmed state
  confirmedScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
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
