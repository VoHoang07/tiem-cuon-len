import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  Star,
  MessageSquare,
  Edit3,
  Trash2,
  MessageCircle,
  ShoppingCart,
  Share2,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useOrders } from '@/store/OrderContext';
import {
  Product,
  Review,
  ProductColorOption,
  ProductAccessoryOption,
  ProductGalleryItem,
} from '@/types/product';
import { ProductCard } from '@/components/ProductCard';
import { ShareModal, PUBLIC_SHOP_URL } from '@/components/ShareModal';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import {
  PD_NOT_FOUND,
  PD_GO_BACK,
  PD_REVIEWS,
  PD_ADD_TO_CART,
} from '@/constants/strings';

const PD_BUY_NOW = 'Mua ngay';
const MAX_WIDTH = 1040;
export const DEFAULT_GIFT_BOX_IMAGE = '/gift-box-letter.jpg';

function resolveImgUri(src: any): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  if (typeof src === 'object' && typeof src.uri === 'string') return src.uri;
  return null;
}

export default function ProductDetailScreen() {
  const {
    id,
    editCartItemId,
    initialColorId,
    initialAccessoryId,
    initialQty,
  } = useLocalSearchParams<{
    id: string;
    editCartItemId?: string;
    initialColorId?: string;
    initialAccessoryId?: string;
    initialQty?: string;
  }>();
  const router = useRouter();
  const {
    products,
    toggleFavorite,
    isFavorite,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    addReview,
    removeProduct,
    cartCount,
  } = useShop();
  const { user, role, isAuthenticated } = useAuth();
  const { openChatWithProduct } = useChat();
  const { orders } = useOrders();

  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isDesktop = windowWidth >= 820;
  const isMobile = windowWidth < 640;

  const [quantity, setQuantity] = useState(1);
  const [selectedColorId, setSelectedColorId] = useState<string | null>(null);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState<string | null>(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const thumbScrollRef = useRef<ScrollView | null>(null);
  const thumbDragRef = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
    moved: boolean;
  }>({ isDown: false, startX: 0, scrollLeft: 0, moved: false });

  const product = products.find((p) => p.id === id);

  useEffect(() => {
    const parsedQty = Math.max(1, Math.min(99, Number(initialQty) || 1));
    setQuantity(parsedQty);
    setSelectedColorId(initialColorId ? String(initialColorId) : null);
    setSelectedAccessoryId(
      initialAccessoryId ? String(initialAccessoryId) : null
    );
    setActiveGalleryIndex(0);
    setShowReviewForm(false);
  }, [id, initialColorId, initialAccessoryId, initialQty]);

  const colorOptions: ProductColorOption[] = useMemo(
    () => product?.colorOptions ?? [],
    [product]
  );
  const accessoryOptions: ProductAccessoryOption[] = useMemo(
    () => [
      {
        id: 'no_box',
        name: 'Không hộp',
        emoji: '🛍️',
        priceDelta: 0,
      },
      {
        id: 'gift_box_letter',
        name: 'Hộp quà + Thư tay',
        emoji: '🎁',
        priceDelta: 15000,
      },
    ],
    []
  );

  // Build clean gallery from all distinct color variant photos + extra gallery angles + default Gift Box slide
  const galleryItems: ProductGalleryItem[] = useMemo(() => {
    if (!product) return [];

    const items: ProductGalleryItem[] = [];
    const c0 = colorOptions[0];
    const a0 = accessoryOptions[0];

    // 1. Always put the dedicated Cover Photo (Trang Bìa) first if it differs from the first color option's photo
    if (product.image && (!c0?.image || c0.image !== product.image)) {
      items.push({
        id: 'g_cover',
        label: 'Ảnh bìa',
        angleTag: 'Ảnh bìa',
        image: product.image,
        zoomMode: 'normal',
      });
    }

    if (colorOptions.length > 0) {
      colorOptions.forEach((c, idx) => {
        const img = c.image || product.image;
        if (img) {
          const isGiftNamed =
            (c.name || '').toLowerCase().includes('hộp quà') ||
            (c.name || '').toLowerCase().includes('thư tay');
          items.push({
            id: `g_color_${c.id || idx}`,
            label: c.name,
            angleTag: c.name,
            image: img,
            colorId: isGiftNamed ? undefined : c.id,
            accessoryId: isGiftNamed ? 'gift_box_letter' : undefined,
            zoomMode: 'normal',
          });
        }
      });
    }

    if (items.length === 0 && product.image) {
      items.push({
        id: 'g_main',
        label: c0 ? c0.name : 'Góc chính',
        angleTag: c0 ? c0.name : 'Góc chính',
        image: product.image,
        colorId: c0?.id,
        accessoryId: a0?.id,
        zoomMode: 'normal',
      });
    }

    if (product.gallery && product.gallery.length > 0) {
      product.gallery.forEach((g, idx) => {
        if (g.image && g.zoomMode !== 'closeup') {
          const isGiftGallery =
            g.accessoryId === 'gift_box_letter' ||
            (g.label || '').toLowerCase().includes('hộp quà') ||
            (g.angleTag || '').toLowerCase().includes('hộp quà');
          items.push({
            ...g,
            id: g.id || `g_extra_${idx}`,
            accessoryId: isGiftGallery ? 'gift_box_letter' : g.accessoryId,
          });
        }
      });
    }

    // Always ensure every product has the default Gift Box + Thank You Card slide
    const hasGiftBoxSlide = items.some(
      (it) => it.accessoryId === 'gift_box_letter' || it.id === 'g_gift_box_default'
    );
    if (!hasGiftBoxSlide) {
      items.push({
        id: 'g_gift_box_default',
        label: '🎁 Hộp quà + Thư tay',
        angleTag: '🎁 Hộp quà + Thư tay',
        image: DEFAULT_GIFT_BOX_IMAGE,
        accessoryId: 'gift_box_letter',
        zoomMode: 'normal',
      });
    }

    return items;
  }, [product, colorOptions, accessoryOptions]);

  useEffect(() => {
    if (!initialColorId || galleryItems.length === 0) return;
    const matchIdx = galleryItems.findIndex(
      (g) => g.colorId === String(initialColorId) && g.zoomMode !== 'closeup'
    );
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    }
  }, [initialColorId, galleryItems]);

  useEffect(() => {
    if (!thumbScrollRef.current) return;
    const targetX = Math.max(0, activeGalleryIndex * 74 - 140);
    try {
      thumbScrollRef.current.scrollTo({ x: targetX, animated: true });
    } catch {
      // ignore
    }
  }, [activeGalleryIndex]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return products
      .filter((p) => p.category === product.category && p.id !== product.id)
      .slice(0, 4);
  }, [products, product]);

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{PD_NOT_FOUND}</Text>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}>
            <Text style={styles.backLink}>{PD_GO_BACK}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeColor: ProductColorOption | null =
    colorOptions.find((c) => c.id === selectedColorId) ?? colorOptions[0] ?? null;
  const activeAccessory: ProductAccessoryOption =
    accessoryOptions.find((a) => a.id === selectedAccessoryId) ??
    accessoryOptions[0];

  const safeGalleryIndex =
    activeGalleryIndex >= 0 && activeGalleryIndex < galleryItems.length
      ? activeGalleryIndex
      : 0;
  const currentGalleryItem: ProductGalleryItem | undefined =
    galleryItems[safeGalleryIndex];

  const handleSelectGalleryIndex = (idx: number) => {
    setActiveGalleryIndex(idx);
    const item = galleryItems[idx];
    if (item?.colorId) setSelectedColorId(item.colorId);
    if (item?.accessoryId === 'gift_box_letter') {
      setSelectedAccessoryId('gift_box_letter');
    }
  };

  const handleSelectColor = (colorOpt: ProductColorOption) => {
    setSelectedColorId(colorOpt.id);
    const matchIdx = galleryItems.findIndex(
      (g) => g.colorId === colorOpt.id && g.zoomMode !== 'closeup'
    );
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    }
  };

  const handleSelectAccessory = (accOpt: ProductAccessoryOption) => {
    setSelectedAccessoryId(accOpt.id);
    if (accOpt.id === 'gift_box_letter') {
      const giftIdx = galleryItems.findIndex(
        (g) =>
          g.accessoryId === 'gift_box_letter' || g.id === 'g_gift_box_default'
      );
      if (giftIdx !== -1) {
        setActiveGalleryIndex(giftIdx);
      }
    } else if (
      currentGalleryItem?.accessoryId === 'gift_box_letter' ||
      currentGalleryItem?.id === 'g_gift_box_default'
    ) {
      const colorIdx = activeColor
        ? galleryItems.findIndex(
            (g) => g.colorId === activeColor.id && g.zoomMode !== 'closeup'
          )
        : 0;
      setActiveGalleryIndex(colorIdx !== -1 ? colorIdx : 0);
    }
  };

  const accessoryDelta = activeAccessory?.priceDelta ?? 0;
  const baseVariantPrice =
    activeColor?.price && Number(activeColor.price) > 0
      ? Number(activeColor.price)
      : product.price;
  const effectivePrice = baseVariantPrice + accessoryDelta;

  const buildVariantProduct = (): Product => {
    const colorId = activeColor?.id ?? 'c1';
    const accId = activeAccessory?.id ?? 'a1';
    const variantId = `${product.id}__${colorId}__${accId}`;
    return {
      ...product,
      id: variantId,
      baseProductId: product.id,
      color: activeColor ? activeColor.name : product.color,
      selectedColorId: activeColor?.id,
      selectedColorName: activeColor?.name ?? product.color,
      selectedColorHex: activeColor?.hex,
      selectedAccessoryId: activeAccessory?.id,
      selectedAccessoryName: activeAccessory?.name,
      selectedAccessoryEmoji: activeAccessory?.emoji,
      image: activeColor?.image || product.image,
      price: effectivePrice,
    };
  };

  const fav = isFavorite(product.id);
  const isAdmin = role === 'admin';
  const hasCompletedOrderForProduct = orders.some(
    (o) =>
      o.status === 'Hoàn thành' &&
      o.items.some(
        (item) =>
          String(item.product.baseProductId || item.product.id).split('__')[0] ===
          product.id
      )
  );
  const canReview = isAdmin || (role === 'customer' && hasCompletedOrderForProduct);

  const submitReview = () => {
    if (!reviewText.trim()) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập nội dung đánh giá.');
      return;
    }

    const newReview: Review = {
      id: `review_${Date.now()}`,
      userId: user?.email ?? 'anonymous',
      userName: user?.name ?? 'Khách hàng',
      rating: reviewRating,
      comment: reviewText.trim(),
      date: new Date().toISOString(),
    };

    addReview(product.id, newReview);
    setReviewText('');
    setReviewRating(5);
    setShowReviewForm(false);
    Alert.alert('Thành công', 'Đánh giá đã được gửi.');
  };

  const maxOrderQty =
    product.isMadeToOrder !== false ? 99 : Math.max(1, product.quantity);

  const handleAddToCart = async () => {
    if (product.isMadeToOrder === false && quantity > product.quantity) {
      Alert.alert('Không đủ hàng', `Chỉ còn ${product.quantity} sản phẩm trong kho.`);
      return;
    }
    const nextVariant = buildVariantProduct();
    if (editCartItemId) {
      if (editCartItemId === nextVariant.id) {
        updateCartQuantity(nextVariant.id, quantity);
      } else {
        removeFromCart(String(editCartItemId));
        await addToCart(nextVariant, quantity);
      }
      router.push('/cart');
      return;
    }
    await addToCart(nextVariant, quantity);
    router.push('/cart');
  };

  const handleBuyNow = () => {
    if (product.isMadeToOrder === false && quantity > product.quantity) {
      Alert.alert('Không đủ hàng', `Chỉ còn ${product.quantity} sản phẩm trong kho.`);
      return;
    }
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push({
      pathname: '/checkout',
      params: {
        mode: 'buy_now',
        productId: product.id,
        quantity: String(quantity),
        selectedColorId: activeColor?.id ?? '',
        selectedColor: activeColor?.name ?? product.color,
        selectedAccessoryId: activeAccessory?.id ?? 'no_box',
        selectedAccessory: activeAccessory
          ? `${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`
          : '',
        unitPrice: String(effectivePrice),
      },
    });
  };

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      removeProduct(product.id);
      router.replace('/');
      return;
    }
    Alert.alert(
      'Xác nhận xóa',
      `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => {
            removeProduct(product.id);
            router.replace('/');
          },
        },
      ]
    );
  };

  const isCloseupZoom = currentGalleryItem?.zoomMode === 'closeup';
  const activeDisplayImage =
    currentGalleryItem?.image || activeColor?.image || product.image;
  const relatedNumColumns = windowWidth >= 900 ? 4 : windowWidth >= 620 ? 3 : 2;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isMobile && styles.scrollContentMobile,
        ]}
        showsVerticalScrollIndicator={false}>
        {/* 1. Minimalist Top Navigation Bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}>
              <ChevronLeft size={18} color="#4A3728" />
              <Text style={styles.backBtnText}>Quay lại</Text>
            </TouchableOpacity>

            {!isMobile && (
              <View style={styles.breadcrumbRow}>
                <Text style={styles.breadcrumbSep}>/</Text>
                <TouchableOpacity onPress={() => router.replace('/')}>
                  <Text style={styles.breadcrumbLink}>Trang chủ</Text>
                </TouchableOpacity>
                <Text style={styles.breadcrumbSep}>›</Text>
                <Text style={styles.breadcrumbCat}>
                  {getCategoryLabel(product.category)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.topBarRight}>
            {isAdmin ? (
              <TouchableOpacity
                style={styles.sharePillBtn}
                onPress={() => setShowShareModal(true)}
                activeOpacity={0.8}>
                <Share2 size={15} color="#4A3728" />
                <Text style={styles.sharePillText}>Chia sẻ</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.iconCircleBtn}
                  onPress={() => setShowShareModal(true)}>
                  <Share2 size={17} color="#4A3728" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconCircleBtn}
                  onPress={() => toggleFavorite(product.id)}>
                  <Heart
                    size={18}
                    color={fav ? COLORS.error : '#4A3728'}
                    fill={fav ? COLORS.error : 'transparent'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconCircleBtn}
                  onPress={() => router.push('/cart')}>
                  <ShoppingCart size={18} color="#4A3728" />
                  {cartCount > 0 && (
                    <View style={styles.cartBadge}>
                      <Text style={styles.cartBadgeText}>
                        {cartCount > 99 ? '99+' : cartCount}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* 2. Clean 2-Column Boutique Card */}
        <View
          style={[
            styles.mainCard,
            isDesktop ? styles.mainCardDesktop : styles.mainCardMobile,
          ]}>
          {/* Left: Clean Neutral Square Photo + Minimal Thumbnails */}
          <View
            style={[
              styles.galleryCol,
              isDesktop && styles.galleryColDesktop,
            ]}>
            <View style={styles.mainImageFrame}>
              {activeDisplayImage ? (
                Platform.OS === 'web' && resolveImgUri(activeDisplayImage) ? (
                  React.createElement('img', {
                    src: resolveImgUri(activeDisplayImage)!,
                    alt: product.name,
                    decoding: 'async',
                    style: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    },
                  })
                ) : (
                  <Image
                    source={
                      typeof activeDisplayImage === 'string'
                        ? { uri: activeDisplayImage }
                        : (activeDisplayImage as any)
                    }
                    style={[
                      styles.mainImage,
                      isCloseupZoom && { transform: [{ scale: 1.22 }] },
                    ]}
                    resizeMode="cover"
                  />
                )
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={{ fontSize: 56 }}>
                    {getCategoryEmoji(product.category)}
                  </Text>
                </View>
              )}

              {galleryItems.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.arrowBtn, styles.arrowLeft]}
                    onPress={() =>
                      handleSelectGalleryIndex(
                        (safeGalleryIndex - 1 + galleryItems.length) %
                          galleryItems.length
                      )
                    }
                    activeOpacity={0.8}>
                    <ChevronLeft size={18} color="#4A3728" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.arrowBtn, styles.arrowRight]}
                    onPress={() =>
                      handleSelectGalleryIndex(
                        (safeGalleryIndex + 1) % galleryItems.length
                      )
                    }
                    activeOpacity={0.8}>
                    <ChevronRight size={18} color="#4A3728" />
                  </TouchableOpacity>
                </>
              )}

              {activeAccessory && (activeAccessory.priceDelta ?? 0) > 0 && (
                <View style={styles.attachedAccessoryPill}>
                  <Text style={styles.attachedAccessoryText} numberOfLines={1}>
                    {activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}
                    Kèm: {activeAccessory.name} (+{formatVND(activeAccessory.priceDelta || 0)})
                  </Text>
                </View>
              )}

              <View style={styles.counterPill}>
                <Text style={styles.counterPillText}>
                  {safeGalleryIndex + 1} / {galleryItems.length}
                </Text>
              </View>
            </View>

            {/* Clean Square Thumbnails (Swipeable / Mouse-Draggable) */}
            {galleryItems.length > 1 && (
              <ScrollView
                ref={thumbScrollRef}
                horizontal
                showsHorizontalScrollIndicator={true}
                scrollEventThrottle={16}
                contentContainerStyle={styles.thumbRow}
                {...(Platform.OS === 'web'
                  ? ({
                      onMouseDown: (e: any) => {
                        const node = e?.currentTarget;
                        if (!node) return;
                        thumbDragRef.current = {
                          isDown: true,
                          startX: e.pageX - (node.offsetLeft || 0),
                          scrollLeft: node.scrollLeft || 0,
                          moved: false,
                        };
                      },
                      onMouseLeave: () => {
                        thumbDragRef.current.isDown = false;
                      },
                      onMouseUp: () => {
                        thumbDragRef.current.isDown = false;
                      },
                      onMouseMove: (e: any) => {
                        if (!thumbDragRef.current.isDown) return;
                        const node = e?.currentTarget;
                        if (!node) return;
                        e.preventDefault?.();
                        const x = e.pageX - (node.offsetLeft || 0);
                        const walk = x - thumbDragRef.current.startX;
                        if (Math.abs(walk) > 5) {
                          thumbDragRef.current.moved = true;
                        }
                        node.scrollLeft = thumbDragRef.current.scrollLeft - walk;
                      },
                    } as any)
                  : {})}>
                {galleryItems.map((gItem, idx) => {
                  const isSelected = safeGalleryIndex === idx;
                  const thumbImg = gItem.image || product.image;
                  return (
                    <TouchableOpacity
                      key={gItem.id}
                      style={[
                        styles.thumbBox,
                        isSelected && styles.thumbBoxActive,
                      ]}
                      onPress={() => {
                        if (thumbDragRef.current.moved) {
                          thumbDragRef.current.moved = false;
                          return;
                        }
                        handleSelectGalleryIndex(idx);
                      }}
                      activeOpacity={0.85}>
                      {thumbImg ? (
                        Platform.OS === 'web' && resolveImgUri(thumbImg) ? (
                          React.createElement('img', {
                            src: resolveImgUri(thumbImg)!,
                            alt: gItem.label || product.name,
                            decoding: 'async',
                            draggable: false,
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                              userSelect: 'none',
                              pointerEvents: 'none',
                            },
                          })
                        ) : (
                          <Image
                            source={
                              typeof thumbImg === 'string'
                                ? { uri: thumbImg }
                                : (thumbImg as any)
                            }
                            style={styles.thumbImg}
                            resizeMode="cover"
                          />
                        )
                      ) : (
                        <Text style={{ fontSize: 20 }}>
                          {getCategoryEmoji(product.category)}
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>

          {/* Right: Calm, Uncluttered Product Details & Pill Selectors */}
          <View
            style={[
              styles.infoCol,
              isDesktop && styles.infoColDesktop,
            ]}>
            {/* Quiet Meta Line */}
            <View style={styles.quietMetaRow}>
              <Text style={styles.quietMetaText}>
                {getCategoryEmoji(product.category)} {getCategoryLabel(product.category)}
              </Text>
              <Text style={styles.quietMetaDot}>•</Text>
              <Star
                size={13}
                color={COLORS.starYellow}
                fill={COLORS.starYellow}
              />
              <Text style={styles.quietMetaText}>
                {product.rating.toFixed(1)}
              </Text>
              <Text style={styles.quietMetaDot}>•</Text>
              <Text style={styles.quietMetaText}>
                {product.isMadeToOrder !== false
                  ? '🧶 Sản phẩm Order (Đặt làm 5–6 ngày)'
                  : product.quantity > 0
                  ? `📦 Có sẵn ${product.quantity} sản phẩm`
                  : 'Tạm hết hàng'}
              </Text>
            </View>

            {/* Product Name */}
            <Text style={[styles.title, isMobile && styles.titleMobile]}>
              {product.name}
            </Text>

            {/* Calm Price Row */}
            <View style={styles.priceRow}>
              <Text style={styles.priceText}>{formatVND(effectivePrice)}</Text>
              {accessoryDelta > 0 && (
                <Text style={styles.priceDeltaNote}>
                  (Đã gồm +{formatVND(accessoryDelta)} {activeAccessory?.name})
                </Text>
              )}
            </View>

            {/* Concise Description */}
            <Text style={styles.descriptionText}>{product.description}</Text>

            <View style={styles.divider} />

            {/* 1. Compact Color Pill Selector */}
            {colorOptions.length > 0 && (
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>
                  Màu sắc:{' '}
                  <Text style={styles.selectorValue}>
                    {activeColor?.name ?? product.color}
                  </Text>
                </Text>
                <View style={styles.pillWrap}>
                  {colorOptions.map((c) => {
                    const isSelected = activeColor?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.optionPill,
                          isSelected && styles.optionPillSelected,
                        ]}
                        onPress={() => handleSelectColor(c)}
                        activeOpacity={0.8}>
                        <View
                          style={[
                            styles.colorDot,
                            { backgroundColor: c.hex },
                          ]}
                        />
                        <Text
                          style={[
                            styles.optionPillText,
                            isSelected && styles.optionPillTextSelected,
                          ]}>
                          {c.price && Number(c.price) > 0 && colorOptions.length > 1
                            ? `${c.name} • ${formatVND(Number(c.price))}`
                            : c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 2. Packaging / Gift Box Pill Selector ("Không hộp" vs "Hộp quà + Thư tay (+15k)") */}
            <View style={styles.selectorGroup}>
              <Text style={styles.selectorLabel}>
                Đóng gói:{' '}
                <Text style={styles.selectorValue}>
                  {activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}
                  {activeAccessory.name}
                  {(activeAccessory.priceDelta ?? 0) > 0
                    ? ` (+${formatVND(activeAccessory.priceDelta || 0)})`
                    : ''}
                </Text>
              </Text>
              <View style={styles.pillWrap}>
                {accessoryOptions.map((acc) => {
                  const isSelected = activeAccessory?.id === acc.id;
                  const delta = acc.priceDelta ?? 0;
                  return (
                    <TouchableOpacity
                      key={acc.id}
                      style={[
                        styles.optionPill,
                        isSelected && styles.optionPillSelected,
                      ]}
                      onPress={() => handleSelectAccessory(acc)}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.optionPillText,
                          isSelected && styles.optionPillTextSelected,
                        ]}>
                        {acc.emoji ? `${acc.emoji} ` : ''}
                        {acc.name}
                        {delta > 0 ? ` (+${formatVND(delta)})` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Desktop Inline Purchase Row */}
            {!isAdmin && isDesktop && (
              <View style={styles.purchaseRow}>
                <View style={styles.qtyBox}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus size={16} color="#4A3728" />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      setQuantity(Math.min(quantity + 1, maxOrderQty))
                    }>
                    <Plus size={16} color="#4A3728" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.cartBtn}
                  onPress={handleAddToCart}
                  activeOpacity={0.85}>
                  <ShoppingCart size={16} color="#4A3728" />
                  <Text style={styles.cartBtnText}>
                    {editCartItemId ? 'Cập nhật giỏ hàng' : PD_ADD_TO_CART}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.buyBtn}
                  onPress={handleBuyNow}
                  activeOpacity={0.85}>
                  <Text style={styles.buyBtnText}>{PD_BUY_NOW}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Subtle Material & Care Footnote + Chat Link */}
            <View style={styles.subtleFooterBox}>
              <Text style={styles.subtleMetaLine}>
                🧶 Chất liệu: {product.material} • Tuỳ chọn Không hộp hoặc Hộp quà + Thư tay (+15.000₫)
              </Text>

              {isAdmin ? (
                <View style={styles.adminRow}>
                  <TouchableOpacity
                    style={styles.adminActionBtn}
                    onPress={() => router.push(`/edit-product/${product.id}`)}>
                    <Edit3 size={14} color="#4A3728" />
                    <Text style={styles.adminActionText}>Sửa</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adminActionBtn}
                    onPress={() => setShowShareModal(true)}>
                    <Share2 size={14} color="#4A3728" />
                    <Text style={styles.adminActionText}>Chia sẻ mẫu</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.adminActionBtn}
                    onPress={() => openChatWithProduct(buildVariantProduct())}>
                    <MessageCircle size={14} color="#4A3728" />
                    <Text style={styles.adminActionText}>Gửi vào chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminActionBtn, styles.adminDeleteBtn]}
                    onPress={handleDelete}>
                    <Trash2 size={14} color={COLORS.error} />
                    <Text style={[styles.adminActionText, { color: COLORS.error }]}>
                      Xóa
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.chatLinkBtn}
                  onPress={() => openChatWithProduct(buildVariantProduct())}
                  activeOpacity={0.75}>
                  <MessageCircle size={15} color="#6E5239" />
                  <Text style={styles.chatLinkText}>
                    Nhắn tiệm tư vấn hoặc đặt phối màu riêng cho mẫu này ›
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* 3. Calm Customer Reviews Section */}
        <View style={styles.sectionCard}>
          <View style={styles.reviewsHeader}>
            <Text style={styles.sectionTitle}>
              {PD_REVIEWS} ({product.reviews.length})
            </Text>
            {canReview && !showReviewForm ? (
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewForm(true)}>
                <MessageSquare size={14} color="#4A3728" />
                <Text style={styles.writeReviewText}>Viết đánh giá</Text>
              </TouchableOpacity>
            ) : !canReview && !showReviewForm ? (
              <View style={{ backgroundColor: '#F6F0E6', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#E5D8C8' }}>
                <Text style={{ fontSize: 11.5, color: '#6E5239', fontWeight: '600' }}>
                  📦 Mở đánh giá sau khi giao đơn thành công
                </Text>
              </View>
            ) : null}
          </View>

          {showReviewForm && (
            <View style={styles.reviewForm}>
              <View style={styles.reviewStarsInput}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setReviewRating(star)}>
                    <Star
                      size={24}
                      color={COLORS.starYellow}
                      fill={
                        star <= reviewRating ? COLORS.starYellow : 'transparent'
                      }
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.reviewInput}
                value={reviewText}
                onChangeText={setReviewText}
                placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
                placeholderTextColor={COLORS.lightText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={styles.reviewFormActions}>
                <TouchableOpacity
                  style={styles.cancelReviewBtn}
                  onPress={() => {
                    setShowReviewForm(false);
                    setReviewText('');
                  }}>
                  <Text style={styles.cancelReviewText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.submitReviewBtn}
                  onPress={submitReview}>
                  <Text style={styles.submitReviewText}>Gửi đánh giá</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {product.reviews.length === 0 ? (
            <Text style={styles.emptyReviewsText}>
              Chưa có đánh giá nào cho sản phẩm này.
            </Text>
          ) : (
            product.reviews.map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewItemHeader}>
                  <Text style={styles.reviewUser}>{review.userName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={12}
                        color={COLORS.starYellow}
                        fill={
                          star <= review.rating
                            ? COLORS.starYellow
                            : 'transparent'
                        }
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))
          )}
        </View>

        {/* 4. Related Products */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <Text style={styles.sectionTitle}>
              Sản phẩm cùng danh mục {getCategoryLabel(product.category).toLowerCase()}
            </Text>
            <View style={[styles.relatedGrid, isMobile && styles.relatedGridMobile]}>
              {relatedProducts.map((rel) => (
                <ProductCard
                  key={rel.id}
                  product={rel}
                  variant="grid"
                  numColumns={relatedNumColumns}
                  onPress={(p) => router.push(`/product/${p.id}`)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={{ height: isDesktop ? 40 : 120 }} />
      </ScrollView>

      {/* Mobile Bottom Purchase Bar */}
      {!isAdmin && !isDesktop && (
        <View style={styles.mobileBarWrap}>
          <View style={styles.mobileBar}>
            <View style={styles.qtyBox}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus size={16} color="#4A3728" />
              </TouchableOpacity>
              <Text style={styles.qtyValue}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() =>
                  setQuantity(Math.min(quantity + 1, maxOrderQty))
                }>
                <Plus size={16} color="#4A3728" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={handleAddToCart}>
              <Text style={styles.cartBtnText} numberOfLines={1}>
                {editCartItemId ? 'Cập nhật giỏ hàng' : PD_ADD_TO_CART}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buyBtn} onPress={handleBuyNow}>
              <Text style={styles.buyBtnText} numberOfLines={1}>
                {PD_BUY_NOW}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Multi-Platform Share Modal */}
      {showShareModal ? (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          type="product"
          title={
            activeColor || activeAccessory
              ? `${product.name} (${[activeColor?.name, activeAccessory?.name]
                  .filter(Boolean)
                  .join(' + ')})`
              : product.name
          }
          subtitle={`🧶 ${getCategoryLabel(product.category)} • Đặt đan thủ công theo mẫu (5–6 ngày)`}
          priceText={formatVND(effectivePrice)}
          url={`${PUBLIC_SHOP_URL}/product/${product.id}`}
          image={activeDisplayImage || product.image}
          shareText={`🧶 ${product.name}${
            activeColor ? ` - Màu: ${activeColor.name}` : ''
          }${
            activeAccessory ? ` - Phụ kiện: ${activeAccessory.name}` : ''
          } (${formatVND(
            effectivePrice
          )})\n✨ Đan móc thủ công tỉ mỉ theo mẫu tại Tiệm Cuộn Len, tặng kèm hộp quà & thiệp viết tay!`}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  scrollContentMobile: {
    paddingHorizontal: 12,
  },
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  notFoundText: {
    fontSize: 16,
    color: COLORS.mediumText,
  },
  backLink: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A3728',
  },

  /* 1. Minimalist Top Bar */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 8,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
  },
  backBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4A3728',
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbLink: {
    fontSize: 13,
    color: '#8C7A6B',
  },
  breadcrumbSep: {
    fontSize: 13,
    color: '#C4B5A6',
  },
  breadcrumbCat: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4738',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sharePillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
    borderWidth: 1,
    borderColor: '#E2D5C5',
  },
  sharePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A3728',
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2ECE1',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#6E4F37',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFDF9',
  },

  /* 2. Main 2-Column Boutique Card */
  mainCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    padding: 24,
    marginBottom: 20,
    ...SHADOWS.small,
  },
  mainCardDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 32,
  },
  mainCardMobile: {
    flexDirection: 'column',
    padding: 16,
    gap: 18,
  },

  /* Left Column: Clean Neutral Frame (never changes border color) */
  galleryCol: {
    width: '100%',
  },
  galleryColDesktop: {
    flex: 0.95,
    maxWidth: 440,
  },
  mainImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#F7F2EA',
    borderWidth: 1,
    borderColor: '#EAE0D3',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 253, 249, 0.88)',
    borderWidth: 1,
    borderColor: '#E6DBD0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowLeft: {
    left: 10,
  },
  arrowRight: {
    right: 10,
  },
  counterPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(255, 253, 249, 0.88)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  counterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C4738',
  },
  attachedAccessoryPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    maxWidth: '72%',
    backgroundColor: 'rgba(255, 253, 249, 0.92)',
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  attachedAccessoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3728',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  thumbBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F7F2EA',
    borderWidth: 1.5,
    borderColor: '#EAE0D3',
  },
  thumbBoxActive: {
    borderColor: '#6E4F37',
    borderWidth: 2,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },

  /* Right Column: Calm Details */
  infoCol: {
    width: '100%',
    gap: 14,
  },
  infoColDesktop: {
    flex: 1.05,
  },
  quietMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  quietMetaText: {
    fontSize: 13,
    color: '#7D6B5D',
    fontWeight: '500',
  },
  quietMetaDot: {
    fontSize: 13,
    color: '#C4B5A6',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3D2B1F',
    lineHeight: 32,
  },
  titleMobile: {
    fontSize: 20,
    lineHeight: 27,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6E4F37',
  },
  priceDeltaNote: {
    fontSize: 13,
    color: '#8C7A6B',
  },
  descriptionText: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#5F5044',
  },
  divider: {
    height: 1,
    backgroundColor: '#F0E8DD',
    marginVertical: 2,
  },

  /* Soft Pill Selectors */
  selectorGroup: {
    gap: 8,
  },
  selectorLabel: {
    fontSize: 13.5,
    color: '#7D6B5D',
    fontWeight: '500',
  },
  selectorValue: {
    color: '#3D2B1F',
    fontWeight: '600',
  },
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
    maxWidth: '100%',
  },
  optionPillSelected: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.18)',
  },
  optionEmoji: {
    fontSize: 15,
  },
  optionPillText: {
    fontSize: 13.5,
    color: '#5C4738',
    fontWeight: '500',
    flexShrink: 1,
  },
  optionPillTextSelected: {
    color: '#3D2B1F',
    fontWeight: '700',
  },
  accessoryList: {
    width: '100%',
    gap: 8,
  },
  accessoryRowBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  accessoryRowBtnSelected: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
  },
  accessoryRowLeft: {
    flex: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accessoryRowLabel: {
    flex: 1,
    flexShrink: 1,
    fontSize: 13.5,
    color: '#5C4738',
    fontWeight: '500',
    lineHeight: 19,
  },
  accessoryRowPrice: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#8C7A6B',
    backgroundColor: '#F2ECE1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  accessoryRowPriceSelected: {
    color: '#3D2B1F',
    backgroundColor: '#E4D5C3',
    fontWeight: '700',
  },

  /* Purchase Controls */
  purchaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  qtyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6F0',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 4,
    height: 44,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    minWidth: 26,
    textAlign: 'center',
    fontSize: 14.5,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  cartBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
    borderWidth: 1,
    borderColor: '#DFD2C3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 14,
  },
  cartBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4A3728',
  },
  buyBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#5C4033',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFDF9',
  },

  /* Subtle Footer Note & Chat Link */
  subtleFooterBox: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DD',
    gap: 8,
  },
  subtleMetaLine: {
    fontSize: 13,
    color: '#8C7A6B',
  },
  chatLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  chatLinkText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#6E5239',
  },
  adminRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  adminActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
  },
  adminDeleteBtn: {
    backgroundColor: '#FDECEC',
  },
  adminActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3728',
  },

  /* 3. Calm Reviews Card */
  sectionCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    padding: 20,
    marginBottom: 20,
  },
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
  },
  writeReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3728',
  },
  emptyReviewsText: {
    fontSize: 14,
    color: '#8C7A6B',
  },
  reviewForm: {
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  reviewStarsInput: {
    flexDirection: 'row',
    gap: 6,
  },
  reviewInput: {
    backgroundColor: '#FFFDF9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    padding: 10,
    fontSize: 14,
    color: '#3D2B1F',
    minHeight: 72,
  },
  reviewFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EDE4D7',
  },
  cancelReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4738',
  },
  submitReviewBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#5C4033',
  },
  submitReviewText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFDF9',
  },
  reviewItem: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DD',
    gap: 4,
  },
  reviewItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewUser: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: '#5F5044',
    lineHeight: 20,
  },

  /* 4. Related Section */
  relatedSection: {
    gap: 12,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  relatedGridMobile: {
    gap: 10,
  },

  /* Mobile Sticky Bar */
  mobileBarWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFDF9',
    borderTopWidth: 1,
    borderTopColor: '#EAE0D3',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mobileBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
