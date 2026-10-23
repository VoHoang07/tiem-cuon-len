import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  ShoppingCart,
  Sparkles,
  User as UserIcon,
  X,
  Gift,
  HeartHandshake,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { ProductCard } from '@/components/ProductCard';
import { CategoryChips } from '@/components/CategoryChips';
import { SectionHeader } from '@/components/SectionHeader';
import { useDebounce } from '@/hooks/useDebounce';
import { BOTTOM_NAV_SPACER } from '@/constants/layout';
import { COLORS, SPACING, SHADOWS, CATEGORIES } from '@/constants/theme';
import { Product, Category } from '@/types/product';
import {
  HOME_WELCOME,
  HOME_SEARCH_PLACEHOLDER,
  HOME_FEATURED,
  HOME_TRENDING,
  HOME_ALL_PRODUCTS,
  HOME_EMPTY_TITLE,
  HOME_EMPTY_SUBTEXT,
} from '@/constants/strings';
import { BrandTitle, BrandAvatar } from '@/components/BrandTitle';
import { HomeSkeleton } from '@/components/Skeleton';
import PushpinTearFooter from '@/components/ui/pushpin-tear-footer';
import { getCategoryLabel } from '@/utils/getCategoryEmoji';

const GAP = 14;
const MAX_CONTAINER_WIDTH = 1120;

