import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShoppingBag, ChevronRight, Trash2, Home, ArrowRightCircle } from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  ORDER_STATUS_NEXT,
} from '@/constants/orderStatus';
import type { Order, OrderStatus } from '@/types/order';

const STATUS_FILTERS: { key: 'ALL' | OrderStatus; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'Đang xử lý', label: 'Đang xử lý' },
  { key: 'Đang giao', label: 'Đang giao' },
  { key: 'Hoàn thành', label: 'Hoàn thành' },
  { key: 'Đã hủy', label: 'Đã hủy' },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { orders, getOrdersByUser, refetchOrders, deleteOrder, updateOrderStatus } = useOrders();
  const { user, role } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');

  const isAdmin = role === 'admin';
  const baseOrders = isAdmin ? orders : getOrdersByUser(user?.id ?? '');

  const displayOrders = useMemo(() => {
    if (statusFilter === 'ALL') return baseOrders;
    return baseOrders.filter((o) => o.status === statusFilter);
  }, [baseOrders, statusFilter]);

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

  const renderItem = ({ item }: { item: Order }) => {
    const nextStatus = ORDER_STATUS_NEXT[item.status];
    return (
      <View style={styles.constrained}>
        <View style={styles.orderCard}>
          <TouchableOpacity
            style={styles.orderCardBody}
            onPress={() => router.push(`/orders/${item.id}`)}
            activeOpacity={0.75}>
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
                  Khách: {item.shippingAddress.fullName}
                  {item.shippingAddress.phone ? ` • ${item.shippingAddress.phone}` : ''}
                </Text>
              ) : null}
              <Text style={styles.orderItems} numberOfLines={2}>
                {item.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}
              </Text>
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('vi-VN')} • {item.paymentMethod}
              </Text>
            </View>

            <View style={styles.orderFooter}>
              <Text style={styles.orderTotal}>{formatVND(item.total)}</Text>
              <View style={styles.detailHint}>
                <Text style={styles.detailHintText}>Chi tiết</Text>
                <ChevronRight size={17} color={COLORS.lightText} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            {isAdmin && nextStatus ? (
              <TouchableOpacity
                style={styles.advanceBtn}
                onPress={() => updateOrderStatus(item.id, nextStatus)}
                activeOpacity={0.8}>
                <ArrowRightCircle size={15} color="#3D2B1F" />
                <Text style={styles.advanceBtnText}>
                  Chuyển: {getOrderStatusLabel(nextStatus)}
                </Text>
              </TouchableOpacity>
            ) : <View />}

            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Trash2 size={15} color={COLORS.error} />
              <Text style={styles.deleteBtnText}>Xoá</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const ListHeader = (
    <View style={styles.constrained}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
            <Home size={20} color={COLORS.darkText} />
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {isAdmin ? 'Quản lý đơn hàng' : 'Đơn hàng của tôi'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {isAdmin
              ? `${baseOrders.length} đơn đặt hàng toàn hệ thống`
              : `${baseOrders.length} đơn hàng đã đặt`}
          </Text>
        </View>
        <View style={{ width: 80 }} />
      </View>

      {/* Status Filter Bar for both Admin and Client */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}>
        {STATUS_FILTERS.map((f) => {
          const active = statusFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setStatusFilter(f.key)}
              activeOpacity={0.75}>
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const ListEmpty = (
    <View style={[styles.constrained, styles.empty]}>
      <ShoppingBag size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>Chưa có đơn hàng nào</Text>
      <Text style={styles.emptySubtext}>
        {isAdmin
          ? 'Các đơn đặt hàng mới từ khách sẽ hiển thị tại đây'
          : 'Đơn hàng của bạn sẽ xuất hiện ở đây sau khi đặt mua'}
      </Text>
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
  listContent: { paddingBottom: 100 },
  listEmpty: { flexGrow: 1 },
  constrained: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
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
  headerCenter: {
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#3D2B1F' },
  headerSubtitle: { fontSize: 12, color: COLORS.mediumText, marginTop: 2 },
  filterRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  filterChipActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  filterChipTextActive: {
    color: '#FAF5EE',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  emptyTitle: { fontSize: 19, fontWeight: '800', color: '#3D2B1F' },
  emptySubtext: { fontSize: 14, color: COLORS.mediumText, textAlign: 'center' },

  orderCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5D6C5',
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
  orderId: { fontSize: 14, fontWeight: '800', color: '#3D2B1F' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800' },

  orderBody: { marginBottom: SPACING.sm },
  customerName: { fontSize: 13.5, fontWeight: '800', color: COLORS.primary, marginBottom: 4 },
  orderItems: { fontSize: 13.5, color: COLORS.darkText, lineHeight: 19, fontWeight: '600' },
  orderDate: { fontSize: 12, color: COLORS.lightText, marginTop: 4 },

  orderFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F0E6D8',
    paddingTop: SPACING.sm,
  },
  orderTotal: { fontSize: 17, fontWeight: '900', color: '#3D2B1F' },
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  detailHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.lightText,
  },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    paddingTop: 4,
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D8C3AD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  advanceBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF0ED',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F5C9C0',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
});
