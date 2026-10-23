import React, { useRef } from 'react';
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
import { Heart, Plus } from 'lucide-react-native';
import { Product } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji } from '@/utils/getCategoryEmoji';

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

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(1)).current;

  const containerWidth = Math.min(windowWidth, MAX_CONTAINER_WIDTH);
  const availableWidth = containerWidth - SPACING.lg * 2 - GAP * (numColumns - 1);
  const gridCardWidth = Math.floor(availableWidth / numColumns);

  const cardWidth =
    variant === 'carousel'
      ? windowWidth >= 768
        ? 230
        : 185
      : gridCardWidth;

  const imageHeight =
    variant === 'carousel'
      ? Math.round(cardWidth * 0.98)
      : Math.min(Math.round(cardWidth * 0.98), 240);

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
              {getCategoryEmoji(product.category)} {product.category}
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
            <Text style={styles.price}>{formatVND(product.price)}</Text>
            <TouchableOpacity
              style={styles.quickAddBtn}
              onPress={handleQuickAdd}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Plus size={16} color={COLORS.white} strokeWidth={2.5} />
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
    backgroundColor: COLORS.white,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.08)',
    ...SHADOWS.small,
  },
  imageContainer: {
    position: 'relative',
    backgroundColor: '#F6EFEA',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    backgroundColor: COLORS.lightPurple,
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
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  quickAddBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
