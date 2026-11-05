import React, { useRef, useState, useMemo, memo } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Animated,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Heart,
  Plus,
  Minus,
  Check,
  Edit3,
  MessageCircle,
  Share2,
  X,
  ShoppingCart,
} from 'lucide-react-native';
import {
  Product,
  ProductColorOption,
  ProductAccessoryOption,
} from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { useFavorites } from '@/store/FavoritesContext';
import { useCart } from '@/store/CartContext';
import { useAuth } from '@/store/AuthContext';
import { useChatTrigger } from '@/store/ChatContext';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import { ShareModal, PUBLIC_SHOP_URL } from '@/components/ShareModal';

const DEFAULT_GIFT_BOX_IMAGE = '/gift-box-letter.jpg';

const PACKAGING_OPTIONS: ProductAccessoryOption[] = [
  {
    id: 'no_box',
    name: 'Không hộp',
    emoji: '🛍️',
    priceDelta: 0,
  },
  {
    id: 'gift_box_letter',
    name: 'Hộp quà + Thư tay',
    emoji: '🎁',
    priceDelta: 15000,
  },
];

const GAP = 14;
const MAX_CONTAINER_WIDTH = 1120;

function resolveImgUri(src: any): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  if (typeof src === 'object' && typeof src.uri === 'string') return src.uri;
  return null;
}

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  variant?: 'grid' | 'carousel';
  numColumns?: number;
}

