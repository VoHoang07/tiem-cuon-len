import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  MessageCircle,
  Sparkles,
  Gift,
  Palette,
  Clock,
  ArrowUp,
  PlusCircle,
  Package,
  ShoppingBag,
  ShieldCheck,
  HelpCircle,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useShop } from '@/store/ShopContext';
import { useOrders } from '@/store/OrderContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { Category } from '@/types/product';

interface BoutiqueFooterProps {
  onSelectCategory?: (category: Category) => void;
  onScrollToTop?: () => void;
}

export function BoutiqueFooter({
  onSelectCategory,
  onScrollToTop,
}: BoutiqueFooterProps) {
  const router = useRouter();
  const { role } = useAuth();
  const { openChat, conversations, unreadCount } = useChat();
  const { products } = useShop();
  const { orders } = useOrders();
  const isAdmin = role === 'admin';

  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isMobile = windowWidth < 720;

  const uniqueProductCount = React.useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).length;
  }, [products]);

  const pendingOrdersCount = React.useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Đang xử lý' ||
          (o.status as string) === 'awaiting_confirmation' ||
          (o.status as string) === 'pending'
      ).length,
    [orders]
  );

  const handleCategoryPress = (cat: Category) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    }
    if (onScrollToTop) {
      onScrollToTop();
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* 1. Bespoke Crochet / Admin Studio Banner */}
      <View style={[styles.bespokeBanner, isMobile && styles.bespokeBannerMobile]}>
        {/* Decorative background yarn circles */}
        <View style={styles.decorCircleLarge} pointerEvents="none" />
        <View style={styles.decorCircleSmall} pointerEvents="none" />

        <View style={styles.bespokeContentLeft}>
          <View style={styles.badgePill}>
            <Sparkles size={12} color="#3D2B1F" />
            <Text style={styles.badgePillText}>
              {isAdmin
                ? 'STUDIO QUẢN TRỊ • TIỆM CUỘN LEN'
                : 'NHẬN ĐẶT ĐAN MÓC THEO YÊU CẦU'}
            </Text>
          </View>

          <Text style={[styles.bespokeTitle, isMobile && styles.bespokeTitleMobile]}>
            {isAdmin
              ? 'Quản lý cửa tiệm & Tư vấn đơn đặt riêng của khách'
              : 'Bạn muốn một mẫu len mang dấu ấn riêng?'}
          </Text>

          <Text style={styles.bespokeDesc}>
            {isAdmin
              ? 'Theo dõi hộp thư khách hàng đang ping sản phẩm, phản hồi tư vấn phối màu theo yêu cầu và cập nhật kho mẫu len thủ công nhanh chóng.'
              : 'Tiệm nhận phối màu theo sở thích, điều chỉnh kích thước hoặc đan móc theo hình mẫu bạn gửi. Mỗi đơn hàng đều được gói hộp quà kèm thiệp viết tay miễn phí.'}
          </Text>

          {/* Highlight Pills */}
          <View style={styles.highlightsRow}>
            {isAdmin ? (
              <>
                <View style={styles.highlightChip}>
                  <Package size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {uniqueProductCount} mẫu trên kệ
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <MessageCircle size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {conversations.length} hội thoại
                    {unreadCount > 0 ? ` (${unreadCount} mới)` : ''}
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <ShoppingBag size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {pendingOrdersCount} đơn chờ duyệt
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.highlightChip}>
                  <Palette size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Tuỳ chọn màu sắc & kiểu dáng
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <Gift size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Tặng kèm hộp quà & thiệp
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <Clock size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Hoàn thiện tỉ mỉ 2–4 ngày
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={[styles.bespokeActions, isMobile && styles.bespokeActionsMobile]}>
          <TouchableOpacity
            style={styles.primaryCtaBtn}
            onPress={openChat}
            activeOpacity={0.85}>
            <MessageCircle size={17} color="#FAF5EE" />
            <Text style={styles.primaryCtaText}>
              {isAdmin
                ? unreadCount > 0
                  ? `Hộp thư khách (${unreadCount})`
                  : 'Mở hộp thư khách hàng'
                : 'Nhắn Tiệm đặt mẫu riêng'}
            </Text>
          </TouchableOpacity>

          {isAdmin ? (
            <TouchableOpacity
              style={styles.secondaryCtaBtn}
              onPress={() => router.push('/add-product')}
              activeOpacity={0.8}>
              <PlusCircle size={16} color="#3D2B1F" />
              <Text style={styles.secondaryCtaText}>Đăng mẫu len mới</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.secondaryCtaBtn}
              onPress={() => handleCategoryPress('All')}
              activeOpacity={0.8}>
              <Text style={styles.secondaryCtaText}>Khám phá kệ len sẵn có ↑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Minimalist Boutique Footer Card */}
      <View style={[styles.footerCard, isMobile && styles.footerCardMobile]}>
        <View style={[styles.columnsRow, isMobile && styles.columnsRowMobile]}>
          {/* Column 1: Brand Story */}
          <View style={[styles.brandCol, isMobile && styles.brandColMobile]}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.brandIconCircle}>
                <Text style={styles.brandIconEmoji}>🧶</Text>
              </View>
              <View>
                <Text style={styles.brandName}>Tiệm Cuộn Len</Text>
                <Text style={styles.brandTagline}>LEN THỦ CÔNG VIỆT NAM</Text>
              </View>
            </View>

            <Text style={styles.brandBio}>
              Đan từng mũi ấm áp, gửi trọn yêu thương. Chuyên thú bông, hoa len,
              túi xách và phụ kiện đan móc thủ công 100% từ sợi len cotton cao cấp.
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                Mở cửa mỗi ngày (08:00 – 22:00) • Giao hàng toàn quốc
              </Text>
            </View>
          </View>

          {/* Column 2: Categories */}
          <View style={styles.linksCol}>
            <Text style={styles.colTitle}>BỘ SƯU TẬP</Text>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('All')}>
              <Text style={styles.footerLinkText}>🧶 Tất cả sản phẩm</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Crochet')}>
              <Text style={styles.footerLinkText}>🌻 Hoa len & Quà tặng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Plushies')}>
              <Text style={styles.footerLinkText}>🧸 Thú bông & Búp bê len</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Bags')}>
              <Text style={styles.footerLinkText}>👜 Túi xách & Ví len</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Accessories')}>
              <Text style={styles.footerLinkText}>🍒 Móc khoá & Phụ kiện</Text>
            </TouchableOpacity>
          </View>

          {/* Column 3: Role-specific Quick Links */}
          <View style={styles.linksCol}>
            <Text style={styles.colTitle}>
              {isAdmin ? 'QUẢN TRỊ TIỆM' : 'DÀNH CHO BẠN'}
            </Text>
            {isAdmin ? (
              <>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/manage-products')}>
                  <Text style={styles.footerLinkText}>📦 Quản lý kho sản phẩm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/orders')}>
                  <Text style={styles.footerLinkText}>🛍️ Duyệt & quản lý đơn hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/payment-methods')}>
                  <Text style={styles.footerLinkText}>💳 Cấu hình tài khoản QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={openChat}>
                  <Text style={styles.footerLinkText}>💬 Hộp thư tư vấn khách hàng</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/cart')}>
                  <Text style={styles.footerLinkText}>🛒 Giỏ hàng của bạn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/favorites')}>
                  <Text style={styles.footerLinkText}>🤍 Sản phẩm đã yêu thích</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/orders')}>
                  <Text style={styles.footerLinkText}>📦 Theo dõi đơn đặt hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={openChat}>
                  <Text style={styles.footerLinkText}>💬 Chat tư vấn & Ping sản phẩm</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Bottom Divider & Copyright Bar */}
        <View style={[styles.bottomBar, isMobile && styles.bottomBarMobile]}>
          <Text style={styles.copyrightText}>
            © 2026 Tiệm Cuộn Len Handmade (tiemcuonlen.shop) • Đan móc thủ công bằng cả trái tim
          </Text>

          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => router.push('/privacy')}>
              <ShieldCheck size={13} color={COLORS.mediumText} />
              <Text style={styles.policyLinkText}>Bảo mật</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => router.push('/help')}>
              <HelpCircle size={13} color={COLORS.mediumText} />
              <Text style={styles.policyLinkText}>Trợ giúp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToTopBtn}
              onPress={handleBackToTop}
              activeOpacity={0.75}>
              <ArrowUp size={13} color="#3D2B1F" />
              <Text style={styles.backToTopText}>Đầu trang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    gap: 16,
  },
  containerMobile: {
    paddingHorizontal: 12,
    gap: 12,
  },

  /* 1. Bespoke Crochet Banner */
  bespokeBanner: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#D8C3AD',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1.5,
    borderColor: '#C5AC92',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    ...SHADOWS.small,
  },
  bespokeBannerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    gap: 16,
  },
  decorCircleLarge: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(250, 245, 238, 0.22)',
  },
  decorCircleSmall: {
    position: 'absolute',
    right: 110,
    bottom: -45,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(61, 43, 31, 0.05)',
  },
  bespokeContentLeft: {
    flex: 1,
    minWidth: 0,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(250, 245, 238, 0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 0.5,
  },
  bespokeTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#2C1E14',
    lineHeight: 28,
  },
  bespokeTitleMobile: {
    fontSize: 18,
    lineHeight: 24,
  },
  bespokeDesc: {
    fontSize: 13.5,
    color: '#4A3525',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 620,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(250, 245, 238, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(61, 43, 31, 0.1)',
  },
  highlightChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  bespokeActions: {
    flexDirection: 'column',
    gap: 9,
    minWidth: 225,
    flexShrink: 0,
  },
  bespokeActionsMobile: {
    minWidth: 0,
    width: '100%',
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    ...SHADOWS.small,
  },
  primaryCtaText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  secondaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  secondaryCtaText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },

  /* 2. Minimalist Boutique Footer Card */
  footerCard: {
    backgroundColor: '#F3ECE2',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  footerCardMobile: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 28,
  },
  columnsRowMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  brandCol: {
    flex: 1.5,
    minWidth: 0,
  },
  brandColMobile: {
    flex: 1,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  brandIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  brandIconEmoji: {
    fontSize: 20,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A5C44',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  brandBio: {
    fontSize: 13,
    color: '#5C4332',
    lineHeight: 19,
    maxWidth: 420,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3525',
  },

  linksCol: {
    flex: 1,
    gap: 7,
  },
  colTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A5C44',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerLinkBtn: {
    paddingVertical: 3,
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3D2B1F',
  },

  /* Bottom Signature Bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2D2C0',
    gap: 12,
  },
  bottomBarMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  copyrightText: {
    fontSize: 12,
    color: '#7A6252',
    fontWeight: '500',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  policyLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  backToTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backToTopText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
});
