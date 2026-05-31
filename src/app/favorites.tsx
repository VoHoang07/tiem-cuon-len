import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ShoppingBag } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/SectionHeader';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING } from '@/constants/theme';
import {
  FAV_TITLE,
  FAV_EMPTY_TITLE,
  FAV_EMPTY_SUBTEXT,
  FAV_BROWSE,
  FAV_SAVED_ITEMS,
} from '@/constants/strings';

export default function FavoritesScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { products, favorites, refetchCartFavorites } = useShop();

  if (role === 'admin') {
    router.replace('/');
    return null;
  }

  // Refetch cart/favorites when screen regains focus
  useFocusEffect(
    useCallback(() => {
      refetchCartFavorites();
    }, [refetchCartFavorites])
  );
  const [refreshing, setRefreshing] = useState(false);

  const favoriteProducts = products.filter((p) => favorites.includes(p.id));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchCartFavorites();
    setRefreshing(false);
  }, [refetchCartFavorites]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{FAV_TITLE}</Text>
          <Heart size={28} color={COLORS.primary} fill={COLORS.primary} />
        </View>

        {favoriteProducts.length === 0 ? (
          <View style={styles.empty}>
            <Heart size={64} color={COLORS.lightText} />
            <Text style={styles.emptyTitle}>{FAV_EMPTY_TITLE}</Text>
            <Text style={styles.emptySubtext}>
              {FAV_EMPTY_SUBTEXT}
            </Text>
            <TouchableOpacity
              style={styles.browseBtn}
              onPress={() => router.push('/')}>
              <ShoppingBag size={18} color={COLORS.white} />
              <Text style={styles.browseBtnText}>{FAV_BROWSE}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <SectionHeader title={`${favoriteProducts.length} ${FAV_SAVED_ITEMS}`} />
            <View style={styles.grid}>
              {favoriteProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={(p) => router.push(`/product/${p.id}`)}
                />
              ))}
            </View>
          </>
        )}
        <View style={{ height: 100 }} />
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
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  empty: {
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
  browseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  browseBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
  },
});
