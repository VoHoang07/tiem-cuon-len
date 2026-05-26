import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  ShoppingCart,
  Heart,
  PlusCircle,
  User,
  Home,
  ShoppingBag,
} from 'lucide-react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
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

    return (
    <View style={styles.container}>
      <View style={styles.nav}>
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
              onPress={() => router.replace(route as any)}>
              <Icon size={22} color={color} />
              {showBadge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount}</Text>
                </View>
              )}
              <Text style={textStyle}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingBottom: SPACING.xl,
    paddingTop: 8,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  tabText: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.lightText,
    marginTop: 3,
  },
  tabTextActive: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: 3,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
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
