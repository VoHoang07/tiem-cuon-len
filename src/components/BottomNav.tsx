import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname, type Href } from 'expo-router';
import {
  ShoppingCart,
  Heart,
  PlusCircle,
  User,
  Home,
  ShoppingBag,
  Package,
} from 'lucide-react-native';
import { COLORS, SHADOWS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { TAB_BAR_CONTENT_HEIGHT } from '@/constants/layout';
import {
  NAV_HOME,
  NAV_FAVORITES,
  NAV_ADD,
  NAV_CART,
  NAV_PROFILE,
} from '@/constants/strings';

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, favorites } = useShop();
  const { role } = useAuth();
  const { orders } = useOrders();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isWideWeb = mounted && Platform.OS === 'web' && windowWidth >= 640;
  const isAdmin = role === 'admin';
  const pendingOrdersCount = orders.filter((o) => o.status === 'Đang xử lý').length;

  const adminTabs = [
    { route: '/', icon: Home, label: NAV_HOME, badge: 0 },
    { route: '/manage-products', icon: Package, label: 'Kho SP', badge: 0 },
    { route: '/add-product', icon: PlusCircle, label: NAV_ADD, badge: 0 },
    { route: '/orders', icon: ShoppingBag, label: 'Đơn hàng', badge: pendingOrdersCount },
    { route: '/profile', icon: User, label: 'Quản trị', badge: 0 },
  ];

  const customerTabs = [
    { route: '/', icon: Home, label: NAV_HOME, badge: 0 },
    { route: '/favorites', icon: Heart, label: NAV_FAVORITES, badge: favorites.length },
    { route: '/cart', icon: ShoppingCart, label: NAV_CART, badge: cartCount },
    { route: '/profile', icon: User, label: NAV_PROFILE, badge: 0 },
  ];

  const tabs = isAdmin ? adminTabs : customerTabs;

  const handleTabPress = (route: string) => {
    if (Platform.OS === 'web') {
      router.push(route as Href);
    } else {
      router.replace(route as Href);
    }
  };

  return (
    <View
      style={[
        styles.outerWrapper,
        isWideWeb ? styles.outerWrapperFloating : { paddingBottom: insets.bottom },
      ]}
      pointerEvents="box-none">
      <View
        style={[
          styles.inner,
          isWideWeb && styles.innerFloating,
          isWideWeb && isAdmin && styles.innerFloatingAdmin,
        ]}>
        {tabs.map((tab) => {
          const { route, icon: Icon, label, badge } = tab;
          const focused = pathname === route;
          const color = focused ? '#3D2B1F' : COLORS.lightText;
          const textStyle = focused ? styles.tabTextActive : styles.tabText;

          return (
            <TouchableOpacity
              key={route}
              style={[styles.tab, focused && isWideWeb && styles.tabActiveFloating]}
              onPress={() => handleTabPress(route)}
              activeOpacity={0.7}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}>
              <View style={styles.iconWrap}>
                <Icon size={21} color={color} strokeWidth={focused ? 2.5 : 2} />
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={textStyle} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(118, 83, 65, 0.12)',
  },
  outerWrapperFloating: {
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    bottom: 16,
    alignItems: 'center',
  },
  inner: {
    height: TAB_BAR_CONTENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  innerFloating: {
    width: '92%',
    maxWidth: 500,
    height: 62,
    backgroundColor: 'rgba(250, 246, 240, 0.96)',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DFCBB5',
    ...SHADOWS.large,
  },
  innerFloatingAdmin: {
    maxWidth: 580,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
    borderRadius: 24,
  },
  tabActiveFloating: {
    backgroundColor: '#D8C3AD',
  },
  iconWrap: {
    position: 'relative',
    width: 26,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10.5,
    fontWeight: '500',
    color: COLORS.lightText,
    marginTop: 2,
    textAlign: 'center',
  },
  tabTextActive: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#3D2B1F',
    marginTop: 2,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.error,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9.5,
    fontWeight: '800',
  },
});