export default function HomeScreen() {
  const router = useRouter();
  const {
    products,
    isLoading,
    refetchCartFavorites,
    hasMore,
    loadMore,
    cartCount,
  } = useShop();
  const { user, isAuthenticated } = useAuth();
  const { width: windowWidth } = useWindowDimensions();

  const numColumns = windowWidth >= 960 ? 4 : windowWidth >= 640 ? 3 : 2;

  useFocusEffect(
    useCallback(() => {
      refetchCartFavorites();
    }, [refetchCartFavorites])
  );

  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
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
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    return filtered;
  }, [products, selectedCategory, search]);

  const featuredProducts = useMemo(
    () => products.filter((p) => p.rating >= 4.8).slice(0, 6),
    [products]
  );

  const trendingProducts = useMemo(
    () => [...products].sort((a, b) => b.rating - a.rating).slice(0, 6),
    [products]
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchCartFavorites();
    setRefreshing(false);
  }, [refetchCartFavorites]);

  const handleEndReached = useCallback(() => {
    if (!hasMore || isLoading) return;
    loadMore();
  }, [hasMore, isLoading, loadMore]);

  const renderProductItem = ({ item }: { item: Product }) => (
    <ProductCard
      product={item}
      variant="grid"
      numColumns={numColumns}
      onPress={(p) => router.push(`/product/${p.id}`)}
    />
  );

  const showFeaturedAndTrending = !search && selectedCategory === 'All';

  const ListHeader = (
    <View style={styles.constrainedContent}>
      {/* Top Navbar */}
      <View style={styles.header}>
        <View style={styles.brandBlock}>
          <Text style={styles.greeting}>{HOME_WELCOME}</Text>
          <BrandTitle />
        </View>

        <View style={styles.headerActions}>
          {/* Quick Cart Button */}
          <TouchableOpacity
            style={styles.cartIconBtn}
            onPress={() => router.push('/cart')}
            activeOpacity={0.75}>
            <ShoppingCart size={20} color={COLORS.darkText} />
            {cartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {cartCount > 99 ? '99+' : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Login or Profile Button */}
          {isAuthenticated ? (
            <TouchableOpacity
              style={styles.userPill}
              onPress={() => router.push('/profile')}
              activeOpacity={0.8}>
              <BrandAvatar size={34} />
              {windowWidth >= 480 && (
                <Text style={styles.userPillName} numberOfLines={1}>
                  {user?.name || 'Tài khoản'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.loginPillBtn}
              onPress={() => router.push('/login')}
              activeOpacity={0.8}>
              <UserIcon size={15} color="#3D2B1F" />
              <Text style={styles.loginPillText}>Đăng nhập</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hero Banner */}
      {showFeaturedAndTrending && (
        <View style={styles.heroBanner}>
          <View style={styles.heroContent}>
            <View style={styles.heroBadge}>
              <Sparkles size={13} color={COLORS.primary} />
              <Text style={styles.heroBadgeText}>BỘ SƯU TẬP THỦ CÔNG MỚI</Text>
            </View>
            <Text style={styles.heroTitle}>
              Đan từng mũi ấm áp,{'\n'}gửi trọn yêu thương 🧶
            </Text>
            <Text style={styles.heroSubtitle}>
              Móc khoá, hoa len, túi xách & quà tặng đan móc thủ công tỉ mỉ từ sợi len cotton cao cấp.
            </Text>
            <View style={styles.heroPillsRow}>
              <View style={styles.heroFeaturePill}>
                <HeartHandshake size={13} color={COLORS.primary} />
                <Text style={styles.heroFeatureText}>100% Thủ công</Text>
              </View>
              <View style={styles.heroFeaturePill}>
                <Gift size={13} color={COLORS.primary} />
                <Text style={styles.heroFeatureText}>Quà tặng xinh xắn</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroVisual}>
            <View style={styles.heroCircleOuter}>
              <View style={styles.heroCircleInner}>
                <Text style={styles.heroMainEmoji}>🧸</Text>
              </View>
              <View style={styles.heroFloatTagTop}>
                <Text style={styles.heroFloatEmoji}>🌷</Text>
              </View>
              <View style={styles.heroFloatTagBottom}>
                <Text style={styles.heroFloatEmoji}>🍒</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Search Bar */}
      <View
        style={[
          styles.searchContainer,
          searchFocused && styles.searchContainerFocused,
        ]}>
        <View style={styles.searchIconBadge}>
          <Search
            size={18}
            color={searchFocused ? COLORS.primary : COLORS.lightText}
          />
        </View>
        <TextInput
          style={styles.searchInput}
          placeholder={HOME_SEARCH_PLACEHOLDER}
          placeholderTextColor={COLORS.lightText}
          value={searchInput}
          onChangeText={setSearchInput}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        />
        {searchInput.length > 0 && (
          <TouchableOpacity
            style={styles.clearSearchBtn}
            onPress={() => setSearchInput('')}>
            <X size={16} color={COLORS.mediumText} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Chips */}
      <CategoryChips
        categories={[...CATEGORIES]}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      {/* Featured Products */}
      {showFeaturedAndTrending && featuredProducts.length > 0 && (
        <View>
          <SectionHeader
            title={HOME_FEATURED}
            subtitle="Được khách hàng yêu thích & đánh giá cao nhất"
          />
          <FlatList
            horizontal
            data={featuredProducts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                variant="carousel"
                onPress={(p) => router.push(`/product/${p.id}`)}
              />
            )}
          />
        </View>
      )}

      {/* Trending */}
      {showFeaturedAndTrending && trendingProducts.length > 0 && (
        <View>
          <SectionHeader
            title={HOME_TRENDING}
            subtitle="Mẫu móc len handmade đang hot tuần này"
          />
          <FlatList
            horizontal
            data={trendingProducts}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
            renderItem={({ item }) => (
              <ProductCard
                product={item}
                variant="carousel"
                onPress={(p) => router.push(`/product/${p.id}`)}
              />
            )}
          />
        </View>
      )}

      {/* All Products Section Header */}
      <SectionHeader
        title={selectedCategory === 'All' ? HOME_ALL_PRODUCTS : getCategoryLabel(selectedCategory)}
        subtitle={`${filteredProducts.length} sản phẩm hiện có`}
      />
    </View>
  );

  const ListEmpty = (
    <View style={[styles.constrainedContent, styles.empty]}>
      <Text style={styles.emptyEmoji}>🧶</Text>
      <Text style={styles.emptyText}>{HOME_EMPTY_TITLE}</Text>
      <Text style={styles.emptySubtext}>{HOME_EMPTY_SUBTEXT}</Text>
    </View>
  );

  const ListFooter = (
    <View style={styles.footerOuter}>
      {hasMore && filteredProducts.length > 0 && (
        <View style={styles.constrainedContent}>
          <TouchableOpacity style={styles.loadMoreBtn} onPress={handleEndReached}>
            <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.tearFooterWrapper}>
        <PushpinTearFooter
          brand="Tiệm Cuộn Len."
          name="len thủ công việt nam"
          logoHref="/"
          sheet="#D8C3AD"
          paper="#FAF5EE"
          sheetInk="#3D2B1F"
          paperInk="#4A3525"
          seed={23}
          email="lienhe@tiemcuonlen.vn"
          newsletter={{
            label: "Nhận thông báo mẫu len thủ công mới mỗi tuần",
            placeholder: "nhập email của bạn...",
          }}
          status={{
            label: "Đang nhận đặt đan móc mẫu len theo yêu cầu",
            href: "/",
          }}
          mark="TCL / 2026"
          timeZone="Asia/Ho_Chi_Minh"
          timeLabel="VN"
          socials={[
            { icon: "ig", label: "Instagram", href: "https://instagram.com" },
            { icon: "chat", label: "Trợ giúp", href: "/help" },
          ]}
          columns={[
            {
              title: "cửa tiệm",
              links: [
                { label: "Móc len thủ công", href: "/" },
                { label: "Túi xách & Ví len", href: "/" },
                { label: "Thú bông & Búp bê", href: "/" },
              ],
              cta: { label: "mua sắm.", href: "/" },
            },
            {
              title: "khách hàng",
              links: [
                { label: "Giỏ hàng của bạn", href: "/cart" },
                { label: "Sản phẩm yêu thích", href: "/favorites" },
                { label: "Tra cứu đơn hàng", href: "/orders" },
              ],
              cta: { label: "liên hệ.", href: "mailto:lienhe@tiemcuonlen.vn" },
            },
          ]}
          sideLinks={[
            { icon: "shield", label: "bảo mật", href: "/privacy" },
            { icon: "doc", label: "trợ giúp", href: "/help" },
          ]}
          chat={{ label: "tư vấn ngay", href: "/help" }}
          copyright="© 2026 Tiệm Cuộn Len"
          credit="đan móc thủ công bằng cả trái tim"
          handle={{ label: "@tiemcuonlen", href: "/" }}
        />
      </View>
      <View style={{ height: BOTTOM_NAV_SPACER }} />
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={[styles.scroll, styles.constrainedContent]}>
          <HomeSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        key={`grid-${numColumns}`}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        numColumns={numColumns}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        columnWrapperStyle={
          filteredProducts.length > 0 ? styles.columnWrapper : undefined
        }
        contentContainerStyle={
          filteredProducts.length === 0 ? styles.listContent : undefined
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
      />
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
  constrainedContent: {
    width: '100%',
    maxWidth: MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
  },
  listContent: {
    flexGrow: 1,
  },
  columnWrapper: {
    width: '100%',
    maxWidth: MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    gap: GAP,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  brandBlock: {
    flex: 1,
  },
  greeting: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.12)',
    ...SHADOWS.small,
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.white,
    padding: 4,
    paddingRight: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.12)',
    ...SHADOWS.small,
  },
  userPillName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
    maxWidth: 110,
  },
  loginPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#C4AA90',
    ...SHADOWS.small,
  },
  loginPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D8C3AD',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    borderRadius: 24,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#C9B199',
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  heroContent: {
    flex: 1,
    paddingRight: SPACING.md,
    gap: 8,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6D7C5',
  },
  heroBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#5C4332',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3D2B1F',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#5C4332',
    lineHeight: 18,
  },
  heroPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  heroFeaturePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6D7C5',
  },
  heroFeatureText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  heroVisual: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCircleOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(250, 245, 238, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  heroCircleInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  heroMainEmoji: {
    fontSize: 36,
  },
  heroFloatTagTop: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  heroFloatTagBottom: {
    position: 'absolute',
    bottom: -2,
    left: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  heroFloatEmoji: {
    fontSize: 14,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(118, 83, 65, 0.12)',
    ...SHADOWS.small,
  },
  searchContainerFocused: {
    borderColor: COLORS.primary,
  },
  searchIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14.5,
    color: COLORS.darkText,
    paddingVertical: 8,
  },
  clearSearchBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredRow: {
    paddingHorizontal: SPACING.lg,
    gap: GAP,
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
  loadMoreBtn: {
    backgroundColor: '#F3ECE2',
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    marginBottom: SPACING.xl,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  footerOuter: {
    width: '100%',
    marginTop: SPACING.xl,
  },
  tearFooterWrapper: {
    width: '100%',
    maxWidth: MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 28,
    overflow: 'hidden',
  },
});
