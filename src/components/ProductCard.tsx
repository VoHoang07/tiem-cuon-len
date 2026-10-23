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
import { Heart, Plus, Check } from 'lucide-react-native';
import { Product } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
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
  const { toggleFavorite, isFavorite, addToCart } = useShop();
  const { width: windowWidth } = useWindowDimensions();
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
              source={{ uri: product.image }}
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

          {/* Favorite Heart Button */}
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
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingText}>{product.rating}</Text>
            </View>
            {product.quantity > 0 && (
              <Text style={styles.stockText}>Còn {product.quantity}</Text>
            )}
          </View>

          <View style={styles.priceRow}>
            <Text style={[styles.price, !isDesktop && styles.priceMobile]}>
              {formatVND(product.price)}
            </Text>
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
