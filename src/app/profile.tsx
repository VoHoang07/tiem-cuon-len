import React, { useState, type ComponentType } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Package,
  ShoppingBag,
  Heart,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  MapPin,
  CreditCard,
  Mail,
  TrendingUp,
  DollarSign,
  BarChart3,
  PlusCircle,
  Edit3,
  Sparkles,
  MessageCircle,
  Check,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useChat } from '@/store/ChatContext';
import { useLogout } from '@/hooks/useLogout';
import {
  ANIMAL_AVATARS,
  BrandAvatar,
  getAnimalAvatar,
} from '@/components/BrandTitle';
import {
  COLORS,
  SPACING,
  SHADOWS,
} from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  PROF_EDIT_PROFILE,
  PROF_PRODUCTS,
  PROF_ORDERS,
  PROF_MANAGE_PRODUCTS,
  PROF_PREVIOUS_ORDERS,
  PROF_FAVORITES_MENU,
  PROF_SETTINGS,
  PROF_HELP,
  PROF_PRIVACY,
  PROF_LOGOUT,
  PROF_CUSTOMER_MY_ORDERS,
  PROF_CUSTOMER_ADDRESS,
  PROF_CUSTOMER_PAYMENT,
  PROF_CUSTOMER_SUBTITLE,
  PROF_CUSTOMER_ORDERS_LABEL,
  PROF_CUSTOMER_FAVORITES_LABEL,
  PROF_CUSTOMER_CART_LABEL,
} from '@/constants/strings';

