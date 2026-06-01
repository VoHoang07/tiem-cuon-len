import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ShoppingBag } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { ProductCard } from '@/components/ProductCard';
import { COLORS, SPACING } from '@/constants/theme';
import { BOTTOM_NAV_SPACER } from '@/constants/layout';
import {
  FAV_TITLE,
  FAV_EMPTY_TITLE,
  FAV_EMPTY_SUBTEXT,
  FAV_BROWSE,
  FAV_SAVED_ITEMS,
} from '@/constants/strings';
import { Product } from '@/types/product';

export default function FavoritesScreen() {
  const router = useRouter();
  const { products, favorites, refetchCartFavorites } = useShop();

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

  const renderItem = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      onPress={(p) => router.push(`/product/${p.id}`)}
    />
  );

  const ListHeader = (
    <View>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{FAV_TITLE}</Text>
        <Heart size={28} color={COLORS.primary} fill={COLORS.primary} />
      </View>
      {favoriteProducts.length > 0 && (
        <Text style={styles.countLabel}>
          {favoriteProducts.length} {FAV_SAVED_ITEMS}
        </Text>
      )}
    </View>
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <Heart size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>{FAV_EMPTY_TITLE}</Text>
      <Text style={styles.emptySubtext}>{FAV_EMPTY_SUBTEXT}</Text>
      <TouchableOpacity
        style={styles.browseBtn}
        onPress={() => router.push('/')}>
        <ShoppingBag size={18} color={COLORS.white} />
        <Text style={styles.browseBtnText}>{FAV_BROWSE}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={favoriteProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        numColumns={2}
        ListHeaderComponent={favoriteProducts.length === 0 ? null : ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={favoriteProducts.length === 0 ? styles.listEmpty : styles.listContent}
        columnWrapperStyle={favoriteProducts.length > 0 ? styles.columnWrapper : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  listContent: {
    paddingBottom: BOTTOM_NAV_SPACER,
  },
  listEmpty: {
    flexGrow: 1,
  },
  columnWrapper: {
    paddingHorizontal: SPACING.lg,
    gap: 10,
    marginBottom: SPACING.sm,
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
  countLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.mediumText,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
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
});
