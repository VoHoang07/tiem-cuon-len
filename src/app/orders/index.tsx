import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingBag, ChevronRight, Trash2, Home } from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getOrderStatusLabel, getOrderStatusColor } from '@/constants/orderStatus';
import type { Order } from '@/types/order';

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, getOrdersByUser, refetchOrders, deleteOrder } = useOrders();
  const { user, role } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'admin';
  const displayOrders = isAdmin ? orders : getOrdersByUser(user?.id ?? '');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchOrders();
    setRefreshing(false);
  }, [refetchOrders]);

  const handleDelete = (order: Order) => {
    if (typeof window !== 'undefined' && window.confirm) {
      const confirmed = window.confirm('Bạn có chắc muốn xoá đơn hàng này không?');
      if (!confirmed) return;
      deleteOrder(order.id).catch((err) => {
        if (__DEV__) console.error('[DELETE FAILED]', err);
        Alert.alert('Lỗi', 'Không thể xoá đơn hàng. Vui lòng thử lại.');
      });
    } else {
      Alert.alert(
        'Xoá đơn hàng',
        'Bạn có chắc muốn xoá đơn hàng này không?',
        [
          { text: 'Hủy', style: 'cancel' },
          {
            text: 'Xoá',
            style: 'destructive',
            onPress: () => {
              deleteOrder(order.id).catch((err) => {
                if (__DEV__) console.error('[DELETE FAILED]', err);
                Alert.alert('Lỗi', 'Không thể xoá đơn hàng. Vui lòng thử lại.');
              });
            },
          },
        ],
      );
    }
  };

  const renderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      <TouchableOpacity
        style={styles.orderCardBody}
        onPress={() => router.push(`/orders/${item.id}`)}
        activeOpacity={0.7}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>#{item.id.slice(-8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(item.status) + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: getOrderStatusColor(item.status) }]} />
            <Text style={[styles.statusText, { color: getOrderStatusColor(item.status) }]}>
              {getOrderStatusLabel(item.status)}
            </Text>
          </View>
        </View>

        <View style={styles.orderBody}>
          {isAdmin && item.shippingAddress?.fullName ? (
            <Text style={styles.customerName}>
              {item.shippingAddress.fullName}
            </Text>
          ) : null}
          <Text style={styles.orderItems} numberOfLines={2}>
            {item.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}
          </Text>
          <Text style={styles.orderDate}>
            {new Date(item.createdAt).toLocaleDateString('vi-VN')}
          </Text>
        </View>

        <View style={styles.orderFooter}>
          <Text style={styles.orderTotal}>{formatVND(item.total)}</Text>
          <ChevronRight size={18} color={COLORS.lightText} />
        </View>
      </TouchableOpacity>

      <View style={styles.deleteRow}>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => handleDelete(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Trash2 size={16} color={COLORS.error} />
          <Text style={styles.deleteBtnText}>Xoá</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListHeader = (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/orders'); }} style={styles.backBtn}>
          <ChevronLeft size={24} color={COLORS.darkText} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
          <Home size={20} color={COLORS.darkText} />
        </TouchableOpacity>
      </View>
      <Text style={styles.headerTitle}>Đơn hàng</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <ShoppingBag size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
      <Text style={styles.emptySubtext}>Đơn hàng của bạn sẽ xuất hiện ở đây</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={displayOrders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={displayOrders.length === 0 ? styles.listEmpty : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  listContent: { paddingBottom: 80 },
  listEmpty: { flexGrow: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  homeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
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

  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  orderCardBody: {
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
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
  customerName: { fontSize: 14, fontWeight: '700', color: COLORS.primary, marginBottom: 4 },
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

  deleteRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingRight: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF0ED',
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
});
