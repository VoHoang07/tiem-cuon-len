import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Search,
  ShoppingCart,
  Heart,
  Sparkles,
  User as UserIcon,
  X,
  Gift,
  HeartHandshake,
  Truck,
  SlidersHorizontal,
  Package,
  ShoppingBag,
  PlusCircle,
  CreditCard,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
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
  HOME_ALL_PRODUCTS,
  HOME_EMPTY_TITLE,
  HOME_EMPTY_SUBTEXT,
} from '@/constants/strings';
import { BrandTitle, BrandAvatar } from '@/components/BrandTitle';
import { HomeSkeleton } from '@/components/Skeleton';
import { BoutiqueFooter } from '@/components/BoutiqueFooter';
import { getCategoryLabel } from '@/utils/getCategoryEmoji';

const GAP = 14;
const MAX_CONTAINER_WIDTH = 1120;

type SortOption = 'popular' | 'price_asc' | 'price_desc' | 'rating';

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'popular', label: 'Phổ biến' },
  { key: 'price_asc', label: 'Giá thấp → cao' },
  { key: 'price_desc', label: 'Giá cao → thấp' },
  { key: 'rating', label: 'Đánh giá cao' },
];

export default function HomeScreen() {
  const router = useRouter();
  const {
    products,
    isLoading,
    refetchCartFavorites,
    hasMore,
    loadMore,
    cartCount,
    favorites,
  } = useShop();
  const { user, role, isAuthenticated } = useAuth();
  const { orders } = useOrders();
  const isAdmin = role === 'admin';
  const pendingOrdersCount = useMemo(
    () => orders.filter((o) => o.status === 'Đang xử lý').length,
    [orders]
  );
  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;

  const isDesktop = windowWidth >= 768;
  const isMobile = windowWidth < 640;
  const numColumns = windowWidth >= 960 ? 4 : windowWidth >= 640 ? 3 : 2;

  const hasFocusedOnce = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      refetchCartFavorites();
    }, [refetchCartFavorites])
  );

  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [sortBy, setSortBy] = useState<SortOption>('popular');
  const [searchInput, setSearchInput] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const search = useDebounce(searchInput, 300);
  const [refreshing, setRefreshing] = useState(false);

  // Deduplicate products by normalized name so identical DB entries don't repeat
  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      const key = p.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    let list = [...uniqueProducts];
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'price_asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      list.sort((a, b) => b.rating - a.rating);
    }
    return list;
  }, [uniqueProducts, selectedCategory, search, sortBy]);

  const featuredProducts = useMemo(
    () =>
      [...uniqueProducts]
        .filter((p) => p.rating >= 4.8)
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 5),
    [uniqueProducts]
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

  const showHeroAndFeatured = !search && selectedCategory === 'All';

  const SearchBarBlock = (
    <View
      style={[
        styles.searchContainer,
        isDesktop ? styles.searchContainerDesktop : styles.searchContainerMobile,
        searchFocused && styles.searchContainerFocused,
      ]}>
      <View style={styles.searchIconBadge}>
        <Search
          size={17}
          color={searchFocused ? COLORS.darkText : COLORS.mediumText}
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
          <X size={15} color={COLORS.mediumText} />
        </TouchableOpacity>
      )}
    </View>
  );

  const containerMaxWidth = Math.min(windowWidth, MAX_CONTAINER_WIDTH);

  const ListHeader = (
    <View style={[styles.constrainedContent, { width: containerMaxWidth, maxWidth: containerMaxWidth }]}>
      {/* Unified Top Navbar (Desktop has inline Search Bar; Mobile stacks Search Bar cleanly below) */}
      <View style={[styles.headerCard, isMobile && styles.headerCardMobile]}>
        <View style={styles.headerTopRow}>
          <View style={[styles.brandBlock, isMobile && styles.brandBlockMobile]}>
            <Text style={styles.greeting}>{HOME_WELCOME}</Text>
            <BrandTitle />
          </View>

          {isDesktop && SearchBarBlock}

          <View style={styles.headerActions}>
            {isAdmin ? (
              <>
                {/* Admin: Add Product Quick Button */}
                <TouchableOpacity
                  style={[styles.loginPillBtn, isMobile && styles.loginPillBtnMobile]}
                  onPress={() => router.push('/add-product')}
                  activeOpacity={0.8}>
                  <PlusCircle size={15} color="#3D2B1F" />
                  <Text style={[styles.loginPillText, isMobile && styles.loginPillTextMobile]}>
                    {isMobile ? 'Thêm' : '+ Thêm SP'}
                  </Text>
                </TouchableOpacity>

                {/* Admin: Manage Products Inventory Button */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, isMobile && styles.iconActionBtnMobile]}
                  onPress={() => router.push('/manage-products')}
                  activeOpacity={0.75}>
                  <Package size={isMobile ? 17 : 19} color={COLORS.darkText} />
                </TouchableOpacity>

                {/* Admin: Orders Button with Pending Badge */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, isMobile && styles.iconActionBtnMobile]}
                  onPress={() => router.push('/orders')}
                  activeOpacity={0.75}>
                  <ShoppingBag size={isMobile ? 17 : 19} color={COLORS.darkText} />
                  {pendingOrdersCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {pendingOrdersCount > 99 ? '99+' : pendingOrdersCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Client: Quick Favorites Button */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, isMobile && styles.iconActionBtnMobile]}
                  onPress={() => router.push('/favorites')}
                  activeOpacity={0.75}>
                  <Heart size={isMobile ? 17 : 19} color={COLORS.darkText} />
                  {favorites.length > 0 && (
                    <View style={[styles.badge, styles.favBadge]}>
                      <Text style={styles.badgeText}>
                        {favorites.length > 99 ? '99+' : favorites.length}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Client: Quick Cart Button */}
                <TouchableOpacity
                  style={[styles.iconActionBtn, isMobile && styles.iconActionBtnMobile]}
                  onPress={() => router.push('/cart')}
                  activeOpacity={0.75}>
                  <ShoppingCart size={isMobile ? 17 : 19} color={COLORS.darkText} />
                  {cartCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {cartCount > 99 ? '99+' : cartCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Login or Profile Button */}
            {isAuthenticated ? (
              <TouchableOpacity
                style={styles.userPill}
                onPress={() => router.push('/profile')}
                activeOpacity={0.8}>
                <BrandAvatar size={32} />
                {!isMobile && (
                  <Text style={styles.userPillName} numberOfLines={1}>
                    {isAdmin ? `Quản trị • ${user?.name || 'Admin'}` : user?.name || 'Tài khoản'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.loginPillBtn, isMobile && styles.loginPillBtnMobile]}
                onPress={() => router.push('/login')}
                activeOpacity={0.8}>
                <UserIcon size={14} color="#3D2B1F" />
                <Text style={[styles.loginPillText, isMobile && styles.loginPillTextMobile]}>
                  Đăng nhập
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!isDesktop && <View style={styles.mobileSearchWrap}>{SearchBarBlock}</View>}
      </View>

      {/* Hero Banner & Service Strip */}
      {showHeroAndFeatured && (
        <View style={[styles.heroSection, isMobile && styles.heroSectionMobile]}>
          <View style={[styles.heroBanner, isMobile && styles.heroBannerMobile]}>
            <View style={styles.heroContent}>
              <View style={styles.heroBadge}>
                <Sparkles size={12} color={COLORS.primary} />
                <Text style={styles.heroBadgeText}>BỘ SƯU TẬP THỦ CÔNG MỚI</Text>
              </View>
              <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
                Đan từng mũi ấm áp,{'\n'}gửi trọn yêu thương 🧶
              </Text>
              <Text style={[styles.heroSubtitle, isMobile && styles.heroSubtitleMobile]}>
                Móc khoá, hoa len, túi xách & quà tặng đan móc tỉ mỉ từ sợi len cotton cao cấp.
              </Text>
              <View style={styles.heroPillsRow}>
                <View style={styles.heroFeaturePill}>
                  <HeartHandshake size={13} color={COLORS.primary} />
                  <Text style={styles.heroFeatureText}>100% Thủ công</Text>
                </View>
                <View style={styles.heroFeaturePill}>
                  <Gift size={13} color={COLORS.primary} />
                  <Text style={styles.heroFeatureText}>Gói quà miễn phí</Text>
                </View>
              </View>
            </View>

            <View style={styles.heroVisual}>
              <View style={[styles.heroCircleOuter, isMobile && styles.heroCircleOuterMobile]}>
                <View style={[styles.heroCircleInner, isMobile && styles.heroCircleInnerMobile]}>
                  <Text style={[styles.heroMainEmoji, isMobile && styles.heroMainEmojiMobile]}>
                    🧸
                  </Text>
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

          {/* Role-Adaptive Bar: Admin gets Quick Management Bar; Client gets Service Highlights Bar */}
          {isAdmin ? (
            <View style={[styles.trustBar, isMobile && styles.trustBarMobile]}>
              <TouchableOpacity
                style={[styles.trustItem, isMobile && styles.trustItemMobile]}
                onPress={() => router.push('/manage-products')}
                activeOpacity={0.75}>
                <View style={styles.trustIconWrap}>
                  <Package size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? `${uniqueProducts.length} Sản phẩm` : `Kho hàng (${uniqueProducts.length} SP)`}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>Bấm để quản lý & sửa giá</Text>}
                </View>
              </TouchableOpacity>
              <View style={styles.trustDivider} />
              <TouchableOpacity
                style={[styles.trustItem, isMobile && styles.trustItemMobile]}
                onPress={() => router.push('/orders')}
                activeOpacity={0.75}>
                <View style={styles.trustIconWrap}>
                  <ShoppingBag size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? `${orders.length} Đơn hàng` : `Đơn hàng (${pendingOrdersCount} chờ xử lý)`}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>Duyệt & cập nhật giao hàng</Text>}
                </View>
              </TouchableOpacity>
              <View style={styles.trustDivider} />
              <TouchableOpacity
                style={[styles.trustItem, isMobile && styles.trustItemMobile]}
                onPress={() => router.push('/payment-methods')}
                activeOpacity={0.75}>
                <View style={styles.trustIconWrap}>
                  <CreditCard size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? 'Cấu hình TT' : 'Cấu hình thanh toán'}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>Ngân hàng, QR, MoMo & COD</Text>}
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.trustBar, isMobile && styles.trustBarMobile]}>
              <View style={[styles.trustItem, isMobile && styles.trustItemMobile]}>
                <View style={styles.trustIconWrap}>
                  <Truck size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? 'Giao toàn quốc' : 'Giao hàng toàn quốc'}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>Đóng gói hộp quà cẩn thận</Text>}
                </View>
              </View>
              <View style={styles.trustDivider} />
              <View style={[styles.trustItem, isMobile && styles.trustItemMobile]}>
                <View style={styles.trustIconWrap}>
                  <HeartHandshake size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? 'Len cotton mịn' : 'Len cotton mềm mịn'}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>An toàn & bền màu theo năm tháng</Text>}
                </View>
              </View>
              <View style={styles.trustDivider} />
              <View style={[styles.trustItem, isMobile && styles.trustItemMobile]}>
                <View style={styles.trustIconWrap}>
                  <Gift size={15} color="#3D2B1F" />
                </View>
                <View style={styles.trustTextWrap}>
                  <Text style={[styles.trustTitle, isMobile && styles.trustTitleMobile]} numberOfLines={1}>
                    {isMobile ? 'Đặt theo mẫu' : 'Nhận đặt theo mẫu'}
                  </Text>
                  {!isMobile && <Text style={styles.trustSub}>Tùy chỉnh màu sắc & kích thước</Text>}
                </View>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Curated Featured Row (Single clean carousel, no duplicate second carousel) */}
      {showHeroAndFeatured && featuredProducts.length > 0 && (
        <View style={styles.featuredSection}>
          <SectionHeader
            title={HOME_FEATURED}
            subtitle="Những mẫu len thủ công được yêu thích nhất tại tiệm"
          />
          <FlatList
            horizontal
            data={featuredProducts}
            keyExtractor={(item) => `featured-${item.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[
              styles.featuredRow,
              isMobile && styles.featuredRowMobile,
            ]}
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

      {/* Main Catalog Filter & Sort Toolbar */}
      <View style={styles.catalogToolbar}>
        <SectionHeader
          title={selectedCategory === 'All' ? HOME_ALL_PRODUCTS : getCategoryLabel(selectedCategory)}
          subtitle={`${filteredProducts.length} sản phẩm sẵn sàng giao ngay`}
        />

        {/* Category Filter Chips */}
        <CategoryChips
          categories={[...CATEGORIES]}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />

        {/* Quick Sort Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.sortRow, isMobile && styles.sortRowMobile]}>
          <View style={styles.sortLabelPill}>
            <SlidersHorizontal size={13} color={COLORS.mediumText} />
            <Text style={styles.sortLabelText}>Sắp xếp:</Text>
          </View>
          {SORT_OPTIONS.map((opt) => {
            const active = sortBy === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.sortChip, active && styles.sortChipActive]}
                onPress={() => setSortBy(opt.key)}
                activeOpacity={0.75}>
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={[styles.constrainedContent, styles.empty]}>
      <Text style={styles.emptyEmoji}>🧶</Text>
      <Text style={styles.emptyText}>{HOME_EMPTY_TITLE}</Text>
      <Text style={styles.emptySubtext}>{HOME_EMPTY_SUBTEXT}</Text>
      {(selectedCategory !== 'All' || searchInput.length > 0) && (
        <TouchableOpacity
          style={styles.resetFilterBtn}
          onPress={() => {
            setSelectedCategory('All');
            setSearchInput('');
            setSortBy('popular');
          }}>
          <Text style={styles.resetFilterText}>Xem lại tất cả sản phẩm</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const flatListRef = useRef<FlatList<Product> | null>(null);
  const handleScrollToTop = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const ListFooter = (
    <View style={[styles.footerOuter, { width: containerMaxWidth, maxWidth: containerMaxWidth, alignSelf: 'center' }]}>
      {hasMore && filteredProducts.length > 0 && (
        <View style={styles.constrainedContent}>
          <TouchableOpacity style={styles.loadMoreBtn} onPress={handleEndReached}>
            <Text style={styles.loadMoreText}>Xem thêm sản phẩm</Text>
          </TouchableOpacity>
        </View>
      )}
      <BoutiqueFooter
        onSelectCategory={setSelectedCategory}
        onScrollToTop={handleScrollToTop}
      />
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
        ref={flatListRef}
        key={`grid-${numColumns}`}
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderProductItem}
        numColumns={numColumns}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        ListFooterComponent={ListFooter}
        columnWrapperStyle={
          filteredProducts.length > 0
            ? [styles.columnWrapper, isMobile && styles.columnWrapperMobile]
            : undefined
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
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  constrainedContent: {
    width: '100%',
    maxWidth: MAX_CONTAINER_WIDTH,
    alignSelf: 'center',
    overflow: 'hidden',
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
  columnWrapperMobile: {
    paddingHorizontal: 12,
    gap: 10,
  },
  headerCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  headerCardMobile: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  brandBlock: {
    flexShrink: 0,
  },
  brandBlockMobile: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    ...SHADOWS.small,
  },
  iconActionBtnMobile: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  badge: {
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
  favBadge: {
    backgroundColor: '#8C684C',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFDF9',
    padding: 4,
    paddingRight: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2D2C0',
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#C4AA90',
    ...SHADOWS.small,
  },
  loginPillBtnMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  loginPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  loginPillTextMobile: {
    fontSize: 12,
  },
  mobileSearchWrap: {
    marginTop: 10,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#E2D2C0',
  },
  searchContainerDesktop: {
    flex: 1,
    maxWidth: 420,
  },
  searchContainerMobile: {
    width: '100%',
  },
  searchContainerFocused: {
    borderColor: '#8C684C',
  },
  searchIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkText,
    paddingVertical: 7,
  },
  clearSearchBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    marginHorizontal: SPACING.lg,
    marginTop: 4,
    marginBottom: 8,
    gap: 10,
  },
  heroSectionMobile: {
    marginHorizontal: 12,
  },
  heroBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D8C3AD',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: '#C9B199',
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  heroBannerMobile: {
    padding: 16,
    borderRadius: 20,
  },
  heroContent: {
    flex: 1,
    paddingRight: 12,
    gap: 7,
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
    fontSize: 10,
    fontWeight: '800',
    color: '#5C4332',
    letterSpacing: 0.6,
  },
  heroTitle: {
    fontSize: 23,
    fontWeight: '900',
    color: '#3D2B1F',
    lineHeight: 29,
    letterSpacing: -0.3,
  },
  heroTitleMobile: {
    fontSize: 18.5,
    lineHeight: 24,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#5C4332',
    lineHeight: 19,
  },
  heroSubtitleMobile: {
    fontSize: 12,
    lineHeight: 17,
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
  heroCircleOuterMobile: {
    width: 76,
    height: 76,
    borderRadius: 38,
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
  heroCircleInnerMobile: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  heroMainEmoji: {
    fontSize: 36,
  },
  heroMainEmojiMobile: {
    fontSize: 28,
  },
  heroFloatTagTop: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  heroFloatTagBottom: {
    position: 'absolute',
    bottom: -2,
    left: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  heroFloatEmoji: {
    fontSize: 13,
  },
  trustBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3ECE2',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  trustBarMobile: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 15,
  },
  trustItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  trustItemMobile: {
    flexDirection: 'column',
    gap: 4,
  },
  trustTextWrap: {
    flexShrink: 1,
    minWidth: 0,
  },
  trustIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  trustTitleMobile: {
    fontSize: 11,
    textAlign: 'center',
  },
  trustSub: {
    fontSize: 11,
    color: '#7A5C45',
    marginTop: 1,
  },
  trustDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#DFCBB5',
    marginHorizontal: 6,
  },
  featuredSection: {
    marginTop: 2,
  },
  featuredRow: {
    paddingHorizontal: SPACING.lg,
    gap: GAP,
  },
  featuredRowMobile: {
    paddingHorizontal: 12,
    gap: 10,
  },
  catalogToolbar: {
    marginTop: 4,
    marginBottom: 6,
  },
  sortRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 10,
    gap: 8,
    alignItems: 'center',
  },
  sortRowMobile: {
    paddingHorizontal: 12,
  },
  sortLabelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingRight: 4,
  },
  sortLabelText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  sortChipActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  sortChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  sortChipTextActive: {
    color: '#FAF5EE',
    fontWeight: '700',
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
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
  },
  resetFilterText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3D2B1F',
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
  tearFooterWrapperMobile: {
    paddingHorizontal: 12,
    borderRadius: 22,
  },
});
