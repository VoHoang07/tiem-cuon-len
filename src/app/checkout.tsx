import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, MapPin, ChevronRight } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useAddresses } from '@/store/AddressContext';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  CHECKOUT_TITLE,
  CHECKOUT_DELIVERY,
  CHECKOUT_PAYMENT,
  CHECKOUT_ORDER_SUMMARY,
  CHECKOUT_TOTAL,
  CHECKOUT_PAY_BTN,
  CHECKOUT_SUCCESS_TITLE,
  CHECKOUT_SUCCESS_TEXT,
  CHECKOUT_ALERT_TITLE,
  CHECKOUT_ALERT_MSG,
} from '@/constants/strings';

const PAYMENT_METHODS = ['Cash on Delivery', 'Mastercard', 'Visa'] as const;

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart, cartTotal, clearCart } = useShop();
  const { user } = useAuth();
  const { addOrder } = useOrders();
  const { userAddresses, getDefaultAddress } = useAddresses();
  const [selectedPayment, setSelectedPayment] = useState<string>(
    PAYMENT_METHODS[0]
  );
  const [submitted, setSubmitted] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');

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

  const handlePayment = () => {
    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng thêm địa chỉ giao hàng trước khi thanh toán.');
      return;
    }

    setSubmitted(true);

    const order = {
      id: `order_${Date.now()}`,
      userId: user?.email ?? 'unknown',
      items: cart.map((ci) => ({
        product: ci.product,
        quantity: ci.quantity,
        price: ci.product.price,
      })),
      total: cartTotal,
      shippingAddress: selectedAddress,
      paymentMethod: selectedPayment,
      status: 'Đang xử lý' as const,
      createdAt: new Date().toISOString(),
    };

    addOrder(order);

    setTimeout(() => {
      clearCart();
    }, 1500);
  };

  if (submitted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Check size={48} color={COLORS.white} />
          </View>
          <Text style={styles.successTitle}>{CHECKOUT_SUCCESS_TITLE}</Text>
          <Text style={styles.successText}>{CHECKOUT_SUCCESS_TEXT}</Text>

          <TouchableOpacity
            style={styles.viewOrdersBtn}
            onPress={() => router.replace('/orders')}>
            <Text style={styles.viewOrdersBtnText}>Xem đơn hàng</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/')}>
            <Text style={styles.homeBtnText}>Về Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{CHECKOUT_TITLE}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Address */}
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
                            {addr.detailAddress}, {addr.ward}, {addr.district}, {addr.city}
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

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_PAYMENT}</Text>
          {PAYMENT_METHODS.map((method) => (
            <TouchableOpacity
              key={method}
              style={[
                styles.paymentOption,
                selectedPayment === method && styles.paymentOptionSelected,
              ]}
              onPress={() => setSelectedPayment(method)}>
              <Text style={styles.paymentText}>{method}</Text>
              {selectedPayment === method && (
                <Check size={20} color={COLORS.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
          {cart.map((item) => (
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
            <Text style={styles.totalValue}>{formatVND(cartTotal)}</Text>
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
              ? `${CHECKOUT_PAY_BTN} ${formatVND(cartTotal)}`
              : 'Thêm địa chỉ để thanh toán'}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scroll: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  section: {
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
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
  changeText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: SPACING.md,
  },
  addressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addressHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  addressInfo: {
    flex: 1,
  },
  addressName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  addressPhone: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  addressDetail: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: 4,
    lineHeight: 18,
  },
  addressList: {
    marginTop: SPACING.md,
  },
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
  altAddressName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  altAddressDetail: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
  },
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
  noAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  addAddressBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  addAddressBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
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
  paymentText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  itemName: {
    fontSize: 14,
    color: COLORS.mediumText,
    flex: 1,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.sm,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  totalValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  payBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.xxl,
  },
  payBtnDisabled: {
    opacity: 0.5,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
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
  successTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  successText: {
    fontSize: 16,
    color: COLORS.mediumText,
  },
  viewOrdersBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 16,
    ...SHADOWS.medium,
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
  },
  homeBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
