import { HiddenBotField } from '@/components/HiddenBotField';
import {
    CHECKOUT_DELIVERY,
    CHECKOUT_ORDER_SUMMARY,
    CHECKOUT_PAYMENT,
    CHECKOUT_TITLE,
    CHECKOUT_TOTAL
} from '@/constants/strings';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import {
    buildCuratedComboProducts,
    isCuratedComboProductId,
} from '@/data/comboCatalog';
import { useAddresses } from '@/store/AddressContext';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useOrders } from '@/store/OrderContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { useShop } from '@/store/ShopContext';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { getProductColorOptionsWithCombo } from '@/utils/comboPricing';
import { validateVietnamRealPhone } from '@/utils/contactTrustValidator';
import { formatVND } from '@/utils/formatCurrency';
import {
    checkRateLimit,
    isCurrentIpBlocked,
    recordSecurityAudit,
    validateHiddenBotField,
} from '@/utils/securityGuard';
import { sendOrderNotificationForOrder } from '@/utils/sendOrderNotification';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Building2,
    Check,
    ChevronLeft,
    ChevronRight,
    Home,
    MapPin,
    MessageCircle,
    Settings,
    Smartphone,
    Store,
    Truck,
    Wallet,
    Zap,
} from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const CHECKOUT_SESSION_KEY = '__tcl_checkout_session_v1';

const TYPE_ICONS: Record<PaymentMethodType, { icon: React.ReactNode; color: string }> = {
  bank_transfer: { icon: <Building2 size={24} color="#765341" />, color: '#765341' },
  momo: { icon: <Smartphone size={24} color="#A50064" />, color: '#A50064' },
  zalopay: { icon: <Wallet size={24} color="#0068FF" />, color: '#0068FF' },
  cod: { icon: <Truck size={24} color="#6BAF5C" />, color: '#6BAF5C' },
};

