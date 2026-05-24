import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Heart } from 'lucide-react-native';
import { Product } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { formatVND } from '@/utils/formatCurrency';

const { width } = Dimensions.get('window');
const GAP = 10;
const CARD_WIDTH = (width - SPACING.lg * 2 - GAP) / 2;

interface ProductCardProps {
  product: Product;
  onPress: (product: Product) => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const { toggleFavorite, isFavorite } = useShop();
  const fav = isFavorite(product.id);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(product)}
      activeOpacity={0.95}>
      <View style={styles.imageContainer}>
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            style={styles.productImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageEmoji}>
              {product.category === 'Bags'
                ? '👜'
                : product.category === 'Dolls'
                  ? '🧸'
                  : product.category === 'Accessories'
                    ? '🧣'
                    : '🧶'}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.favButton}
          onPress={() => toggleFavorite(product.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Heart
            size={16}
            color={fav ? COLORS.primary : '#999'}
            fill={fav ? COLORS.primary : 'transparent'}
          />
        </TouchableOpacity>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatVND(product.price)}</Text>
          <View style={styles.ratingBadge}>
            <Text style={styles.ratingText}>★ {product.rating}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    marginBottom: GAP,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  imageContainer: {
    position: 'relative',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: CARD_WIDTH * 1.05,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  imagePlaceholder: {
    width: '100%',
    height: CARD_WIDTH * 1.05,
    backgroundColor: COLORS.lightPurple,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: {
    fontSize: 38,
  },
  favButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 10,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    padding: 10,
  },
  name: {
    fontSize: 12.5,
    fontWeight: '600',
    color: COLORS.darkText,
    lineHeight: 16,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightPurple,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ratingText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.warmBrown,
  },
});
