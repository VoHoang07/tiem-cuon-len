import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { useRouter, usePathname, type Href } from 'expo-router';
import {
  ShoppingCart,
  Heart,
  PlusCircle,
  User,
  Home,
  ShoppingBag,
} from 'lucide-react-native';
import { COLORS } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
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

  const isAdmin = role === 'admin';

  const adminTabs = [
    { route: '/', icon: Home, label: NAV_HOME },
    { route: '/add-product', icon: PlusCircle, label: NAV_ADD },
    { route: '/orders', icon: ShoppingBag, label: 'Đơn hàng' },
    { route: '/profile', icon: User, label: NAV_PROFILE },
  ];

  const customerTabs = [
    { route: '/', icon: Home, label: NAV_HOME },
    { route: '/favorites', icon: Heart, label: NAV_FAVORITES },
    { route: '/cart', icon: ShoppingCart, label: NAV_CART },
    { route: '/profile', icon: User, label: NAV_PROFILE },
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
    <View style={[styles.container, { height: TAB_BAR_CONTENT_HEIGHT }]}>
      {tabs.map((tab) => {
        const { route, icon: Icon, label } = tab;
        const focused = pathname === route;
        const color = focused ? COLORS.primary : COLORS.lightText;
        const textStyle = focused ? styles.tabTextActive : styles.tabText;

        const showBadge =
          (label === NAV_FAVORITES && favorites.length > 0) ||
          (label === NAV_CART && cartCount > 0);
        const badgeCount =
          label === NAV_FAVORITES ? favorites.length : cartCount;

        return (
          <TouchableOpacity
            key={route}
            style={styles.tab}
            onPress={() => handleTabPress(route)}
            activeOpacity={0.6}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}>
            <View style={styles.iconWrap}>
              <Icon size={24} color={color} strokeWidth={focused ? 2.5 : 2} />
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeCount > 99 ? '99+' : badgeCount}
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
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    paddingBottom: 4,
  },
  iconWrap: {
    position: 'relative',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.lightText,
    marginTop: 3,
    textAlign: 'center',
  },
  tabTextActive: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 3,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: '700',
  },
});
