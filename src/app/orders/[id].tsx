import {
    getOrderStatusColor,
    getOrderStatusLabel,
    ORDER_STATUS_NEXT,
} from '@/constants/orderStatus';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useOrders } from '@/store/OrderContext';
import { useShop } from '@/store/ShopContext';
import type { OrderStatus } from '@/types/order';
import { formatVND } from '@/utils/formatCurrency';
import {
    ADMIN_BOOKING_PORTALS,
    exportOrdersToGoshipCsv,
    formatShippingSlipForClipboard,
    getCarrierTrackingUrl,
    getCodCollectAmount,
    getFullAddressString,
    SHIPPING_CARRIERS,
} from '@/utils/shippingTracker';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Check,
    CheckCircle2,
    ChevronLeft,
    Clock,
    Copy,
    ExternalLink,
    MapPin,
    Package,
    Phone,
    QrCode,
    Star,
    Truck,
    User as UserIcon
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    Image,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
    desc: 'Thủ công tỉ mỉ 5–6 ngày',
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

const QUICK_FEEDBACK_CHIPS = [
  '🧶 Đường móc tỉ mỉ, chắc tay',
  '🎁 Đóng gói hộp quà & thiệp rất xinh',
  '💝 Giống mẫu 100%, len mềm mịn',
  '🚚 Giao hàng cẩn thận, đáng tiền',
  '🌟 Chủ tiệm tư vấn dễ thương, nhiệt tình',
];

