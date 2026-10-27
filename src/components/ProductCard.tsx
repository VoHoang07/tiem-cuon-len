import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Plus, Check, Edit3, MessageCircle } from 'lucide-react-native';
import { Product } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';

const GAP = 14;
const MAX_CONTAINER_WIDTH = 1120;

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
  variant?: 'grid' | 'carousel';
  numColumns?: number;
}

export function ProductCard({
  product,
  onPress,
  variant = 'grid',
  numColumns = 2,
}: ProductCardProps) {
  const router = useRouter();
  const { toggleFavorite, isFavorite, addToCart } = useShop();
  const { role } = useAuth();
  const { openChatWithProduct } = useChat();
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
        ? 236
        : 176
      : gridCardWidth;

  const imageHeight =
    variant === 'carousel'
      ? Math.round(cardWidth * 0.92)
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

  const handleFavoritePress = () => {
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

  const handleQuickAdd = () => {
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 950);
  };

  const handleAdminEdit = () => {
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
            <Image
              source={
                typeof product.image === 'string'
                  ? { uri: product.image }
                  : (product.image as any)
              }
              style={[styles.productImage, { height: imageHeight }]}
              resizeMode="cover"
            />
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

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
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
              {product.quantity > 0 ? `Kho: ${product.quantity}` : 'Hết hàng'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, !isDesktop && styles.priceMobile]}>
              {formatVND(product.price)}
            </Text>
            <View style={styles.cardActionBtnsRow}>
              <TouchableOpacity
                style={styles.pingCardBtn}
                onPress={() => openChatWithProduct(product)}
                activeOpacity={0.75}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <MessageCircle size={14} color="#3D2B1F" strokeWidth={2.3} />
              </TouchableOpacity>
              {isAdmin ? (
                <TouchableOpacity
                  style={[styles.quickAddBtn, isDesktop && styles.quickAddBtnDesktop]}
                  onPress={handleAdminEdit}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Edit3 size={14} color="#3D2B1F" strokeWidth={2.5} />
                  {isDesktop && <Text style={styles.quickAddText}>Sửa</Text>}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.quickAddBtn,
                    isDesktop && styles.quickAddBtnDesktop,
                    justAdded && styles.quickAddBtnAdded,
                  ]}
                  onPress={handleQuickAdd}
                  activeOpacity={0.75}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  {justAdded ? (
                    <Check size={15} color="#3D2B1F" strokeWidth={2.8} />
                  ) : (
                    <Plus size={15} color="#3D2B1F" strokeWidth={2.6} />
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
    </Animated.View>
  );
}

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
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    lineHeight: 19,
    minHeight: 38,
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
  },
  price: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  priceMobile: {
    fontSize: 14.5,
  },
  cardActionBtnsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pingCardBtn: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAddBtn: {
    minWidth: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: '#D8C3AD',
    borderWidth: 1,
    borderColor: '#C5AC92',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  quickAddBtnDesktop: {
    paddingHorizontal: 11,
    borderRadius: 12,
  },
  quickAddBtnAdded: {
    backgroundColor: '#DCEBD6',
    borderColor: '#A3C896',
  },
  quickAddText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
});
