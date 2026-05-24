import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  ShoppingCart,
  Heart,
  User,
  Home,
} from 'lucide-react-native';
import { COLORS, SPACING } from '@/constants/theme';
import { useShop } from '@/store/ShopContext';
import {
  NAV_HOME,
  NAV_FAVORITES,
  NAV_CART,
  NAV_PROFILE,
} from '@/constants/strings';

const TABS = [
  { route: '/', icon: Home, label: NAV_HOME },
  { route: '/favorites', icon: Heart, label: NAV_FAVORITES },
  { route: '/cart', icon: ShoppingCart, label: NAV_CART },
  { route: '/profile', icon: User, label: NAV_PROFILE },
] as const;

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { cartCount, favorites } = useShop();

  const isActive = (route: string) => {
    if (route === '/') {
      return pathname === '/' || pathname === '/index';
    }
    return pathname === route || pathname.startsWith(route + '/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.nav}>
        {TABS.map(({ route, icon: Icon, label }) => {
          const focused = isActive(route);
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
              onPress={() => {
                if (route === '/') {
                  router.replace('/');
                } else {
                  router.replace(route);
                }
              }}
              activeOpacity={0.7}>
              <Icon size={22} color={color} />
              {showBadge && badgeCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {badgeCount > 9 ? '9+' : badgeCount}
                  </Text>
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
    borderTopWidth: 0,
    paddingBottom: SPACING.xxl,
    paddingTop: SPACING.sm,
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: SPACING.sm,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.lightText,
    marginTop: 2,
  },
  tabTextActive: {
    fontSize: 11,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.primary,
    marginTop: 2,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
});