async function compressProofScreenshotWeb(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      if (typeof document === 'undefined') {
        resolve(rawDataUrl);
        return;
      }
      const img = new window.Image();
      img.onerror = () => resolve(rawDataUrl);
      img.onload = () => {
        try {
          const maxDim = 920;
          let w = img.naturalWidth || img.width || 600;
          let h = img.naturalHeight || img.height || 600;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.max(1, Math.round(w * ratio));
            h = Math.max(1, Math.round(h * ratio));
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawDataUrl);
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch {
          resolve(rawDataUrl);
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { orders, updateOrderStatus, updateOrderShipping } = useOrders();
  const { user, role } = useAuth();
  const { products, addReview, addShopReview } = useShop();
  const { sendMessage, openChat } = useChat();
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth > 0 ? rawWidth : 390) < 640;

  const isAdmin = role === 'admin';
  const rawOrder = orders.find((o) => o.id === id);
  // Anti-IDOR ownership verification: only the order owner or Admin can access this order
  const order =
    rawOrder && (isAdmin || (user && rawOrder.userId === user.id))
      ? rawOrder
      : undefined;

  const [selectedCarrier, setSelectedCarrier] = useState<string>(
    order?.shippingAddress?.shippingCarrier || 'SPX'
  );
  const [trackingInput, setTrackingInput] = useState<string>(
    order?.shippingAddress?.trackingCode || ''
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  // Product quick review state when order is Completed ('Hoàn thành')
  const [activeReviewItemId, setActiveReviewItemId] = useState<string | null>(null);
  const [itemRating, setItemRating] = useState<number>(5);
  const [itemComment, setItemComment] = useState<string>('');
  const [reviewedItemIds, setReviewedItemIds] = useState<Record<string, boolean>>({});

  // Section 1: Video Unboxing + Web Link (-25.000₫ Personal Voucher)
  const [videoRating, setVideoRating] = useState<number>(5);
  const [videoSelectedTags, setVideoSelectedTags] = useState<string[]>([]);
  const [videoComment, setVideoComment] = useState<string>('');
  const [videoPostUrl, setVideoPostUrl] = useState<string>('');
  const [videoProofImg, setVideoProofImg] = useState<string | null>(null);
  const [videoSubmitting, setVideoSubmitting] = useState<boolean>(false);
  const [videoSubmitted, setVideoSubmitted] = useState<boolean>(false);
  const [videoError, setVideoError] = useState<string | null>(null);

  // Section 2: Follow FB Fanpage + Public Share (-15.000₫ Personal Voucher)
  const [fbRating, setFbRating] = useState<number>(5);
  const [fbSelectedTags, setFbSelectedTags] = useState<string[]>([]);
  const [fbComment, setFbComment] = useState<string>('');
  const [fbPostUrl, setFbPostUrl] = useState<string>('');
  const [fbProofImg, setFbProofImg] = useState<string | null>(null);
  const [fbSubmitting, setFbSubmitting] = useState<boolean>(false);
  const [fbSubmitted, setFbSubmitted] = useState<boolean>(false);
  const [fbError, setFbError] = useState<string | null>(null);

  useEffect(() => {
    if (!order?.id || typeof window === 'undefined' || !window.localStorage) return;
    try {
      setVideoSubmitted(
        window.localStorage.getItem(`tcl_proof_video_${order.id}`) === '1'
      );
      setFbSubmitted(
        window.localStorage.getItem(`tcl_proof_fb_${order.id}`) === '1'
      );
    } catch {
      // ignore
    }
  }, [order?.id]);

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
          <Text style={styles.notFoundText}>
            Không tìm thấy đơn hàng hoặc bạn không có quyền truy cập (Anti-IDOR).
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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

  const handlePickProofScreenshot = async (
    target: 'video_unbox_25k' | 'fb_follow_share_15k'
  ) => {
    const setErr = target === 'video_unbox_25k' ? setVideoError : setFbError;
    const setImg =
      target === 'video_unbox_25k' ? setVideoProofImg : setFbProofImg;
    setErr(null);

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const validation = await validateWebFileUpload(file);
        if (!validation.valid) {
          setErr(validation.error || 'Ảnh tải lên không hợp lệ.');
          return;
        }
        try {
          const compressed = await compressProofScreenshotWeb(file);
          const b64Check = validateBase64ImageUpload(compressed);
          if (!b64Check.valid) {
            setErr(b64Check.error || 'Định dạng ảnh không hợp lệ.');
            return;
          }
          setImg(compressed);
        } catch {
          setErr('Không thể xử lý ảnh minh chứng. Bạn thử chọn lại ảnh khác nhé.');
        }
      };
      input.click();
      return;
    }

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.72,
        base64: true,
      });
      if (!res.canceled && res.assets?.[0]?.base64) {
        const mime = res.assets[0].mimeType || 'image/jpeg';
        const dataUri = `data:${mime};base64,${res.assets[0].base64}`;
        const check = validateBase64ImageUpload(dataUri);
        if (!check.valid) {
          setErr(check.error || 'Ảnh không hợp lệ.');
          return;
        }
        setImg(dataUri);
      }
    } catch {
      setErr('Không thể mở thư viện ảnh.');
    }
  };

  const handleSubmitMissionProof = (
    missionType: 'video_unbox_25k' | 'fb_follow_share_15k'
  ) => {
    const isVideo = missionType === 'video_unbox_25k';
    const proofImg = isVideo ? videoProofImg : fbProofImg;
    const rating = isVideo ? videoRating : fbRating;
    const selectedTags = isVideo ? videoSelectedTags : fbSelectedTags;
    const rawComment = isVideo ? videoComment : fbComment;
    const postUrl = (isVideo ? videoPostUrl : fbPostUrl).trim();
    const setErr = isVideo ? setVideoError : setFbError;
    const setBusy = isVideo ? setVideoSubmitting : setFbSubmitting;
    const setDone = isVideo ? setVideoSubmitted : setFbSubmitted;

    if (!proofImg) {
      setErr(
        isVideo
          ? 'Vui lòng đính kèm ảnh chụp màn hình Story/Bài đăng (Facebook, Instagram hoặc TikTok) có gắn link web tiemcuonlen.shop nhé!'
          : 'Vui lòng đính kèm ảnh chụp màn hình đã Follow Fanpage & Chia sẻ bài công khai nhé!'
      );
      return;
    }

    setErr(null);
    setBusy(true);

    const combinedReview = [selectedTags.join(', '), rawComment.trim()]
      .filter(Boolean)
      .join(' — ') ||
      'Sản phẩm đan móc tỉ mỉ, rất xinh và ưng ý ạ!';

    const reviewerName =
      order.shippingAddress?.fullName || user?.name || 'Khách đã mua';
    const reviewerEmail =
      order.shippingAddress?.email || user?.email || undefined;

    // 1. Publish review to Shop & first product in order
    addShopReview({
      id: `shop_rev_${Date.now()}`,
      userId: reviewerEmail || order.userId || 'customer',
      userName: reviewerName,
      rating,
      comment: combinedReview,
      date: new Date().toISOString(),
    });
    const firstItem = order.items[0];
    if (firstItem) {
      const firstBaseId = String(
        firstItem.product.baseProductId || firstItem.product.id
      ).split('__')[0];
      addReview(firstBaseId, {
        id: `rev_${Date.now()}`,
        userId: reviewerEmail || order.userId || 'customer',
        userName: reviewerName,
        rating,
        comment: combinedReview,
        date: new Date().toISOString(),
      });
    }

    // 2. Dispatch structured proof + screenshot directly into Live Chat so Admin approves & sends 1-to-1 voucher in Chat!
    const chatSummary = isVideo
      ? `🎬 [Mục 1 — Nhận Gói Quà 60.000₫ (Voucher -25k + Tặng 1 SP 35k)] Mình vừa đánh giá ${rating}★ ("${combinedReview.slice(
          0,
          120
        )}") và gửi ảnh màn hình đăng Video/Story khui hàng (FB/IG/TikTok) kèm tên & link web cho đơn #${order.id.slice(
          -8
        )}${postUrl ? ` (${postUrl})` : ''}. Shop kiểm tra và gửi mã quà 60k giúp mình nhé!`
      : `👍 [Mục 2 — Nhận Voucher -15.000₫] Mình vừa đánh giá ${rating}★ ("${combinedReview.slice(
          0,
          120
        )}") và gửi ảnh màn hình Follow Fanpage FB + Share bài công khai cho đơn #${order.id.slice(
          -8
        )}${postUrl ? ` (${postUrl})` : ''}. Shop kiểm tra và gửi mã riêng giúp mình nhé!`;

    sendMessage(chatSummary, null, undefined, {
      voucherProof: {
        missionType,
        orderId: order.id,
        userId: user?.id || order.userId,
        customerEmail: reviewerEmail,
        customerName: reviewerName,
        rating,
        reviewText: combinedReview.slice(0, 220),
        postUrl: postUrl || undefined,
        proofImage: proofImg,
      },
    });

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          isVideo
            ? `tcl_proof_video_${order.id}`
            : `tcl_proof_fb_${order.id}`,
          '1'
        );
      }
    } catch {
      // ignore
    }

    setBusy(false);
    setDone(true);
    openChat();
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
              {isAdmin && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 6,
                    backgroundColor:
                      order.shippingAddress?.isVerifiedAccount ||
                      order.shippingAddress?.email
                        ? '#ECFDF5'
                        : '#FFFBEB',
                    borderWidth: 1,
                    borderColor:
                      order.shippingAddress?.isVerifiedAccount ||
                      order.shippingAddress?.email
                        ? '#6EE7B7'
                        : '#FCD34D',
                    borderRadius: 10,
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    marginBottom: 4,
                  }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color:
                        order.shippingAddress?.isVerifiedAccount ||
                        order.shippingAddress?.email
                          ? '#065F46'
                          : '#92400E',
                    }}>
                    {order.shippingAddress?.isVerifiedAccount ||
                    order.shippingAddress?.email
                      ? `🛡️ Xác thực chống Scam: ✅ Acc Thật Đã Xác Thực (${
                          order.shippingAddress?.email ||
                          order.shippingAddress?.customerAuthProvider ||
                          'Google / Gmail'
                        })`
                      : '⚠️ Xác thực chống Scam: Khách vãng lai chưa liên kết Google/FB (Nên gọi xác nhận SĐT trước khi gửi)'}
                  </Text>
                </View>
              )}
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
                {order.shippingAddress?.bonusGiftProductName && (
                  <View
                    style={{
                      backgroundColor: '#FDF2F8',
                      borderWidth: 1.5,
                      borderColor: '#EC4899',
                      borderRadius: 12,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      gap: 3,
                    }}>
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '900',
                        color: '#9D174D',
                      }}>
                      🎀 LƯU Ý ĐÓNG GÓI QUÀ TẶNG KÈM (MÃ KHUI HÀNG {order.shippingAddress.promoCode}):
                    </Text>
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: '800',
                        color: '#831843',
                      }}>
                      👉 Bỏ thêm vào hộp: +01 {order.shippingAddress.bonusGiftProductName} (Quà 35k • Miễn phí 0₫)
                    </Text>
                  </View>
                )}

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

                  {/* Goship.io 1-Tap Field Copy Grid & CSV Export */}
                  <View
                  style={{
                    backgroundColor: '#FAF4EC',
                    borderWidth: 1,
                    borderColor: '#E5D5C3',
                    borderRadius: 10,
                    padding: 9,
                    gap: 6,
                  }}>
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: '#5C4033',
                    }}>
                    ⚡ Chép nhanh từng ô cho Goship.io / Xuất file CSV:
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 6,
                    }}>
                    {[
                      {
                        key: 'gs_name',
                        label: '👤 Chép Tên',
                        val: order.shippingAddress?.fullName || 'Khách hàng',
                      },
                      {
                        key: 'gs_phone',
                        label: '📞 Chép SĐT',
                        val: order.shippingAddress?.phone || '',
                      },
                      {
                        key: 'gs_detail',
                        label: '🏠 Chép ĐC chi tiết',
                        val: order.shippingAddress?.detailAddress || fullAddress,
                      },
                      {
                        key: 'gs_cod',
                        label: `💰 Chép COD (${codAmount})`,
                        val: String(codAmount),
                      },
                      {
                        key: 'gs_items',
                        label: '🧶 Chép Tên SP & Thiệp',
                        val: order.items
                          .map((i) => {
                            const c = i.product.giftCardNote
                              ? ` [Thiệp: ${i.product.giftCardNote}]`
                              : '';
                            return `${i.product.name} (x${i.quantity})${c}`;
                          })
                          .join(', '),
                      },
                    ].map((btn) => (
                      <TouchableOpacity
                        key={btn.key}
                        style={styles.portalChip}
                        onPress={() => handleCopy(btn.val, btn.key)}
                        activeOpacity={0.8}>
                        <Text style={styles.portalChipText}>
                          {copiedKey === btn.key ? '✅ Đã chép!' : btn.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={[
                        styles.portalChip,
                        { backgroundColor: '#4A3427', borderColor: '#4A3427' },
                      ]}
                      onPress={() => exportOrdersToGoshipCsv([order])}
                      activeOpacity={0.8}>
                      <Text style={[styles.portalChipText, { color: '#FFFDF9' }]}>
                        📥 Tải CSV Goship.io
                      </Text>
                    </TouchableOpacity>
                  </View>
                  </View>

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
                    ✅ Đã đồng bộ mã vận đơn & tự động gửi Email báo mã vận đơn tới Gmail khách hàng!
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
              const baseId = String(
                item.product.baseProductId || item.product.id || ''
              ).split('__')[0];
              const liveCatalogProd = products.find((p) => p.id === baseId);
              const resolvedThumb =
                item.product.image || liveCatalogProd?.image || null;
              const isReviewOpen = activeReviewItemId === item.product.id;
              const isItemReviewed = Boolean(reviewedItemIds[item.product.id]);

              return (
                <View key={item.product.id} style={styles.itemBlockWrap}>
                  <View style={styles.itemRow}>
                    <TouchableOpacity
                      style={styles.itemIcon}
                      onPress={() => router.push(`/product/${baseId}`)}>
                      {resolvedThumb ? (
                        <Image
                          source={
                            typeof resolvedThumb === 'string'
                              ? { uri: resolvedThumb }
                              : (resolvedThumb as any)
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
                      {Boolean(item.product.giftCardNote) && (
                        <View
                          style={{
                            marginTop: 5,
                            backgroundColor: '#FDF6EC',
                            borderWidth: 1,
                            borderColor: '#E5D3C0',
                            borderRadius: 8,
                            paddingHorizontal: 8,
                            paddingVertical: 5,
                          }}>
                          <Text
                            style={{
                              fontSize: 11.5,
                              color: '#5C4033',
                              fontWeight: '600',
                            }}>
                            💌 Nội dung thiệp: &ldquo;{item.product.giftCardNote}&rdquo;
                          </Text>
                        </View>
                      )}
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
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: 6,
                          marginBottom: 4,
                        }}>
                        {[
                          '🧶 Đường móc tỉ mỉ, chắc tay',
                          '🎁 Hộp quà & thiệp rất xinh',
                          '🚚 Giao hàng nhanh, đóng gói kỹ',
                          '💝 Giống mẫu 100%, sẽ ủng hộ tiếp',
                        ].map((tag) => (
                          <TouchableOpacity
                            key={tag}
                            onPress={() =>
                              setItemComment((prev) =>
                                prev ? `${prev}. ${tag}` : tag
                              )
                            }
                            style={{
                              backgroundColor: '#FFFBEB',
                              borderWidth: 1,
                              borderColor: '#FDE68A',
                              borderRadius: 999,
                              paddingHorizontal: 9,
                              paddingVertical: 4,
                            }}>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '700',
                                color: '#92400E',
                              }}>
                              + {tag}
                            </Text>
                          </TouchableOpacity>
                        ))}
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

                      {/* 3B. TWO SEPARATE POST-DELIVERY VOUCHER REWARD SECTIONS (25K VIDEO + 15K FB FOLLOW & SHARE) */}
                      {order.status === 'Hoàn thành' && (
                        <View
                          style={[
                            styles.section,
                            isMobile && styles.sectionMobile,
                            { gap: 14 },
                          ]}>
                          <View
                            style={{
                              backgroundColor: '#FFFBEB',
                              borderWidth: 1.5,
                              borderColor: '#FCD34D',
                              borderRadius: 14,
                              padding: 12,
                              gap: 4,
                            }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                              }}>
                              <Gift size={16} color="#B45309" />
                              <Text
                                style={{
                                  fontSize: 14,
                                  fontWeight: '900',
                                  color: '#92400E',
                                  flex: 1,
                                }}>
                                Đánh Giá & Gửi Ảnh Minh Chứng — Nhận Mã Voucher Riêng Qua Chat
                              </Text>
                            </View>
                            <Text
                              style={{
                                fontSize: 12,
                                color: '#78350F',
                                lineHeight: 17,
                              }}>
                              Chọn 1 hoặc cả 2 mục bên dưới: chấm sao, chạm nhanh từ khóa nhận xét và đính kèm ảnh chụp màn hình. Tiệm sẽ xác nhận và gửi{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Mã Voucher cá nhân độc quyền
                              </Text>{' '}
                              ngay trong khung Chat cho tài khoản của bạn!
                            </Text>
                          </View>

                          {/* ================= MỤC 1: STORY / VIDEO KHUI HÀNG + LINK WEB -> GÓI QUÀ 60.000₫ (-25K + 1 SP 35K) ================= */}
                          <View
                            style={{
                              backgroundColor: '#FDF2F8',
                              borderWidth: 1.5,
                              borderColor: '#F9A8D4',
                              borderRadius: 14,
                              padding: 13,
                              gap: 9,
                            }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 7,
                                  flex: 1,
                                  minWidth: 180,
                                }}>
                                <Video size={18} color="#9D174D" />
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: '900',
                                    color: '#831843',
                                    flex: 1,
                                  }}>
                                  Mục 1: Quay Video / Story Khui Hàng (FB / IG / TikTok) + Kèm Tên & Link Web
                                </Text>
                              </View>
                              <View
                                style={{
                                  backgroundColor: '#9D174D',
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: '900',
                                    color: '#FFFFFF',
                                  }}>
                                  🎁 Gói Quà 60.000₫ (-25k + 1 SP 35k)
                                </Text>
                              </View>
                            </View>

                            <Text
                              style={{
                                fontSize: 12,
                                color: '#9D174D',
                                lineHeight: 17,
                                fontWeight: '600',
                              }}>
                              • Điều kiện: Quay video khui hàng đăng{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Story hoặc Bài đăng lên Facebook, Instagram hoặc TikTok
                              </Text>{' '}
                              kèm tên Tiệm & gắn link web{' '}
                              <Text style={{ fontWeight: '900' }}>
                                tiemcuonlen.shop
                              </Text>{' '}
                              (đúng như thiệp hướng dẫn trong hộp hàng).{'\n'}• Phần thưởng kép trị giá{' '}
                              <Text style={{ fontWeight: '900' }}>60.000₫</Text>: Tặng mã riêng vừa{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Giảm 25.000₫
                              </Text>{' '}
                              vừa được{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Tự chọn thêm 01 sản phẩm giá 35.000₫ (Móc khóa / Kẹp tóc) của Tiệm miễn phí 0₫
                              </Text>{' '}
                              cho đơn mua lẻ tiếp theo từ 159.000₫!
                            </Text>

                            {videoSubmitted ? (
                              <View
                                style={{
                                  backgroundColor: '#ECFDF5',
                                  borderWidth: 1,
                                  borderColor: '#6EE7B7',
                                  borderRadius: 11,
                                  padding: 11,
                                  gap: 7,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: '800',
                                    color: '#065F46',
                                    lineHeight: 18,
                                  }}>
                                  ✅ Đã gửi đánh giá & ảnh minh chứng vào khung Chat! Tiệm đang kiểm tra và gửi mã Gói Quà 60.000₫ (-25k + chọn 1 SP 35k) cho bạn ngay trong khung Chat nhé.
                                </Text>
                                <TouchableOpacity
                                  onPress={() => openChat()}
                                  activeOpacity={0.85}
                                  style={{
                                    alignSelf: 'flex-start',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: '#047857',
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderRadius: 9,
                                  }}>
                                  <MessageCircle size={14} color="#FFFFFF" />
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '800',
                                      color: '#FFFFFF',
                                    }}>
                                    Mở khung Chat nhận mã Quà 60.000₫
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: 12,
                                  padding: 11,
                                  borderWidth: 1,
                                  borderColor: '#FBCFE8',
                                  gap: 8,
                                }}>
                                {/* Stars */}
                                <View style={styles.starsPickerRow}>
                                  <Text style={styles.starsPickerLabel}>
                                    1. Chấm sao sản phẩm:
                                  </Text>
                                  <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((st) => (
                                      <TouchableOpacity
                                        key={st}
                                        onPress={() => setVideoRating(st)}>
                                        <Star
                                          size={21}
                                          color="#F59E0B"
                                          fill={
                                            st <= videoRating
                                              ? '#F59E0B'
                                              : 'transparent'
                                          }
                                        />
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>

                                {/* Suggested Keyword Pills */}
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: '700',
                                    color: '#5C4332',
                                  }}>
                                  2. Chạm nhanh từ khóa nhận xét (hoặc tự viết thêm):
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                  }}>
                                  {QUICK_FEEDBACK_CHIPS.map((chip) => {
                                    const active =
                                      videoSelectedTags.includes(chip);
                                    return (
                                      <TouchableOpacity
                                        key={chip}
                                        onPress={() =>
                                          setVideoSelectedTags((prev) =>
                                            prev.includes(chip)
                                              ? prev.filter((t) => t !== chip)
                                              : [...prev, chip]
                                          )
                                        }
                                        style={{
                                          backgroundColor: active
                                            ? '#9D174D'
                                            : '#FDF2F8',
                                          borderWidth: 1,
                                          borderColor: active
                                            ? '#9D174D'
                                            : '#F9A8D4',
                                          borderRadius: 999,
                                          paddingHorizontal: 9,
                                          paddingVertical: 4.5,
                                        }}>
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: active
                                              ? '#FFFFFF'
                                              : '#831843',
                                          }}>
                                          {active ? `✓ ${chip}` : `+ ${chip}`}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                <TextInput
                                  style={[
                                    styles.inlineReviewInput,
                                    { fontSize: 16 },
                                  ]}
                                  value={videoComment}
                                  onChangeText={setVideoComment}
                                  placeholder="Tự viết thêm cảm nhận của bạn (tùy chọn)..."
                                  placeholderTextColor={COLORS.lightText}
                                  multiline
                                />

                                <TextInput
                                  style={{
                                    backgroundColor: '#FAF6F0',
                                    borderWidth: 1,
                                    borderColor: '#E2D4C5',
                                    borderRadius: 9,
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    fontSize: 16,
                                    color: COLORS.darkText,
                                    minWidth: 0,
                                  }}
                                  value={videoPostUrl}
                                  onChangeText={setVideoPostUrl}
                                  placeholder="Link Story / bài đăng FB, IG hoặc TikTok (không bắt buộc nếu đã có ảnh màn hình)..."
                                  placeholderTextColor={COLORS.lightText}
                                  autoCapitalize="none"
                                  />

                                  {/* Upload Screenshot Proof */}
                                  <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                  }}>
                                  <TouchableOpacity
                                    onPress={() =>
                                      void handlePickProofScreenshot(
                                        'video_unbox_25k'
                                      )
                                    }
                                    activeOpacity={0.85}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                      backgroundColor: '#FCE7F3',
                                      borderWidth: 1,
                                      borderColor: '#F472B6',
                                      paddingHorizontal: 12,
                                      paddingVertical: 8,
                                      borderRadius: 10,
                                    }}>
                                    <Camera size={15} color="#9D174D" />
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '800',
                                        color: '#9D174D',
                                      }}>
                                      {videoProofImg
                                        ? 'Đổi ảnh màn hình khác'
                                        : '📸 Tải ảnh màn hình Story / Bài đăng có gắn link web'}
                                    </Text>
                                  </TouchableOpacity>

                                  {videoProofImg && (
                                    <View
                                      style={{
                                        position: 'relative',
                                        width: 66,
                                        height: 66,
                                        borderRadius: 9,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: '#F472B6',
                                      }}>
                                      {Platform.OS === 'web' ? (
                                        React.createElement('img', {
                                          src: videoProofImg,
                                          alt: 'Preview Video Proof',
                                          style: {
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                          },
                                        })
                                      ) : (
                                        <Image
                                          source={{ uri: videoProofImg }}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                          }}
                                        />
                                      )}
                                      <TouchableOpacity
                                        onPress={() => setVideoProofImg(null)}
                                        style={{
                                          position: 'absolute',
                                          top: 2,
                                          right: 2,
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          borderRadius: 10,
                                          padding: 2,
                                        }}>
                                        <X size={12} color="#FFFFFF" />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>

                                {videoError ? (
                                  <Text
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: '700',
                                      color: '#B91C1C',
                                    }}>
                                    ⚠️ {videoError}
                                  </Text>
                                ) : null}

                                <TouchableOpacity
                                  style={[
                                    styles.submitInlineReviewBtn,
                                    { backgroundColor: '#9D174D' },
                                  ]}
                                  disabled={videoSubmitting}
                                  onPress={() =>
                                    handleSubmitMissionProof('video_unbox_25k')
                                  }
                                  activeOpacity={0.85}>
                                  {videoSubmitting ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#FFFFFF"
                                    />
                                  ) : (
                                    <Text style={styles.submitInlineReviewText}>
                                      Gửi Minh Chứng & Nhận Gói Quà 60.000₫ (-25k + 1 SP 35k) Qua Chat
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>

                          {/* ================= MỤC 2: FOLLOW FANPAGE FB + SHARE CÔNG KHAI -> VOUCHER -15.000₫ ================= */}
                          <View
                            style={{
                              backgroundColor: '#EFF6FF',
                              borderWidth: 1.5,
                              borderColor: '#93C5FD',
                              borderRadius: 14,
                              padding: 13,
                              gap: 9,
                            }}>
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}>
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 7,
                                  flex: 1,
                                  minWidth: 180,
                                }}>
                                <Share2 size={18} color="#1D4ED8" />
                                <Text
                                  style={{
                                    fontSize: 14,
                                    fontWeight: '900',
                                    color: '#1E3A8A',
                                    flex: 1,
                                  }}>
                                  Mục 2: Follow Fanpage FB & Chia Sẻ Bài Công Khai
                                </Text>
                              </View>
                              <View
                                style={{
                                  backgroundColor: '#1D4ED8',
                                  paddingHorizontal: 10,
                                  paddingVertical: 4,
                                  borderRadius: 999,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: '900',
                                    color: '#FFFFFF',
                                  }}>
                                  🎁 Tặng Mã -15.000₫
                                </Text>
                              </View>
                            </View>

                            <Text
                              style={{
                                fontSize: 12,
                                color: '#1E40AF',
                                lineHeight: 17,
                                fontWeight: '600',
                              }}>
                              • Điều kiện: Bấm{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Theo dõi (Follow) Fanpage Facebook
                              </Text>{' '}
                              của Tiệm Cuộn Len và{' '}
                              <Text style={{ fontWeight: '900' }}>
                                Chia sẻ (Share) bài viết ở chế độ Công khai
                              </Text>
                              .{'\n'}• Phần thưởng: Mã riêng{' '}
                              <Text style={{ fontWeight: '900' }}>-15.000₫</Text>{' '}
                              cho đơn mua lẻ từ 119.000₫ (chỉ tài khoản của bạn dùng được 1 lần, không áp chồng Combo).
                            </Text>

                            {fbSubmitted ? (
                              <View
                                style={{
                                  backgroundColor: '#ECFDF5',
                                  borderWidth: 1,
                                  borderColor: '#6EE7B7',
                                  borderRadius: 11,
                                  padding: 11,
                                  gap: 7,
                                }}>
                                <Text
                                  style={{
                                    fontSize: 12.5,
                                    fontWeight: '800',
                                    color: '#065F46',
                                    lineHeight: 18,
                                  }}>
                                  ✅ Đã gửi đánh giá & ảnh minh chứng Follow + Share Fanpage vào khung Chat! Tiệm đang kiểm tra và gửi mã riêng -15.000₫ cho bạn ngay trong khung Chat nhé.
                                </Text>
                                <TouchableOpacity
                                  onPress={() => openChat()}
                                  activeOpacity={0.85}
                                  style={{
                                    alignSelf: 'flex-start',
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 6,
                                    backgroundColor: '#047857',
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderRadius: 9,
                                  }}>
                                  <MessageCircle size={14} color="#FFFFFF" />
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      fontWeight: '800',
                                      color: '#FFFFFF',
                                    }}>
                                    Mở khung Chat nhận mã -15.000₫
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : (
                              <View
                                style={{
                                  backgroundColor: '#FFFFFF',
                                  borderRadius: 12,
                                  padding: 11,
                                  borderWidth: 1,
                                  borderColor: '#BFDBFE',
                                  gap: 8,
                                }}>
                                {/* Stars */}
                                <View style={styles.starsPickerRow}>
                                  <Text style={styles.starsPickerLabel}>
                                    1. Chấm sao dịch vụ của Tiệm:
                                  </Text>
                                  <View style={styles.starsRow}>
                                    {[1, 2, 3, 4, 5].map((st) => (
                                      <TouchableOpacity
                                        key={st}
                                        onPress={() => setFbRating(st)}>
                                        <Star
                                          size={21}
                                          color="#F59E0B"
                                          fill={
                                            st <= fbRating
                                              ? '#F59E0B'
                                              : 'transparent'
                                          }
                                        />
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>

                                {/* Suggested Keyword Pills */}
                                <Text
                                  style={{
                                    fontSize: 11.5,
                                    fontWeight: '700',
                                    color: '#5C4332',
                                  }}>
                                  2. Chạm nhanh từ khóa nhận xét (hoặc tự viết thêm):
                                </Text>
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    gap: 6,
                                  }}>
                                  {QUICK_FEEDBACK_CHIPS.map((chip) => {
                                    const active =
                                      fbSelectedTags.includes(chip);
                                    return (
                                      <TouchableOpacity
                                        key={chip}
                                        onPress={() =>
                                          setFbSelectedTags((prev) =>
                                            prev.includes(chip)
                                              ? prev.filter((t) => t !== chip)
                                              : [...prev, chip]
                                          )
                                        }
                                        style={{
                                          backgroundColor: active
                                            ? '#1D4ED8'
                                            : '#EFF6FF',
                                          borderWidth: 1,
                                          borderColor: active
                                            ? '#1D4ED8'
                                            : '#93C5FD',
                                          borderRadius: 999,
                                          paddingHorizontal: 9,
                                          paddingVertical: 4.5,
                                        }}>
                                        <Text
                                          style={{
                                            fontSize: 11,
                                            fontWeight: '700',
                                            color: active
                                              ? '#FFFFFF'
                                              : '#1E3A8A',
                                          }}>
                                          {active ? `✓ ${chip}` : `+ ${chip}`}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                <TextInput
                                  style={[
                                    styles.inlineReviewInput,
                                    { fontSize: 16 },
                                  ]}
                                  value={fbComment}
                                  onChangeText={setFbComment}
                                  placeholder="Tự viết thêm cảm nhận của bạn (tùy chọn)..."
                                  placeholderTextColor={COLORS.lightText}
                                  multiline
                                />

                                <TextInput
                                  style={{
                                    backgroundColor: '#FAF6F0',
                                    borderWidth: 1,
                                    borderColor: '#E2D4C5',
                                    borderRadius: 9,
                                    paddingHorizontal: 10,
                                    paddingVertical: 8,
                                    fontSize: 16,
                                    color: COLORS.darkText,
                                    minWidth: 0,
                                  }}
                                  value={fbPostUrl}
                                  onChangeText={setFbPostUrl}
                                  placeholder="Link bài viết Facebook đã chia sẻ công khai (tùy chọn)..."
                                  placeholderTextColor={COLORS.lightText}
                                  autoCapitalize="none"
                                />

                                {/* Upload Screenshot Proof */}
                                <View
                                  style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: 10,
                                  }}>
                                  <TouchableOpacity
                                    onPress={() =>
                                      void handlePickProofScreenshot(
                                        'fb_follow_share_15k'
                                      )
                                    }
                                    activeOpacity={0.85}
                                    style={{
                                      flexDirection: 'row',
                                      alignItems: 'center',
                                      gap: 6,
                                      backgroundColor: '#DBEAFE',
                                      borderWidth: 1,
                                      borderColor: '#60A5FA',
                                      paddingHorizontal: 12,
                                      paddingVertical: 8,
                                      borderRadius: 10,
                                    }}>
                                    <Camera size={15} color="#1D4ED8" />
                                    <Text
                                      style={{
                                        fontSize: 12,
                                        fontWeight: '800',
                                        color: '#1D4ED8',
                                      }}>
                                      {fbProofImg
                                        ? 'Đổi ảnh màn hình khác'
                                        : '📸 Tải ảnh màn hình đã Follow & Share bài'}
                                    </Text>
                                  </TouchableOpacity>

                                  {fbProofImg && (
                                    <View
                                      style={{
                                        position: 'relative',
                                        width: 66,
                                        height: 66,
                                        borderRadius: 9,
                                        overflow: 'hidden',
                                        borderWidth: 1,
                                        borderColor: '#60A5FA',
                                      }}>
                                      {Platform.OS === 'web' ? (
                                        React.createElement('img', {
                                          src: fbProofImg,
                                          alt: 'Preview FB Share Proof',
                                          style: {
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                          },
                                        })
                                      ) : (
                                        <Image
                                          source={{ uri: fbProofImg }}
                                          style={{
                                            width: '100%',
                                            height: '100%',
                                          }}
                                        />
                                      )}
                                      <TouchableOpacity
                                        onPress={() => setFbProofImg(null)}
                                        style={{
                                          position: 'absolute',
                                          top: 2,
                                          right: 2,
                                          backgroundColor: 'rgba(0,0,0,0.65)',
                                          borderRadius: 10,
                                          padding: 2,
                                        }}>
                                        <X size={12} color="#FFFFFF" />
                                      </TouchableOpacity>
                                    </View>
                                  )}
                                </View>

                                {fbError ? (
                                  <Text
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: '700',
                                      color: '#B91C1C',
                                    }}>
                                    ⚠️ {fbError}
                                  </Text>
                                ) : null}

                                <TouchableOpacity
                                  style={[
                                    styles.submitInlineReviewBtn,
                                    { backgroundColor: '#1D4ED8' },
                                  ]}
                                  disabled={fbSubmitting}
                                  onPress={() =>
                                    handleSubmitMissionProof(
                                      'fb_follow_share_15k'
                                    )
                                  }
                                  activeOpacity={0.85}>
                                  {fbSubmitting ? (
                                    <ActivityIndicator
                                      size="small"
                                      color="#FFFFFF"
                                    />
                                  ) : (
                                    <Text style={styles.submitInlineReviewText}>
                                      Gửi Minh Chứng Follow/Share & Nhận Mã -15.000₫ Qua Chat
                                    </Text>
                                  )}
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
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
            {order.shippingAddress?.promoCode &&
              Number(order.shippingAddress?.discountAmount) > 0 && (
                <View style={styles.metaLineRow}>
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: '#065F46', fontWeight: '800' },
                    ]}>
                    🎟️ Mã giảm giá ({order.shippingAddress.promoCode})
                  </Text>
                  <Text
                    style={[
                      styles.sectionValue,
                      { color: '#065F46', fontWeight: '900' },
                    ]}>
                    -{formatVND(Number(order.shippingAddress.discountAmount))}
                  </Text>
                </View>
              )}
            {order.shippingAddress?.bonusGiftProductName && (
              <View style={styles.metaLineRow}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: '#9D174D', fontWeight: '800', flex: 1, paddingRight: 8 },
                  ]}>
                  🎀 Quà tặng kèm ({order.shippingAddress.bonusGiftProductName})
                </Text>
                <Text
                  style={[
                    styles.sectionValue,
                    { color: '#15803D', fontWeight: '900' },
                  ]}>
                  0₫
                </Text>
              </View>
            )}
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
