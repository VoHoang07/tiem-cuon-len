import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Linking,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Package,
  QrCode,
  Truck,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Phone,
  User as UserIcon,
  CheckCircle2,
  Clock,
  Star,
} from 'lucide-react-native';
import { useOrders } from '@/store/OrderContext';
import { useAuth } from '@/store/AuthContext';
import { useShop } from '@/store/ShopContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import {
  getOrderStatusLabel,
  getOrderStatusColor,
  ORDER_STATUS_NEXT,
} from '@/constants/orderStatus';
import {
  SHIPPING_CARRIERS,
  ADMIN_BOOKING_PORTALS,
  formatShippingSlipForClipboard,
  getCarrierTrackingUrl,
  getCodCollectAmount,
  getFullAddressString,
} from '@/utils/shippingTracker';
import type { OrderStatus } from '@/types/order';

function getTimelineStepIndex(status: OrderStatus): number {
  if (status === 'Đã hủy') return -1;
  if (status === 'Hoàn thành') return 3;
  if (status === 'Đang giao') return 2;
  if (status === 'Đang xử lý' || status === 'Đang chuẩn bị hàng') return 1;
  return 0;
}

const TIMELINE_STEPS = [
  {
    key: 'ordered',
    title: 'Đã đặt đơn',
    desc: 'Tiếp nhận đơn hàng',
  },
  {
    key: 'crafting',
    title: 'Đan & Chuẩn bị mẫu',
    desc: 'Thủ công tỉ mỉ 3–4 ngày',
  },
  {
    key: 'shipping',
    title: 'Đang vận chuyển',
    desc: 'Bàn giao cho đơn vị ship',
  },
  {
    key: 'completed',
    title: 'Giao thành công',
    desc: 'Khách đã nhận hàng',
  },
];

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, updateOrderShipping } = useOrders();
  const { user, role } = useAuth();
  const { addReview, addShopReview } = useShop();
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth > 0 ? rawWidth : 390) < 640;

  const order = orders.find((o) => o.id === id);

  const [selectedCarrier, setSelectedCarrier] = useState<string>(
    order?.shippingAddress?.shippingCarrier || 'Viettel Post'
  );
  const [trackingInput, setTrackingInput] = useState<string>(
    order?.shippingAddress?.trackingCode || ''
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Product & Shop Review state when order is Completed ('Hoàn thành')
  const [activeReviewItemId, setActiveReviewItemId] = useState<string | null>(null);
  const [itemRating, setItemRating] = useState<number>(5);
  const [itemComment, setItemComment] = useState<string>('');
  const [reviewedItemIds, setReviewedItemIds] = useState<Record<string, boolean>>({});

  const [shopRating, setShopRating] = useState<number>(5);
  const [shopComment, setShopComment] = useState<string>('');
  const [shopReviewed, setShopReviewed] = useState<boolean>(false);

  useEffect(() => {
    if (order?.shippingAddress?.shippingCarrier) {
      setSelectedCarrier(order.shippingAddress.shippingCarrier);
    }
    if (order?.shippingAddress?.trackingCode !== undefined) {
      setTrackingInput(order.shippingAddress.trackingCode);
    }
  }, [
    order?.id,
    order?.shippingAddress?.shippingCarrier,
    order?.shippingAddress?.trackingCode,
  ]);

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
  const stepIndex = getTimelineStepIndex(order.status);
  const codAmount = getCodCollectAmount(order);
  const fullAddress = getFullAddressString(order);
  const savedCarrier = order.shippingAddress?.shippingCarrier;
  const savedTracking = order.shippingAddress?.trackingCode;
  const trackingUrl = getCarrierTrackingUrl(
    savedCarrier || selectedCarrier,
    savedTracking || trackingInput
  );

  const handleCopy = async (text: string, key: string) => {
    await Clipboard.setStringAsync(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 2000);
  };

  const handleSaveTracking = async (markAsShipping: boolean) => {
    const nextStat: OrderStatus =
      markAsShipping && order.status !== 'Hoàn thành'
        ? 'Đang giao'
        : order.status;
    await updateOrderShipping(order.id, {
      status: nextStat,
      shippingCarrier: selectedCarrier,
      trackingCode: trackingInput.trim(),
    });
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          {/* Header */}
          <View style={[styles.header, isMobile && styles.headerMobile]}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/orders');
              }}
              style={styles.backBtn}>
              <ChevronLeft size={22} color={COLORS.darkText} />
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Chi tiết đơn #{order.id.slice(-8)}
            </Text>
            <View style={{ width: 38 }} />
          </View>

          {/* 1. Status & Quick Action Bar */}
          <View style={[styles.section, isMobile && styles.sectionMobile]}>
            <View style={styles.statusRow}>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getOrderStatusColor(order.status) + '20' },
                ]}>
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: getOrderStatusColor(order.status) },
                  ]}
                />
                <Text
                  style={[
                    styles.statusText,
                    { color: getOrderStatusColor(order.status) },
                  ]}>
                  {getOrderStatusLabel(order.status)}
                </Text>
              </View>

              <View style={styles.statusActionsWrap}>
                {order.status === 'pending_payment' && (
                  <TouchableOpacity
                    style={styles.payNowBtn}
                    onPress={() => router.push(`/payment/${order.id}`)}>
                    <QrCode size={15} color="#FAF5EE" />
                    <Text style={styles.payNowText}>Thanh toán QR</Text>
                  </TouchableOpacity>
                )}
                {!isAdmin && order.status === 'Đang giao' && (
                  <TouchableOpacity
                    style={styles.updateStatusBtn}
                    onPress={() => updateOrderStatus(order.id, 'Hoàn thành')}>
                    <Text style={styles.updateStatusText}>
                      ✅ Đã nhận được hàng
                    </Text>
                  </TouchableOpacity>
                )}
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

            {/* 4-Step Visual Order & Handmade Delivery Timeline */}
            {order.status !== 'Đã hủy' && (
              <View style={styles.timelineBox}>
                {TIMELINE_STEPS.map((st, idx) => {
                  const isDone = idx <= stepIndex;
                  const isCurrent = idx === stepIndex;
                  return (
                    <View key={st.key} style={styles.timelineStepRow}>
                      <View style={styles.timelineIndicatorCol}>
                        <View
                          style={[
                            styles.timelineDot,
                            isDone && styles.timelineDotDone,
                            isCurrent && styles.timelineDotCurrent,
                          ]}>
                          {isDone ? (
                            <Check size={11} color="#FFFDF9" strokeWidth={3} />
                          ) : (
                            <Clock size={11} color="#A08679" />
                          )}
                        </View>
                        {idx < TIMELINE_STEPS.length - 1 && (
                          <View
                            style={[
                              styles.timelineConnector,
                              idx < stepIndex && styles.timelineConnectorDone,
                            ]}
                          />
                        )}
                      </View>
                      <View style={styles.timelineTextCol}>
                        <Text
                          style={[
                            styles.timelineTitle,
                            isDone && styles.timelineTitleDone,
                            isCurrent && styles.timelineTitleCurrent,
                          ]}>
                          {st.title}
                        </Text>
                        <Text style={styles.timelineDesc}>
                          {idx === 2 && savedTracking
                            ? `${savedCarrier || 'Đơn vị ship'} • Mã vận đơn: ${savedTracking}`
                            : st.desc}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* 2. Role-Adaptive Shipping & Waybill Section (Sync Client & Admin) */}
          <View style={[styles.section, isMobile && styles.sectionMobile]}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionHeaderLeft}>
                <Truck size={18} color="#3D2B1F" />
                <Text style={styles.sectionHeaderMainTitle}>
                  {isAdmin
                    ? 'Vận đơn & Công cụ lên đơn Ship'
                    : 'Thông tin vận chuyển & Theo dõi đơn'}
                </Text>
              </View>
              {order.shippingAddress?.shippingMethod ? (
                <View style={styles.methodPill}>
                  <Text style={styles.methodPillText} numberOfLines={1}>
                    {order.shippingAddress.shippingMethod}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Recipient Address + COD Summary */}
            <View style={styles.recipientBox}>
              <View style={styles.recipientRow}>
                <UserIcon size={14} color="#6E5239" />
                <Text style={styles.recipientName}>
                  {order.shippingAddress?.fullName || 'Khách hàng'}
                </Text>
              </View>

              {order.shippingAddress?.phone ? (
                <View style={styles.recipientRowBetween}>
                  <View style={styles.recipientRow}>
                    <Phone size={14} color="#6E5239" />
                    <Text style={styles.recipientSub}>
                      {order.shippingAddress.phone}
                    </Text>
                  </View>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.miniCopyBtn}
                      onPress={() =>
                        handleCopy(order.shippingAddress.phone, 'phone')
                      }>
                      {copiedKey === 'phone' ? (
                        <Check size={12} color="#2E7D32" />
                      ) : (
                        <Copy size={12} color="#5C4332" />
                      )}
                      <Text style={styles.miniCopyText}>
                        {copiedKey === 'phone' ? 'Đã chép SĐT' : 'Chép SĐT'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              <View style={styles.recipientRowBetween}>
                <View style={[styles.recipientRow, { flex: 1 }]}>
                  <MapPin size={14} color="#6E5239" style={{ marginTop: 2 }} />
                  <Text style={[styles.recipientSub, { flex: 1 }]}>
                    {fullAddress}
                  </Text>
                </View>
                {isAdmin && (
                  <TouchableOpacity
                    style={styles.miniCopyBtn}
                    onPress={() => handleCopy(fullAddress, 'addr')}>
                    {copiedKey === 'addr' ? (
                      <Check size={12} color="#2E7D32" />
                    ) : (
                      <Copy size={12} color="#5C4332" />
                    )}
                    <Text style={styles.miniCopyText}>
                      {copiedKey === 'addr' ? 'Đã chép ĐC' : 'Chép ĐC'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* COD Collection Alert Box (Admin only) */}
              {isAdmin && (
                <View
                  style={[
                    styles.codAlertBox,
                    codAmount === 0 && styles.codAlertBoxPaid,
                  ]}>
                  <Text
                    style={[
                      styles.codAlertTitle,
                      codAmount === 0 && styles.codAlertTitlePaid,
                    ]}>
                    {codAmount > 0
                      ? `💰 Số tiền Shipper thu khi giao (COD): ${formatVND(codAmount)}`
                      : '✅ Đơn chuyển khoản QR: Thu hộ COD = 0₫ (Không thu tiền khi giao)'}
                  </Text>
                </View>
              )}
            </View>

            {/* CLIENT VIEW: Clean Tracking Card */}
            {!isAdmin && (
              <View style={styles.clientTrackingWrap}>
                {savedTracking ? (
                  <View style={styles.liveTrackingCard}>
                    <View style={styles.liveTrackingTop}>
                      <View>
                        <Text style={styles.liveTrackingLabel}>
                          {(savedCarrier || 'ĐƠN VỊ VẬN CHUYỂN').toUpperCase()}
                        </Text>
                        <Text style={styles.liveTrackingCode}>
                          Mã vận đơn: {savedTracking}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.copyCodePill}
                        onPress={() => handleCopy(savedTracking, 'track_code')}>
                        {copiedKey === 'track_code' ? (
                          <Check size={13} color="#2E7D32" />
                        ) : (
                          <Copy size={13} color="#3D2B1F" />
                        )}
                        <Text style={styles.copyCodePillText}>
                          {copiedKey === 'track_code' ? 'Đã chép' : 'Chép mã'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {trackingUrl ? (
                      <TouchableOpacity
                        style={styles.openTrackingBtn}
                        onPress={() => Linking.openURL(trackingUrl)}
                        activeOpacity={0.85}>
                        <Truck size={16} color="#FFFDF9" />
                        <Text style={styles.openTrackingBtnText}>
                          Xem hành trình đơn hàng
                        </Text>
                        <ExternalLink size={14} color="#FFFDF9" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : (
                  <View style={styles.pendingTrackingBanner}>
                    <Text style={styles.pendingTrackingText}>
                      🧶 Mã vận đơn sẽ hiển thị tại đây ngay khi tiệm gửi hàng.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ADMIN VIEW: 1-Click Copy Slip + Carrier Portal Links + Waybill Input */}
            {isAdmin && (
              <View style={styles.adminShippingToolkit}>
                {/* Step A: 1-Click Copy Full Slip for Goship / Viettel Post / GHTK */}
                <TouchableOpacity
                  style={[
                    styles.copyFullSlipBtn,
                    copiedKey === 'full_slip' && styles.copyFullSlipBtnDone,
                  ]}
                  onPress={() =>
                    handleCopy(formatShippingSlipForClipboard(order), 'full_slip')
                  }
                  activeOpacity={0.85}>
                  {copiedKey === 'full_slip' ? (
                    <CheckCircle2 size={17} color="#2E7D32" />
                  ) : (
                    <Copy size={16} color="#FAF5EE" />
                  )}
                  <Text
                    style={[
                      styles.copyFullSlipText,
                      copiedKey === 'full_slip' && { color: '#2E7D32' },
                    ]}>
                    {copiedKey === 'full_slip'
                      ? 'Đã chép phiếu giao hàng! Dán vào Goship / Viettel Post / GHTK'
                      : '📋 Bước 1: Chép toàn bộ thông tin để tạo đơn Ship'}
                  </Text>
                </TouchableOpacity>

                {/* Quick Portal Shortcuts */}
                <View style={styles.portalRow}>
                  <Text style={styles.portalHint}>Mở nhanh web đặt ship:</Text>
                  <View style={styles.portalPillsWrap}>
                    {ADMIN_BOOKING_PORTALS.map((p) => (
                      <TouchableOpacity
                        key={p.name}
                        style={styles.portalChip}
                        onPress={() => Linking.openURL(p.url)}>
                        <Text style={styles.portalChipText}>{p.name}</Text>
                        <ExternalLink size={11} color="#5C4332" />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.toolkitDivider} />

                {/* Step B: Attach Carrier & Tracking Number */}
                <Text style={styles.toolkitStepTitle}>
                  🚚 Bước 2: Gắn đơn vị vận chuyển & Mã vận đơn cho khách
                </Text>

                <View style={styles.carrierChipsWrap}>
                  {SHIPPING_CARRIERS.map((c) => {
                    const active = selectedCarrier === c.shortLabel;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.carrierChip,
                          active && styles.carrierChipActive,
                        ]}
                        onPress={() => setSelectedCarrier(c.shortLabel)}
                        activeOpacity={0.8}>
                        <Text
                          style={[
                            styles.carrierChipText,
                            active && styles.carrierChipTextActive,
                          ]}>
                          {c.shortLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TextInput
                  style={styles.trackingInput}
                  placeholder="Nhập mã vận đơn (VD: S21948291) hoặc dán link theo dõi Grab/Ahamove..."
                  placeholderTextColor={COLORS.lightText}
                  value={trackingInput}
                  onChangeText={setTrackingInput}
                />

                <View style={styles.saveTrackingActions}>
                  <TouchableOpacity
                    style={styles.saveAndShipBtn}
                    onPress={() => handleSaveTracking(true)}
                    activeOpacity={0.85}>
                    <Truck size={15} color="#FFFDF9" />
                    <Text style={styles.saveAndShipBtnText}>
                      Lưu vận đơn & Báo khách Đang giao
                    </Text>
                  </TouchableOpacity>

                  {trackingUrl && (savedTracking || trackingInput.trim()) ? (
                    <TouchableOpacity
                      style={styles.testTrackBtn}
                      onPress={() => Linking.openURL(trackingUrl)}>
                      <ExternalLink size={14} color="#3D2B1F" />
                      <Text style={styles.testTrackBtnText}>Thử tra cứu</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>

                {savedNotice && (
                  <Text style={styles.savedNoticeText}>
                    ✅ Đã đồng bộ mã vận đơn sang màn hình của khách hàng!
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* 3. Ordered Items + Inline Product Review when Completed */}
          <View style={[styles.section, isMobile && styles.sectionMobile]}>
            <Text style={styles.sectionTitle}>
              Sản phẩm trong đơn ({order.items.reduce((s, i) => s + i.quantity, 0)} món)
            </Text>
            {order.items.map((item) => {
              const baseId = String(item.product.id || '').split('__')[0];
              const isReviewOpen = activeReviewItemId === item.product.id;
              const isItemReviewed = Boolean(reviewedItemIds[item.product.id]);

              return (
                <View key={item.product.id} style={styles.itemBlockWrap}>
                  <View style={styles.itemRow}>
                    <TouchableOpacity
                      style={styles.itemIcon}
                      onPress={() => router.push(`/product/${baseId}`)}>
                      {item.product.image ? (
                        <Image
                          source={
                            typeof item.product.image === 'string'
                              ? { uri: item.product.image }
                              : (item.product.image as any)
                          }
                          style={styles.itemProductImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Package size={20} color={COLORS.primary} />
                      )}
                    </TouchableOpacity>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={2}>
                        {item.product.name}
                      </Text>
                      <Text style={styles.itemMeta}>
                        SL: {item.quantity} x {formatVND(item.price)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text style={styles.itemTotal}>
                        {formatVND(item.price * item.quantity)}
                      </Text>
                      {order.status === 'Hoàn thành' && (
                        <TouchableOpacity
                          style={[
                            styles.rateItemBtn,
                            isItemReviewed && styles.rateItemBtnDone,
                          ]}
                          disabled={isItemReviewed}
                          onPress={() => {
                            if (isReviewOpen) {
                              setActiveReviewItemId(null);
                            } else {
                              setActiveReviewItemId(item.product.id);
                              setItemRating(5);
                              setItemComment('');
                            }
                          }}>
                          <Text
                            style={[
                              styles.rateItemBtnText,
                              isItemReviewed && styles.rateItemBtnTextDone,
                            ]}>
                            {isItemReviewed
                              ? '✅ Đã đánh giá SP'
                              : isReviewOpen
                                ? 'Đóng'
                                : '⭐ Đánh giá SP'}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {order.status === 'Hoàn thành' && isReviewOpen && !isItemReviewed && (
                    <View style={styles.inlineReviewBox}>
                      <View style={styles.starsPickerRow}>
                        <Text style={styles.starsPickerLabel}>Chấm sao sản phẩm:</Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((st) => (
                            <TouchableOpacity key={st} onPress={() => setItemRating(st)}>
                              <Star
                                size={22}
                                color="#F59E0B"
                                fill={st <= itemRating ? '#F59E0B' : 'transparent'}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <TextInput
                        style={styles.inlineReviewInput}
                        value={itemComment}
                        onChangeText={setItemComment}
                        placeholder="Chia sẻ vài câu cảm nhận về mẫu len này nhé..."
                        placeholderTextColor={COLORS.lightText}
                        multiline
                      />
                      <TouchableOpacity
                        style={styles.submitInlineReviewBtn}
                        onPress={() => {
                          const text = itemComment.trim() || 'Sản phẩm rất xinh và ưng ý ạ!';
                          addReview(baseId, {
                            id: `rev_${Date.now()}`,
                            userId: user?.email || order.userId || 'customer',
                            userName:
                              order.shippingAddress?.fullName ||
                              user?.name ||
                              'Khách đã mua',
                            rating: itemRating,
                            comment: text,
                            date: new Date().toISOString(),
                          });
                          setReviewedItemIds((prev) => ({ ...prev, [item.product.id]: true }));
                          setActiveReviewItemId(null);
                          setItemComment('');
                        }}>
                        <Text style={styles.submitInlineReviewText}>
                          Gửi đánh giá sản phẩm ({itemRating} ★)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* 3B. Shop Review Box when Order is Completed ('Hoàn thành') */}
          {order.status === 'Hoàn thành' && (
            <View style={[styles.section, isMobile && styles.sectionMobile]}>
              <Text style={styles.sectionTitle}>⭐ Đánh giá Shop (Tiệm Cuộn Len)</Text>
              {shopReviewed ? (
                <View style={styles.shopReviewedBanner}>
                  <Text style={styles.shopReviewedText}>
                    ✅ Cảm ơn bạn đã gửi đánh giá {shopRating} ★ cho Tiệm Cuộn Len! Đánh giá của bạn đã hiển thị ở mục Đánh giá Shop trên trang chủ.
                  </Text>
                </View>
              ) : (
                <View style={styles.inlineReviewBox}>
                  <View style={styles.starsPickerRow}>
                    <Text style={styles.starsPickerLabel}>Chấm sao dịch vụ & đóng gói của Tiệm:</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((st) => (
                        <TouchableOpacity key={st} onPress={() => setShopRating(st)}>
                          <Star
                            size={22}
                            color="#F59E0B"
                            fill={st <= shopRating ? '#F59E0B' : 'transparent'}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TextInput
                    style={styles.inlineReviewInput}
                    value={shopComment}
                    onChangeText={setShopComment}
                    placeholder="Nhận xét về cách tư vấn, đóng gói hộp quà và tốc độ giao hàng của Tiệm..."
                    placeholderTextColor={COLORS.lightText}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.submitInlineReviewBtn}
                    onPress={() => {
                      const text =
                        shopComment.trim() ||
                        'Shop tư vấn nhiệt tình, đóng gói hộp quà cẩn thận 5 sao!';
                      addShopReview({
                        id: `shop_rev_${Date.now()}`,
                        userId: user?.email || order.userId || 'customer',
                        userName:
                          order.shippingAddress?.fullName ||
                          user?.name ||
                          'Khách đã mua',
                        rating: shopRating,
                        comment: text,
                        date: new Date().toISOString(),
                      });
                      setShopReviewed(true);
                    }}>
                    <Text style={styles.submitInlineReviewText}>
                      Gửi đánh giá Shop ({shopRating} ★)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* 4. Payment & Order Total */}
          <View style={[styles.section, isMobile && styles.sectionMobile]}>
            <View style={styles.metaLineRow}>
              <Text style={styles.sectionTitle}>Phương thức thanh toán</Text>
              <Text style={styles.sectionValue}>{order.paymentMethod}</Text>
            </View>
            <View style={styles.metaLineRow}>
              <Text style={styles.sectionTitle}>Ngày đặt hàng</Text>
              <Text style={styles.sectionSub}>
                {new Date(order.createdAt).toLocaleDateString('vi-VN', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            {order.shippingAddress?.shippingFee !== undefined && (
              <View style={styles.metaLineRow}>
                <Text style={styles.sectionTitle}>Phí vận chuyển</Text>
                <Text style={styles.sectionValue}>
                  {order.shippingAddress.shippingFee === 0
                    ? 'Miễn phí (0₫)'
                    : formatVND(order.shippingAddress.shippingFee)}
                </Text>
              </View>
            )}
            <View style={styles.totalDivider} />
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tổng thanh toán</Text>
              <Text style={styles.totalValue}>{formatVND(order.total)}</Text>
            </View>
          </View>

          <View style={{ height: 60 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  container: { width: '100%', maxWidth: 840, alignSelf: 'center' },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  notFoundText: { fontSize: 18, fontWeight: '600', color: COLORS.mediumText },
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
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
    color: '#3D2B1F',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#FFFDF9',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  sectionMobile: {
    marginHorizontal: 12,
    padding: 14,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.mediumText },
  sectionValue: { fontSize: 14, fontWeight: '800', color: '#3D2B1F' },
  sectionSub: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  statusText: { fontSize: 13.5, fontWeight: '800' },
  statusActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  payNowText: { fontSize: 12.5, fontWeight: '800', color: '#FAF5EE' },
  updateStatusBtn: {
    backgroundColor: '#D8C3AD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  updateStatusText: { fontSize: 12.5, fontWeight: '800', color: '#3D2B1F' },

  /* 4-Step Visual Timeline */
  timelineBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F0E6D8',
  },
  timelineStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  timelineIndicatorCol: {
    alignItems: 'center',
    width: 22,
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F3ECE2',
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineDotDone: {
    backgroundColor: '#6BAF5C',
    borderColor: '#6BAF5C',
  },
  timelineDotCurrent: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  timelineConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#E5D6C5',
    marginVertical: 2,
  },
  timelineConnectorDone: {
    backgroundColor: '#6BAF5C',
  },
  timelineTextCol: {
    flex: 1,
    paddingBottom: 10,
  },
  timelineTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  timelineTitleDone: {
    color: '#3D2B1F',
  },
  timelineTitleCurrent: {
    fontWeight: '900',
    color: '#3D2B1F',
  },
  timelineDesc: {
    fontSize: 12,
    color: COLORS.lightText,
    marginTop: 1,
  },

  /* Shipping & Waybill Section */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionHeaderMainTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  methodPill: {
    backgroundColor: '#F3ECE2',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    maxWidth: '100%',
  },
  methodPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  recipientBox: {
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EAE0D3',
    gap: 7,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  recipientRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recipientName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  recipientSub: {
    fontSize: 13,
    color: '#5C4738',
    lineHeight: 18,
    fontWeight: '600',
  },
  miniCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE6DA',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  miniCopyText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  codAlertBox: {
    marginTop: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  codAlertBoxPaid: {
    backgroundColor: '#EAF6E8',
    borderColor: '#B8DFB2',
  },
  codAlertTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#B45309',
  },
  codAlertTitlePaid: {
    color: '#2E7D32',
  },

  /* Client Tracking View */
  clientTrackingWrap: {
    marginTop: 12,
  },
  liveTrackingCard: {
    backgroundColor: '#F3FAF2',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#B8DFB2',
    gap: 10,
  },
  liveTrackingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  liveTrackingLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2E7D32',
    letterSpacing: 0.4,
  },
  liveTrackingCode: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E4620',
    marginTop: 2,
  },
  copyCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFDF9',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#B8DFB2',
  },
  copyCodePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  openTrackingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  openTrackingBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  pendingTrackingBanner: {
    backgroundColor: '#FAF3E8',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E8D8C3',
  },
  pendingTrackingText: {
    fontSize: 12.5,
    color: '#5C4033',
    lineHeight: 18,
    fontWeight: '600',
  },

  /* Admin Shipping Toolkit */
  adminShippingToolkit: {
    marginTop: 12,
    gap: 10,
  },
  copyFullSlipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3D2B1F',
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  copyFullSlipBtnDone: {
    backgroundColor: '#EAF6E8',
    borderWidth: 1,
    borderColor: '#B8DFB2',
  },
  copyFullSlipText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FAF5EE',
    textAlign: 'center',
    flexShrink: 1,
  },
  portalRow: {
    gap: 6,
  },
  portalHint: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  portalPillsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  portalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3ECE2',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  portalChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  toolkitDivider: {
    height: 1,
    backgroundColor: '#F0E6D8',
    marginVertical: 4,
  },
  toolkitStepTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  carrierChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  carrierChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  carrierChipActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  carrierChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4738',
  },
  carrierChipTextActive: {
    color: '#FAF5EE',
  },
  trackingInput: {
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFCBB5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13.5,
    color: '#3D2B1F',
    minWidth: 0,
  },
  saveTrackingActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  saveAndShipBtn: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#5C4033',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  saveAndShipBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  testTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3ECE2',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  testTrackBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  savedNoticeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#2E7D32',
    marginTop: 2,
  },

  /* Items & Totals */
  itemBlockWrap: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0E6D8',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rateItemBtn: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rateItemBtnDone: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  rateItemBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
  },
  rateItemBtnTextDone: {
    color: '#047857',
  },
  inlineReviewBox: {
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  starsPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  starsPickerLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineReviewInput: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2C1E14',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  submitInlineReviewBtn: {
    backgroundColor: '#3D2B1F',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitInlineReviewText: {
    color: '#FFFDF9',
    fontSize: 13,
    fontWeight: '800',
  },
  shopReviewedBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    padding: 12,
  },
  shopReviewedText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    lineHeight: 19,
  },
  itemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemProductImage: {
    width: 44,
    height: 44,
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemName: { fontSize: 14, fontWeight: '700', color: '#3D2B1F' },
  itemMeta: { fontSize: 12, color: COLORS.mediumText, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: '800', color: COLORS.primary },
  metaLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  totalDivider: {
    height: 1,
    backgroundColor: '#F0E6D8',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 16, fontWeight: '800', color: '#3D2B1F' },
  totalValue: { fontSize: 21, fontWeight: '900', color: COLORS.primary },
});
