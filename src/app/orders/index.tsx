import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingBag, ChevronRight } from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { useAuth } from '@/store/AuthContext';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getOrderStatusLabel, getOrderStatusColor } from '@/constants/orderStatus';
import type { Order } from '@/types/order';

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, getOrdersByUser, refetchOrders } = useOrders();
  const { user, role } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'admin';
  const displayOrders = isAdmin ? orders : getOrdersByUser(user?.id ?? '');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchOrders();
    setRefreshing(false);
  }, [refetchOrders]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/orders'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Đơn hàng</Text>
          <View style={{ width: 40 }} />
        </View>

        {displayOrders.length === 0 ? (
          <View style={styles.empty}>
            <ShoppingBag size={64} color={COLORS.lightText} />
            <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
            <Text style={styles.emptySubtext}>Đơn hàng của bạn sẽ xuất hiện ở đây</Text>
          </View>
        ) : (
          <View style={styles.orderList}>
            {displayOrders.map((order) => (
              <TouchableOpacity
                key={order.id}
                style={styles.orderCard}
                onPress={() => router.push(`/orders/${order.id}`)}>
                <View style={styles.orderHeader}>
                  <Text style={styles.orderId}>#{order.id.slice(-8)}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) + '20' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getOrderStatusColor(order.status) }]} />
                    <Text style={[styles.statusText, { color: getOrderStatusColor(order.status) }]}>
                      {getOrderStatusLabel(order.status)}
                    </Text>
                  </View>
                </View>
                <View style={styles.orderBody}>
                  <Text style={styles.orderItems} numberOfLines={2}>
                    {order.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}
                  </Text>
                  <Text style={styles.orderDate}>
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </Text>
                </View>
                <View style={styles.orderFooter}>
                  <Text style={styles.orderTotal}>{formatVND(order.total)}</Text>
                  <ChevronRight size={18} color={COLORS.lightText} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.md,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkText },
  emptySubtext: { fontSize: 14, color: COLORS.mediumText, textAlign: 'center' },
  orderList: { paddingHorizontal: SPACING.lg },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  orderId: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  orderBody: { marginBottom: SPACING.sm },
  orderItems: { fontSize: 13, color: COLORS.mediumText, lineHeight: 18 },
  orderDate: { fontSize: 12, color: COLORS.lightText, marginTop: 4 },
  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  orderTotal: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
});