export default function CheckoutScreen() {
  const router = useRouter();
  const {
    mode,
    productId,
    quantity: buyNowQty,
    selectedColorId,
    selectedColor,
    selectedAccessoryId,
    selectedAccessory,
    giftCardNote,
    unitPrice,
  } = useLocalSearchParams<{
    mode?: string;
    productId?: string;
    quantity?: string;
    selectedColorId?: string;
    selectedColor?: string;
    selectedAccessoryId?: string;
    selectedAccessory?: string;
    giftCardNote?: string;
    unitPrice?: string;
  }>();
  const isBuyNow = mode === 'buyNow' || mode === 'buy_now';

  const { cart, clearCart, products, updateCartItemPackaging } = useShop();
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';
  const { addOrder } = useOrders();
  const { userAddresses, getDefaultAddress } = useAddresses();
  const {
    enabledMethods,
    defaultMethod,
    loading: pmLoading,
    shippingConfig,
    updateShippingConfig,
  } = usePaymentMethods();
  const { openChat, sendMessage, myMessages, isOpen: isChatOpen } = useChat();
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  const isDesktop = windowWidth >= 820;
  const [showAdminShipConfig, setShowAdminShipConfig] = useState(false);
  const [draftHcmFee, setDraftHcmFee] = useState(String(shippingConfig.hcmFee));
  const [draftProvFee, setDraftProvFee] = useState(String(shippingConfig.provincialFee));
  const [draftThreshold, setDraftThreshold] = useState(String(shippingConfig.freeshipThreshold));
  const [buyNowGiftOverride, setBuyNowGiftOverride] = useState<boolean | null>(null);
  const [buyNowGiftNote, setBuyNowGiftNote] = useState<string>(
    giftCardNote ? String(giftCardNote) : ''
  );

  useEffect(() => {
    setBuyNowGiftOverride(null);
    setBuyNowGiftNote(giftCardNote ? String(giftCardNote) : '');
  }, [productId, selectedAccessoryId, giftCardNote]);

  useEffect(() => {
    setDraftHcmFee(String(shippingConfig.hcmFee));
    setDraftProvFee(String(shippingConfig.provincialFee));
    setDraftThreshold(String(shippingConfig.freeshipThreshold));
  }, [shippingConfig]);

  // Compute buyNow product (derive authoritative variant + packaging price from catalog)
  const buyNowProduct = useMemo(() => {
    if (!isBuyNow || !productId) return null;
    const base =
      products.find((p) => p.id === productId) ??
      (isCuratedComboProductId(String(productId))
        ? buildCuratedComboProducts(products).find((p) => p.id === productId) ??
          null
        : null);
    if (!base) return null;
    const baseColorOptions = getProductColorOptionsWithCombo(base);
    const matchedColor =
      baseColorOptions.find((c) => c.id === selectedColorId) ||
      baseColorOptions.find(
        (c) => c.name.toLowerCase() === (selectedColor || '').trim().toLowerCase()
      ) ||
      baseColorOptions[0];

    const defaultIsGiftBox =
      selectedAccessoryId === 'gift_box_letter' ||
      (selectedAccessory || '').toLowerCase().includes('hộp quà') ||
      (selectedAccessory || '').toLowerCase().includes('quà tặng');
    const isGiftBox =
      buyNowGiftOverride !== null ? buyNowGiftOverride : defaultIsGiftBox;
    const accessoryDelta = isGiftBox ? 25000 : 0;
    const resolvedAccessoryId = isGiftBox ? 'gift_box_letter' : 'no_box';
    const resolvedAccessoryName = isGiftBox
      ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
      : 'Tự dùng / Tiêu chuẩn';
    const resolvedAccessoryEmoji = isGiftBox ? '🎁' : '🛍️';

    const baseVariantPrice =
      matchedColor?.price && Number(matchedColor.price) > 0
        ? Number(matchedColor.price)
        : Math.max(1000, Number(base.price));
    const authoritativePrice = baseVariantPrice + accessoryDelta;
    const colorLabel = (selectedColor || matchedColor?.name || '').trim();
    return {
      ...base,
      id: `${base.id}__${matchedColor?.id || 'c1'}__${resolvedAccessoryId}`,
      baseProductId: base.id,
      name: colorLabel ? `${base.name} (${colorLabel})` : base.name,
      color: colorLabel || base.color,
      selectedColorId: matchedColor?.id,
      selectedColorName: colorLabel || base.color,
      selectedColorHex: matchedColor?.hex,
      selectedAccessoryId: resolvedAccessoryId,
      selectedAccessoryName: resolvedAccessoryName,
      selectedAccessoryEmoji: resolvedAccessoryEmoji,
      giftCardNote: isGiftBox ? buyNowGiftNote : undefined,
      image: matchedColor?.image || base.image,
      price: authoritativePrice,
    };
  }, [
    isBuyNow,
    productId,
    products,
    selectedColorId,
    selectedColor,
    selectedAccessoryId,
    selectedAccessory,
    buyNowGiftOverride,
    buyNowGiftNote,
  ]);

  const buyNowQtyNum = Math.max(1, Math.min(99, parseInt(buyNowQty ?? '1', 10) || 1));

  // Compute checkout items based on mode
  const checkoutItems = useMemo(() => {
    if (isBuyNow && buyNowProduct) {
      return [{ product: buyNowProduct, quantity: buyNowQtyNum }];
    }
    return cart;
  }, [isBuyNow, buyNowProduct, buyNowQtyNum, cart]);

  const subtotal = useMemo(() => {
    return checkoutItems.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0);
  }, [checkoutItems]);

  const initialSessionDraft = useMemo(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = window.sessionStorage.getItem(CHECKOUT_SESSION_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            shippingOption:
              parsed?.shippingOption === 'express' ||
              parsed?.shippingOption === 'pickup' ||
              parsed?.shippingOption === 'standard'
                ? (parsed.shippingOption as 'standard' | 'express' | 'pickup')
                : 'standard',
            selectedAddressId:
              typeof parsed?.selectedAddressId === 'string'
                ? parsed.selectedAddressId
                : '',
            selectedPaymentId:
              typeof parsed?.selectedPaymentId === 'string'
                ? parsed.selectedPaymentId
                : '',
          };
        }
      }
    } catch {
      // ignore
    }
    return {
      shippingOption: 'standard' as const,
      selectedAddressId: '',
      selectedPaymentId: '',
    };
  }, []);

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [shippingOption, setShippingOption] = useState<'standard' | 'express' | 'pickup'>(
    initialSessionDraft.shippingOption
  );
  const [hasAskedExpressChat, setHasAskedExpressChat] = useState(false);
  const [expressFeeConfirmed, setExpressFeeConfirmed] = useState(false);
  const [showExpressCard, setShowExpressCard] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    initialSessionDraft.selectedAddressId
  );
  const [addressMissingError, setAddressMissingError] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const addressShakeAnim = useRef(new Animated.Value(0)).current;
  const [botTrap, setBotTrap] = useState('');
  const formMountedAtRef = useRef<number>(Date.now());
  const lastOrderAtRef = useRef<number>(0);

  // Persist checkout choices to sessionStorage so accidental F5 reload keeps user selections
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(
          CHECKOUT_SESSION_KEY,
          JSON.stringify({
            shippingOption,
            selectedAddressId,
            selectedPaymentId: selectedPayment?.id || initialSessionDraft.selectedPaymentId || '',
          })
        );
      }
    } catch {
      // ignore
    }
  }, [shippingOption, selectedAddressId, selectedPayment?.id, initialSessionDraft.selectedPaymentId]);

  const triggerAddressShake = () => {
    setAddressMissingError(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    addressShakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(addressShakeAnim, { toValue: -14, duration: 55, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: 14, duration: 55, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: -12, duration: 55, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: 12, duration: 55, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(addressShakeAnim, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();
  };

  // Reset express fee confirmation if address changes or user leaves express mode
  useEffect(() => {
    setExpressFeeConfirmed(false);
    setHasAskedExpressChat(false);
    setShowExpressCard(false);
  }, [selectedAddressId]);

  useEffect(() => {
    if (shippingOption !== 'express') {
      setExpressFeeConfirmed(false);
      setShowExpressCard(false);
    }
  }, [shippingOption]);

  // Detect if customer already sent an express inquiry in this chat session & surface latest admin reply
  const latestAdminReply = useMemo(() => {
    for (let i = myMessages.length - 1; i >= 0; i--) {
      if (myMessages[i].senderRole === 'admin') {
        return myMessages[i];
      }
    }
    return null;
  }, [myMessages]);

  // Set saved or default payment method when data loads
  useEffect(() => {
    if (!selectedPayment) {
      if (initialSessionDraft.selectedPaymentId && enabledMethods.length > 0) {
        const savedPm = enabledMethods.find(
          (m) => m.id === initialSessionDraft.selectedPaymentId
        );
        if (savedPm) {
          setSelectedPayment(savedPm);
          return;
        }
      }
      if (defaultMethod) {
        setSelectedPayment(defaultMethod);
      }
    }
  }, [defaultMethod, enabledMethods, initialSessionDraft.selectedPaymentId, selectedPayment]);

  const selectedAddress =
    userAddresses.find((a) => a.id === selectedAddressId) ??
    getDefaultAddress();

  const isHCM = useMemo(() => {
    const cityNorm = (selectedAddress?.city || '').toLowerCase();
    return (
      !cityNorm ||
      cityNorm.includes('hồ chí minh') ||
      cityNorm.includes('ho chi minh') ||
      cityNorm.includes('hcm') ||
      cityNorm.includes('sài gòn')
    );
  }, [selectedAddress?.city]);

  // Auto-reset to standard shipping if customer switches to a non-HCM address
  useEffect(() => {
    if (!isHCM && shippingOption === 'express') {
      setShippingOption('standard');
    }
  }, [isHCM, shippingOption]);

  // Estimate Grab/Ahamove 2h fee from Shop (Quận 8, TP.HCM) to customer's District
  const expressEstimate = useMemo(() => {
    const distRaw = (selectedAddress?.district || '').trim();
    if (!distRaw) {
      return {
        range: '~45k – 65k',
        sub: 'Grab / Ahamove • Tiệm báo giá trước khi gọi xe',
      };
    }
    return {
      range: '~45k – 65k',
      sub: `Tới ${distRaw} • Tiệm báo giá trước khi gọi xe`,
    };
  }, [selectedAddress?.district]);

  const hasMadeToOrder = useMemo(() => {
    return checkoutItems.some((ci) => {
      const baseId = String(ci.product.baseProductId || ci.product.id).split('__')[0];
      const liveProd = products.find((p) => p.id === baseId);
      return liveProd
        ? liveProd.isMadeToOrder !== false
        : ci.product.isMadeToOrder !== false;
    });
  }, [checkoutItems, products]);

  const deliveryTimeEstimate = useMemo(() => {
    if (hasMadeToOrder) {
      if (shippingOption === 'pickup') {
        return {
          totalDays: '5–6 ngày',
          breakdown: '5–6 ngày đan thủ công • Tiệm báo bạn ghé lấy ngay khi hoàn thiện',
        };
      }
      if (shippingOption === 'express') {
        return {
          totalDays: '5–6 ngày',
          breakdown: '5–6 ngày đan thủ công + Giao hỏa tốc 2h ngay khi hoàn thiện',
        };
      }
      return isHCM
        ? {
            totalDays: '6–8 ngày',
            breakdown: '5–6 ngày đan thủ công + 1–2 ngày giao nội thành TP.HCM',
          }
        : {
            totalDays: '7–10 ngày',
            breakdown: '5–6 ngày đan thủ công + 2–4 ngày giao liên tỉnh',
          };
    }

    if (shippingOption === 'pickup') {
      return {
        totalDays: 'Trong ngày',
        breakdown: 'Hàng có sẵn • Ghé Tiệm (Quận 8) nhận ngay trong ngày',
      };
    }
    if (shippingOption === 'express') {
      return {
        totalDays: 'Trong 2 giờ',
        breakdown: 'Hàng có sẵn • Giao hỏa tốc 2h nội thành TP.HCM',
      };
    }
    return isHCM
      ? {
          totalDays: '1–2 ngày',
          breakdown: 'Hàng có sẵn đóng gói ngay • Giao nội thành TP.HCM 1–2 ngày',
        }
      : {
          totalDays: '2–4 ngày',
          breakdown: 'Hàng có sẵn đóng gói ngay • Giao liên tỉnh 2–4 ngày',
        };
  }, [hasMadeToOrder, shippingOption, isHCM]);

  const standardShippingFee = useMemo(() => {
    if (
      shippingConfig.freeshipEnabled &&
      shippingConfig.freeshipThreshold > 0 &&
      subtotal >= shippingConfig.freeshipThreshold
    ) {
      return 0;
    }
    return isHCM ? shippingConfig.hcmFee : shippingConfig.provincialFee;
  }, [subtotal, isHCM, shippingConfig]);

  const shippingFee = useMemo(() => {
    if (shippingOption === 'pickup') return 0;
    if (shippingOption === 'express') return 0; // Khách trả cước trực tiếp cho tài xế theo giá App
    return standardShippingFee;
  }, [shippingOption, standardShippingFee]);

  const shippingMethodLabel = useMemo(() => {
    if (shippingOption === 'pickup') {
      return `Nhận tại Tiệm (${deliveryTimeEstimate.totalDays})`;
    }
    if (shippingOption === 'express') {
      return `Giao Hỏa Tốc 2h (Dự kiến ${expressEstimate.range} • Nhận sau ${deliveryTimeEstimate.totalDays})`;
    }
    return isHCM
      ? `Giao tiêu chuẩn Nội thành (Dự kiến ${deliveryTimeEstimate.totalDays})`
      : `Giao tiêu chuẩn Toàn quốc (Dự kiến ${deliveryTimeEstimate.totalDays})`;
  }, [shippingOption, isHCM, expressEstimate.range, deliveryTimeEstimate.totalDays]);

  const handleSaveShippingConfig = async () => {
    const hcm = Math.max(0, parseInt(draftHcmFee.replace(/[^0-9]/g, ''), 10) || 0);
    const prov = Math.max(0, parseInt(draftProvFee.replace(/[^0-9]/g, ''), 10) || 0);
    const thresh = Math.max(
      0,
      parseInt(draftThreshold.replace(/[^0-9]/g, ''), 10) || 0
    );
    await updateShippingConfig({
      hcmFee: hcm,
      provincialFee: prov,
      freeshipThreshold: thresh,
    });
    setShowAdminShipConfig(false);
  };

  const checkoutTotal = subtotal + shippingFee;

  useEffect(() => {
    if (!selectedAddressId && userAddresses.length > 0) {
      const defaultAddr = getDefaultAddress();
      setSelectedAddressId(defaultAddr?.id ?? userAddresses[0].id);
    }
    if (userAddresses.length > 0) {
      setAddressMissingError(false);
    }
  }, [userAddresses]);

  const hasAddress = Boolean(
    selectedAddress &&
      selectedAddress.fullName?.trim() &&
      selectedAddress.phone?.trim() &&
      (shippingOption === 'pickup' ||
        (selectedAddress.city?.trim() && selectedAddress.detailAddress?.trim()))
  );

  const getOrderStatus = (type: PaymentMethodType) => {
    if (type === 'cod') return 'Đang xử lý' as const;
    return 'pending_payment' as const;
  };

  const handleAskExpressFeeInChat = () => {
    if (!hasAddress || !selectedAddress) {
      triggerAddressShake();
      return;
    }
    const fullAddr = [
      selectedAddress.detailAddress,
      selectedAddress.ward,
      selectedAddress.district,
      selectedAddress.city,
    ]
      .filter(Boolean)
      .join(', ');
    const itemsSummary = checkoutItems
      .map((ci) => `${ci.product.name} (x${ci.quantity})`)
      .join(', ');
    const firstProd = checkoutItems[0]?.product;

    if (!hasAskedExpressChat) {
      sendMessage(
        `🚀 Cho mình hỏi giá Ship Hỏa Tốc 2h giao tới địa chỉ: "${fullAddr}" cho đơn: ${itemsSummary} (Dự kiến hệ thống: ${expressEstimate.range}). Tiệm báo giá ship giúp mình để mình xác nhận thanh toán nhé!`,
        firstProd
          ? {
              id: firstProd.id,
              name: firstProd.name,
              price: firstProd.price,
              category: firstProd.category,
              image:
                typeof firstProd.image === 'string' && firstProd.image.length < 500
                  ? firstProd.image
                  : null,
            }
          : null
      );
      setHasAskedExpressChat(true);
    }
    openChat();
  };

  const handlePayment = async (bypassExpressCheck?: boolean) => {
    if (isSubmittingOrder) return;
    if (!user?.id) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để đặt hàng.');
      router.replace('/login');
      return;
    }
    if (!hasAddress || !selectedAddress) {
      triggerAddressShake();
      return;
    }
    const phoneCheck = validateVietnamRealPhone(selectedAddress.phone || '');
    if (!phoneCheck.valid) {
      triggerAddressShake();
      Alert.alert(
        'Cần cập nhật Số điện thoại thật',
        phoneCheck.error ||
          'Vui lòng cập nhật số điện thoại thật đang hoạt động để Bưu tá gọi giao hàng (cho phép Mở hộp kiểm tra hàng trước khi thanh toán).'
      );
      router.push(`/addresses/add?id=${encodeURIComponent(selectedAddress.id)}` as any);
      return;
    }
    if (shippingOption === 'express' && !expressFeeConfirmed && !bypassExpressCheck) {
      setShowExpressCard(true);
      return;
    }

    const botCheck = validateHiddenBotField(botTrap, formMountedAtRef.current, 600);
    if (!botCheck.valid) {
      recordSecurityAudit({
        eventType: 'BOT_TRAP_TRIGGERED',
        severity: 'CRITICAL',
        path: '/checkout',
        method: 'POST_CHECKOUT_TRAP',
        userEmail: user?.email,
        userId: user?.id,
        details: { reason: botCheck.reason },
      });
      Alert.alert('Bảo mật', 'Phát hiện thao tác tự động bất thường. Yêu cầu đã bị từ chối.');
      return;
    }

    const ipStatus = await isCurrentIpBlocked();
    if (ipStatus.blocked) {
      recordSecurityAudit({
        eventType: 'BLOCKED_IP_ATTEMPT',
        severity: 'CRITICAL',
        path: '/checkout',
        method: 'POST_CHECKOUT_BLOCKED_IP',
        userEmail: user?.email,
        userId: user?.id,
        details: { ip: ipStatus.ip, reason: ipStatus.reason },
      });
      Alert.alert(
        'Từ chối truy cập',
        `Địa chỉ IP (${ipStatus.ip}) đã bị chặn đặt hàng do vi phạm chính sách bảo mật.`
      );
      return;
    }

    const rate = checkRateLimit('checkout_order', 3, 60_000, 60_000);
    if (!rate.allowed) {
      recordSecurityAudit({
        eventType: 'RATE_LIMIT_TRIGGERED',
        severity: 'WARNING',
        path: '/checkout',
        method: 'POST_CHECKOUT_RATELIMIT',
        userEmail: user?.email,
        userId: user?.id,
        details: { retryAfterSec: rate.retryAfterSec },
      });
      Alert.alert(
        'Thao tác quá nhanh',
        `Vui lòng đợi ${rate.retryAfterSec} giây trước khi tạo đơn hàng tiếp theo.`
      );
      return;
    }

    if (Date.now() - lastOrderAtRef.current < 15000) {
      Alert.alert('Thao tác quá nhanh', 'Vui lòng đợi 15 giây trước khi tạo đơn hàng tiếp theo.');
      return;
    }
    if (checkoutItems.length === 0 || checkoutTotal <= 0) {
      Alert.alert('Giỏ hàng trống', 'Không có sản phẩm hợp lệ để thanh toán.');
      return;
    }
    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng thêm địa chỉ giao hàng trước khi thanh toán.');
      return;
    }

    if (!selectedPayment) {
      Alert.alert('Chưa chọn', 'Vui lòng chọn phương thức thanh toán.');
      return;
    }

    setIsSubmittingOrder(true);
    lastOrderAtRef.current = Date.now();

    const orderShortId = `${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6)}`;
    const orderId = `CUONLEN-${orderShortId}`;
    const status = getOrderStatus(selectedPayment.type);

    const giftNotesSummary = checkoutItems
      .map((ci) => {
        const accName = (
          ci.product.selectedAccessoryName ||
          ci.selectedAccessory ||
          ''
        ).toLowerCase();
        const isGift =
          ci.product.selectedAccessoryId === 'gift_box_letter' ||
          accName.includes('hộp quà') ||
          accName.includes('quà tặng');
        const noteText = (ci.product.giftCardNote || ci.giftCardNote || '').trim();
        if (!isGift || !noteText) return null;
        return `💌 Thiệp (${ci.product.name}): "${noteText}"`;
      })
      .filter(Boolean)
      .join(' | ');

    const combinedAddressNote = [
      selectedAddress.note?.trim(),
      giftNotesSummary,
    ]
      .filter(Boolean)
      .join(' — ');

    const order = {
      id: orderId,
      userId: user?.id ?? user?.email ?? 'unknown',
      items: checkoutItems.map((ci) => {
        const {
          colorOptions,
          accessoryOptions,
          gallery,
          reviews,
          ...compactProd
        } = ci.product;
        const colorLabel = (ci.product.selectedColorName || ci.selectedColor || '').trim();
        const accLower = (
          ci.product.selectedAccessoryName ||
          ci.selectedAccessory ||
          ''
        ).toLowerCase();
        const isGiftBox =
          ci.product.selectedAccessoryId === 'gift_box_letter' ||
          accLower.includes('hộp quà') ||
          accLower.includes('quà tặng');
        const boxLabel = isGiftBox
          ? '🎁 Set Quà Tặng Đặc Biệt (+25.000₫)'
          : 'Tự dùng / Tiêu chuẩn';
        const suffixParts = [colorLabel, boxLabel].filter(Boolean);
        const suffixStr = suffixParts.join(' • ');
        const displayName =
          suffixStr && !compactProd.name.includes(`(${suffixStr})`)
            ? `${compactProd.name} (${suffixStr})`
            : compactProd.name;
        const itemGiftNote = (
          ci.product.giftCardNote ||
          ci.giftCardNote ||
          ''
        ).trim();
        return {
          product: {
            ...compactProd,
            name: displayName,
            selectedAccessoryId: isGiftBox ? 'gift_box_letter' : 'no_box',
            selectedAccessoryName: isGiftBox
              ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
              : 'Tự dùng / Tiêu chuẩn',
            giftCardNote: isGiftBox && itemGiftNote ? itemGiftNote : undefined,
          },
          quantity: ci.quantity,
          price: ci.product.price,
        };
      }),
      total: checkoutTotal,
      shippingAddress: {
        ...selectedAddress,
        note: combinedAddressNote || selectedAddress.note,
        shippingMethod: shippingMethodLabel,
        shippingFee,
      },
      paymentMethod: selectedPayment.title,
      status,
      createdAt: new Date().toISOString(),
    };

    await addOrder(order);

    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.removeItem(CHECKOUT_SESSION_KEY);
      }
    } catch {
      // ignore
    }

    recordSecurityAudit({
      eventType: 'CHECKOUT_ORDER_CREATED',
      severity: 'INFO',
      path: '/checkout',
      method: selectedPayment.type.toUpperCase(),
      userEmail: user?.email,
      userId: user?.id,
      details: {
        orderId,
        total: checkoutTotal,
        itemCount: checkoutItems.length,
        shippingMethod: shippingMethodLabel,
        paymentMethod: selectedPayment.title,
      },
    });

    if (selectedPayment.type === 'cod') {
      // COD order is finalized immediately -> notify shop owner & clear cart
      sendOrderNotificationForOrder(order).catch(() => {});
      if (!isBuyNow) clearCart();
      setSubmitted(true);
    } else {
      // Bank Transfer / QR: Do NOT send email yet!
      // Email & cart clearing happen only AFTER payment is confirmed on /payment/[orderId]
      router.replace({
        pathname: `/payment/${orderId}` as any,
        params: isBuyNow ? { buyNow: '1' } : undefined,
      });
    }
  };

    const renderCODSuccess = () => (
    <SafeAreaView style={styles.safe}>
      <View style={styles.successContainer}>
        <View style={[styles.successIcon, { backgroundColor: '#6BAF5C' }]}>
          <Truck size={48} color={COLORS.white} />
        </View>
        <Text style={styles.successTitle}>Đặt hàng thành công</Text>
        <Text style={styles.successText}>
          Đơn hàng của bạn đang được xử lý.{'\n'}
          Bạn sẽ thanh toán khi nhận hàng.
        </Text>

        <View style={styles.codInfoCard}>
          <Truck size={20} color="#6BAF5C" />
          <Text style={styles.codInfoText}>
            Thanh toán khi nhận hàng (COD)
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewOrdersBtn}
          onPress={() => router.replace('/orders')}>
          <Text style={styles.viewOrdersBtnText}>Xem đơn hàng</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.goHomeBtn} onPress={() => router.replace('/')}>
          <Text style={styles.goHomeBtnText}>Về Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    );

  if (submitted) return renderCODSuccess();

  if (pmLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={[styles.header, isDesktop && styles.headerDesktop]}>
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
          <Text style={styles.headerTitle} numberOfLines={1}>{CHECKOUT_TITLE}</Text>
          <View style={{ width: 64 }} />
        </View>

        <View style={[styles.checkoutBody, isDesktop && styles.checkoutBodyDesktop]}>
          {/* Left Column on Desktop: Address + Shipping + Payment */}
          <View style={[styles.leftCol, isDesktop && styles.leftColDesktop]}>
            {/* Address */}
            <Animated.View
              style={[
                styles.section,
                isDesktop && styles.sectionDesktop,
                { transform: [{ translateX: addressShakeAnim }] },
              ]}>
              <View style={styles.sectionHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    addressMissingError && { color: '#DC2626' },
                  ]}>
                  {CHECKOUT_DELIVERY}
                </Text>
                <TouchableOpacity onPress={() => router.push('/addresses')}>
                  <Text style={styles.changeText}>Thay đổi</Text>
                </TouchableOpacity>
              </View>

              {addressMissingError && (
                <View style={styles.addressErrorBanner}>
                  <Text style={styles.addressErrorBannerText}>
                    ⚠️ Vui lòng nhập thông tin người nhận & địa chỉ giao hàng trước khi bấm Thanh toán!
                  </Text>
                </View>
              )}

              {!hasAddress ? (
                <View
                  style={[
                    styles.noAddressCard,
                    addressMissingError && styles.noAddressCardError,
                  ]}>
                  <MapPin
                    size={48}
                    color={addressMissingError ? '#DC2626' : COLORS.lightText}
                  />
                  <Text
                    style={[
                      styles.noAddressText,
                      addressMissingError && { color: '#B91C1C', fontWeight: '700' },
                    ]}>
                    {addressMissingError
                      ? 'Bạn chưa nhập thông tin địa chỉ giao hàng!'
                      : 'Bạn chưa có địa chỉ giao hàng'}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.addAddressBtn,
                      addressMissingError && { backgroundColor: '#DC2626' },
                    ]}
                    onPress={() => router.push('/addresses/add')}>
                    <Text style={styles.addAddressBtnText}>
                      + Nhập địa chỉ giao hàng ngay
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.addressCard,
                      isDesktop && styles.addressCardDesktop,
                      addressMissingError && styles.addressCardError,
                    ]}
                    onPress={() => router.push('/addresses')}>
                    <View style={styles.addressHeader}>
                      <MapPin size={20} color={COLORS.primary} />
                      <View style={styles.addressInfo}>
                        <View style={styles.addressTopRow}>
                          <Text style={styles.addressName}>{selectedAddress?.fullName}</Text>
                          {selectedAddress?.phone ? (
                            <Text style={styles.addressPhoneInline}>• {selectedAddress.phone}</Text>
                          ) : null}
                        </View>
                        <Text style={styles.addressDetail}>
                          {[
                            selectedAddress?.detailAddress,
                            selectedAddress?.ward,
                            selectedAddress?.district,
                            selectedAddress?.city,
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={COLORS.lightText} />
                      </View>
                      </TouchableOpacity>

                      {/* Phone Carrier Verification & Buyer Protection Shield */}
                      {(() => {
                      const pCheck = validateVietnamRealPhone(
                      selectedAddress?.phone || ''
                      );
                      return (
                      <View
                        style={{
                          marginTop: 8,
                          backgroundColor: pCheck.valid ? '#ECFDF5' : '#FEF2F2',
                          borderWidth: 1,
                          borderColor: pCheck.valid ? '#A7F3D0' : '#FECACA',
                          borderRadius: 10,
                          paddingHorizontal: 11,
                          paddingVertical: 8,
                          gap: 4,
                        }}>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: pCheck.valid ? '#065F46' : '#B91C1C',
                          }}>
                          {pCheck.valid
                            ? `✅ SĐT ${pCheck.carrier} (${pCheck.normalized}) — Shipper sẽ gọi số này khi giao hàng`
                            : `⚠️ SĐT (${selectedAddress?.phone}) chưa hợp lệ — Bấm "Thay đổi" để nhập SĐT thật nhận hàng`}
                        </Text>
                        <Text
                          style={{
                            fontSize: 11,
                            color: pCheck.valid ? '#047857' : '#991B1B',
                            lineHeight: 15,
                          }}>
                          🛡️ <Text style={{ fontWeight: '800' }}>Cam kết Đồng Kiểm 100%:</Text> Bạn được mở hộp kiểm tra đúng mẫu len trước khi thanh toán. SĐT của bạn được bảo mật tuyệt đối, không gọi quảng cáo.
                        </Text>
                      </View>
                      );
                      })()}

                  {userAddresses.length > 1 && (
                    <View style={styles.addressList}>
                      <Text style={styles.addressListTitle}>Địa chỉ khác</Text>
                      <View style={isDesktop ? styles.altAddressGridDesktop : undefined}>
                        {userAddresses
                          .filter((a) => a.id !== selectedAddressId)
                          .map((addr) => (
                            <TouchableOpacity
                              key={addr.id}
                              style={[
                                styles.altAddressCard,
                                isDesktop && styles.altAddressCardDesktop,
                                selectedAddressId === addr.id && styles.altAddressCardSelected,
                              ]}
                              onPress={() => {
                                setSelectedAddressId(addr.id);
                                setAddressMissingError(false);
                              }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.altAddressName}>{addr.fullName}</Text>
                                <Text style={styles.altAddressDetail} numberOfLines={2}>
                                  {[addr.detailAddress, addr.ward, addr.district, addr.city]
                                    .filter(Boolean)
                                    .join(', ')}
                                </Text>
                              </View>
                              {selectedAddressId === addr.id && (
                                <Check size={20} color={COLORS.primary} />
                              )}
                            </TouchableOpacity>
                          ))}
                      </View>
                    </View>
                  )}
                </>
              )}
            </Animated.View>

            {/* Shipping Carrier Selection */}
            <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Cách nhận hàng</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {shippingConfig.freeshipEnabled && shippingConfig.freeshipThreshold > 0 && (
                    <Text style={styles.freeshipBadge}>
                      Freeship từ {Math.round(shippingConfig.freeshipThreshold / 1000)}k
                    </Text>
                  )}
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.adminConfigBtn}
                      onPress={() => setShowAdminShipConfig((v) => !v)}>
                      <Settings size={13} color="#3D2B1F" />
                      <Text style={styles.adminConfigBtnText}>Chỉnh phí ship</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {isAdmin && showAdminShipConfig && (
                <View style={styles.adminShipConfigCard}>
                  <Text style={styles.adminShipConfigTitle}>
                    ⚙️ Cấu hình phí vận chuyển (Đồng bộ toàn shop)
                  </Text>
                  <View style={styles.adminShipInputsRow}>
                    <View style={styles.adminShipField}>
                      <Text style={styles.adminShipFieldLabel}>Nội thành TP.HCM (₫)</Text>
                      <TextInput
                        style={styles.adminShipInput}
                        value={draftHcmFee}
                        onChangeText={setDraftHcmFee}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.adminShipField}>
                      <Text style={styles.adminShipFieldLabel}>Liên tỉnh (₫)</Text>
                      <TextInput
                        style={styles.adminShipInput}
                        value={draftProvFee}
                        onChangeText={setDraftProvFee}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.adminShipInputsRow}>
                    <View style={styles.adminShipField}>
                      <Text style={styles.adminShipFieldLabel}>Đơn tối thiểu Freeship (₫)</Text>
                      <TextInput
                        style={styles.adminShipInput}
                        value={draftThreshold}
                        onChangeText={setDraftThreshold}
                        keyboardType="numeric"
                      />
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.freeshipToggleBtn,
                        shippingConfig.freeshipEnabled && styles.freeshipToggleBtnActive,
                      ]}
                      onPress={() =>
                        updateShippingConfig({
                          freeshipEnabled: !shippingConfig.freeshipEnabled,
                        })
                      }>
                      <Text
                        style={[
                          styles.freeshipToggleText,
                          shippingConfig.freeshipEnabled && styles.freeshipToggleTextActive,
                        ]}>
                        {shippingConfig.freeshipEnabled ? '✅ Đang bật Freeship' : '⭕ Đang tắt Freeship'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.adminShipSaveBtn}
                    onPress={handleSaveShippingConfig}>
                    <Text style={styles.adminShipSaveBtnText}>Lưu bảng phí vận chuyển</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={isDesktop ? styles.optionsGridDesktop : undefined}>
                {[
                  {
                    id: 'standard' as const,
                    icon: <Truck size={20} color="#6BAF5C" />,
                    iconBg: '#6BAF5C18',
                    title: 'Giao tiêu chuẩn',
                    sub: hasMadeToOrder
                      ? isHCM
                        ? 'Nhận sau 6–8 ngày (gồm đan)'
                        : 'Nhận sau 7–10 ngày (gồm đan)'
                      : isHCM
                        ? 'Nội thành • 1–2 ngày'
                        : 'Toàn quốc • 2–4 ngày',
                    priceLabel:
                      standardShippingFee === 0 ? 'Miễn phí' : formatVND(standardShippingFee),
                    isFree: standardShippingFee === 0,
                    show: true,
                  },
                  {
                    id: 'express' as const,
                    icon: <Zap size={20} color="#D97706" />,
                    iconBg: '#FEF3C7',
                    title: 'Hỏa Tốc 2h (HCM)',
                    sub: 'Báo giá qua Chat trước khi đặt',
                    priceLabel: `${expressEstimate.range}`,
                    isFree: false,
                    show: isHCM,
                  },
                  {
                    id: 'pickup' as const,
                    icon: <Store size={20} color="#765341" />,
                    iconBg: '#F5EFE6',
                    title: 'Nhận tại tiệm (Q.8)',
                    sub: hasMadeToOrder
                      ? 'Đan 5–6 ngày xong ghé lấy'
                      : 'Ghé lấy ngay trong ngày',
                    priceLabel: 'Miễn phí',
                    isFree: true,
                    show: true,
                  },
                ]
                  .filter((opt) => opt.show)
                  .map((opt) => {
                    const active = shippingOption === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.paymentOption,
                          isDesktop && styles.shippingCardDesktop,
                          active && styles.paymentOptionSelected,
                        ]}
                        onPress={() => setShippingOption(opt.id)}
                        activeOpacity={0.8}>
                        {isDesktop ? (
                          <View style={{ width: '100%', gap: 5 }}>
                            <View style={styles.shippingCardTopDesktop}>
                              <View style={[styles.paymentIconWrap, styles.paymentIconWrapCompact, { backgroundColor: opt.iconBg }]}>
                                {opt.icon}
                              </View>
                              <View style={styles.shippingRight}>
                                <Text
                                  style={[
                                    styles.shippingFeeTag,
                                    opt.isFree && { color: '#4E8C40' },
                                  ]}>
                                  {opt.priceLabel}
                                </Text>
                                {active && <Check size={16} color={COLORS.primary} />}
                              </View>
                            </View>
                            <Text style={styles.paymentTextDesktop}>{opt.title}</Text>
                            <Text style={styles.shippingSubtextDesktop} numberOfLines={1}>
                              {opt.sub}
                            </Text>
                          </View>
                        ) : (
                          <>
                            <View style={[styles.paymentOptionLeft, { flex: 1 }]}>
                              <View style={[styles.paymentIconWrap, { backgroundColor: opt.iconBg }]}>
                                {opt.icon}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.paymentText}>{opt.title}</Text>
                                <Text style={styles.shippingSubtext}>{opt.sub}</Text>
                              </View>
                            </View>
                            <View style={styles.shippingRight}>
                              <Text
                                style={[
                                  styles.shippingFeeTag,
                                  opt.isFree && { color: '#4E8C40' },
                                ]}>
                                {opt.priceLabel}
                              </Text>
                              {active && <Check size={18} color={COLORS.primary} />}
                            </View>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </View>

            {/* Payment Method — dynamic from Supabase */}
            <View style={[styles.section, isDesktop && styles.sectionDesktop]}>
              <Text style={styles.sectionTitle}>{CHECKOUT_PAYMENT}</Text>
              <View style={isDesktop ? styles.optionsGridDesktop : undefined}>
                {enabledMethods.map((method) => {
                  const { icon, color } = TYPE_ICONS[method.type];
                  const isSelected = selectedPayment?.id === method.id;

                  return (
                    <TouchableOpacity
                      key={method.id}
                      style={[
                        styles.paymentOption,
                        isDesktop && styles.paymentMethodCardDesktop,
                        isSelected && styles.paymentOptionSelected,
                      ]}
                      onPress={() => setSelectedPayment(method)}>
                      <View style={[styles.paymentOptionLeft, { flex: 1 }]}>
                        <View
                          style={[
                            styles.paymentIconWrap,
                            isDesktop && styles.paymentIconWrapCompact,
                            { backgroundColor: color + '15' },
                          ]}>
                          {icon}
                        </View>
                        <Text
                          style={[
                            styles.paymentText,
                            isDesktop && styles.paymentTextDesktop,
                            { flex: 1 },
                          ]}
                          numberOfLines={2}>
                          {method.title}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Right Column on Desktop: Order Summary + Pay Button Card */}
          <View style={[styles.rightCol, isDesktop && styles.rightColDesktop]}>
            <HiddenBotField value={botTrap} onChangeText={setBotTrap} />
            <View style={[styles.section, isDesktop && styles.summaryCardDesktop]}>
              <Text style={styles.sectionTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
              {checkoutItems.map((item) => {
                const baseId = String(item.product.baseProductId || item.product.id).split('__')[0];
                const liveProd = products.find((p) => p.id === baseId);
                const isItemOrder = liveProd
                  ? liveProd.isMadeToOrder !== false
                  : item.product.isMadeToOrder !== false;
                const accLower = (item.product.selectedAccessoryName || '').toLowerCase();
                const isGiftBox =
                  item.product.selectedAccessoryId === 'gift_box_letter' ||
                  accLower.includes('hộp quà') ||
                  accLower.includes('quà tặng');
                const currentGiftNote = isBuyNow
                  ? buyNowGiftNote
                  : item.product.giftCardNote ?? item.giftCardNote ?? '';

                return (
                  <View key={item.product.id} style={{ marginBottom: 10 }}>
                    <View style={[styles.summaryItem, { marginBottom: 6 }]}>
                      {item.product.image ? (
                        <Image
                          source={
                            typeof item.product.image === 'string'
                              ? { uri: item.product.image }
                              : (item.product.image as any)
                          }
                          style={styles.summaryThumb}
                          resizeMode="cover"
                        />
                      ) : null}
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.itemName} numberOfLines={2}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.summaryVariantText} numberOfLines={1}>
                          {`${
                            item.product.selectedColorName
                              ? `Màu: ${item.product.selectedColorName} • `
                              : ''
                          }${
                            isGiftBox
                              ? '🎁 Set Quà Tặng Đặc Biệt (+25.000₫)'
                              : '🛍️ Tự dùng / Tiêu chuẩn'
                          }`}
                        </Text>
                        <View style={styles.summaryMetaInline}>
                          <Text style={styles.summaryQtyText}>Số lượng: x{item.quantity}</Text>
                          <Text style={styles.summaryStockBadge}>
                            {isItemOrder ? '• 🧶 Hàng đặt (5–6 ngày)' : '• 📦 Có sẵn'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.itemPrice}>
                        {formatVND(item.product.price * item.quantity)}
                      </Text>
                    </View>

                    {/* Cross-sell Gift Set & Handwritten Card Note inside Checkout */}
                    {!isGiftBox ? (
                      <TouchableOpacity
                        onPress={() => {
                          if (isBuyNow) {
                            setBuyNowGiftOverride(true);
                          } else {
                            updateCartItemPackaging(item.product.id, true);
                          }
                        }}
                        activeOpacity={0.85}
                        style={{
                          backgroundColor: '#FDF6EC',
                          borderWidth: 1,
                          borderColor: '#EADBC8',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: 6,
                        }}>
                        <View style={{ flex: 1, minWidth: 160, gap: 2 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '600',
                              color: '#5C4033',
                            }}>
                            🎁 Bạn mua làm quà tặng?{' '}
                            <Text style={{ fontWeight: '800', color: '#8B5A2B' }}>
                              Nâng cấp Set Quà Tặng Đặc Biệt (+25.000₫)
                            </Text>
                          </Text>
                          <Text style={{ fontSize: 11, color: '#7A6552' }}>
                            Hộp nắp gài vintage, rơm thơm, thiệp viết tay + Tặng kèm 1 quà len mini bí mật
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: '#5C4033',
                            paddingHorizontal: 9,
                            paddingVertical: 3,
                            borderRadius: 999,
                          }}>
                          <Text
                            style={{
                              color: '#FFFDF9',
                              fontSize: 11,
                              fontWeight: '700',
                            }}>
                            + Thêm 25.000₫
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={{
                          backgroundColor: '#FDF8F2',
                          borderWidth: 1,
                          borderColor: '#E5D3C0',
                          borderRadius: 10,
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          gap: 6,
                        }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: 6,
                          }}>
                          <Text
                            style={{
                              fontSize: 11.5,
                              fontWeight: '700',
                              color: '#5C4033',
                            }}>
                            🎁 Set Quà Tặng Đặc Biệt (+25.000₫)
                          </Text>
                          <TouchableOpacity
                            onPress={() => {
                              if (isBuyNow) {
                                setBuyNowGiftOverride(false);
                              } else {
                                updateCartItemPackaging(item.product.id, false);
                              }
                            }}
                            activeOpacity={0.75}>
                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight: '600',
                                color: '#8C7460',
                                textDecorationLine: 'underline',
                              }}>
                              Đổi về Tiêu chuẩn
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 11, color: '#6E5643', lineHeight: 15 }}>
                          • Hộp carton nắp gài vintage, ruy băng & lót rơm thơm giấy cao cấp{'\n'}
                          • Thiệp viết tay + 🎁 Tặng kèm 1 món quà len mini bí mật bất ngờ từ tiệm
                        </Text>
                        <TextInput
                          style={{
                            backgroundColor: '#FFFFFF',
                            borderWidth: 1,
                            borderColor: '#E2D4C5',
                            borderRadius: 8,
                            paddingHorizontal: 10,
                            paddingVertical: 6,
                            fontSize: 12,
                            color: '#3B2A1E',
                            minWidth: 0,
                          }}
                          placeholder="💌 Ghi chú nội dung thiệp (nếu có)..."
                          placeholderTextColor="#A3907E"
                          value={currentGiftNote}
                          onChangeText={(txt) => {
                            if (isBuyNow) {
                              setBuyNowGiftNote(txt);
                            } else {
                              updateCartItemPackaging(item.product.id, true, txt);
                            }
                          }}
                          maxLength={220}
                        />
                      </View>
                    )}
                  </View>
                );
              })}
              <View style={styles.divider} />
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Tạm tính ({checkoutItems.length} món)</Text>
                <Text style={styles.subValue}>{formatVND(subtotal)}</Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Phí vận chuyển</Text>
                <Text
                  style={[
                    styles.subValue,
                    shippingOption !== 'express' && shippingFee === 0 && { color: '#4E8C40' },
                  ]}>
                  {shippingOption === 'express'
                    ? `Dự kiến ${expressEstimate.range} (trả khi nhận)`
                    : shippingFee === 0
                      ? 'Miễn phí (0₫)'
                      : formatVND(shippingFee)}
                </Text>
              </View>
              <View style={styles.subRow}>
                <Text style={styles.subLabel}>Dự kiến nhận hàng</Text>
                <Text style={[styles.subValue, { color: '#8B5E3C' }]}>
                  {hasMadeToOrder
                    ? `${deliveryTimeEstimate.totalDays} (gồm 5–6 ngày đan)`
                    : deliveryTimeEstimate.totalDays}
                </Text>
              </View>
              {shippingOption === 'standard' &&
                shippingConfig.freeshipEnabled &&
                shippingConfig.freeshipThreshold > 0 &&
                subtotal < shippingConfig.freeshipThreshold && (
                  <Text style={styles.freeshipHint}>
                    💡 Mua thêm {formatVND(shippingConfig.freeshipThreshold - subtotal)} để được Miễn phí giao hàng!
                  </Text>
                )}
              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{CHECKOUT_TOTAL}</Text>
                <Text style={styles.totalValue}>{formatVND(checkoutTotal)}</Text>
              </View>

              {/* Pay Button inside Summary Card on Desktop, or below on Mobile */}
              <View style={isDesktop ? styles.desktopPayBtnWrap : styles.mobilePayBtnWrap}>
                <TouchableOpacity
                  style={[
                    styles.payBtn,
                    isDesktop && styles.payBtnDesktop,
                  ]}
                  onPress={() => handlePayment()}
                  disabled={isSubmittingOrder}
                  activeOpacity={0.8}>
                  <Text style={styles.payBtnText}>
                    {selectedPayment?.type === 'cod'
                      ? `Đặt hàng COD (${formatVND(checkoutTotal)})`
                      : `Tiếp tục quét mã QR (${formatVND(checkoutTotal)})`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={{ height: isDesktop ? 32 : 60 }} />
      </ScrollView>

      {/* Express 2h Confirmation Card Overlay when customer clicks Thanh toán */}
      {showExpressCard && !isChatOpen && (
        <View style={styles.expressOverlayBackdrop}>
          <View style={styles.expressOverlayCard}>
            <View style={styles.expressOverlayHeader}>
              <View style={styles.expressOverlayIconWrap}>
                <Zap size={20} color="#D97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expressOverlayTitle}>
                  Xác nhận giá Ship Hỏa Tốc 2h
                </Text>
                <Text style={styles.expressOverlaySub}>
                  Dự kiến tới {selectedAddress?.district || 'TP.HCM'}: {expressEstimate.range}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.expressOverlayCloseBtn}
                onPress={() => setShowExpressCard(false)}>
                <Text style={styles.expressOverlayCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Clickable Card to jump to Chat with Shop */}
            <TouchableOpacity
              style={styles.expressChatJumpCard}
              onPress={handleAskExpressFeeInChat}
              activeOpacity={0.85}>
              <View style={styles.expressChatJumpIcon}>
                <MessageCircle size={22} color="#FAF5EE" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.expressChatJumpTitle}>
                  💬 Nhấn vào đây để Chat với Shop biết giá Hỏa Tốc
                </Text>
                <Text style={styles.expressChatJumpDesc}>
                  {hasAskedExpressChat || latestAdminReply
                    ? 'Đã mở hội thoại Hỏa Tốc • Nhấn để xem tin nhắn báo giá của Shop'
                    : 'Nhảy sang khung Chat gửi địa chỉ để Shop báo giá ship chính xác'}
                </Text>
              </View>
              <ChevronRight size={18} color="#92400E" />
            </TouchableOpacity>

            {latestAdminReply ? (
              <View style={styles.expressReplyBanner}>
                <Text style={styles.expressReplyBannerText} numberOfLines={3}>
                  💬 Shop báo: &ldquo;{latestAdminReply.text}&rdquo;
                </Text>
              </View>
            ) : null}

            {/* Confirm Express Payment Button */}
            <TouchableOpacity
              style={[
                styles.expressConfirmPayBtn,
                !hasAskedExpressChat && !latestAdminReply && styles.expressConfirmPayBtnLocked,
              ]}
              onPress={() => {
                if (!hasAskedExpressChat && !latestAdminReply) {
                  Alert.alert(
                    'Chat với Shop trước nhé',
                    'Vui lòng nhấn vào thẻ "Chat với Shop biết giá Hỏa Tốc" ở trên để hỏi giá ship trước khi xác nhận thanh toán.'
                  );
                  return;
                }
                setExpressFeeConfirmed(true);
                setShowExpressCard(false);
                handlePayment(true);
              }}
              activeOpacity={0.85}>
              <Text style={styles.expressConfirmPayBtnText}>
                {hasAskedExpressChat || latestAdminReply
                  ? selectedPayment?.type === 'cod'
                    ? `✅ Xác nhận thanh toán Hỏa Tốc • COD (${formatVND(checkoutTotal)})`
                    : `✅ Xác nhận thanh toán Hỏa Tốc • Quét QR (${formatVND(checkoutTotal)})`
                  : '🔒 Xác nhận thanh toán Hỏa Tốc (Cần bấm Chat với Shop trước)'}
              </Text>
            </TouchableOpacity>

            {/* Option to switch to Standard Shipping and pay normally */}
            <TouchableOpacity
              style={styles.expressSwitchMethodBtn}
              onPress={() => {
                setShippingOption('standard');
                setShowExpressCard(false);
              }}>
              <Text style={styles.expressSwitchMethodText}>
                🔄 Đổi sang Giao tiêu chuẩn (Thanh toán bình thường)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// --- Sub-components ---

// --- Styles ---

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  scrollContent: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  scrollContentDesktop: {
    maxWidth: 1180,
    paddingHorizontal: 16,
  },
  checkoutBody: {
    width: '100%',
  },
  checkoutBodyDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    paddingHorizontal: 6,
  },
  leftCol: {
    width: '100%',
  },
  leftColDesktop: {
    flex: 1.45,
    minWidth: 0,
  },
  rightCol: {
    width: '100%',
  },
  rightColDesktop: {
    flex: 1,
    maxWidth: 420,
    minWidth: 330,
  },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
  },
  headerDesktop: {
    paddingVertical: 10,
    marginBottom: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: { flex: 1, fontSize: 20, fontWeight: '800', color: COLORS.darkText, textAlign: 'center' },
  section: { paddingHorizontal: 14, marginBottom: SPACING.xxl },
  sectionDesktop: {
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: 8,
  },
  changeText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: 8 },
  addressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addressCardDesktop: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  addressHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  addressInfo: { flex: 1 },
  addressTopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  addressName: { fontSize: 15.5, fontWeight: '700', color: COLORS.darkText },
  addressPhone: { fontSize: 13, color: COLORS.mediumText, marginTop: 2 },
  addressPhoneInline: { fontSize: 13.5, fontWeight: '600', color: COLORS.mediumText },
  addressDetail: { fontSize: 13, color: COLORS.mediumText, marginTop: 3, lineHeight: 18 },
  addressList: { marginTop: SPACING.md },
  addressListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.sm,
  },
  altAddressGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  altAddressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  altAddressCardDesktop: {
    flex: 1,
    minWidth: 220,
    marginBottom: 0,
  },
  altAddressCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPurple,
  },
  altAddressName: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  altAddressDetail: { fontSize: 12, color: COLORS.mediumText, marginTop: 2 },
  noAddressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.xxxl,
    alignItems: 'center',
    gap: SPACING.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
  },
  noAddressCardError: {
    borderColor: '#DC2626',
    borderWidth: 2,
    borderStyle: 'solid',
    backgroundColor: '#FFF5F5',
  },
  addressCardError: {
    borderColor: '#DC2626',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  addressErrorBanner: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 10,
  },
  addressErrorBannerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    lineHeight: 18,
  },
  noAddressText: { fontSize: 15, fontWeight: '600', color: COLORS.mediumText },
  addAddressBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.sm,
  },
  addAddressBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  paymentOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.lightPurple,
  },
  paymentOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  paymentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentIconWrapCompact: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  paymentText: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  paymentTextDesktop: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  optionsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  shippingCardDesktop: {
    flex: 1,
    minWidth: 190,
    padding: 12,
    marginBottom: 0,
    alignItems: 'flex-start',
  },
  shippingCardTopDesktop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  shippingSubtextDesktop: {
    fontSize: 11.5,
    lineHeight: 16,
    color: COLORS.mediumText,
  },
  paymentMethodCardDesktop: {
    flex: 1,
    minWidth: 210,
    paddingVertical: 11,
    paddingHorizontal: 13,
    marginBottom: 0,
  },
  paymentDetails: { marginTop: SPACING.md, paddingHorizontal: SPACING.lg },
  paymentDetailsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  bankCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
    gap: SPACING.md,
  },
  qrCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.xxxl,
    ...SHADOWS.small,
    alignItems: 'center',
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    borderRadius: 16,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    gap: SPACING.xs,
  },
  qrImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
    alignSelf: 'center',
  },
  qrPlaceholderText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  qrSubtext: { fontSize: 11, color: COLORS.mediumText, textAlign: 'center' },
  bankInfo: { gap: SPACING.xs },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
  },
  infoLabel: { fontSize: 13, color: COLORS.mediumText, fontWeight: '600' },
  infoValueRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  infoValue: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  infoValueHighlight: {
    color: COLORS.primary,
    fontSize: 15,
    backgroundColor: COLORS.softBeige,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 6,
  },
  copyBtn: { padding: 4 },
  noteBox: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    padding: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  noteTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.xs,
  },
  noteText: { fontSize: 13, color: COLORS.mediumText, lineHeight: 20 },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    gap: 10,
  },
  summaryThumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#F5EFE6',
  },
  itemName: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  summaryVariantText: { fontSize: 12, color: '#6E5239', marginTop: 2 },
  summaryQtyText: { fontSize: 12, color: COLORS.mediumText, marginTop: 1 },
  itemPrice: { fontSize: 14, fontWeight: '700', color: COLORS.darkText },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: SPACING.sm },
  freeshipBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4E8C40',
    backgroundColor: '#EAF6E8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  adminConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE6DC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  adminConfigBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  adminShipConfigCard: {
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5D8C8',
    marginBottom: 12,
    gap: 10,
  },
  adminShipConfigTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  adminShipInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'flex-end',
  },
  adminShipField: {
    flex: 1,
    minWidth: 130,
    gap: 4,
  },
  adminShipFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5239',
  },
  adminShipInput: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#2C1E14',
    minWidth: 0,
  },
  freeshipToggleBtn: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freeshipToggleBtnActive: {
    backgroundColor: '#EAF6E8',
    borderColor: '#86EFAC',
  },
  freeshipToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4332',
  },
  freeshipToggleTextActive: {
    color: '#166534',
  },
  adminShipSaveBtn: {
    backgroundColor: '#3D2B1F',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  adminShipSaveBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  shippingSubtext: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  shippingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  shippingFeeTag: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  deliveryEstimateBox: {
    backgroundColor: '#FFF9F0',
    borderWidth: 1,
    borderColor: '#EAD6BD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    gap: 3,
  },
  deliveryEstimateBoxReady: {
    backgroundColor: '#F3FAF1',
    borderColor: '#C5E4BF',
  },
  deliveryEstimateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  deliveryEstimateSub: {
    fontSize: 12,
    color: '#6E5239',
    fontWeight: '600',
  },
  summaryMetaInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  summaryStockBadge: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#8B5E3C',
  },
  expressGateBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 13,
    marginTop: 6,
    gap: 8,
  },
  expressGateBoxConfirmed: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  expressGateHeader: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#92400E',
  },
  expressGateDesc: {
    fontSize: 12,
    lineHeight: 18,
    color: '#78350F',
    fontWeight: '600',
  },
  expressAdminReplyBox: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  expressAdminReplyLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B45309',
  },
  expressAdminReplyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2C1E14',
  },
  expressGateActionsRow: {
    gap: 8,
    marginTop: 2,
  },
  expressGateActionsRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  expressChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  expressChatBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  expressConfirmBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#D97706',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  expressConfirmBtnDisabled: {
    opacity: 0.5,
    borderColor: '#D6C7B2',
  },
  expressConfirmBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  expressConfirmBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
    textAlign: 'center',
  },
  expressConfirmBtnTextActive: {
    color: '#FFFFFF',
  },
  expressBottomGateWrap: {
    marginHorizontal: 14,
    marginBottom: SPACING.xxl,
  },
  payBtnExpressChat: {
    backgroundColor: '#D97706',
    marginHorizontal: 0,
    marginBottom: 0,
  },
  expressBottomConfirmGroup: {
    gap: 8,
  },
  expressMinimalHint: {
    fontSize: 11.5,
    color: '#78350F',
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  expressCompactReplyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  expressCompactReplyText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#78350F',
  },
  expressCompactOpenLink: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#D97706',
    textDecorationLine: 'underline',
  },
  expressBottomOpenChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  expressBottomOpenChatText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  expressBottomAgreeBtn: {
    backgroundColor: '#059669',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 14,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  expressBottomAgreeText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  subLabel: {
    fontSize: 14,
    color: COLORS.mediumText,
    fontWeight: '600',
  },
  subValue: {
    fontSize: 14,
    color: COLORS.darkText,
    fontWeight: '700',
  },
  freeshipHint: {
    fontSize: 12,
    color: '#6E5239',
    backgroundColor: '#FAF3E8',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
    fontWeight: '600',
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  summaryCardDesktop: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 0,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    ...SHADOWS.small,
  },
  desktopPayBtnWrap: {
    marginTop: 14,
  },
  mobilePayBtnWrap: {
    marginTop: 14,
    marginHorizontal: -14,
  },
  payBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 14,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.xxl,
  },
  payBtnDesktop: {
    marginHorizontal: 0,
    marginBottom: 0,
    borderRadius: 14,
    paddingVertical: 14,
  },
  payBtnDisabled: { opacity: 0.5 },
  payBtnText: { fontSize: 16, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.lg,
    backgroundColor: COLORS.cream,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontSize: 24, fontWeight: '800', color: COLORS.darkText, textAlign: 'center' },
  successText: { fontSize: 16, color: COLORS.mediumText, textAlign: 'center', lineHeight: 24 },
  codInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F0FFF4',
    borderRadius: 14,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  codInfoText: { fontSize: 15, fontWeight: '700', color: '#6BAF5C' },
  successActions: { width: '100%', gap: SPACING.md, marginTop: SPACING.lg },
  viewOrdersBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 16,
    ...SHADOWS.medium,
    alignItems: 'center',
  },
  viewOrdersBtnText: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  goHomeBtn: {
    borderRadius: 20,
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: COLORS.primary,
    alignItems: 'center',
  },
  goHomeBtnText: { fontSize: 16, fontWeight: '700', color: COLORS.primary },
  expressOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(44, 30, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 999,
  },
  expressOverlayCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#FFFDF9',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#E5D5C3',
    gap: 14,
    ...SHADOWS.large,
  },
  expressOverlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  expressOverlayIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  expressOverlayTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
  },
  expressOverlaySub: {
    fontSize: 12.5,
    color: '#92400E',
    fontWeight: '700',
    marginTop: 2,
  },
  expressOverlayCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressOverlayCloseText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5C4332',
  },
  expressChatJumpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 16,
    padding: 14,
  },
  expressChatJumpIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expressChatJumpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#78350F',
  },
  expressChatJumpDesc: {
    fontSize: 12,
    color: '#92400E',
    marginTop: 3,
    lineHeight: 17,
  },
  expressReplyBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  expressReplyBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#065F46',
  },
  expressConfirmPayBtn: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  expressConfirmPayBtnLocked: {
    backgroundColor: '#9CA3AF',
  },
  expressConfirmPayBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  expressSwitchMethodBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
  },
  expressSwitchMethodText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4A3525',
  },
});
