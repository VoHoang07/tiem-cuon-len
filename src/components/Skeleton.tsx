import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/theme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 8, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: COLORS.border,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <View style={styles.productCard}>
      <Skeleton height={140} borderRadius={12} />
      <View style={styles.cardInfo}>
        <Skeleton width="70%" height={14} />
        <Skeleton width="40%" height={18} style={{ marginTop: 8 }} />
        <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
      </View>
    </View>
  );
}

export function OrderCardSkeleton() {
  return (
    <View style={styles.orderCard}>
      <View style={styles.orderHeader}>
        <Skeleton width={80} height={16} />
        <Skeleton width={100} height={24} borderRadius={12} />
      </View>
      <Skeleton width="90%" height={14} style={{ marginTop: 10 }} />
      <Skeleton width="60%" height={12} style={{ marginTop: 6 }} />
      <View style={styles.orderFooter}>
        <Skeleton width={60} height={20} />
      </View>
    </View>
  );
}

export function HomeSkeleton() {
  return (
    <View style={styles.homeContainer}>
      {/* Header skeleton */}
      <View style={styles.homeHeader}>
        <View>
          <Skeleton width={120} height={14} />
          <Skeleton width={160} height={24} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={44} height={44} borderRadius={22} />
      </View>

      {/* Search bar skeleton */}
      <Skeleton height={48} borderRadius={12} style={{ marginHorizontal: 16, marginTop: 8 }} />

      {/* Category chips skeleton */}
      <View style={styles.chipRow}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} width={70} height={32} borderRadius={16} />
        ))}
      </View>

      {/* Featured section */}
      <Skeleton width={140} height={18} style={{ marginHorizontal: 16, marginTop: 16 }} />
      <View style={styles.featuredRow}>
        {[1, 2].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </View>

      {/* Grid skeleton */}
      <Skeleton width={140} height={18} style={{ marginHorizontal: 16, marginTop: 20 }} />
      <View style={styles.gridRow}>
        {[1, 2, 3, 4].map((i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  productCard: {
    width: 160,
    marginRight: 12,
    marginBottom: 16,
  },
  cardInfo: {
    paddingTop: 10,
  },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  homeContainer: {
    paddingTop: 16,
  },
  homeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  featuredRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    marginTop: 12,
    justifyContent: 'space-between',
  },
});
