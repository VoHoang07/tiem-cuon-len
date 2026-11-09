import { BottomNav } from '@/components/BottomNav';
import { PromoMilestoneAndPickerCard } from '@/components/PromoMilestoneAndPickerCard';
import {
    CART_CLEAR_ALL,
    CART_EMPTY_ALERT_MSG,
    CART_EMPTY_ALERT_TITLE,
    CART_EMPTY_SUBTEXT,
    CART_EMPTY_TITLE,
    CART_PER_PIECE,
    CART_START_SHOPPING,
    CART_TITLE,
    CHECKOUT_ORDER_SUMMARY,
    CHECKOUT_TITLE,
    CHECKOUT_TOTAL,
} from '@/constants/strings';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { useShop } from '@/store/ShopContext';
import type { CartItem } from '@/types/product';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji } from '@/utils/getCategoryEmoji';
import { useRouter } from 'expo-router';
import {
    ChevronLeft,
    Home,
    Minus,
    Plus,
    RotateCcw,
    ShoppingBag,
    Trash2,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  const isMobile = windowWidth < 640;

  const {
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    updateCartItemPackaging,
    cartTotal,
    clearCart,
    cartHydrated,
  } = useShop();
  const { isAuthenticated } = useAuth();
  const { shippingConfig } = usePaymentMethods();
  const [lastClearedItems, setLastClearedItems] = useState<CartItem[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string;
    discountAmount: number;
  }>({ code: '', discountAmount: 0 });

  const isFreeShip =
    shippingConfig.freeShippingEnabled &&
    cartTotal >= shippingConfig.freeShippingThreshold;
  const shippingFee =
    cart.length === 0
      ? 0
      : isFreeShip
        ? 0
        : shippingConfig.standardShippingFee;
  const finalTotal = Math.max(
    0,
    cartTotal - appliedPromo.discountAmount + shippingFee
  );

  const handleEditCartItemOptions = (item: CartItem) => {
    const baseId = String(
      item.product.baseProductId || item.product.id
    ).split('__')[0];
    router.push({
      pathname: `/product/${baseId}` as any,
      params: {
        editCartItemId: item.product.id,
        initialColorId: item.product.selectedColorId || '',
        initialAccessoryId: item.product.selectedAccessoryId || 'no_box',
        initialQty: String(item.quantity),
        initialGiftNote: item.product.giftCardNote || item.giftCardNote || '',
      },
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert(CART_EMPTY_ALERT_TITLE, CART_EMPTY_ALERT_MSG);
      return;
    }
    if (!isAuthenticated) {
      router.push({
        pathname: '/login',
        params: { redirect: '/checkout' },
      });
      return;
    }
    router.push('/checkout');
  };

  const handleClearCart = () => {
    if (cart.length === 0) return;
    setLastClearedItems([...cart]);
    clearCart();
  };

  const handleUndoClearCart = async () => {
    if (lastClearedItems.length === 0) return;
    const itemsToRestore = [...lastClearedItems];
    setLastClearedItems([]);
    for (const item of itemsToRestore) {
      await addToCart(item.product, item.quantity);
    }
  };

  const renderRightActions = (item: CartItem) => (
    <TouchableOpacity
      style={styles.swipeDelete}
      onPress={() => removeFromCart(item.product.id)}>
      <Trash2 size={22} color={COLORS.white} />
      <Text style={styles.swipeDeleteText}>Xóa</Text>
    </TouchableOpacity>
  );

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const colorLabel =
      item.product.selectedColorName || item.selectedColor || item.product.color;
    const colorHex = item.product.selectedColorHex;
    const packagingLabel =
      item.product.selectedAccessoryName ||
      item.selectedAccessory ||
      'Tự dùng / Tiêu chuẩn';
    const isGiftBox =
      item.product.selectedAccessoryId === 'gift_box_letter' ||
      packagingLabel.toLowerCase().includes('hộp quà') ||
      packagingLabel.toLowerCase().includes('quà tặng');
    const giftNote = item.product.giftCardNote ?? item.giftCardNote ?? '';

    return (
      <Swipeable renderRightActions={() => renderRightActions(item)}>
        <View style={{ marginBottom: 12 }}>
          <View
            style={[
              styles.cartItem,
              isMobile && styles.cartItemMobile,
              { marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
            ]}>
            <TouchableOpacity
              style={styles.itemImage}
              onPress={() => handleEditCartItemOptions(item)}
              activeOpacity={0.8}>
              {item.product.image ? (
                <Image
                  source={
                    typeof item.product.image === 'string'
                      ? { uri: item.product.image }
                      : (item.product.image as any)
                  }
                  style={styles.itemProductImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.itemEmoji}>
                  {getCategoryEmoji(item.product.category)}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.itemInfo}
              onPress={() => handleEditCartItemOptions(item)}
              activeOpacity={0.75}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product.name}
              </Text>

              <View style={styles.variantTagsWrap}>
                {colorLabel ? (
                  <View style={styles.variantTagPill}>
                    {colorHex ? (
                      <View
                        style={[
                          styles.variantColorDot,
                          { backgroundColor: colorHex },
                        ]}
                      />
                    ) : null}
                    <Text style={styles.variantTagText} numberOfLines={1}>
                      Màu: {colorLabel}
                    </Text>
                  </View>
                ) : null}
                <View style={styles.variantTagPill}>
                  <Text style={styles.variantTagText} numberOfLines={1}>
                    {isGiftBox
                      ? '🎁 Set Quà Tặng Đặc Biệt (+25.000₫)'
                      : '🛍️ Tự dùng / Tiêu chuẩn'}
                  </Text>
                </View>
                <View style={styles.changeOptionPill}>
                  <Text style={styles.changeOptionText}>Đổi mẫu / hộp ✎</Text>
                </View>
              </View>

              <Text style={styles.itemPrice}>
                {formatVND(item.product.price)} {CART_PER_PIECE}
              </Text>
            </TouchableOpacity>
            <View style={styles.itemActions}>
              <View style={styles.qtyAndDeleteRow}>
                <View style={styles.qtyControl}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      updateCartQuantity(item.product.id, item.quantity - 1)
                    }>
                    <Minus size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      updateCartQuantity(item.product.id, item.quantity + 1)
                    }>
                    <Plus size={14} color={COLORS.primary} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.deleteItemBtn}
                  onPress={() => removeFromCart(item.product.id)}
                  activeOpacity={0.7}
                  accessibilityLabel="Xóa sản phẩm khỏi giỏ hàng">
                  <Trash2 size={15} color={COLORS.error} />
                </TouchableOpacity>
              </View>
              <Text style={styles.itemTotal}>
                {formatVND(item.product.price * item.quantity)}
              </Text>
            </View>
          </View>

          {/* Cross-sell Gift Box & Handwritten Card Note Bar */}
          {!isGiftBox ? (
            <TouchableOpacity
              onPress={() => updateCartItemPackaging(item.product.id, true)}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#FDF6EC',
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: '#EADBC8',
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 9,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
              }}>
              <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: '#5C4033',
                  }}>
                  🎁 Bạn mua làm quà tặng?{' '}
                  <Text style={{ fontWeight: '800', color: '#8B5A2B' }}>
                    Nâng cấp Set Quà Tặng Đặc Biệt (+25.000₫)
                  </Text>
                </Text>
                <Text style={{ fontSize: 11, color: '#7A6552' }}>
                  Hộp nắp gài vintage, rơm thơm, thiệp viết tay + Tặng kèm 1 quà len mini bí mật
                </Text>
              </View>
              <View
                style={{
                  backgroundColor: '#5C4033',
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 999,
                }}>
                <Text
                  style={{
                    color: '#FFFDF9',
                    fontSize: 11.5,
                    fontWeight: '700',
                  }}>
                  + Thêm 25.000₫
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <View
              style={{
                backgroundColor: '#FDF8F2',
                borderWidth: 1,
                borderTopWidth: 0,
                borderColor: '#E5D3C0',
                borderBottomLeftRadius: 14,
                borderBottomRightRadius: 14,
                paddingHorizontal: 12,
                paddingVertical: 10,
                gap: 6,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#5C4033',
                  }}>
                  🎁 Đã chọn Set Quà Tặng Đặc Biệt (+25.000₫)
                </Text>
                <TouchableOpacity
                  onPress={() => updateCartItemPackaging(item.product.id, false)}
                  activeOpacity={0.75}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '600',
                      color: '#8C7460',
                      textDecorationLine: 'underline',
                    }}>
                    Đổi về Tiêu chuẩn
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 11.5, color: '#6E5643', lineHeight: 16 }}>
                • Hộp carton nắp gài vintage, ruy băng & lót rơm thơm giấy cao cấp{'\n'}
                • Thiệp viết tay + 🎁 Tặng kèm 1 món quà len mini bí mật bất ngờ từ tiệm
              </Text>
              <TextInput
                style={{
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#E2D4C5',
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  fontSize: 12.5,
                  color: '#3B2A1E',
                  minWidth: 0,
                }}
                placeholder="💌 Ghi chú nội dung thiệp (nếu có)..."
                placeholderTextColor="#A3907E"
                value={giftNote}
                onChangeText={(txt) =>
                  updateCartItemPackaging(item.product.id, true, txt)
                }
                maxLength={220}
              />
            </View>
          )}
        </View>
      </Swipeable>
    );
  };

  const ListHeader = (
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
      <Text style={styles.headerTitle}>{CART_TITLE}</Text>
      {cart.length > 0 ? (
        <TouchableOpacity
          style={styles.clearBtn}
          onPress={handleClearCart}
          activeOpacity={0.75}>
          <Trash2 size={14} color={COLORS.error} />
          <Text style={styles.clearText}>{CART_CLEAR_ALL}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 60 }} />
      )}
    </View>
  );

  const ListFooter = cart.length > 0 ? (
    <View style={[styles.summary, isMobile && styles.summaryMobile]}>
      <Text style={styles.summaryTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
      <PromoMilestoneAndPickerCard
        subtotal={cartTotal}
        onPromoChange={setAppliedPromo}
      />
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Tạm tính</Text>
        <Text style={styles.summaryValue}>{formatVND(cartTotal)}</Text>
      </View>
      {appliedPromo.discountAmount > 0 && (
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: '#065F46', fontWeight: '800' }]}>
            🎟️ Mã giảm giá ({appliedPromo.code})
          </Text>
          <Text style={[styles.summaryValue, { color: '#065F46', fontWeight: '900' }]}>
            -{formatVND(appliedPromo.discountAmount)}
          </Text>
        </View>
      )}
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel}>Phí vận chuyển</Text>
        <Text style={styles.summaryValue}>
          {isFreeShip ? 'Miễn phí' : formatVND(shippingFee)}
        </Text>
      </View>
      {shippingConfig.freeShippingEnabled && !isFreeShip && (
        <Text style={styles.freeShipHint}>
          🚚 Mua thêm {formatVND(shippingConfig.freeShippingThreshold - cartTotal)}{' '}
          để được Freeship (Đơn từ {formatVND(shippingConfig.freeShippingThreshold)})
        </Text>
      )}
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel}>{CHECKOUT_TOTAL}</Text>
        <Text style={styles.totalValue}>{formatVND(finalTotal)}</Text>
      </View>
    </View>
  ) : null;

  const ListEmpty = !cartHydrated ? (
    <View style={styles.emptyCart}>
      <ShoppingBag size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>Đang tải giỏ hàng...</Text>
    </View>
  ) : (
    <View style={styles.emptyCart}>
      {lastClearedItems.length > 0 && (
        <View style={styles.undoBanner}>
          <Text style={styles.undoText}>
            Đã xóa {lastClearedItems.length} sản phẩm khỏi giỏ hàng
          </Text>
          <TouchableOpacity
            style={styles.undoBtn}
            onPress={handleUndoClearCart}
            activeOpacity={0.8}>
            <RotateCcw size={13} color={COLORS.white} />
            <Text style={styles.undoBtnText}>Hoàn tác</Text>
          </TouchableOpacity>
        </View>
      )}
      <ShoppingBag size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>{CART_EMPTY_TITLE}</Text>
      <Text style={styles.emptySubtext}>{CART_EMPTY_SUBTEXT}</Text>
      <TouchableOpacity
        style={styles.shopBtn}
        onPress={() => router.replace('/')}>
        <Text style={styles.shopBtnText}>{CART_START_SHOPPING}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.product.id}
        renderItem={renderCartItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={
          cart.length === 0 ? styles.listEmpty : styles.listContent
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Centered Checkout Bar */}
      {cart.length > 0 && (
        <View style={styles.checkoutBarOuter} pointerEvents="box-none">
          <View
            style={[
              styles.checkoutBar,
              isMobile && styles.checkoutBarMobile,
              { paddingBottom: SPACING.lg + Math.max(insets.bottom, 0) },
            ]}>
            <View>
              <Text style={styles.totalText}>{CHECKOUT_TOTAL}</Text>
              <Text style={styles.totalAmount}>{formatVND(finalTotal)}</Text>
            </View>
            <TouchableOpacity
              style={styles.checkoutBtn}
              onPress={handleCheckout}>
              <Text style={styles.checkoutBtnText}>{CHECKOUT_TITLE}</Text>
            </TouchableOpacity>
          </View>
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
  listContent: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    paddingBottom: 140,
  },
  listEmpty: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F5C4C0',
  },
  clearText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.error,
  },
  undoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 14,
    marginBottom: 12,
    ...SHADOWS.small,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  undoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  undoBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.white,
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
  swipeDelete: {
    backgroundColor: COLORS.error,
    borderRadius: 16,
    marginVertical: SPACING.xs,
    marginRight: SPACING.lg,
    marginLeft: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
  },
  swipeDeleteText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  cartItem: {
    backgroundColor: COLORS.white,
    marginHorizontal: 14,
    marginBottom: SPACING.md,
    borderRadius: 20,
    padding: 12,
    flexDirection: 'row',
    ...SHADOWS.small,
  },
  cartItemMobile: {
    marginHorizontal: 12,
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
  itemAccCornerBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,253,249,0.94)',
    borderWidth: 1,
    borderColor: '#E5D8C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemAccCornerEmoji: {
    fontSize: 12,
  },
  itemInfo: {
    flex: 1,
    marginLeft: SPACING.md,
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  variantTagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  variantTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F5EFE6',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    maxWidth: '100%',
  },
  variantColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.2)',
  },
  variantTagText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#5C4738',
    flexShrink: 1,
  },
  changeOptionPill: {
    backgroundColor: '#EFE6D9',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#DCCBB6',
  },
  changeOptionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  freeShipHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7A5A40',
    backgroundColor: '#FAF4EC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 4,
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
  qtyAndDeleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  deleteItemBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#F5C4C0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 4,
  },
  summary: {
    backgroundColor: COLORS.white,
    marginHorizontal: 14,
    borderRadius: 20,
    padding: 16,
    ...SHADOWS.small,
  },
  summaryMobile: {
    marginHorizontal: 12,
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
  checkoutBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  checkoutBar: {
    width: '100%',
    maxWidth: 840,
    backgroundColor: '#FFFDF9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.large,
  },
  checkoutBarMobile: {
    paddingHorizontal: 14,
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
