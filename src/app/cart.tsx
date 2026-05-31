import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Minus,
  Plus,
  Trash2,
  ShoppingBag,
  Home,
  } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji } from '@/utils/getCategoryEmoji';
import {
  CART_TITLE,
  CART_CLEAR_ALL,
  CART_EMPTY_TITLE,
  CART_EMPTY_SUBTEXT,
  CART_START_SHOPPING,
  CART_PER_PIECE,
  CART_EMPTY_ALERT_TITLE,
  CART_EMPTY_ALERT_MSG,
  CHECKOUT_TITLE,
  CHECKOUT_TOTAL,
  CHECKOUT_ORDER_SUMMARY,
} from '@/constants/strings';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { role } = useAuth();
  const { cart, removeFromCart, updateCartQuantity, cartTotal, clearCart, cartHydrated } =
    useShop();

  if (role === 'admin') {
    router.replace('/');
    return null;
  }

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(CART_EMPTY_ALERT_TITLE, CART_EMPTY_ALERT_MSG);
      return;
    }
    router.push('/checkout');
  };

  const handleClearCart = () => {
    Alert.alert('Xóa giỏ hàng', 'Bạn có chắc muốn xóa toàn bộ giỏ hàng?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => clearCart() },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backBtn}>
              <ChevronLeft size={24} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={20} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{CART_TITLE}</Text>
          {cart.length > 0 && (
            <TouchableOpacity onPress={handleClearCart}>
              <Text style={styles.clearText}>{CART_CLEAR_ALL}</Text>
            </TouchableOpacity>
          )}
          {cart.length === 0 && <View style={{ width: 60 }} />}
        </View>

        {!cartHydrated ? (
          <View style={styles.emptyCart}>
            <ShoppingBag size={64} color={COLORS.lightText} />
            <Text style={styles.emptyTitle}>Đang tải giỏ hàng...</Text>
          </View>
        ) : cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <ShoppingBag size={64} color={COLORS.lightText} />
            <Text style={styles.emptyTitle}>{CART_EMPTY_TITLE}</Text>
            <Text style={styles.emptySubtext}>
              {CART_EMPTY_SUBTEXT}
            </Text>
            <TouchableOpacity
              style={styles.shopBtn}
              onPress={() => router.replace('/')}>
              <Text style={styles.shopBtnText}>{CART_START_SHOPPING}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Cart Items */}
            {cart.map((item) => (
              <View key={item.product.id} style={styles.cartItem}>
                <View style={styles.itemImage}>
                  {item.product.image ? (
                    <Image
                      source={{ uri: item.product.image }}
                      style={styles.itemProductImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.itemEmoji}>{getCategoryEmoji(item.product.category)}</Text>
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.product.name}
                  </Text>
                  <Text style={styles.itemCategory}>
                    {item.product.category}
                  </Text>
                  <Text style={styles.itemPrice}>
                    {formatVND(item.product.price)} {CART_PER_PIECE}
                  </Text>
                </View>
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    onPress={() => removeFromCart(item.product.id)}>
                    <Trash2 size={18} color={COLORS.error} />
                  </TouchableOpacity>
                  <View style={styles.qtyControl}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        updateCartQuantity(
                          item.product.id,
                          item.quantity - 1
                        )
                      }>
                      <Minus size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() =>
                        updateCartQuantity(
                          item.product.id,
                          item.quantity + 1
                        )
                      }>
                      <Plus size={14} color={COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.itemTotal}>
                    {formatVND(item.product.price * item.quantity)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Order Summary */}
            <View style={styles.summary}>
              <Text style={styles.summaryTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Tạm tính</Text>
                <Text style={styles.summaryValue}>{formatVND(cartTotal)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
                <Text style={styles.summaryValue}>Miễn phí</Text>
              </View>
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>{CHECKOUT_TOTAL}</Text>
                <Text style={styles.totalValue}>{formatVND(cartTotal)}</Text>
              </View>
            </View>

            <View style={{ height: 120 }} />
          </>
        )}
      </ScrollView>

      {/* Checkout Bar */}
      {cart.length > 0 && (
        <View style={[styles.checkoutBar, { paddingBottom: SPACING.lg + Math.max(insets.bottom, 0) }]}>
          <View>
            <Text style={styles.totalText}>{CHECKOUT_TOTAL}</Text>
            <Text style={styles.totalAmount}>{formatVND(cartTotal)}</Text>
          </View>
          <TouchableOpacity
            style={styles.checkoutBtn}
            onPress={handleCheckout}>
            <Text style={styles.checkoutBtnText}>{CHECKOUT_TITLE}</Text>
          </TouchableOpacity>
        </View>
      )}
      {cart.length === 0 && <BottomNav />}
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
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.error,
  },
  emptyCart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.mediumText,
    textAlign: 'center',
    paddingHorizontal: SPACING.xxxl,
  },
  shopBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  shopBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  cartItem: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 20,
    padding: SPACING.md,
    flexDirection: 'row',
    ...SHADOWS.small,
  },
  itemImage: {
    width: 70,
    height: 70,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemProductImage: {
    width: 70,
    height: 70,
    resizeMode: 'cover',
  },
  itemEmoji: {
    fontSize: 32,
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  itemCategory: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: 2,
  },
  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingLeft: SPACING.sm,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    minWidth: 20,
    textAlign: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  summary: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  summaryLabel: {
    fontSize: 14,
    color: COLORS.mediumText,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.primary,
  },
  checkoutBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    ...SHADOWS.large,
  },
  totalText: {
    fontSize: 13,
    color: COLORS.mediumText,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
  },
  checkoutBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 14,
  },
  checkoutBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
});
