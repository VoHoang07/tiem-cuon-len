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
    computeHandmadeCraftingSchedule,
    exportOrdersToGoshipCsv,
    formatShippingSlipForClipboard,
    getCachedGuestTrackedOrders,
    getCarrierTrackingUrl,
    getCodCollectAmount,
    lookupPublicOrdersByPhoneOrCode,
    syncActiveOrdersWithGoship,
    type SyncedOrderGoshipPayload,
} from '@/utils/shippingTracker';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
    ArrowRightCircle,
    Check,
    ChevronLeft,
    ChevronRight,
    Clock,
    Copy,
    Home,
    LogIn,
    QrCode,
    Search,
    ShoppingBag,
    Trash2,
    Truck,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
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
  const {
    orders,
    getOrdersByUser,
    refetchOrders,
    deleteOrder,
    updateOrderStatus,
    rescueOrdersManual,
  } = useOrders();
  const { user, role, isAuthenticated } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [rescuingOrders, setRescuingOrders] = useState(false);
  const [rescueStatusMsg, setRescueStatusMsg] = useState<string | null>(null);

  const handleScanLocalRescue = useCallback(async () => {
    setRescuingOrders(true);
    setRescueStatusMsg(null);
    try {
      const res = await rescueOrdersManual();
      setRescueStatusMsg(res.message);
    } catch {
      setRescueStatusMsg('Không thể quét khôi phục đơn hàng lúc này.');
    } finally {
      setRescuingOrders(false);
    }
  }, [rescueOrdersManual]);

  const handleImportOrdersFile = useCallback(() => {
    if (typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,text/csv,application/json';
    input.onchange = async (e: any) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      setRescuingOrders(true);
      setRescueStatusMsg(null);
      try {
        const text = await file.text();
        const res = await rescueOrdersManual(text);
        setRescueStatusMsg(res.message);
      } catch {
        setRescueStatusMsg('Lỗi đọc file CSV/JSON đơn hàng.');
      } finally {
        setRescuingOrders(false);
      }
    };
    input.click();
  }, [rescueOrdersManual]);

  const initialGuestCache = useMemo(() => getCachedGuestTrackedOrders(), []);
  const [guestLookupQuery, setGuestLookupQuery] = useState<string>(
    initialGuestCache.lastQuery
  );
  const [guestOrders, setGuestOrders] = useState<Order[]>(
    initialGuestCache.orders
  );
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [hasSearchedGuest, setHasSearchedGuest] = useState(
    initialGuestCache.orders.length > 0
  );
  const lastAutoSearchedQueryRef = useRef<string>(initialGuestCache.lastQuery);
  const [syncedPatchesMap, setSyncedPatchesMap] = useState<
    Record<string, SyncedOrderGoshipPayload>
  >({});

  const runGuestLookup = useCallback(async (rawQuery: string) => {
    const clean = rawQuery.trim();
    if (!clean) {
      setGuestError('Vui lòng nhập Số điện thoại nhận hàng hoặc Mã đơn hàng.');
      return;
    }
    lastAutoSearchedQueryRef.current = clean;
    setGuestError(null);
    setGuestLoading(true);
    const res = await lookupPublicOrdersByPhoneOrCode(clean);
    setGuestLoading(false);
    setHasSearchedGuest(true);
    if (!res.ok) {
      setGuestError(res.error || 'Không thể tra cứu đơn hàng lúc này.');
      return;
    }
    setGuestOrders(res.orders);
  }, []);

  const handleGuestLookup = async () => {
    await runGuestLookup(guestLookupQuery);
  };

  // Auto-trigger Shopee-style lookup as soon as unauthenticated customer finishes typing a 10-digit phone number or CUONLEN code
  useEffect(() => {
    if (isAuthenticated) return;
    const raw = guestLookupQuery.trim();
    if (!raw || raw === lastAutoSearchedQueryRef.current) return;
    const digits = raw.replace(/[^0-9]/g, '').replace(/^84/, '0');
    const isCompleteVnPhone = /^0[35789]\d{8}$/.test(digits);
    const isOrderCode =
      raw.toUpperCase().startsWith('CUONLEN-') && raw.length >= 12;
    if (!isCompleteVnPhone && !isOrderCode) return;

    const timer = setTimeout(() => {
      void runGuestLookup(raw);
    }, 320);
    return () => clearTimeout(timer);
  }, [guestLookupQuery, isAuthenticated, runGuestLookup]);

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
  const rawBaseOrders = isAdmin
    ? orders
    : isAuthenticated
      ? getOrdersByUser(user?.id ?? '')
      : guestOrders;

  const baseOrders = useMemo(
    () =>
      rawBaseOrders.map((o) => {
        const patch = syncedPatchesMap[o.id];
        if (!patch) return o;
        return {
          ...o,
          status: patch.status || o.status,
          shippingAddress: {
            ...o.shippingAddress,
            ...patch.shippingAddress,
          },
        };
      }),
    [rawBaseOrders, syncedPatchesMap]
  );

  const activeOrderIdsSignature = useMemo(
    () =>
      rawBaseOrders
        .filter(
          (o) =>
            o.status === 'Đang giao' ||
            o.status === 'Đang chuẩn bị hàng' ||
            o.status === 'Đang xử lý'
        )
        .slice(0, 8)
        .map((o) => o.id)
        .join(','),
    [rawBaseOrders]
  );

  // Auto-sync logged-in customer's active orders with Goship SPX in the background
  useEffect(() => {
    if (!isAuthenticated || !activeOrderIdsSignature) return;
    let active = true;
    const ids = activeOrderIdsSignature.split(',').filter(Boolean);
    syncActiveOrdersWithGoship(ids).then((res) => {
      if (!active || !res.ok || res.syncedOrders.length === 0) return;
      let hasNewTracking = false;
      const nextMap: Record<string, SyncedOrderGoshipPayload> = {};
      for (const s of res.syncedOrders) {
        if (s?.id) {
          nextMap[s.id] = s;
          if (s.shippingAddress?.trackingCode) {
            hasNewTracking = true;
          }
        }
      }
      setSyncedPatchesMap((prev) => ({ ...prev, ...nextMap }));
      if (hasNewTracking) {
        void refetchOrders();
      }
    });
    return () => {
      active = false;
    };
  }, [isAuthenticated, activeOrderIdsSignature, refetchOrders]);

  const displayOrders = useMemo(() => {
    if (statusFilter === 'ALL') return baseOrders;
    return baseOrders.filter((o) => o.status === statusFilter);
  }, [baseOrders, statusFilter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchOrders();
    setRefreshing(false);
  }, [refetchOrders]);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (order: Order) => {
    if (confirmDeleteId === order.id) {
      setConfirmDeleteId(null);
      deleteOrder(order.id).catch((err) => {
        if (__DEV__) console.error('[DELETE FAILED]', err);
        Alert.alert('Lỗi', 'Không thể xoá đơn hàng. Vui lòng thử lại.');
      });
    } else {
      setConfirmDeleteId(order.id);
      setTimeout(() => {
        setConfirmDeleteId((prev) => (prev === order.id ? null : prev));
      }, 4000);
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
              {item.shippingAddress?.bonusGiftProductName && (
                <View
                  style={{
                    marginTop: 5,
                    alignSelf: 'flex-start',
                    backgroundColor: '#FFF1EE',
                    borderWidth: 1,
                    borderColor: '#FFCCC2',
                    borderRadius: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                  }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: '#EE4D2D',
                    }}>
                    {isAdmin
                      ? `🎁 NHỚ BỎ KÈM QUÀ TẶNG (0₫): ${item.shippingAddress.bonusGiftProductName}`
                      : `🎁 Quà tặng kèm (0₫): ${item.shippingAddress.bonusGiftProductName}`}
                  </Text>
                </View>
              )}
              <Text style={styles.orderDate}>
                {new Date(item.createdAt).toLocaleDateString('vi-VN')} •{' '}
                {item.status === 'pending_payment'
                  ? 'Chuyển khoản QR (Chưa nhận thanh toán)'
                  : item.paymentMethod}
              </Text>
              {!isAdmin && item.status === 'pending_payment' && (
                <View
                  style={{
                    marginTop: 5,
                    backgroundColor: '#FEF2F2',
                    borderWidth: 1,
                    borderColor: '#FECACA',
                    borderRadius: 8,
                    paddingHorizontal: 9,
                    paddingVertical: 5,
                  }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: '#B91C1C',
                    }}>
                    ⏳ Đơn chưa hoàn tất đặt: Vui lòng bấm &ldquo;Quét mã QR thanh toán&rdquo; bên dưới để Tiệm bắt đầu chuẩn bị mẫu nhé!
                  </Text>
                </View>
              )}

              {/* Shipping & Handmade Crafting Schedule Pill */}
              <View style={styles.shippingMetaRow}>
                {trackingCode ||
                item.status === 'Đang giao' ||
                item.status === 'Hoàn thành' ||
                item.shippingAddress?.craftingStage === 'handed_to_spx' ? (
                  <View
                    style={{
                      width: '100%',
                      backgroundColor: '#F8FAFC',
                      borderWidth: 1,
                      borderColor: '#BBF7D0',
                      borderRadius: 12,
                      paddingHorizontal: 11,
                      paddingVertical: 9,
                      gap: 7,
                    }}>
                    {/* Top Row: Carrier + Waybill (Never overflows right border) */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                      }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flex: 1,
                          minWidth: 0,
                        }}>
                        <View
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 6,
                            backgroundColor: '#DCFCE7',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Truck size={12} color="#15803D" />
                        </View>
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 12,
                            fontWeight: '800',
                            color: '#1E293B',
                          }}
                          numberOfLines={1}>
                          {carrier || 'SPX Express'}
                          {trackingCode
                            ? ` • ${trackingCode}`
                            : ' • Đang vận chuyển'}
                        </Text>
                      </View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '700',
                          color: '#15803D',
                        }}>
                        Bản đồ ›
                      </Text>
                    </View>

                    {/* Compact Mobile Shopee Route Track Strip */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 2,
                      }}>
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '700',
                          color: '#64748B',
                        }}>
                        Kho Thủ Đức
                      </Text>
                      <View
                        style={{
                          flex: 1,
                          height: 4,
                          backgroundColor: '#E2E8F0',
                          borderRadius: 999,
                          position: 'relative',
                          justifyContent: 'center',
                        }}>
                        <View
                          style={{
                            width:
                              item.status === 'Hoàn thành' ? '100%' : '55%',
                            height: '100%',
                            backgroundColor: '#16A34A',
                            borderRadius: 999,
                          }}
                        />
                        <View
                          style={{
                            position: 'absolute',
                            left: item.status === 'Hoàn thành' ? '90%' : '50%',
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: '#16A34A',
                            borderWidth: 1.5,
                            borderColor: '#FFFFFF',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <Truck size={9.5} color="#FFFFFF" />
                        </View>
                      </View>
                      <Text
                        style={{
                          fontSize: 10.5,
                          fontWeight: '800',
                          color: '#14532D',
                          maxWidth: 110,
                        }}
                        numberOfLines={1}>
                        {item.shippingAddress?.district ||
                          item.shippingAddress?.city ||
                          'Điểm nhận'}
                      </Text>
                    </View>

                    {/* Single-Line Clean Current Checkpoint */}
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '600',
                        color: '#334155',
                      }}
                      numberOfLines={1}>
                      📍{' '}
                      {item.shippingAddress?.goshipStatusText ||
                        item.shippingAddress?.goshipHistory?.[0]?.description ||
                        (item.status === 'Hoàn thành'
                          ? 'Đã giao hàng thành công'
                          : `Đang giao tới ${[
                              item.shippingAddress?.district,
                              item.shippingAddress?.city,
                            ]
                              .filter(Boolean)
                              .join(', ') || 'địa chỉ nhận hàng'}`)}
                    </Text>
                  </View>
                ) : item.status === 'Đang xử lý' ||
                  item.status === 'Đang chuẩn bị hàng' ? (
                  (() => {
                    const sched = computeHandmadeCraftingSchedule(item);
                    return (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 5,
                          backgroundColor: '#FFFBEB',
                          borderWidth: 1,
                          borderColor: '#FDE68A',
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          maxWidth: '100%',
                        }}>
                        <Clock size={12} color="#B45309" />
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: '#92400E',
                            flexShrink: 1,
                          }}
                          numberOfLines={2}>
                          {sched.activeStageTitle} • Dự kiến gửi SPX:{' '}
                          {sched.expectedShipWindowText}
                        </Text>
                      </View>
                    );
                  })()
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
                      codAmount === 0 &&
                        item.status !== 'pending_payment' &&
                        styles.codBadgePaid,
                      item.status === 'pending_payment' && {
                        backgroundColor: '#FEE2E2',
                        borderColor: '#EF4444',
                        borderWidth: 1,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.codBadgeText,
                        codAmount === 0 &&
                          item.status !== 'pending_payment' &&
                          styles.codBadgeTextPaid,
                        item.status === 'pending_payment' && {
                          color: '#B91C1C',
                          fontWeight: '900',
                        },
                      ]}>
                      {item.status === 'pending_payment'
                        ? `⛔ CHƯA CHUYỂN KHOẢN (${formatVND(item.total)})`
                        : codAmount > 0
                          ? `Thu COD: ${formatVND(codAmount)}`
                          : '✅ Đã chuyển khoản (Thu COD: 0₫)'}
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
              {item.status === 'pending_payment' && !isAdmin && (
                <TouchableOpacity
                  style={styles.payNowBtn}
                  onPress={() => router.push(`/payment/${item.id}`)}
                  activeOpacity={0.8}>
                  <QrCode size={14} color="#FAF5EE" />
                  <Text style={styles.payNowBtnText}>Quét mã QR thanh toán</Text>
                </TouchableOpacity>
              )}
              {isAdmin && item.status !== 'pending_payment' && (
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
              {!isAdmin && trackingCode ? (
                <TouchableOpacity
                  style={styles.trackOrderBtn}
                  onPress={() => router.push(`/orders/${item.id}`)}
                  activeOpacity={0.8}>
                  <Truck size={14} color="#2E7D32" />
                  <Text style={styles.trackOrderBtnText}>
                    Xem trạm SPX trực tiếp
                  </Text>
                </TouchableOpacity>
              ) : null}
              {isAdmin && nextStatus ? (
                <TouchableOpacity
                  style={styles.advanceBtn}
                  onPress={() => updateOrderStatus(item.id, nextStatus)}
                  activeOpacity={0.8}>
                  <ArrowRightCircle size={15} color="#3D2B1F" />
                  <Text style={styles.advanceBtnText}>
                    {item.status === 'pending_payment'
                      ? 'Xác nhận tiền đã về (Duyệt tay)'
                      : `Chuyển: ${getOrderStatusLabel(nextStatus)}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
              </View>

              {!item.isMaskedGuestView && (
              <TouchableOpacity
                style={[
                  styles.deleteBtn,
                  confirmDeleteId === item.id && {
                    backgroundColor: '#FEE2E2',
                    borderColor: '#EF4444',
                    borderWidth: 1,
                  },
                ]}
                onPress={() => handleDelete(item)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Trash2 size={15} color={COLORS.error} />
                <Text style={styles.deleteBtnText}>
                  {confirmDeleteId === item.id ? 'Bấm lần nữa để xoá' : 'Xoá'}
                </Text>
              </TouchableOpacity>
              )}
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
            {isAdmin
              ? 'Quản lý đơn hàng & Vận đơn SPX'
              : isAuthenticated
                ? 'Hành trình đơn hàng của tôi'
                : 'Tra cứu hành trình đơn hàng'}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {isAdmin
              ? `${baseOrders.length} đơn đặt hàng toàn hệ thống`
              : isAuthenticated
                ? `Tự động hiển thị ${baseOrders.length} đơn hàng của tài khoản bạn`
                : 'Kiểm tra tiến độ đan 5–6 ngày & hành trình bưu cục SPX'}
          </Text>
        </View>
        <View style={{ width: isMobile ? 38 : 80 }} />
        </View>

        {/* GUEST PUBLIC LOOKUP CARD (Compact, Single-Row Search Bar for Mobile) */}
        {!isAuthenticated && (
        <View
          style={{
            marginHorizontal: isMobile ? 12 : 20,
            marginBottom: 10,
            backgroundColor: '#FFFDF9',
            borderWidth: 1,
            borderColor: '#E5D5C3',
            borderRadius: 16,
            padding: 12,
            gap: 8,
            ...SHADOWS.small,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '800',
                color: '#3D2B1F',
                flex: 1,
              }}
              numberOfLines={1}>
              Tra cứu nhanh bằng SĐT hoặc Mã đơn
            </Text>
            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: '/login',
                  params: { redirect: '/orders' },
                })
              }
              activeOpacity={0.8}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#F3ECE2',
                paddingHorizontal: 9,
                paddingVertical: 4,
                borderRadius: 999,
              }}>
              <LogIn size={11.5} color="#3D2B1F" />
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: '#3D2B1F',
                }}>
                Đăng nhập
              </Text>
            </TouchableOpacity>
          </View>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}>
            <View
              style={{
                flex: 1,
                minWidth: 0,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 7,
                backgroundColor: '#FAF6F0',
                borderWidth: 1,
                borderColor: '#DCCAB8',
                borderRadius: 11,
                paddingHorizontal: 11,
                paddingVertical: 8,
              }}>
              <Search size={15} color={COLORS.mediumText} />
              <TextInput
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 16,
                  color: COLORS.darkText,
                }}
                placeholder="Nhập SĐT (10 số) hoặc Mã đơn..."
                placeholderTextColor={COLORS.lightText}
                value={guestLookupQuery}
                onChangeText={(txt) => {
                  setGuestLookupQuery(txt);
                  if (guestError) setGuestError(null);
                }}
                returnKeyType="search"
                onSubmitEditing={() => void handleGuestLookup()}
                autoCapitalize="characters"
              />
            </View>
            <TouchableOpacity
              onPress={() => void handleGuestLookup()}
              disabled={guestLoading}
              activeOpacity={0.85}
              style={{
                backgroundColor: '#3D2B1F',
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 11,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}>
              {guestLoading ? (
                <ActivityIndicator size="small" color="#FFFDF9" />
              ) : (
                <Search size={14} color="#FFFDF9" />
              )}
              <Text
                style={{
                  fontSize: 12.5,
                  fontWeight: '800',
                  color: '#FFFDF9',
                }}>
                Tìm
              </Text>
            </TouchableOpacity>
          </View>

          {guestError ? (
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '700',
                color: '#B91C1C',
              }}>
              ⚠️ {guestError}
            </Text>
          ) : (
            <Text
              style={{
                fontSize: 11,
                color: '#7A6555',
              }}
              numberOfLines={1}>
              ✨ Gõ đủ 10 số SĐT sẽ tự động hiện đơn & vị trí bưu cục SPX
            </Text>
          )}
        </View>
        )}

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

      {/* Admin Goship.io Bulk Export, Order Rescue & Portal Bar */}
      {isAdmin && (
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
            gap: 8,
          }}>
          <View
            style={{
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
                📦 Quản lý Vận đơn Goship & Khôi phục đơn hàng ({displayOrders.length} đơn)
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#6E5643',
                  marginTop: 2,
                }}>
                Tự động khôi phục đơn từ bộ nhớ trình duyệt hoặc nhập file CSV/JSON từ Supabase cũ
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
                  backgroundColor: '#15803D',
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 9,
                  opacity: rescuingOrders ? 0.7 : 1,
                }}
                disabled={rescuingOrders}
                onPress={() => void handleScanLocalRescue()}
                activeOpacity={0.85}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: '#FFFDF9',
                  }}>
                  {rescuingOrders
                    ? '⏳ Đang khôi phục...'
                    : '🔄 Quét khôi phục đơn trên máy'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  backgroundColor: '#FFFDF9',
                  borderWidth: 1,
                  borderColor: '#15803D',
                  paddingHorizontal: 11,
                  paddingVertical: 7,
                  borderRadius: 9,
                }}
                disabled={rescuingOrders}
                onPress={handleImportOrdersFile}
                activeOpacity={0.85}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: '#15803D',
                  }}>
                  📂 Nhập CSV/JSON đơn cũ
                </Text>
              </TouchableOpacity>
              {displayOrders.length > 0 && (
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
                    📥 Xuất CSV Goship ({displayOrders.length})
                  </Text>
                </TouchableOpacity>
              )}
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
          {rescueStatusMsg ? (
            <View
              style={{
                backgroundColor: '#ECFDF5',
                borderWidth: 1,
                borderColor: '#A7F3D0',
                borderRadius: 8,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '700',
                  color: '#065F46',
                }}>
                ✨ {rescueStatusMsg}
              </Text>
            </View>
          ) : null}
        </View>
      )}
      </View>
      );

  const ListEmpty = (
    <View style={[styles.constrained, styles.empty]}>
      <ShoppingBag size={64} color={COLORS.lightText} />
      <Text style={styles.emptyTitle}>
        {!isAuthenticated && !hasSearchedGuest
          ? 'Nhập SĐT ở trên để xem tiến độ đơn hàng'
          : 'Chưa tìm thấy đơn hàng nào'}
      </Text>
      <Text style={styles.emptySubtext}>
        {isAdmin
          ? 'Các đơn đặt hàng mới từ khách sẽ hiển thị tại đây'
          : !isAuthenticated
            ? hasSearchedGuest
              ? 'Không tìm thấy đơn hàng khớp với SĐT / Mã đơn vừa nhập. Bạn kiểm tra lại SĐT lúc đặt hoặc bấm Đăng nhập nhé!'
              : 'Nếu bạn đã có tài khoản, bấm nút "Đăng nhập để tự hiện mọi đơn" phía trên sẽ hiển thị toàn bộ đơn ngay lập tức.'
            : 'Đơn hàng của bạn sẽ xuất hiện tự động ở đây ngay sau khi đặt mua'}
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
