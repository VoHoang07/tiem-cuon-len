import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Package } from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  ORDER_STATUS_NEXT,
} from '@/constants/orderStatus';

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus } = useOrders();
  const { role } = useAuth();

  const order = orders.find((o) => o.id === id);

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Không tìm thấy đơn hàng</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAdmin = role === 'admin';
  const nextStatus = ORDER_STATUS_NEXT[order.status];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/orders'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chi tiết đơn hàng</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.section}>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status) + '20' }]}>
              <View style={[styles.statusDot, { backgroundColor: getOrderStatusColor(order.status) }]} />
              <Text style={[styles.statusText, { color: getOrderStatusColor(order.status) }]}>
                {getOrderStatusLabel(order.status)}
              </Text>
            </View>
            {isAdmin && nextStatus && (
              <TouchableOpacity
                style={styles.updateStatusBtn}
                onPress={() => updateOrderStatus(order.id, nextStatus)}>
                <Text style={styles.updateStatusText}>
                  Chuyển: {getOrderStatusLabel(nextStatus)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mã đơn hàng</Text>
          <Text style={styles.sectionValue}>#{order.id.slice(-8)}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Khách hàng</Text>
          <Text style={styles.sectionValue}>{order.shippingAddress?.fullName ?? '—'}</Text>
          {order.shippingAddress?.phone ? (
            <Text style={styles.sectionSub}>{order.shippingAddress.phone}</Text>
          ) : null}
          {order.shippingAddress?.detailAddress ? (
            <Text style={styles.sectionSub}>
              {[order.shippingAddress.detailAddress, order.shippingAddress.ward, order.shippingAddress.district, order.shippingAddress.city].filter(Boolean).join(', ')}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ngày đặt</Text>
          <Text style={styles.sectionValue}>
            {new Date(order.createdAt).toLocaleDateString('vi-VN', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sản phẩm</Text>
          {order.items.map((item) => (
            <View key={item.product.id} style={styles.itemRow}>
              <View style={styles.itemIcon}>
                {item.product.image ? (
                  <Image
                    source={{ uri: item.product.image }}
                    style={styles.itemProductImage}
                    resizeMode="cover"
                  />
                ) : (
                  <Package size={20} color={COLORS.primary} />
                )}
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                <Text style={styles.itemMeta}>SL: {item.quantity} x {formatVND(item.price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatVND(item.price * item.quantity)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thanh toán</Text>
          <Text style={styles.sectionValue}>{order.paymentMethod}</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tổng cộng</Text>
            <Text style={styles.totalValue}>{formatVND(order.total)}</Text>
          </View>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 120 },
  notFoundText: { fontSize: 18, fontWeight: '600', color: COLORS.mediumText },
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
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: COLORS.lightText, marginBottom: 4 },
  sectionValue: { fontSize: 15, fontWeight: '600', color: COLORS.darkText },
  sectionSub: { fontSize: 13, color: COLORS.mediumText, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 14, fontWeight: '700' },
  updateStatusBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  updateStatusText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  itemProductImage: {
    width: 40,
    height: 40,
    resizeMode: 'cover',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  itemMeta: { fontSize: 12, color: COLORS.mediumText, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
});
