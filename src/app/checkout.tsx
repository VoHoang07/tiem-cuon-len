import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Check,
  MapPin,
  ChevronRight,
  Building2,
  Smartphone,
  Wallet,
  Truck,
  Home,
  Zap,
  Store,
  Settings,
  MessageCircle,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useAddresses } from '@/store/AddressContext';
import { usePaymentMethods } from '@/store/PaymentMethodsContext';
import { useChat } from '@/store/ChatContext';
import { type PaymentMethod, type PaymentMethodType } from '@/types/payment-method';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { sendOrderNotificationForOrder } from '@/utils/sendOrderNotification';
import {
  CHECKOUT_TITLE,
  CHECKOUT_DELIVERY,
  CHECKOUT_PAYMENT,
  CHECKOUT_ORDER_SUMMARY,
  CHECKOUT_TOTAL,
  CHECKOUT_SUCCESS_TITLE,
  CHECKOUT_SUCCESS_TEXT,
} from '@/constants/strings';

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
    selectedColor,
    selectedAccessory,
    unitPrice,
  } = useLocalSearchParams<{
    mode?: string;
    productId?: string;
    quantity?: string;
    selectedColor?: string;
    selectedAccessory?: string;
    unitPrice?: string;
  }>();
  const isBuyNow = mode === 'buyNow' || mode === 'buy_now';

  const { cart, clearCart, products } = useShop();
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
  const { openChat, sendMessage, myMessages } = useChat();
  const [showAdminShipConfig, setShowAdminShipConfig] = useState(false);
  const [draftHcmFee, setDraftHcmFee] = useState(String(shippingConfig.hcmFee));
  const [draftProvFee, setDraftProvFee] = useState(String(shippingConfig.provincialFee));
  const [draftThreshold, setDraftThreshold] = useState(String(shippingConfig.freeshipThreshold));

  useEffect(() => {
    setDraftHcmFee(String(shippingConfig.hcmFee));
    setDraftProvFee(String(shippingConfig.provincialFee));
    setDraftThreshold(String(shippingConfig.freeshipThreshold));
  }, [shippingConfig]);

  // Compute buyNow product (derive authoritative price from catalog + accessoryDelta, never trust URL price param)
  const buyNowProduct = useMemo(() => {
    if (!isBuyNow || !productId) return null;
    const base = products.find((p) => p.id === productId) ?? null;
    if (!base) return null;
    const matchedColor = base.colorOptions?.find(
      (c) => c.name.toLowerCase() === (selectedColor || '').trim().toLowerCase()
    );
    const matchedAccessory = base.accessoryOptions?.find(
      (a) => a.name.toLowerCase() === (selectedAccessory || '').trim().toLowerCase()
    );
    const accessoryDelta = matchedAccessory?.priceDelta ?? 0;
    const authoritativePrice = Math.max(1000, Number(base.price) + Number(accessoryDelta));
    const suffixParts = [selectedColor, selectedAccessory].filter(Boolean);
    return {
      ...base,
      name: suffixParts.length > 0 ? `${base.name} (${suffixParts.join(' - ')})` : base.name,
      color: selectedColor || base.color,
      selectedColorName: selectedColor || base.color,
      selectedColorHex: matchedColor?.hex,
      selectedAccessoryName: selectedAccessory || undefined,
      image: matchedColor?.image || base.image,
      price: authoritativePrice,
    };
  }, [isBuyNow, productId, products, selectedColor, selectedAccessory]);

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

  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod | null>(null);
  const [shippingOption, setShippingOption] = useState<'standard' | 'express' | 'pickup'>('standard');
  const [hasAskedExpressChat, setHasAskedExpressChat] = useState(false);
  const [expressFeeConfirmed, setExpressFeeConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const lastOrderAtRef = useRef<number>(0);

  // Reset express fee confirmation if address changes or user leaves express mode
  useEffect(() => {
    setExpressFeeConfirmed(false);
    setHasAskedExpressChat(false);
  }, [selectedAddressId]);

  useEffect(() => {
    if (shippingOption !== 'express') {
      setExpressFeeConfirmed(false);
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

  // Set default payment method when data loads
  useEffect(() => {
    if (defaultMethod && !selectedPayment) {
      setSelectedPayment(defaultMethod);
    }
  }, [defaultMethod]);

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
    const d = distRaw.toLowerCase();
    if (!d) {
      return {
        range: '~20k – 45k',
        sub: 'Grab / Ahamove • Tiệm báo giá trước khi gọi xe',
      };
    }
    const isNear =
      d.includes('quận 8') ||
      d.includes('quận 5') ||
      d.includes('quận 6') ||
      d.includes('quận 7') ||
      d.includes('quận 4') ||
      d.includes('quận 10') ||
      d.includes('quận 11') ||
      (d.includes('quận 1') && !d.includes('quận 12')) ||
      d.includes('bình chánh');
    if (isNear) {
      return {
        range: '~18k – 30k',
        sub: `Tới ${distRaw} • Tiệm báo giá trước khi gọi xe`,
      };
    }
    const isMid =
      d.includes('quận 3') ||
      d.includes('phú nhuận') ||
      d.includes('bình thạnh') ||
      d.includes('tân bình') ||
      d.includes('tân phú') ||
      d.includes('nhà bè');
    if (isMid) {
      return {
        range: '~30k – 45k',
        sub: `Tới ${distRaw} • Tiệm báo giá trước khi gọi xe`,
      };
    }
    return {
      range: '~45k – 65k',
      sub: `Tới ${distRaw} • Tiệm báo giá trước khi gọi xe`,
    };
  }, [selectedAddress?.district]);

  const hasMadeToOrder = useMemo(() => {
    return checkoutItems.some((ci) => {
      const liveProd = products.find((p) => p.id === ci.product.id);
      return liveProd
        ? liveProd.isMadeToOrder !== false
        : ci.product.isMadeToOrder !== false;
    });
  }, [checkoutItems, products]);

  const deliveryTimeEstimate = useMemo(() => {
    if (hasMadeToOrder) {
      if (shippingOption === 'pickup') {
        return {
          totalDays: '3–4 ngày',
          breakdown: '3–4 ngày đan thủ công • Tiệm báo bạn ghé lấy ngay khi hoàn thiện',
        };
      }
      if (shippingOption === 'express') {
        return {
          totalDays: '3–4 ngày',
          breakdown: '3–4 ngày đan thủ công + Giao hỏa tốc 2h ngay khi hoàn thiện',
        };
      }
      return isHCM
        ? {
            totalDays: '4–6 ngày',
            breakdown: '3–4 ngày đan thủ công + 1–2 ngày giao nội thành TP.HCM',
          }
        : {
            totalDays: '5–8 ngày',
            breakdown: '3–4 ngày đan thủ công + 2–4 ngày giao liên tỉnh',
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
  }, [userAddresses]);

  const hasAddress = userAddresses.length > 0;

  const getOrderStatus = (type: PaymentMethodType) => {
    if (type === 'cod') return 'Đang xử lý' as const;
    return 'pending_payment' as const;
  };

  const handleAskExpressFeeInChat = () => {
    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng thêm địa chỉ nhận hàng trước khi hỏi giá Ship Hỏa Tốc.');
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

  const handlePayment = async () => {
    if (isSubmittingOrder) return;
    if (!user?.id) {
      Alert.alert('Yêu cầu đăng nhập', 'Vui lòng đăng nhập để đặt hàng.');
      router.replace('/login');
      return;
    }
    if (!selectedAddress) {
      Alert.alert('Thiếu địa chỉ', 'Vui lòng thêm địa chỉ giao hàng trước khi thanh toán.');
      return;
    }
    if (shippingOption === 'express' && !expressFeeConfirmed) {
      handleAskExpressFeeInChat();
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

    const order = {
      id: orderId,
      userId: user?.id ?? user?.email ?? 'unknown',
      items: checkoutItems.map((ci) => ({
        product: ci.product,
        quantity: ci.quantity,
        price: ci.product.price,
      })),
      total: checkoutTotal,
      shippingAddress: {
        ...selectedAddress,
        shippingMethod: shippingMethodLabel,
        shippingFee,
      },
      paymentMethod: selectedPayment.title,
      status,
      createdAt: new Date().toISOString(),
    };

    await addOrder(order);

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
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* Header */}
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
          <Text style={styles.headerTitle} numberOfLines={1}>{CHECKOUT_TITLE}</Text>
          <View style={{ width: 64 }} />
        </View>

        {/* Address — unchanged */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{CHECKOUT_DELIVERY}</Text>
            <TouchableOpacity onPress={() => router.push('/addresses')}>
              <Text style={styles.changeText}>Thay đổi</Text>
            </TouchableOpacity>
          </View>

          {!hasAddress ? (
            <View style={styles.noAddressCard}>
              <MapPin size={48} color={COLORS.lightText} />
              <Text style={styles.noAddressText}>Bạn chưa có địa chỉ giao hàng</Text>
              <TouchableOpacity
                style={styles.addAddressBtn}
                onPress={() => router.push('/addresses/add')}>
                <Text style={styles.addAddressBtnText}>Thêm địa chỉ giao hàng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.addressCard}
                onPress={() => router.push('/addresses')}>
                <View style={styles.addressHeader}>
                  <MapPin size={20} color={COLORS.primary} />
                  <View style={styles.addressInfo}>
                    <Text style={styles.addressName}>{selectedAddress?.fullName}</Text>
                    <Text style={styles.addressPhone}>{selectedAddress?.phone}</Text>
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

              {userAddresses.length > 1 && (
                <View style={styles.addressList}>
                  <Text style={styles.addressListTitle}>Địa chỉ khác</Text>
                  {userAddresses
                    .filter((a) => a.id !== selectedAddressId)
                    .map((addr) => (
                      <TouchableOpacity
                        key={addr.id}
                        style={[
                          styles.altAddressCard,
                          selectedAddressId === addr.id && styles.altAddressCardSelected,
                        ]}
                        onPress={() => setSelectedAddressId(addr.id)}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.altAddressName}>{addr.fullName}</Text>
                          <Text style={styles.altAddressDetail}>
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
              )}
            </>
          )}
        </View>

        {/* Shipping Carrier Selection — Ultra-clean for Customer, Configurable for Admin */}
        <View style={styles.section}>
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

          {[
            {
              id: 'standard' as const,
              icon: <Truck size={20} color="#6BAF5C" />,
              iconBg: '#6BAF5C18',
              title: 'Giao tiêu chuẩn',
              sub: hasMadeToOrder
                ? isHCM
                  ? 'Nội thành TP.HCM • Tổng 4–6 ngày (3–4 ngày làm + 1–2 ngày ship)'
                  : 'Toàn quốc • Tổng 5–8 ngày (3–4 ngày làm + 2–4 ngày ship)'
                : isHCM
                  ? 'Nội thành TP.HCM • 1–2 ngày'
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
              title: 'Giao Hỏa Tốc 2h (TP.HCM)',
              sub: hasMadeToOrder
                ? `${expressEstimate.sub} • Làm 3–4 ngày xong giao ngay 2h`
                : expressEstimate.sub,
              priceLabel: `Dự kiến ${expressEstimate.range}`,
              isFree: false,
              show: isHCM,
            },
            {
              id: 'pickup' as const,
              icon: <Store size={20} color="#765341" />,
              iconBg: '#F5EFE6',
              title: 'Nhận tại tiệm (Quận 8)',
              sub: hasMadeToOrder
                ? 'Làm thủ công 3–4 ngày • Tự qua lấy khi tiệm báo xong'
                : 'Tự qua lấy khi tiệm chuẩn bị xong',
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
                  style={[styles.paymentOption, active && styles.paymentOptionSelected]}
                  onPress={() => setShippingOption(opt.id)}
                  activeOpacity={0.8}>
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
                </TouchableOpacity>
              );
            })}

          {/* Total Crafting + Shipping Time Notice Box */}
          <View
            style={[
              styles.deliveryEstimateBox,
              !hasMadeToOrder && styles.deliveryEstimateBoxReady,
            ]}>
            <Text style={styles.deliveryEstimateTitle}>
              {hasMadeToOrder
                ? `🧶 Đơn có hàng đặt làm • Tổng thời gian nhận: khoảng ${deliveryTimeEstimate.totalDays}`
                : `📦 Hàng có sẵn • Thời gian nhận dự kiến: ${deliveryTimeEstimate.totalDays}`}
            </Text>
            <Text style={styles.deliveryEstimateSub}>
              {deliveryTimeEstimate.breakdown}
            </Text>
          </View>

          {/* 2-Step Express Shipping Chat Quote & Confirmation Gate */}
          {shippingOption === 'express' && (
            <View
              style={[
                styles.expressGateBox,
                expressFeeConfirmed && styles.expressGateBoxConfirmed,
              ]}>
              <Text style={styles.expressGateHeader}>
                {expressFeeConfirmed
                  ? '✅ Đã xác nhận phí Ship Hỏa Tốc với Tiệm'
                  : '⚡ Xác nhận phí Ship Hỏa Tốc qua Chat trước khi thanh toán'}
              </Text>
              <Text style={styles.expressGateDesc}>
                {expressFeeConfirmed
                  ? 'Bạn đã đồng ý mức cước Hỏa Tốc qua khung Chat. Bây giờ bạn có thể bấm nút Thanh toán bên dưới!'
                  : 'Vì cước xe Hỏa Tốc 2h thay đổi theo số km thực tế, bạn vui lòng bấm Bước 1 để nhắn địa chỉ qua khung Chat cho Tiệm báo giá, sau đó bấm Bước 2 (Đồng ý) để mở khóa Thanh toán.'}
              </Text>

              {latestAdminReply ? (
                <View style={styles.expressAdminReplyBox}>
                  <Text style={styles.expressAdminReplyLabel}>💬 Tin nhắn mới nhất từ Tiệm:</Text>
                  <Text style={styles.expressAdminReplyText}>{latestAdminReply.text}</Text>
                </View>
              ) : null}

              <View style={styles.expressGateActionsRow}>
                <TouchableOpacity
                  style={styles.expressChatBtn}
                  onPress={handleAskExpressFeeInChat}
                  activeOpacity={0.85}>
                  <MessageCircle size={16} color="#FFFDF9" />
                  <Text style={styles.expressChatBtnText}>
                    {hasAskedExpressChat
                      ? '💬 Mở lại khung Chat với Tiệm'
                      : '💬 Bước 1: Nhắn Chat hỏi giá Ship'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.expressConfirmBtn,
                    !hasAskedExpressChat && !latestAdminReply && styles.expressConfirmBtnDisabled,
                    expressFeeConfirmed && styles.expressConfirmBtnActive,
                  ]}
                  disabled={!hasAskedExpressChat && !latestAdminReply}
                  onPress={() => setExpressFeeConfirmed((prev) => !prev)}
                  activeOpacity={0.85}>
                  <Text
                    style={[
                      styles.expressConfirmBtnText,
                      expressFeeConfirmed && styles.expressConfirmBtnTextActive,
                    ]}>
                    {expressFeeConfirmed
                      ? '✅ Đã đồng ý giá Ship (Bấm lại nếu muốn hủy)'
                      : hasAskedExpressChat || latestAdminReply
                        ? '⭕ Bước 2: Tôi đồng ý giá Ship • Cho phép Thanh toán'
                        : '🔒 Bước 2: Đồng ý giá Ship (Nhắn Bước 1 trước)'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Payment Method — dynamic from Supabase */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_PAYMENT}</Text>
          {enabledMethods.map((method) => {
            const { icon, color } = TYPE_ICONS[method.type];
            const isSelected = selectedPayment?.id === method.id;

            return (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentOption,
                  isSelected && styles.paymentOptionSelected,
                ]}
                onPress={() => setSelectedPayment(method)}>
                <View style={styles.paymentOptionLeft}>
                  <View style={[styles.paymentIconWrap, { backgroundColor: color + '15' }]}>
                    {icon}
                  </View>
                  <Text style={styles.paymentText}>{method.title}</Text>
                </View>
                {isSelected && <Check size={20} color={color} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{CHECKOUT_ORDER_SUMMARY}</Text>
          {checkoutItems.map((item) => {
            const liveProd = products.find((p) => p.id === item.product.id);
            const isItemOrder = liveProd
              ? liveProd.isMadeToOrder !== false
              : item.product.isMadeToOrder !== false;
            return (
              <View key={item.product.id} style={styles.summaryItem}>
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
                  {(item.product.selectedColorName || item.product.selectedAccessoryName) ? (
                    <Text style={styles.summaryVariantText} numberOfLines={1}>
                      {[
                        item.product.selectedColorName
                          ? `Màu: ${item.product.selectedColorName}`
                          : null,
                        item.product.selectedAccessoryName
                          ? `${item.product.selectedAccessoryEmoji ? `${item.product.selectedAccessoryEmoji} ` : ''}${item.product.selectedAccessoryName}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  ) : null}
                  <View style={styles.summaryMetaInline}>
                    <Text style={styles.summaryQtyText}>Số lượng: x{item.quantity}</Text>
                    <Text style={styles.summaryStockBadge}>
                      {isItemOrder ? '• 🧶 Hàng đặt (3–4 ngày)' : '• 📦 Có sẵn'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.itemPrice}>
                  {formatVND(item.product.price * item.quantity)}
                </Text>
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
            <Text style={styles.subLabel}>
              {hasMadeToOrder ? 'Tổng thời gian làm & giao' : 'Thời gian giao dự kiến'}
            </Text>
            <Text style={[styles.subValue, { color: '#8B5E3C' }]}>
              Khoảng {deliveryTimeEstimate.totalDays}
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
        </View>

        {/* Pay Button (with Express 2-Step Chat Verification Gate) */}
        {shippingOption === 'express' && !expressFeeConfirmed ? (
          <View style={styles.expressBottomGateWrap}>
            {!hasAskedExpressChat && !latestAdminReply ? (
              <TouchableOpacity
                style={[styles.payBtn, styles.payBtnExpressChat, !hasAddress && styles.payBtnDisabled]}
                onPress={handleAskExpressFeeInChat}
                disabled={!hasAddress}
                activeOpacity={0.85}>
                <Text style={styles.payBtnText}>
                  {hasAddress
                    ? '💬 Bước 1: Nhắn Chat hỏi giá Ship Hỏa Tốc'
                    : 'Thêm địa chỉ để hỏi giá Ship'}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.expressBottomConfirmGroup}>
                <TouchableOpacity
                  style={styles.expressBottomOpenChatBtn}
                  onPress={handleAskExpressFeeInChat}
                  activeOpacity={0.85}>
                  <MessageCircle size={17} color="#92400E" />
                  <Text style={styles.expressBottomOpenChatText}>
                    Mở lại khung Chat xem báo giá Ship
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.expressBottomAgreeBtn}
                  onPress={() => setExpressFeeConfirmed(true)}
                  activeOpacity={0.85}>
                  <Text style={styles.expressBottomAgreeText}>
                    ✅ Bước 2: Tôi đồng ý giá Ship Tiệm báo • Mở khóa Thanh toán
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.payBtn, !hasAddress && styles.payBtnDisabled]}
            onPress={handlePayment}
            disabled={!hasAddress}
            activeOpacity={0.8}>
            <Text style={styles.payBtnText}>
              {hasAddress
                ? selectedPayment?.type === 'cod'
                  ? `Đặt hàng COD (${formatVND(checkoutTotal)})`
                  : `Tiếp tục quét mã QR (${formatVND(checkoutTotal)})`
                : 'Thêm địa chỉ để thanh toán'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
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
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: SPACING.md,
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  changeText: { fontSize: 14, fontWeight: '600', color: COLORS.primary, marginBottom: SPACING.md },
  addressCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  addressHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  addressInfo: { flex: 1 },
  addressName: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  addressPhone: { fontSize: 13, color: COLORS.mediumText, marginTop: 2 },
  addressDetail: { fontSize: 13, color: COLORS.mediumText, marginTop: 4, lineHeight: 18 },
  addressList: { marginTop: SPACING.md },
  addressListTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.sm,
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
  paymentText: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
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
    gap: 10,
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { fontSize: 18, fontWeight: '800', color: COLORS.darkText },
  totalValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  payBtn: {
    backgroundColor: COLORS.primary,
    marginHorizontal: 14,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginBottom: SPACING.xxl,
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
});
