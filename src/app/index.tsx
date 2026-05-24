import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { ProductCard } from '@/components/ProductCard';
import { CategoryChips } from '@/components/CategoryChips';
import { SectionHeader } from '@/components/SectionHeader';
import { BottomNav } from '@/components/BottomNav';
import { useDebounce } from '@/hooks/useDebounce';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { Product, Category } from '@/types/product';
import { CATEGORIES } from '@/constants/theme';
import {
  HOME_WELCOME,
  HOME_SEARCH_PLACEHOLDER,
  HOME_FEATURED,
  HOME_TRENDING,
  HOME_ALL_PRODUCTS,
  HOME_EMPTY_TITLE,
  HOME_EMPTY_SUBTEXT,
} from '@/constants/strings';
import { BrandLogo } from '@/components/BrandLogo';
import { HomeSkeleton } from '@/components/Skeleton';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { products, isLoading } = useShop();
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [searchInput, setSearchInput] = useState('');
  const search = useDebounce(searchInput, 300);
  const [refreshing, setRefreshing] = useState(false);

  const filteredProducts = useMemo(() => {
    let filtered = products;
    if (selectedCategory !== 'All') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.tags.some((t) => t.includes(q))
      );
    }
    return filtered;
  }, [products, selectedCategory, search]);

  const featuredProducts = useMemo(
    () => products.filter((p) => p.rating >= 4.8).slice(0, 4),
    [products]
  );

  const trendingProducts = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 4),
    [products]
  );

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{HOME_WELCOME}</Text>
            <BrandLogo
              size="md"
              centered={false}
              onPress={() => router.replace('/')}
            />
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/profile')}
            activeOpacity={0.7}
            hitSlop={8}>
            <Text style={styles.avatarText}>CL</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.lightText} />
          <TextInput
            style={styles.searchInput}
            placeholder={HOME_SEARCH_PLACEHOLDER}
            placeholderTextColor={COLORS.lightText}
            value={searchInput}
            onChangeText={setSearchInput}
          />
        </View>

        {/* Category Chips */}
        <CategoryChips
          categories={[...CATEGORIES]}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Featured Products */}
        {!search && selectedCategory === 'All' && (
          <>
            <SectionHeader title={HOME_FEATURED} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}>
              {featuredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={(p) => router.push(`/product/${p.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* Trending */}
        {!search && selectedCategory === 'All' && (
          <>
            <SectionHeader title={HOME_TRENDING} />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredRow}>
              {trendingProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onPress={(p) => router.push(`/product/${p.id}`)}
                />
              ))}
            </ScrollView>
          </>
        )}

        {/* All Products Grid */}
        <SectionHeader
          title={
            selectedCategory === 'All' ? HOME_ALL_PRODUCTS : selectedCategory
          }
        />
        <View style={styles.grid}>
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onPress={(p) => router.push(`/product/${p.id}`)}
            />
          ))}
        </View>

        {filteredProducts.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🧶</Text>
            <Text style={styles.emptyText}>{HOME_EMPTY_TITLE}</Text>
            <Text style={styles.emptySubtext}>
              {HOME_EMPTY_SUBTEXT}
            </Text>
          </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  greeting: {
    fontSize: 13,
    color: COLORS.mediumText,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkText,
  },
  featuredRow: {
    paddingHorizontal: SPACING.lg,
    gap: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.lg,
    justifyContent: 'space-between',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: SPACING.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.lightText,
    marginTop: SPACING.xs,
  },
});
