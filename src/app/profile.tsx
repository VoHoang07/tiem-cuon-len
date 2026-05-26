import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useLogout } from '@/hooks/useLogout';
import { BottomNav } from '@/components/BottomNav';
import { BrandLogo } from '@/components/BrandLogo';

const LOGO_IMAGE = require('../../assets/images/logo-shop.png');

import {
  COLORS,
  SPACING,
  SHADOWS,
} from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  PROF_EDIT_PROFILE,
  PROF_PRODUCTS,
  PROF_FAVORITES,
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
  const { user, role } = useAuth();
  const { orders, getOrdersByUser } = useOrders();
  const { handleLogout } = useLogout();

  const userOrders = user ? getOrdersByUser(user.email) : [];

  const isAdmin = role === 'admin';

  // ─── ADMIN PROFILE ──────────────────────────
  if (isAdmin) {
    const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const completedOrders = orders.filter((o) => o.status === 'Hoàn thành').length;
    const processingOrders = orders.filter((o) => o.status === 'Đang xử lý').length;
    const avgOrderValue = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    // Top selling product
    const productSales: Record<string, { name: string; count: number }> = {};
    orders.forEach((o) => {
      o.items.forEach((item) => {
        if (!productSales[item.product.id]) {
          productSales[item.product.id] = { name: item.product.name, count: 0 };
        }
        productSales[item.product.id].count += item.quantity;
      });
    });
    const topProduct = Object.values(productSales).sort((a, b) => b.count - a.count)[0];

    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.adminAvatar}>
              <Image
                source={LOGO_IMAGE}
                style={styles.adminAvatarImage}
                resizeMode="cover"
              />
            </View>
            <Text style={styles.subtitle}>Sản phẩm len handmade bằng cả trái tim.</Text>
            <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/profile/edit')}>
              <Text style={styles.editBtnText}>{PROF_EDIT_PROFILE}</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsRow}>
            {[
              { label: PROF_PRODUCTS, value: products.length, icon: Package, onPress: () => router.push('/manage-products') },
              { label: PROF_ORDERS, value: orders.length, icon: ShoppingBag, onPress: () => router.push('/orders') },
              { label: 'Doanh thu', value: formatVND(totalRevenue), icon: DollarSign, onPress: () => router.push('/orders') },
            ].map((stat) => (
              <TouchableOpacity key={stat.label} style={styles.statCard} onPress={stat.onPress} activeOpacity={0.7}>
                <stat.icon size={24} color={COLORS.primary} />
                <Text style={stat.label === 'Doanh thu' ? styles.statValueSmall : styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Dashboard */}
          <View style={styles.dashboardSection}>
            <View style={styles.dashboardHeader}>
              <BarChart3 size={20} color={COLORS.primary} />
              <Text style={styles.dashboardTitle}>Tổng quan kinh doanh</Text>
            </View>

            <View style={styles.dashboardGrid}>
              <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.7}>
                <DollarSign size={20} color={COLORS.success} />
                <Text style={styles.dashboardValue}>{formatVND(totalRevenue)}</Text>
                <Text style={styles.dashboardLabel}>Tổng doanh thu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.7}>
                <TrendingUp size={20} color={COLORS.primary} />
                <Text style={styles.dashboardValue}>{formatVND(avgOrderValue)}</Text>
                <Text style={styles.dashboardLabel}>TB / đơn</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.7}>
                <Package size={20} color={COLORS.starYellow} />
                <Text style={styles.dashboardValue}>{completedOrders}</Text>
                <Text style={styles.dashboardLabel}>Đã hoàn thành</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.dashboardCard} onPress={() => router.push('/orders')} activeOpacity={0.7}>
                <ShoppingBag size={20} color="#E8A840" />
                <Text style={styles.dashboardValue}>{processingOrders}</Text>
                <Text style={styles.dashboardLabel}>Đang xử lý</Text>
              </TouchableOpacity>
            </View>

            {topProduct && (
              <TouchableOpacity
                style={styles.topProductCard}
                onPress={() => router.push(`/product/${topProduct.name}`)}
                activeOpacity={0.7}>
                <Text style={styles.topProductLabel}>Sản phẩm bán chạy nhất</Text>
                <Text style={styles.topProductName}>{topProduct.name}</Text>
                <Text style={styles.topProductCount}>Đã bán: {topProduct.count}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Menu Items */}
          <View style={styles.menuSection}>
            <MenuItem icon={Package} label={PROF_MANAGE_PRODUCTS} onPress={() => router.push('/manage-products')} />
            <MenuItem icon={PlusCircle} label="Thêm sản phẩm" onPress={() => router.push('/add-product')} />
            <MenuItem icon={ShoppingBag} label={PROF_PREVIOUS_ORDERS} onPress={() => router.push('/orders')} />
            <MenuItem icon={CreditCard} label={PROF_CUSTOMER_PAYMENT} onPress={() => router.push('/payment-methods')} />
            <MenuItem icon={Settings} label={PROF_SETTINGS} onPress={() => router.push('/settings')} />
            <MenuItem icon={HelpCircle} label={PROF_HELP} onPress={() => router.push('/help')} />
            <MenuItem icon={Shield} label={PROF_PRIVACY} onPress={() => router.push('/privacy')} />
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={20} color={COLORS.error} />
            <Text style={styles.logoutText}>{PROF_LOGOUT}</Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
        </ScrollView>
        <BottomNav />
      </SafeAreaView>
    );
  }

  // ─── CUSTOMER PROFILE ───────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Customer Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <User size={40} color={COLORS.primary} />
          </View>
          <Text style={styles.customerName}>{user?.name ?? 'Khách hàng'}</Text>
          <View style={styles.emailRow}>
            <Mail size={14} color={COLORS.mediumText} />
            <Text style={styles.customerEmail}>{user?.email ?? ''}</Text>
          </View>
          <Text style={styles.customerSubtitle}>{PROF_CUSTOMER_SUBTITLE}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: PROF_CUSTOMER_ORDERS_LABEL, value: userOrders.length, icon: ShoppingBag, onPress: () => router.push('/orders') },
            { label: PROF_CUSTOMER_FAVORITES_LABEL, value: favorites.length, icon: Heart, onPress: () => router.push('/favorites') },
            { label: PROF_CUSTOMER_CART_LABEL, value: cart.reduce((sum, ci) => sum + ci.quantity, 0), icon: Package, onPress: () => router.push('/cart') },
          ].map((stat) => (
            <TouchableOpacity key={stat.label} style={styles.statCard} onPress={stat.onPress} activeOpacity={0.7}>
              <stat.icon size={24} color={COLORS.primary} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Customer Menu Items */}
        <View style={styles.menuSection}>
          <MenuItem icon={ShoppingBag} label={PROF_CUSTOMER_MY_ORDERS} onPress={() => router.push('/orders')} />
          <MenuItem icon={Heart} label={PROF_FAVORITES_MENU} onPress={() => router.push('/favorites')} />
          <MenuItem icon={MapPin} label={PROF_CUSTOMER_ADDRESS} onPress={() => router.push('/addresses')} />
          <MenuItem icon={CreditCard} label={PROF_CUSTOMER_PAYMENT} onPress={() => router.push('/payment-methods')} />
          <MenuItem icon={Settings} label={PROF_SETTINGS} onPress={() => router.push('/settings')} />
          <MenuItem icon={HelpCircle} label={PROF_HELP} onPress={() => router.push('/help')} />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>{PROF_LOGOUT}</Text>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

function MenuItem({ icon: Icon, label, onPress }: { icon: any; label: string; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Icon size={22} color={COLORS.primary} />
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <ChevronRight size={20} color={COLORS.lightText} />
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
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xxxl,
    paddingHorizontal: SPACING.lg,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: SPACING.md,
    ...SHADOWS.medium,
  },
  adminAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#765341',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8cbc4',
    marginBottom: SPACING.md,
  },
  adminAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  customerName: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  customerEmail: {
    fontSize: 14,
    color: COLORS.mediumText,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mediumText,
    marginTop: SPACING.xs,
  },
  customerSubtitle: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: SPACING.sm,
    fontStyle: 'italic',
  },
  editBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 15,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.white,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xxl,
  },
  statCard: {
    backgroundColor: COLORS.white,
    alignItems: 'center',
    padding: SPACING.lg,
    borderRadius: 16,
    flex: 1,
    marginHorizontal: SPACING.xs,
    ...SHADOWS.small,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: SPACING.xs,
  },
  statValueSmall: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: SPACING.xs,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
    textAlign: 'center',
  },
  menuSection: {
    backgroundColor: COLORS.lightPurple,
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  menuLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    ...SHADOWS.small,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.error,
  },
  dashboardSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
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
    fontWeight: '700',
    color: COLORS.darkText,
  },
  dashboardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  dashboardCard: {
    width: '47%',
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    padding: SPACING.md,
    alignItems: 'center',
    gap: 4,
  },
  dashboardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: 2,
  },
  dashboardLabel: {
    fontSize: 11,
    color: COLORS.mediumText,
    textAlign: 'center',
  },
  topProductCard: {
    backgroundColor: COLORS.lightPurple,
    borderRadius: 14,
    padding: SPACING.md,
    marginTop: SPACING.md,
    alignItems: 'center',
  },
  topProductLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumText,
    marginBottom: 2,
  },
  topProductName: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },
  topProductCount: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
  },
});