export const ProductCard = memo(function ProductCard({
  product,
  onPress,
  variant = 'grid',
  numColumns = 2,
}: ProductCardProps) {
  const router = useRouter();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { role } = useAuth();
  const openChatWithProduct = useChatTrigger();
  const isAdmin = role === 'admin';

  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const fav = isFavorite(product.id);
  const [justAdded, setJustAdded] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showQuickOptionModal, setShowQuickOptionModal] = useState(false);
  const [quickColorId, setQuickColorId] = useState<string | null>(
    product.colorOptions?.[0]?.id ?? null
  );
  const [quickAccessoryId, setQuickAccessoryId] = useState<string>('no_box');
  const [quickQty, setQuickQty] = useState<number>(1);
  const [quickPreviewGiftBox, setQuickPreviewGiftBox] = useState<boolean>(false);

  const colorOptions: ProductColorOption[] = useMemo(
    () => product.colorOptions ?? [],
    [product.colorOptions]
  );
  const activeQuickColor: ProductColorOption | null =
    colorOptions.find((c) => c.id === quickColorId) ?? colorOptions[0] ?? null;
  const activeQuickAccessory: ProductAccessoryOption =
    PACKAGING_OPTIONS.find((a) => a.id === quickAccessoryId) ??
    PACKAGING_OPTIONS[0];
  const quickBasePrice =
    activeQuickColor?.price && Number(activeQuickColor.price) > 0
      ? Number(activeQuickColor.price)
      : product.price;
  const quickAccessoryDelta = activeQuickAccessory?.priceDelta ?? 0;
  const quickEffectivePrice = quickBasePrice + quickAccessoryDelta;
  const quickPreviewImage = quickPreviewGiftBox
    ? DEFAULT_GIFT_BOX_IMAGE
    : activeQuickColor?.image || product.image;

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const isDesktop = windowWidth >= 768;
  const containerWidth = Math.min(windowWidth, MAX_CONTAINER_WIDTH);
  const horizontalPad = windowWidth < 640 ? 12 : SPACING.lg;
  const gapSize = windowWidth < 640 ? 10 : GAP;
  const availableWidth = containerWidth - horizontalPad * 2 - gapSize * (numColumns - 1);
  const gridCardWidth = Math.floor(availableWidth / numColumns);

  const cardWidth =
    variant === 'carousel'
      ? isDesktop
        ? 254
        : 182
      : gridCardWidth;

  const imageHeight =
    variant === 'carousel'
      ? Math.round(cardWidth * 0.9)
      : Math.min(Math.round(cardWidth * 0.94), 232);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handleFavoritePress = (e?: any) => {
    e?.stopPropagation?.();
    Animated.sequence([
      Animated.spring(heartScale, {
        toValue: 1.3,
        friction: 3,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.spring(heartScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
    toggleFavorite(product.id);
  };

  const handleOpenQuickAdd = (e?: any) => {
    e?.stopPropagation?.();
    setQuickColorId(product.colorOptions?.[0]?.id ?? null);
    setQuickAccessoryId('no_box');
    setQuickPreviewGiftBox(false);
    setQuickQty(1);
    setShowQuickOptionModal(true);
  };

  const handleConfirmQuickAdd = () => {
    const colorId = activeQuickColor?.id ?? 'c1';
    const accId = activeQuickAccessory?.id ?? 'no_box';
    const variantProduct: Product = {
      ...product,
      id: `${product.id}__${colorId}__${accId}`,
      baseProductId: product.id,
      color: activeQuickColor ? activeQuickColor.name : product.color,
      selectedColorId: activeQuickColor?.id,
      selectedColorName: activeQuickColor?.name ?? product.color,
      selectedColorHex: activeQuickColor?.hex,
      selectedAccessoryId: activeQuickAccessory?.id,
      selectedAccessoryName: activeQuickAccessory?.name,
      selectedAccessoryEmoji: activeQuickAccessory?.emoji,
      image: activeQuickColor?.image || product.image,
      price: quickEffectivePrice,
    };
    addToCart(variantProduct, quickQty);
    setShowQuickOptionModal(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1100);
  };

  const handleAdminEdit = (e?: any) => {
    e?.stopPropagation?.();
    router.push(`/edit-product/${product.id}`);
  };

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        { width: cardWidth, transform: [{ scale: scaleAnim }] },
      ]}>
      <Pressable
        style={styles.card}
        onPress={() => onPress(product)}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}>
        <View style={styles.imageContainer}>
          {product.image ? (
            Platform.OS === 'web' && resolveImgUri(product.image) ? (
              <View style={[styles.productImage, { height: imageHeight, overflow: 'hidden' }]}>
                {React.createElement('img', {
                  src: resolveImgUri(product.image)!,
                  alt: product.name,
                  decoding: 'async',
                  loading: variant === 'carousel' ? 'eager' : 'lazy',
                  fetchPriority: variant === 'carousel' ? 'high' : 'auto',
                  draggable: false,
                  style: {
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                    userSelect: 'none',
                  },
                })}
              </View>
            ) : (
              <Image
                source={
                  typeof product.image === 'string'
                    ? { uri: product.image }
                    : (product.image as any)
                }
                style={[styles.productImage, { height: imageHeight }]}
                resizeMode="cover"
              />
            )
          ) : (
            <View style={[styles.imagePlaceholder, { height: imageHeight }]}>
              <Text style={styles.imageEmoji}>
                {getCategoryEmoji(product.category)}
              </Text>
            </View>
          )}

          {/* Category Pill */}
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>
              {getCategoryEmoji(product.category)} {getCategoryLabel(product.category)}
            </Text>
          </View>

          {/* Top-Right Action: Admin gets Quick Edit; Client gets Favorite Heart */}
          {isAdmin ? (
            <TouchableOpacity
              style={[styles.favButton, styles.adminEditBadge]}
              onPress={handleAdminEdit}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Edit3 size={15} color="#3D2B1F" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.favButton, fav && styles.favButtonActive]}
              onPress={handleFavoritePress}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Heart
                  size={16}
                  color={fav ? COLORS.error : COLORS.darkText}
                  fill={fav ? COLORS.error : 'transparent'}
                />
              </Animated.View>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.info, !isDesktop && styles.infoMobile]}>
          <Text style={[styles.name, !isDesktop && styles.nameMobile]} numberOfLines={2}>
            {product.name}
          </Text>

          {((product.colorOptions && product.colorOptions.length > 0) ||
            (product.accessoryOptions && product.accessoryOptions.length > 0)) && (
            <View style={styles.variantsPreviewRow}>
              {product.colorOptions && product.colorOptions.length > 0 && (
                <View style={styles.colorDotsRow}>
                  {product.colorOptions.slice(0, 4).map((c) => (
                    <View
                      key={c.id}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c.hex },
                      ]}
                    />
                  ))}
                  {product.colorOptions.length > 4 && (
                    <Text style={styles.moreVariantsText}>
                      +{product.colorOptions.length - 4}
                    </Text>
                  )}
                </View>
              )}
              {product.accessoryOptions && product.accessoryOptions.length > 0 && (
                <View style={styles.accessoryCountBadge}>
                  <Text style={styles.accessoryCountText} numberOfLines={1}>
                    {product.accessoryOptions[0]?.emoji || '🎀'} {product.accessoryOptions.length} phụ kiện
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.metaRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingText}>{product.rating}</Text>
            </View>
            <Text style={styles.stockText}>
              {product.isMadeToOrder !== false
                ? '🧶 Đặt làm theo mẫu'
                : product.quantity > 0
                ? `📦 Có sẵn: ${product.quantity}`
                : 'Tạm hết hàng'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text
              style={[
                styles.price,
                variant === 'carousel' && styles.priceCarousel,
                !isDesktop && styles.priceMobile,
              ]}
              numberOfLines={1}>
              {formatVND(product.price)}
            </Text>
            <View style={styles.cardActionBtnsRow}>
              {(isDesktop || isAdmin) && (
                <TouchableOpacity
                  style={[styles.pingCardBtn, !isDesktop && styles.pingCardBtnMobile]}
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    setShowShareModal(true);
                  }}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Share2 size={isDesktop ? 13 : 12.5} color="#3D2B1F" strokeWidth={2.3} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.pingCardBtn, !isDesktop && styles.pingCardBtnMobile]}
                onPress={(e: any) => {
                  e?.stopPropagation?.();
                  openChatWithProduct(product);
                }}
                activeOpacity={0.75}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <MessageCircle size={isDesktop ? 13.5 : 13} color="#3D2B1F" strokeWidth={2.3} />
              </TouchableOpacity>
              {isAdmin ? (
                isDesktop ? (
                  <TouchableOpacity
                    style={[styles.quickAddBtn, styles.quickAddBtnDesktop]}
                    onPress={handleAdminEdit}
                    activeOpacity={0.75}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                    <Edit3 size={14} color="#3D2B1F" strokeWidth={2.5} />
                    <Text style={styles.quickAddText}>Sửa</Text>
                  </TouchableOpacity>
                ) : null
              ) : (
                <TouchableOpacity
                  style={[
                    styles.quickAddBtn,
                    !isDesktop && styles.quickAddBtnMobile,
                    isDesktop && styles.quickAddBtnDesktop,
                    justAdded && styles.quickAddBtnAdded,
                  ]}
                  onPress={handleOpenQuickAdd}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  {justAdded ? (
                    <Check size={isDesktop ? 14 : 14} color="#3D2B1F" strokeWidth={2.8} />
                  ) : (
                    <Plus size={isDesktop ? 14 : 14} color="#3D2B1F" strokeWidth={2.6} />
                  )}
                  {isDesktop && (
                    <Text style={styles.quickAddText}>
                      {justAdded ? 'Đã thêm' : 'Thêm'}
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Pressable>

      {/* Compact Quick Option Picker Modal when clicking "+ Thêm" */}
      {showQuickOptionModal ? (
        <Modal
          visible={showQuickOptionModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowQuickOptionModal(false)}>
          <Pressable
            style={[
              styles.quickModalOverlay,
              !isDesktop && styles.quickModalOverlayMobile,
            ]}
            onPress={() => setShowQuickOptionModal(false)}>
            <Pressable
              style={[
                styles.quickModalCard,
                !isDesktop && styles.quickModalCardMobile,
              ]}
              onPress={(e: any) => e?.stopPropagation?.()}>
              {/* Header: Product Preview + Live Price + Close */}
              <View style={styles.quickModalHeader}>
                <View style={styles.quickModalThumbWrap}>
                  {quickPreviewImage ? (
                    <Image
                      source={
                        typeof quickPreviewImage === 'string'
                          ? { uri: quickPreviewImage }
                          : (quickPreviewImage as any)
                      }
                      style={styles.quickModalThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={{ fontSize: 26 }}>
                      {getCategoryEmoji(product.category)}
                    </Text>
                  )}
                </View>

                <View style={styles.quickModalHeaderInfo}>
                  <Text style={styles.quickModalTitle} numberOfLines={2}>
                    {product.name}
                  </Text>
                  <View style={styles.quickModalPriceRow}>
                    <Text style={styles.quickModalPrice}>
                      {formatVND(quickEffectivePrice)}
                    </Text>
                    {quickAccessoryDelta > 0 && (
                      <Text style={styles.quickModalPriceSub}>
                        (gồm +{formatVND(quickAccessoryDelta)} hộp quà)
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setShowQuickOptionModal(false);
                      router.push(`/product/${product.id}`);
                    }}
                    activeOpacity={0.7}>
                    <Text style={styles.quickModalDetailLink}>
                      Xem trang chi tiết sản phẩm ›
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.quickModalCloseBtn}
                  onPress={() => setShowQuickOptionModal(false)}
                  activeOpacity={0.75}>
                  <X size={16} color="#4A3728" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.quickModalBody}
                showsVerticalScrollIndicator={false}>
                {/* 1. Color / Variant Options */}
                {colorOptions.length > 0 && (
                  <View style={styles.quickOptionGroup}>
                    <Text style={styles.quickOptionLabel}>
                      Chọn mẫu / màu:{' '}
                      <Text style={styles.quickOptionValue}>
                        {activeQuickColor?.name ?? product.color}
                      </Text>
                    </Text>
                    <View style={styles.quickPillsWrap}>
                      {colorOptions.map((c) => {
                        const isSelected = activeQuickColor?.id === c.id;
                        return (
                          <TouchableOpacity
                            key={c.id}
                            style={[
                              styles.quickPill,
                              isSelected && styles.quickPillSelected,
                            ]}
                            onPress={() => {
                              setQuickColorId(c.id);
                              setQuickPreviewGiftBox(false);
                            }}
                            activeOpacity={0.8}>
                            <View
                              style={[
                                styles.quickPillDot,
                                { backgroundColor: c.hex },
                              ]}
                            />
                            <Text
                              style={[
                                styles.quickPillText,
                                isSelected && styles.quickPillTextSelected,
                              ]}>
                              {c.price &&
                              Number(c.price) > 0 &&
                              colorOptions.length > 1
                                ? `${c.name} • ${formatVND(Number(c.price))}`
                                : c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 2. Packaging Options (Không hộp vs Hộp quà + Thư tay +15k) */}
                <View style={styles.quickOptionGroup}>
                  <Text style={styles.quickOptionLabel}>
                    Đóng gói:{' '}
                    <Text style={styles.quickOptionValue}>
                      {activeQuickAccessory.emoji} {activeQuickAccessory.name}
                    </Text>
                  </Text>
                  <View style={styles.quickPillsWrap}>
                    {PACKAGING_OPTIONS.map((acc) => {
                      const isSelected = activeQuickAccessory.id === acc.id;
                      const delta = acc.priceDelta ?? 0;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[
                            styles.quickPill,
                            isSelected && styles.quickPillSelected,
                          ]}
                          onPress={() => {
                            setQuickAccessoryId(acc.id);
                            setQuickPreviewGiftBox(acc.id === 'gift_box_letter');
                          }}
                          activeOpacity={0.8}>
                          <Text
                            style={[
                              styles.quickPillText,
                              isSelected && styles.quickPillTextSelected,
                            ]}>
                            {acc.emoji} {acc.name}
                            {delta > 0 ? ` (+${formatVND(delta)})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </ScrollView>

              {/* Footer: Quantity + Confirm Add to Cart */}
              <View style={styles.quickModalFooter}>
                <View style={styles.quickQtyBox}>
                  <TouchableOpacity
                    style={styles.quickQtyBtn}
                    onPress={() => setQuickQty(Math.max(1, quickQty - 1))}>
                    <Minus size={14} color="#4A3728" />
                  </TouchableOpacity>
                  <Text style={styles.quickQtyText}>{quickQty}</Text>
                  <TouchableOpacity
                    style={styles.quickQtyBtn}
                    onPress={() =>
                      setQuickQty(
                        Math.min(
                          quickQty + 1,
                          product.isMadeToOrder !== false
                            ? 99
                            : Math.max(1, product.quantity)
                        )
                      )
                    }>
                    <Plus size={14} color="#4A3728" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.quickConfirmBtn}
                  onPress={handleConfirmQuickAdd}
                  activeOpacity={0.85}>
                  <ShoppingCart size={15} color="#FFFDF9" />
                  <Text style={styles.quickConfirmBtnText} numberOfLines={1}>
                    Thêm vào giỏ • {formatVND(quickEffectivePrice * quickQty)}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}

      {showShareModal ? (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          type="product"
          title={product.name}
          subtitle={`🧶 ${getCategoryLabel(product.category)} • Đặt làm theo mẫu`}
          priceText={formatVND(product.price)}
          url={`${PUBLIC_SHOP_URL}/product/${product.id}`}
          image={product.image}
          shareText={`🧶 ${product.name} (${formatVND(
            product.price
          )})\n✨ Đan móc thủ công tỉ mỉ theo mẫu tại Tiệm Cuộn Len, tặng kèm hộp quà & thiệp viết tay!`}
        />
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  cardWrapper: {
    marginBottom: GAP,
  },
  card: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8DACB',
    ...SHADOWS.small,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#F3ECE2',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: {
    fontSize: 42,
  },
  categoryTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(250, 246, 240, 0.94)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(216, 195, 173, 0.5)',
  },
  categoryTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  favButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  adminEditBadge: {
    backgroundColor: 'rgba(216, 195, 173, 0.96)',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  favButtonActive: {
    backgroundColor: '#FFF5F5',
  },
  info: {
    padding: 12,
    gap: 6,
  },
  infoMobile: {
    padding: 10,
    gap: 5,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    lineHeight: 19,
    minHeight: 38,
  },
  nameMobile: {
    fontSize: 13,
    lineHeight: 17.5,
    minHeight: 35,
  },
  variantsPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 1,
  },
  colorDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  colorDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(61, 43, 31, 0.25)',
  },
  moreVariantsText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  accessoryCountBadge: {
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    maxWidth: '58%',
  },
  accessoryCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#5C4332',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FDF6EA',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
  },
  ratingStar: {
    fontSize: 11,
    color: COLORS.starYellow,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.warmBrown,
  },
  stockText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.lightText,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3D2B1F',
    flexShrink: 1,
  },
  priceCarousel: {
    fontSize: 14.5,
  },
  priceMobile: {
    fontSize: 14,
  },
  cardActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  pingCardBtn: {
    width: 29,
    height: 29,
    borderRadius: 9,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingCardBtnMobile: {
    width: 28,
    height: 28,
    borderRadius: 9,
  },
  quickAddBtn: {
    minWidth: 29,
    height: 29,
    borderRadius: 9,
    backgroundColor: '#D8C3AD',
    borderWidth: 1,
    borderColor: '#C5AC92',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 8,
  },
  quickAddBtnMobile: {
    minWidth: 28,
    width: 28,
    height: 28,
    borderRadius: 9,
    paddingHorizontal: 0,
  },
  quickAddBtnDesktop: {
    paddingHorizontal: 9,
    borderRadius: 10,
  },
  quickAddBtnAdded: {
    backgroundColor: '#DCEBD6',
    borderColor: '#A3C896',
  },
  quickAddText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  quickModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 30, 21, 0.32)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 24,
  },
  quickModalOverlayMobile: {
    alignItems: 'center',
    padding: 12,
  },
  quickModalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '84%',
    backgroundColor: '#FFFDF9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    padding: 16,
    gap: 12,
    ...SHADOWS.large,
  },
  quickModalCardMobile: {
    maxWidth: 420,
    borderRadius: 20,
    padding: 14,
  },
  quickModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  quickModalThumbWrap: {
    width: 62,
    height: 62,
    borderRadius: 14,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickModalThumb: {
    width: '100%',
    height: '100%',
  },
  quickModalHeaderInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  quickModalTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#2C1E14',
    lineHeight: 19,
  },
  quickModalPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickModalPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primary,
  },
  quickModalPriceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#7A5A40',
  },
  quickModalDetailLink: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5239',
    marginTop: 1,
  },
  quickModalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickModalBody: {
    maxHeight: 260,
  },
  quickOptionGroup: {
    marginBottom: 12,
    gap: 7,
  },
  quickOptionLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  quickOptionValue: {
    fontWeight: '800',
    color: '#2C1E14',
  },
  quickPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F6F1E9',
    borderWidth: 1,
    borderColor: '#E2D4C3',
  },
  quickPillSelected: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  quickPillDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  quickPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  quickPillTextSelected: {
    color: '#FFFDF9',
  },
  quickModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE6DA',
  },
  quickQtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F6F1E9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2D4C3',
    height: 40,
    paddingHorizontal: 4,
  },
  quickQtyBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickQtyText: {
    minWidth: 22,
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  quickConfirmBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#3D2B1F',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  quickConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
});
