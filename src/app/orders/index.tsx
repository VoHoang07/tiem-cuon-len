import {
    getOrderStatusColor,
    getOrderStatusLabel,
    ORDER_STATUS_NEXT,
} from '@/constants/orderStatus';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import type { Order, OrderStatus } from '@/types/order';
import { formatVND } from '@/utils/formatCurrency';
import {
    exportOrdersToGoshipCsv,
    formatShippingSlipForClipboard,
    getCarrierTrackingUrl,
    getCodCollectAmount,
} from '@/utils/shippingTracker';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
    ArrowRightCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Copy,
    Home,
    QrCode,
    ShoppingBag,
    Trash2,
    Truck,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STATUS_FILTERS: { key: 'ALL' | OrderStatus; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'pending_payment', label: 'Chờ thanh toán' },
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
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  const handleCopySlip = async (order: Order) => {
    const text = formatShippingSlipForClipboard(order);
    await Clipboard.setStringAsync(text);
    setCopiedOrderId(order.id);
    setTimeout(() => {
      setCopiedOrderId((prev) => (prev === order.id ? null : prev));
    }, 2000);
  };

  const isAdmin = role === 'admin';
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth > 0 ? rawWidth : 390) < 640;
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
    const carrier = item.shippingAddress?.shippingCarrier;
    const trackingCode = item.shippingAddress?.trackingCode;
    const trackingUrl = getCarrierTrackingUrl(carrier, trackingCode);
    const codAmount = getCodCollectAmount(item);
    const isCopied = copiedOrderId === item.id;

    return (
      <View style={styles.constrained}>
        <View style={[styles.orderCard, isMobile && styles.orderCardMobile]}>
          <TouchableOpacity
            style={[styles.orderCardBody, isMobile && styles.orderCardBodyMobile]}
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
                <View style={{ gap: 4, marginBottom: 4 }}>
                  <Text style={[styles.customerName, { marginBottom: 0 }]}>
                    Khách: {item.shippingAddress.fullName}
                    {item.shippingAddress.phone ? ` • ${item.shippingAddress.phone}` : ''}
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      alignSelf: 'flex-start',
                      backgroundColor:
                        item.shippingAddress.isVerifiedAccount ||
                        item.shippingAddress.email
                          ? '#D1FAE5'
                          : '#FEF3C7',
                      borderWidth: 1,
                      borderColor:
                        item.shippingAddress.isVerifiedAccount ||
                        item.shippingAddress.email
                          ? '#34D399'
                          : '#FCD34D',
                      borderRadius: 999,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                    }}>
                    <Text
                      style={{
                        fontSize: 10.5,
                        fontWeight: '800',
                        color:
                          item.shippingAddress.isVerifiedAccount ||
                          item.shippingAddress.email
                            ? '#065F46'
                            : '#92400E',
                      }}
                      numberOfLines={1}>
                      {item.shippingAddress.isVerifiedAccount ||
                      item.shippingAddress.email
                        ? `🛡️ Acc Thật Đã Xác Thực (${
                            item.shippingAddress.email ||
                            item.shippingAddress.customerAuthProvider ||
                            'Google / Gmail'
                          })`
                        : '⚠️ Khách vãng lai (Chưa liên kết Gmail/FB — Nên gọi xác nhận SĐT)'}
                    </Text>
                  </View>
                </View>
              ) : null}
              <Text style={styles.orderItems} numberOfLines={2}>
                {item.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}
              </Text>
              {item.items.some((i) => Boolean(i.product.giftCardNote)) && (
                <Text
                  style={{
                    fontSize: 11.5,
                    color: '#7A5230',
                    fontWeight: '600',
                    marginTop: 2,
                  }}
                  numberOfLines={2}>
                  {item.items
                    .filter((i) => Boolean(i.product.giftCardNote))
                    .map((i) => `💌 Thiệp: "${i.product.giftCardNote}"`)
                    .join(' • ')}
                </Text>
              )}
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('vi-VN')} • {item.paymentMethod}
              </Text>

              {/* Shipping & Tracking Pill */}
              <View style={styles.shippingMetaRow}>
                {trackingCode ? (
                  <View style={styles.trackingBadge}>
                    <Truck size={12} color="#2E7D32" />
                    <Text style={styles.trackingBadgeText} numberOfLines={1}>
                      {carrier ? `${carrier}: ` : 'Mã vận đơn: '}
                      {trackingCode}
                    </Text>
                  </View>
                ) : item.shippingAddress?.shippingMethod ? (
                  <View style={styles.shipMethodBadge}>
                    <Truck size={12} color="#5C4332" />
                    <Text style={styles.shipMethodBadgeText} numberOfLines={1}>
                      {item.shippingAddress.shippingMethod}
                    </Text>
                  </View>
                ) : null}

                {isAdmin && (
                  <View
                    style={[
                      styles.codBadge,
                      codAmount === 0 && styles.codBadgePaid,
                    ]}>
                    <Text
                      style={[
                        styles.codBadgeText,
                        codAmount === 0 && styles.codBadgeTextPaid,
                      ]}>
                      {codAmount > 0
                        ? `Thu COD: ${formatVND(codAmount)}`
                        : 'Thu COD: 0₫ (Đã CK)'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.orderFooter}>
              <Text style={styles.orderTotal}>{formatVND(item.total)}</Text>
              <View style={styles.detailHint}>
                <Text style={styles.detailHintText}>Chi tiết & Vận đơn</Text>
                <ChevronRight size={17} color={COLORS.lightText} />
              </View>
            </View>
          </TouchableOpacity>

          <View style={[styles.actionRow, isMobile && styles.actionRowMobile]}>
            <View style={styles.actionLeft}>
              {item.status === 'pending_payment' && (
                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={() => router.push(`/payment/${item.id}`)}
                  activeOpacity={0.8}>
                  <QrCode size={14} color="#FAF5EE" />
                  <Text style={styles.payNowBtnText}>Thanh toán QR</Text>
                </TouchableOpacity>
              )}
              {isAdmin && (
                <TouchableOpacity
                  style={[styles.copySlipBtn, isCopied && styles.copySlipBtnDone]}
                  onPress={() => handleCopySlip(item)}
                  activeOpacity={0.8}>
                  {isCopied ? (
                    <Check size={14} color="#2E7D32" />
                  ) : (
                    <Copy size={13.5} color="#3D2B1F" />
                  )}
                  <Text
                    style={[
                      styles.copySlipBtnText,
                      isCopied && { color: '#2E7D32' },
                    ]}>
                    {isCopied ? 'Đã chép đơn Ship' : 'Chép đơn Ship'}
                  </Text>
                </TouchableOpacity>
              )}
              {!isAdmin && trackingCode && trackingUrl ? (
                <TouchableOpacity
                  style={styles.trackOrderBtn}
                  onPress={() => Linking.openURL(trackingUrl)}
                  activeOpacity={0.8}>
                  <Truck size={14} color="#2E7D32" />
                  <Text style={styles.trackOrderBtnText}>Tra cứu vận đơn</Text>
                </TouchableOpacity>
              ) : null}
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
              ) : null}
            </View>

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
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={22} color={COLORS.darkText} />
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={20} color={COLORS.darkText} />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, isMobile && styles.headerTitleMobile]} numberOfLines={1}>
            {isAdmin ? 'Quản lý đơn hàng' : 'Đơn hàng của tôi'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isAdmin
              ? `${baseOrders.length} đơn đặt hàng toàn hệ thống`
              : `${baseOrders.length} đơn hàng đã đặt`}
          </Text>
        </View>
        <View style={{ width: isMobile ? 38 : 80 }} />
      </View>

      {/* Status Filter Bar for both Admin and Client */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.filterRow, isMobile && styles.filterRowMobile]}>
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

      {/* Admin Goship.io Bulk Export & Portal Bar */}
      {isAdmin && displayOrders.length > 0 && (
        <View
          style={{
            marginHorizontal: isMobile ? 12 : 20,
            marginBottom: 10,
            backgroundColor: '#FAF4EC',
            borderWidth: 1,
            borderColor: '#E5D5C3',
            borderRadius: 14,
            paddingHorizontal: 12,
            paddingVertical: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 8,
          }}>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Text
              style={{
                fontSize: 12.5,
                fontWeight: '800',
                color: '#3B281E',
              }}>
              📦 Công cụ đẩy đơn hàng loạt lên Goship.io ({displayOrders.length} đơn)
            </Text>
            <Text
              style={{
                fontSize: 11,
                color: '#6E5643',
                marginTop: 2,
              }}>
              Tải file Excel/CSV chuẩn định dạng Goship (Tên, SĐT, ĐC 3 cấp, Tiền COD, Khai giá, Ghi chú thiệp)
            </Text>
          </View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}>
            <TouchableOpacity
              style={{
                backgroundColor: '#4A3427',
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 9,
              }}
              onPress={() => exportOrdersToGoshipCsv(displayOrders)}
              activeOpacity={0.85}>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: '#FFFDF9',
                }}>
                📥 Xuất Excel / CSV Goship ({displayOrders.length} đơn)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                backgroundColor: '#FFFDF9',
                borderWidth: 1,
                borderColor: '#D6C2AD',
                paddingHorizontal: 11,
                paddingVertical: 7,
                borderRadius: 9,
              }}
              onPress={() => Linking.openURL('https://goship.io')}
              activeOpacity={0.85}>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: '#4A3427',
                }}>
                🚀 Mở Goship.io ›
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
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
    gap: 8,
  },
  headerMobile: {
    paddingHorizontal: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#3D2B1F', textAlign: 'center' },
  headerTitleMobile: { fontSize: 18 },
  headerSubtitle: { fontSize: 12, color: COLORS.mediumText, marginTop: 2, textAlign: 'center' },
  filterRow: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    gap: 8,
  },
  filterRowMobile: {
    paddingHorizontal: 12,
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
  orderCardMobile: {
    marginHorizontal: 12,
    borderRadius: 18,
  },
  orderCardBody: {
    padding: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  orderCardBodyMobile: {
    padding: 14,
    paddingBottom: 10,
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
  shippingMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
  },
  trackingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF6E8',
    borderWidth: 1,
    borderColor: '#B8DFB2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  trackingBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#2E7D32',
    flexShrink: 1,
  },
  shipMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3ECE2',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '100%',
  },
  shipMethodBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4332',
    flexShrink: 1,
  },
  codBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codBadgePaid: {
    backgroundColor: '#EBF5FF',
  },
  codBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  codBadgeTextPaid: {
    color: '#1D4ED8',
  },

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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    paddingTop: 4,
  },
  actionRowMobile: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  actionLeft: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  payNowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  copySlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3ECE2',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  copySlipBtnDone: {
    backgroundColor: '#EAF6E8',
    borderColor: '#B8DFB2',
  },
  copySlipBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  trackOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF6E8',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#B8DFB2',
  },
  trackOrderBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2E7D32',
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