export default function ProfileScreen() {
  const router = useRouter();
  const { products, favorites, cart } = useShop();
  const { user, role, guestAvatar, updateAvatar } = useAuth();
  const { orders, getOrdersByUser } = useOrders();
  const { openChat, unreadCount, conversations } = useChat();
  const { handleLogout } = useLogout();
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const currentAnimal = getAnimalAvatar(
    user?.avatar ?? (!user ? guestAvatar : undefined),
    user?.id || user?.email || user?.name
  );

  const userOrders = user ? getOrdersByUser(user.id) : [];
  const isAdmin = role === 'admin';

  const AvatarPickerBlock = showAvatarPicker ? (
    <View style={styles.avatarPickerBox}>
      <Text style={styles.avatarPickerTitle}>Chọn thú cưng đại diện của bạn</Text>
      <View style={styles.avatarPickerGrid}>
        {ANIMAL_AVATARS.map((item) => {
          const active = currentAnimal.id === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.avatarPickerItem,
                { backgroundColor: item.bg },
                active && [styles.avatarPickerItemActive, { borderColor: item.border }],
              ]}
              onPress={() => {
                updateAvatar(item.id);
                setShowAvatarPicker(false);
              }}
              activeOpacity={0.8}>
              <Text style={styles.avatarPickerEmoji}>{item.emoji}</Text>
              <Text
                style={[
                  styles.avatarPickerName,
                  active && styles.avatarPickerNameActive,
                ]}
                numberOfLines={1}>
                {item.name}
              </Text>
              {active && (
                <View style={[styles.avatarPickerCheck, { backgroundColor: item.border }]}>
                  <Check size={9} color="#FFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ) : null;

  // ─── ADMIN PROFILE ──────────────────────────
  if (isAdmin) {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const completedOrders = orders.filter((o) => o.status === 'Hoàn thành').length;
    const processingOrders = orders.filter((o) => o.status === 'Đang xử lý').length;
    const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    // Top selling product
    const productSales: Record<string, { id: string; name: string; count: number }> = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!productSales[item.product.id]) {
          productSales[item.product.id] = { id: item.product.id, name: item.product.name, count: 0 };
        }
        productSales[item.product.id].count += item.quantity;
      });
    });
    const topProduct = Object.values(productSales).sort((a, b) => b.count - a.count)[0];

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            {/* Admin Profile Header Card */}
            <View style={styles.profileHeaderCard}>
              <View style={styles.roleBadge}>
                <Sparkles size={12} color="#5C4332" />
                <Text style={styles.roleBadgeText}>QUẢN TRỊ VIÊN TIỆM LEN</Text>
              </View>
              <TouchableOpacity
                style={styles.avatarWrapBtn}
                onPress={() => setShowAvatarPicker((v) => !v)}
                activeOpacity={0.85}>
                <BrandAvatar size={88} />
                <View style={styles.avatarEditBadge}>
                  <Edit3 size={11} color="#FFFDF9" />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowAvatarPicker((v) => !v)}
                activeOpacity={0.75}>
                <Text style={styles.changeAvatarHint}>
                  {currentAnimal.emoji} {currentAnimal.name} • Nhấn để đổi thú cưng
                </Text>
              </TouchableOpacity>
              {AvatarPickerBlock}
              <Text style={styles.customerName}>{user?.name || 'Quản trị viên'}</Text>
              {user?.email ? (
                <View style={styles.emailRow}>
                  <Mail size={14} color={COLORS.mediumText} />
                  <Text style={styles.customerEmail}>{user.email}</Text>
                </View>
              ) : null}
              <Text style={styles.subtitle}>Quản lý kho sản phẩm, đơn hàng & vận hành Tiệm Cuộn Len</Text>
              <View style={styles.headerActionRow}>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => router.push('/profile/edit')}
                  activeOpacity={0.8}>
                  <Edit3 size={14} color="#3D2B1F" />
                  <Text style={styles.editBtnText}>{PROF_EDIT_PROFILE}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickAddHeaderBtn}
                  onPress={() => router.push('/add-product')}
                  activeOpacity={0.8}>
                  <PlusCircle size={14} color={COLORS.white} />
                  <Text style={styles.quickAddHeaderText}>Thêm sản phẩm</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              {[
                { label: PROF_PRODUCTS, value: products.length, icon: Package, onPress: () => router.push('/manage-products') },
                { label: PROF_ORDERS, value: orders.length, icon: ShoppingBag, onPress: () => router.push('/orders') },
                { label: 'Doanh thu', value: formatVND(totalRevenue), icon: DollarSign, onPress: () => router.push('/orders') },
              ].map((stat) => (
                <TouchableOpacity key={stat.label} style={styles.statCard} onPress={stat.onPress} activeOpacity={0.75}>
                  <View style={styles.statIconWrap}>
                    <stat.icon size={20} color="#3D2B1F" />
                  </View>
                  <Text style={stat.label === 'Doanh thu' ? styles.statValueSmall : styles.statValue}>
                    {stat.value}
                  </Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Business Dashboard */}
            <View style={styles.dashboardSection}>
              <View style={styles.dashboardHeader}>
                <BarChart3 size={20} color={COLORS.primary} />
                <Text style={styles.dashboardTitle}>Tổng quan kinh doanh</Text>
              </View>

              <View style={styles.dashboardGrid}>
                <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.75}>
                  <DollarSign size={20} color={COLORS.success} />
                  <Text style={styles.dashboardValue}>{formatVND(totalRevenue)}</Text>
                  <Text style={styles.dashboardLabel}>Tổng doanh thu</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.75}>
                  <TrendingUp size={20} color={COLORS.primary} />
                  <Text style={styles.dashboardValue}>{formatVND(avgOrderValue)}</Text>
                  <Text style={styles.dashboardLabel}>Trung bình / đơn</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.75}>
                  <Package size={20} color={COLORS.starYellow} />
                  <Text style={styles.dashboardValue}>{completedOrders}</Text>
                  <Text style={styles.dashboardLabel}>Đơn hoàn thành</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.75}>
                  <ShoppingBag size={20} color="#E8A840" />
                  <Text style={styles.dashboardValue}>{processingOrders}</Text>
                  <Text style={styles.dashboardLabel}>Đơn chờ xử lý</Text>
                </TouchableOpacity>
              </View>

              {topProduct && (
                <TouchableOpacity
                  style={styles.topProductCard}
                  onPress={() => router.push(`/product/${topProduct.id}`)}
                  activeOpacity={0.75}>
                  <Text style={styles.topProductLabel}>🔥 Sản phẩm bán chạy nhất</Text>
                  <Text style={styles.topProductName}>{topProduct.name}</Text>
                  <Text style={styles.topProductCount}>Đã bán: {topProduct.count} sản phẩm</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Admin Menu Items */}
            <View style={styles.menuSection}>
              <MenuItem
                icon={MessageCircle}
                label="Hộp thư tin nhắn khách hàng"
                badge={unreadCount > 0 ? `${unreadCount} chưa đọc` : `${conversations.length} hội thoại`}
                onPress={openChat}
              />
              <MenuItem icon={Package} label={PROF_MANAGE_PRODUCTS} badge={`${products.length} SP`} onPress={() => router.push('/manage-products')} />
              <MenuItem icon={PlusCircle} label="Thêm sản phẩm mới" onPress={() => router.push('/add-product')} />
              <MenuItem
                icon={ShoppingBag}
                label={PROF_PREVIOUS_ORDERS}
                badge={processingOrders > 0 ? `${processingOrders} mới` : undefined}
                onPress={() => router.push('/orders')}
              />
              <MenuItem icon={CreditCard} label="Cấu hình phương thức thanh toán" onPress={() => router.push('/payment-methods')} />
              <MenuItem icon={Settings} label={PROF_SETTINGS} onPress={() => router.push('/settings')} />
              <MenuItem icon={HelpCircle} label={PROF_HELP} onPress={() => router.push('/help')} />
              <MenuItem icon={Shield} label={PROF_PRIVACY} onPress={() => router.push('/privacy')} />
            </View>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <LogOut size={20} color={COLORS.error} />
              <Text style={styles.logoutText}>{PROF_LOGOUT}</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── CUSTOMER / CLIENT PROFILE ───────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Customer Profile Header Card */}
          <View style={styles.profileHeaderCard}>
            <View style={styles.roleBadge}>
              <Sparkles size={12} color="#5C4332" />
              <Text style={styles.roleBadgeText}>
                {user ? 'KHÁCH HÀNG THÂN THIẾT' : 'KHÁCH THĂM TIỆM'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.avatarWrapBtn}
              onPress={() => setShowAvatarPicker((v) => !v)}
              activeOpacity={0.85}>
              <BrandAvatar size={86} />
              <View style={styles.avatarEditBadge}>
                <Edit3 size={11} color="#FFFDF9" />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowAvatarPicker((v) => !v)}
              activeOpacity={0.75}>
              <Text style={styles.changeAvatarHint}>
                {currentAnimal.emoji} {currentAnimal.name} • Nhấn để đổi thú cưng
              </Text>
            </TouchableOpacity>
            {AvatarPickerBlock}
            <Text style={styles.customerName}>{user?.name || 'Khách hàng'}</Text>
            {user ? (
              <>
                <View style={styles.emailRow}>
                  <Mail size={14} color={COLORS.mediumText} />
                  <Text style={styles.customerEmail}>{user.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.editBtn, { marginTop: 12 }]}
                  onPress={() => router.push('/profile/edit')}
                  activeOpacity={0.8}>
                  <Edit3 size={14} color="#3D2B1F" />
                  <Text style={styles.editBtnText}>{PROF_EDIT_PROFILE}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.guestAuthRow}>
                <TouchableOpacity
                  style={styles.guestLoginBtn}
                  onPress={() => router.push('/login')}
                  activeOpacity={0.85}>
                  <Text style={styles.guestLoginText}>Đăng nhập</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.guestRegisterBtn}
                  onPress={() => router.push('/register')}
                  activeOpacity={0.85}>
                  <Text style={styles.guestRegisterText}>Đăng ký tài khoản</Text>
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.customerSubtitle}>{PROF_CUSTOMER_SUBTITLE}</Text>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: PROF_CUSTOMER_ORDERS_LABEL, value: userOrders.length, icon: ShoppingBag, onPress: () => router.push('/orders') },
              { label: PROF_CUSTOMER_FAVORITES_LABEL, value: favorites.length, icon: Heart, onPress: () => router.push('/favorites') },
              { label: PROF_CUSTOMER_CART_LABEL, value: cart.reduce((sum, ci) => sum + ci.quantity, 0), icon: Package, onPress: () => router.push('/cart') },
            ].map((stat) => (
              <TouchableOpacity key={stat.label} style={styles.statCard} onPress={stat.onPress} activeOpacity={0.75}>
                <View style={styles.statIconWrap}>
                  <stat.icon size={20} color="#3D2B1F" />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Customer Menu Items */}
          <View style={styles.menuSection}>
            <MenuItem
              icon={MessageCircle}
              label="Trò chuyện & Tư vấn với Tiệm"
              badge={unreadCount > 0 ? `${unreadCount} mới` : 'Trực tuyến'}
              onPress={openChat}
            />
            <MenuItem
              icon={ShoppingBag}
              label={PROF_CUSTOMER_MY_ORDERS}
              badge={userOrders.length > 0 ? `${userOrders.length}` : undefined}
              onPress={() => router.push('/orders')}
            />
            <MenuItem
              icon={Heart}
              label={PROF_FAVORITES_MENU}
              badge={favorites.length > 0 ? `${favorites.length}` : undefined}
              onPress={() => router.push('/favorites')}
            />
            <MenuItem icon={MapPin} label={PROF_CUSTOMER_ADDRESS} onPress={() => router.push('/addresses')} />
            <MenuItem icon={CreditCard} label={PROF_CUSTOMER_PAYMENT} onPress={() => router.push('/payment-methods')} />
            <MenuItem icon={Settings} label={PROF_SETTINGS} onPress={() => router.push('/settings')} />
            <MenuItem icon={HelpCircle} label={PROF_HELP} onPress={() => router.push('/help')} />
            <MenuItem icon={Shield} label={PROF_PRIVACY} onPress={() => router.push('/privacy')} />
          </View>

          {/* Logout */}
          {user && (
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
              <LogOut size={20} color={COLORS.error} />
              <Text style={styles.logoutText}>{PROF_LOGOUT}</Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 100 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function MenuItem({
  icon: Icon,
  label,
  badge,
  onPress,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.menuLeft}>
        <View style={styles.menuIconWrap}>
          <Icon size={19} color="#3D2B1F" />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {badge ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <ChevronRight size={19} color={COLORS.lightText} />
      </View>
    </TouchableOpacity>
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
  scrollContent: {
    paddingTop: SPACING.md,
  },
  container: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  profileHeaderCard: {
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.lg,
    borderRadius: 24,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    ...SHADOWS.small,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    marginBottom: 12,
  },
  roleBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#5C4332',
    letterSpacing: 0.6,
  },
  avatarWrapBtn: {
    position: 'relative',
    marginBottom: 6,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#5C4033',
    borderWidth: 2,
    borderColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeAvatarHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E4F37',
    marginBottom: 8,
  },
  avatarPickerBox: {
    width: '100%',
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  avatarPickerTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5C4332',
    textAlign: 'center',
    marginBottom: 10,
  },
  avatarPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  avatarPickerItem: {
    width: '22.5%',
    minWidth: 66,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E8DACB',
    position: 'relative',
  },
  avatarPickerItemActive: {
    borderWidth: 2.5,
  },
  avatarPickerEmoji: {
    fontSize: 24,
    marginBottom: 2,
  },
  avatarPickerName: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#6E5A4B',
  },
  avatarPickerNameActive: {
    fontWeight: '800',
    color: '#3D2B1F',
  },
  avatarPickerCheck: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 4,
  },
  guestAuthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  guestLoginBtn: {
    backgroundColor: '#3D2B1F',
    borderRadius: 16,
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
    ...SHADOWS.small,
  },
  guestLoginText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },
  guestRegisterBtn: {
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    paddingHorizontal: SPACING.xl,
    paddingVertical: 10,
  },
  guestRegisterText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  customerEmail: {
    fontSize: 13.5,
    color: COLORS.mediumText,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.mediumText,
    marginTop: 6,
    textAlign: 'center',
  },
  customerSubtitle: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D8C3AD',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  quickAddHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  quickAddHeaderText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    gap: 10,
  },
  statCard: {
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 18,
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#3D2B1F',
    marginTop: 2,
  },
  statValueSmall: {
    fontSize: 14,
    fontWeight: '900',
    color: '#3D2B1F',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
    textAlign: 'center',
    fontWeight: '600',
  },
  menuSection: {
    backgroundColor: '#FFFDF9',
    marginHorizontal: SPACING.lg,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 15,
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6D8',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadge: {
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12,
  },
  menuBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    paddingVertical: 15,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F2D6D3',
    ...SHADOWS.small,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.error,
  },
  dashboardSection: {
    backgroundColor: '#FFFDF9',
    marginHorizontal: SPACING.lg,
    borderRadius: 22,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  dashboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  dashboardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dashboardCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FAF5EE',
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#E8DACB',
  },
  dashboardValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#3D2B1F',
    marginTop: 2,
  },
  dashboardLabel: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    textAlign: 'center',
    fontWeight: '600',
  },
  topProductCard: {
    backgroundColor: '#F3ECE2',
    borderRadius: 16,
    padding: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  topProductLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumText,
    marginBottom: 2,
  },
  topProductName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  topProductCount: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
    fontWeight: '600',
  },
});
