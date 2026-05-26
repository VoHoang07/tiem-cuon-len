import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Check,
  MapPin,
  ChevronRight,
  Building2,
  Smartphone,
  Wallet,
  Truck,
  Home,
  } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useAddresses } from '@/store/AddressContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  CHECKOUT_TITLE,
  CHECKOUT_DELIVERY,
  CHECKOUT_PAYMENT,
  CHECKOUT_ORDER_SUMMARY,
  CHECKOUT_TOTAL,
  CHECKOUT_SUCCESS_TITLE,
  CHECKOUT_SUCCESS_TEXT,
} from '@/constants/strings';

const TYPE_ICONS: Record<PaymentMethodType, { icon: React.ReactNode; color: string }> = {
  bank_transfer: { icon: <Building2 size={24} color="#765341" />, color: '#765341' },
  momo: { icon: <Smartphone size={24} color="#A50064" />, color: '#A50064' },
  zalopay: { icon: <Wallet size={24} color="#0068FF" />, color: '#0068FF' },
  cod: { icon: <Truck size={24} color="#6BAF5C" />, color: '#6BAF5C' },
};

export default function CheckoutScreen() {
  const router = useRouter();
  const { mode, productId, quantity: buyNowQty } = useLocalSearchParams<{
    mode?: string;
    productId?: string;
    quantity?: string;
  }>();
  const isBuyNow = mode === 'buyNow';

  const { cart, clearCart, products } = useShop();
  const { user } = useAuth();
  const { addOrder } = useOrders();
  const { userAddresses, getDefaultAddress } = useAddresses();
  const { enabledMethods, defaultMethod, loading: pmLoading } = usePaymentMethods();

  // Compute buyNow product
  const buyNowProduct = useMemo(() => {
    if (!isBuyNow || !productId) return null;
    return products.find((p) => p.id === productId) ?? null;
  }, [isBuyNow, productId, products]);

  const buyNowQtyNum = parseInt(buyNowQty ?? '1', 10) || 1;

  // Compute checkout items based on mode
  const checkoutItems = useMemo(() => {
    if (isBuyNow && buyNowProduct) {
      return [{ product: buyNowProduct, quantity: buyNowQtyNum }];
    }
    return cart;
  }, [isBuyNow, buyNowProduct, buyNowQtyNum, cart]);

  const checkoutTotal = useMemo(() => {
    return checkoutItems.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0);
  }, [checkoutItems]);

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

  // Set default payment method when data loads
  useEffect(() => {
    if (defaultMethod && !selectedPayment) {
      setSelectedPayment(defaultMethod);
    }
  }, [defaultMethod]);

  const selectedAddress =
    userAddresses.find((a) => a.id === selectedAddressId) ??
    getDefaultAddress();

  useEffect(() => {
    if (!selectedAddressId && userAddresses.length > 0) {
      const defaultAddr = getDefaultAddress();
      setSelectedAddressId(defaultAddr?.id ?? userAddresses[0].id);
    }
  }, [userAddresses]);

  const hasAddress = userAddresses.length > 0;

  const getOrderStatus = (type: PaymentMethodType) => {
    if (type === 'cod') return 'Đang xử lý' as const;
    return 'pending_payment' as const;
  };

  const handlePayment = () => {
    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng thêm địa chỉ giao hàng trước khi thanh toán.');
      return;
    }

    if (!selectedPayment) {
      Alert.alert('Chưa chọn', 'Vui lòng chọn phương thức thanh toán.');
      return;
    }

    const orderShortId = Date.now().toString().slice(-6);
    const orderId = `CUONLEN-${orderShortId}`;
    const status = getOrderStatus(selectedPayment.type);

    const order = {
      id: orderId,
      userId: user?.id ?? user?.email ?? 'unknown',
      items: checkoutItems.map((ci) => ({
        product: ci.product,
        quantity: ci.quantity,
        price: ci.product.price,
      })),
      total: checkoutTotal,
      shippingAddress: selectedAddress,
      paymentMethod: selectedPayment.title,
      status,
      createdAt: new Date().toISOString(),
    };

    addOrder(order);

    if (selectedPayment.type === 'cod') {
      if (!isBuyNow) clearCart(); // Only clear cart in cart mode
      setSubmitted(true);
    } else {
      if (!isBuyNow) clearCart(); // Only clear cart in cart mode
      router.replace(`/payment/${orderId}`);
    }
    };

    const renderCODSuccess = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: '#6BAF5C' }]}>
          <Truck size={48} color={COLORS.white} />
        </View>
        <Text style={styles.successTitle}>Đặt hàng thành công</Text>
        <Text style={styles.successText}>
          Đơn hàng của bạn đang được xử lý.{'\n'}
          Bạn sẽ thanh toán khi nhận hàng.
        </Text>

        <View style={styles.codInfoCard}>
          <Truck size={20} color="#6BAF5C" />
          <Text style={styles.codInfoText}>
            Thanh toán khi nhận hàng (COD)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewOrdersBtn}
          onPress={() => router.replace('/orders')}>
          <Text style={styles.viewOrdersBtnText}>Xem đơn hàng</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.homeBtnText}>Về Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    );

  if (submitted) return renderCODSuccess();

  if (pmLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              }}
              style={styles.backBtn}>
              <ChevronLeft size={24} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={20} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{CHECKOUT_TITLE}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Address — unchanged */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{CHECKOUT_DELIVERY}</Text>
            <TouchableOpacity onPress={() => router.push('/addresses')}>
              <Text style={styles.changeText}>Thay đổi</Text>
            </TouchableOpacity>
          </View>

          {!hasAddress ? (
            <View style={styles.noAddressCard}>
              <MapPin size={48} color={COLORS.lightText} />
              <Text style={styles.noAddressText}>Bạn chưa có địa chỉ giao hàng</Text>
              <TouchableOpacity
                style={styles.addAddressBtn}
                onPress={() => router.push('/addresses/add')}>
                <Text style={styles.addAddressBtnText}>Thêm địa chỉ giao hàng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.addressCard}
                onPress={() => router.push('/addresses')}>
                <View style={styles.addressHeader}>
                  <MapPin size={20} color={COLORS.primary} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressName}>{selectedAddress?.fullName}</Text>
                    <Text style={styles.addressPhone}>{selectedAddress?.phone}</Text>
                    <Text style={styles.addressDetail}>
                      {selectedAddress?.detailAddress}, {selectedAddress?.ward},{' '}
                      {selectedAddress?.district}, {selectedAddress?.city}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={COLORS.lightText} />
                </View>
              </TouchableOpacity>

              {userAddresses.length > 1 && (
                <View style={styles.addressList}>
                  <Text style={styles.addressListTitle}>Địa chỉ khác</Text>
                  {userAddresses
                    .filter((a) => a.id !== selectedAddressId)
                    .map((addr) => (
                      <TouchableOpacity
                        key={addr.id}
                        style={[
                          styles.altAddressCard,
                          selectedAddressId === addr.id && styles.altAddressCardSelected,
                        ]}
                        onPress={() => setSelectedAddressId(addr.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.altAddressName}>{addr.fullName}</Text>
                          <Text style={styles.altAddressDetail}>
                            {addr.detailAddress}, {addr.ward}, {addr.district},{' '}
                            {addr.city}
                          </Text>
                        </View>
                        {selectedAddressId === addr.id && (
                          <Check size={20} color={COLORS.primary} />
                        )}
                      </TouchableOpacity>
                    ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Payment Method — dynamic from Supabase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_PAYMENT}</Text>
          {enabledMethods.map((method) => {
            const { icon, color } = TYPE_ICONS[method.type];
            const isSelected = selectedPayment?.id === method.id;

            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  isSelected && styles.paymentOptionSelected,
                ]}
                onPress={() => setSelectedPayment(method)}>
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: color + '15' }]}>
                    {icon}
                  </View>
                  <Text style={styles.paymentText}>{method.title}</Text>
                </View>
                {isSelected && <Check size={20} color={color} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
          {checkoutItems.map((item) => (
            <View key={item.product.id} style={styles.summaryItem}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.product.name} x{item.quantity}
              </Text>
              <Text style={styles.itemPrice}>
                {formatVND(item.product.price * item.quantity)}
              </Text>
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{CHECKOUT_TOTAL}</Text>
            <Text style={styles.totalValue}>{formatVND(checkoutTotal)}</Text>
          </View>
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payBtn, !hasAddress && styles.payBtnDisabled]}
          onPress={handlePayment}
          disabled={!hasAddress}
          activeOpacity={0.8}>
          <Text style={styles.payBtnText}>
            {hasAddress
              ? selectedPayment?.type === 'cod'
                ? 'Đặt hàng COD'
                : `Thanh toán ${formatVND(checkoutTotal)}`
              : 'Thêm địa chỉ để thanh toán'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

// --- Sub-components ---

// --- Styles ---

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText },
  section: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.xxl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  changeText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: SPACING.md },
  addressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addressHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  addressInfo: { flex: 1 },
  addressName: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  addressPhone: { fontSize: 13, color: COLORS.mediumText, marginTop: 2 },
  addressDetail: { fontSize: 13, color: COLORS.mediumText, marginTop: 4, lineHeight: 18 },
  addressList: { marginTop: SPACING.md },
  addressListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.sm,
  },
  altAddressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  altAddressCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPurple,
  },
  altAddressName: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  altAddressDetail: { fontSize: 12, color: COLORS.mediumText, marginTop: 2 },
  noAddressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  noAddressText: { fontSize: 15, fontWeight: '600', color: COLORS.mediumText },
  addAddressBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  addAddressBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  paymentOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPurple,
  },
  paymentOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentText: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  paymentDetails: { marginTop: SPACING.md, paddingHorizontal: SPACING.lg },
  paymentDetailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  bankCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
    gap: SPACING.md,
  },
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.xxxl,
    ...SHADOWS.small,
    alignItems: 'center',
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 16,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    alignSelf: 'center',
  },
  qrPlaceholderText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  qrSubtext: { fontSize: 11, color: COLORS.mediumText, textAlign: 'center' },
  bankInfo: { gap: SPACING.xs },
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
  noteBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  noteText: { fontSize: 13, color: COLORS.mediumText, lineHeight: 20 },
  summaryItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: SPACING.xs },
  itemName: { fontSize: 14, color: COLORS.mediumText, flex: 1 },
  itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  payBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.xxl,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 16, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
    backgroundColor: COLORS.cream,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.darkText, textAlign: 'center' },
  successText: { fontSize: 16, color: COLORS.mediumText, textAlign: 'center', lineHeight: 24 },
  codInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FFF4',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  codInfoText: { fontSize: 15, fontWeight: '700', color: '#6BAF5C' },
  successActions: { width: '100%', gap: SPACING.md, marginTop: SPACING.lg },
  viewOrdersBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 16,
    ...SHADOWS.medium,
    alignItems: 'center',
  },
  viewOrdersBtnText: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  homeBtn: {
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  homeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
});
