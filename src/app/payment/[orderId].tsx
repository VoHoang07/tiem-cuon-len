import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
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
  Search,
  X,
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

  interface BankInfo {
  name: string;
  shortName: string;
  bin: string;
  schemes: string[]; // deep link URL schemes to try
  }

  const BANK_LIST: BankInfo[] = [
  { name: 'Vietcombank', shortName: 'VCB', bin: '970436', schemes: ['vcbdigibank://', 'https://www.vietcombank.com.vn'] },
  { name: 'MB Bank', shortName: 'MB', bin: '970422', schemes: ['mbbank://', 'https://www.mbbank.com.vn'] },
  { name: 'Techcombank', shortName: 'TCB', bin: '970407', schemes: ['tcbdigibank://', 'https://www.techcombank.com.vn'] },
  { name: 'BIDV', shortName: 'BIDV', bin: '970418', schemes: ['bidvsmartbanking://', 'https://www.bidv.com.vn'] },
  { name: 'VietinBank', shortName: 'CTG', bin: '970415', schemes: ['vietinbank://', 'https://www.vietinbank.vn'] },
  { name: 'ACB', shortName: 'ACB', bin: '970416', schemes: ['acbapp://', 'https://www.acb.com.vn'] },
  { name: 'VPBank', shortName: 'VPB', bin: '970432', schemes: ['vpbankonline://', 'https://www.vpbank.com.vn'] },
  { name: 'TPBank', shortName: 'TPB', bin: '970423', schemes: ['tpbank://', 'https://tpb.vn'] },
  { name: 'Sacombank', shortName: 'STB', bin: '970403', schemes: ['sacombank://', 'https://www.sacombank.com.vn'] },
  { name: 'Agribank', shortName: 'AGB', bin: '970405', schemes: ['agribank://', 'https://www.agribank.com.vn'] },
  { name: 'HDBank', shortName: 'HDB', bin: '970437', schemes: ['hdbank://', 'https://www.hdbank.com.vn'] },
  { name: 'SHB', shortName: 'SHB', bin: '970443', schemes: ['shbmobile://', 'https://www.shb.com.vn'] },
  { name: 'MSB', shortName: 'MSB', bin: '970426', schemes: ['msbmobile://', 'https://www.msb.com.vn'] },
  { name: 'OCB', shortName: 'OCB', bin: '970448', schemes: ['ocbomni://', 'https://www.ocb.com.vn'] },
  { name: 'VIB', shortName: 'VIB', bin: '970441', schemes: ['vibmobile://', 'https://www.vib.com.vn'] },
  ];

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
  const [showBankModal, setShowBankModal] = useState(false);
  const [showBankListModal, setShowBankListModal] = useState(false);
  const [bankSearch, setBankSearch] = useState('');

  const paymentMethod: PaymentMethod | undefined = enabledMethods.find(
    (m) => m.title === order?.paymentMethod,
  ) ?? enabledMethods[0];

  const orderShortId = order?.id?.replace('CUONLEN-', '') ?? '';
  const transferPrefix = paymentMethod?.transfer_prefix ?? 'CUONLEN';
  const transferContent = `${transferPrefix}-${orderShortId}`;

  // Generate VietQR image URL with real amount and content
  const bankCode = '970436';
  const accountNo = paymentMethod?.account_number ?? '';
  const accountName = paymentMethod?.account_name ?? '';
  const orderAmount = order?.total ?? 0;
  const vietqrImageUrl = accountNo
    ? `https://img.vietqr.io/image/${bankCode}-${accountNo}-compact.png?accountName=${encodeURIComponent(accountName)}&amount=${orderAmount}&addInfo=${encodeURIComponent(transferContent)}`
    : '';

  const handleCopy = async (text: string, field: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleOpenBankApp = () => {
    // Open bank selection list instead of trying a single deep link
    setShowBankListModal(true);
  };

  const handleSelectBank = async (bank: BankInfo) => {
    setShowBankListModal(false);

    // Try each deep link scheme for the selected bank
    for (const scheme of bank.schemes) {
      try {
        const supported = await Linking.canOpenURL(scheme);
        if (supported) {
          await Linking.openURL(scheme);
          return;
        }
      } catch {
        // continue
      }
    }

    // Fallback: show QR modal with all info
    Alert.alert(
      `Không mở được ${bank.name}`,
      `Vui lòng mở thủ công app ${bank.name} và quét mã QR để thanh toán.`,
      [
        { text: 'Đóng', style: 'cancel' },
        { text: 'Xem mã QR', onPress: () => setShowBankModal(true) },
      ],
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
            {paymentMethod?.type === 'bank_transfer' && vietqrImageUrl ? (
              <Image
                source={{ uri: vietqrImageUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            ) : paymentMethod?.qr_image ? (
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
                <Text style={styles.actionBtnText}>Mở app ngân hàng bất kỳ</Text>
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
                1. Mở app ngân hàng bất kỳ và quét mã QR{'\n'}
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

      {/* Bank QR Fallback Modal */}
      <Modal visible={showBankModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bankModalCard}>
            <Text style={styles.bankModalTitle}>Quét mã QR để thanh toán</Text>
            <Text style={styles.bankModalSubtext}>
              Mở app ngân hàng bất kỳ (Vietcombank, MB Bank, Techcombank, BIDV, ACB, VPBank...) và quét mã QR.
            </Text>

            {/* QR in modal */}
            <View style={styles.bankModalQrWrap}>
              {paymentMethod?.type === 'bank_transfer' && vietqrImageUrl ? (
                <Image
                  source={{ uri: vietqrImageUrl }}
                  style={styles.bankModalQr}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.qrPlaceholder, { width: 180, height: 180 }]}>
                  {typeInfo.icon}
                  <Text style={[styles.qrPlaceholderText, { color: typeInfo.color }]}>
                    QR thanh toán
                  </Text>
                </View>
              )}
            </View>

            {/* Amount */}
            <Text style={styles.bankModalAmount}>{formatVND(order.total)}</Text>

            {/* Info rows */}
            <View style={styles.bankModalInfo}>
              {paymentMethod?.account_number && (
                <View style={styles.bankModalRow}>
                  <Text style={styles.bankModalLabel}>Số tài khoản</Text>
                  <Text style={styles.bankModalValue} selectable>{paymentMethod.account_number}</Text>
                </View>
              )}
              <View style={styles.bankModalRow}>
                <Text style={styles.bankModalLabel}>Nội dung CK</Text>
                <Text style={[styles.bankModalValue, styles.bankModalHighlight]} selectable>
                  {transferContent}
                </Text>
              </View>
            </View>

            {/* Action buttons in modal */}
            <View style={styles.bankModalActions}>
              {paymentMethod?.account_number && (
                <TouchableOpacity
                  style={styles.bankModalActionBtn}
                  onPress={() => handleCopy(paymentMethod.account_number!, 'account')}>
                  {copiedField === 'account' ? (
                    <CheckCheck size={18} color={COLORS.success} />
                  ) : (
                    <Copy size={18} color={COLORS.primary} />
                  )}
                  <Text style={styles.bankModalActionText}>Sao chép STK</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.bankModalActionBtn}
                onPress={() => handleCopy(transferContent, 'content')}>
                {copiedField === 'content' ? (
                  <CheckCheck size={18} color={COLORS.success} />
                ) : (
                  <Copy size={18} color={COLORS.primary} />
                )}
                <Text style={styles.bankModalActionText}>Sao chép nội dung CK</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.bankModalCloseBtn}
              onPress={() => setShowBankModal(false)}>
              <Text style={styles.bankModalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Bank List Modal */}
      <Modal visible={showBankListModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.bankListCard}>
            {/* Header */}
            <View style={styles.bankListHeader}>
              <Text style={styles.bankListTitle}>Chọn ngân hàng của bạn</Text>
              <TouchableOpacity onPress={() => { setShowBankListModal(false); setBankSearch(''); }}>
                <X size={24} color={COLORS.mediumText} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.bankSearchWrap}>
              <Search size={18} color={COLORS.lightText} />
              <TextInput
                style={styles.bankSearchInput}
                placeholder="Tìm ngân hàng..."
                placeholderTextColor={COLORS.lightText}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoFocus
              />
            </View>

            {/* Bank list */}
            <ScrollView style={styles.bankScroll} showsVerticalScrollIndicator={false}>
              {BANK_LIST.filter(
                (b) =>
                  !bankSearch ||
                  b.name.toLowerCase().includes(bankSearch.toLowerCase()) ||
                  b.shortName.toLowerCase().includes(bankSearch.toLowerCase()),
              ).map((bank) => (
                <TouchableOpacity
                  key={bank.bin}
                  style={styles.bankListItem}
                  onPress={() => handleSelectBank(bank)}
                  activeOpacity={0.6}>
                  <View style={styles.bankListIcon}>
                    <Building2 size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.bankListInfo}>
                    <Text style={styles.bankListName}>{bank.name}</Text>
                    <Text style={styles.bankListShort}>{bank.shortName}</Text>
                  </View>
                  <ExternalLink size={16} color={COLORS.lightText} />
                </TouchableOpacity>
              ))}
            </ScrollView>
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

  // Bank QR modal
  bankModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: SPACING.xl,
    alignItems: 'center',
    gap: SPACING.md,
    width: '100%',
    maxHeight: '90%',
    ...SHADOWS.large,
  },
  bankModalTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText, textAlign: 'center' },
  bankModalSubtext: { fontSize: 13, color: COLORS.mediumText, textAlign: 'center', lineHeight: 20 },
  bankModalQrWrap: { alignItems: 'center', marginVertical: SPACING.sm },
  bankModalQr: { width: 200, height: 200, borderRadius: 16 },
  bankModalAmount: { fontSize: 28, fontWeight: '900', fontStyle: 'italic', color: COLORS.primary },
  bankModalInfo: {
    width: '100%',
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  bankModalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bankModalLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  bankModalValue: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  bankModalHighlight: {
    color: COLORS.primary,
    backgroundColor: COLORS.softBeige,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  bankModalActions: { flexDirection: 'row', gap: SPACING.sm, width: '100%' },
  bankModalActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bankModalActionText: { fontSize: 13, fontWeight: '700', color: COLORS.darkText },
  bankModalCloseBtn: {
    width: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  bankModalCloseText: { fontSize: 16, fontWeight: '700', color: COLORS.white },

  // Bank list modal
  bankListCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: SPACING.xl,
    maxHeight: '85%',
    width: '100%',
  },
  bankListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  bankListTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText },
  bankSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  bankSearchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.darkText,
    paddingVertical: SPACING.sm,
  },
  bankScroll: { maxHeight: 400 },
  bankListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  bankListIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankListInfo: { flex: 1 },
  bankListName: { fontSize: 15, fontWeight: '700', color: COLORS.darkText },
  bankListShort: { fontSize: 12, color: COLORS.lightText, marginTop: 2 },

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
