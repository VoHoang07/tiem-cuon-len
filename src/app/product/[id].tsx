import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
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
  Home,
  MessageCircle,
  Check,
  Palette,
  Sparkles,
  ShoppingCart,
  Camera,
  Gift,
  ShieldCheck,
  Truck,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import {
  Product,
  Review,
  ProductColorOption,
  ProductAccessoryOption,
  ProductGalleryItem,
} from '@/types/product';
import { ProductCard } from '@/components/ProductCard';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import {
  PD_NOT_FOUND,
  PD_GO_BACK,
  PD_DESCRIPTION,
  PD_PRODUCT_DETAILS,
  PD_MATERIAL,
  PD_COLOR,
  PD_STOCK,
  PD_STOCK_AVAILABLE,
  PD_TAGS,
  PD_REVIEWS,
  PD_ADD_TO_CART,
} from '@/constants/strings';

const PD_BUY_NOW = 'Thanh toán ngay';
const MAX_WIDTH = 1120;

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    products,
    toggleFavorite,
    isFavorite,
    addToCart,
    addReview,
    removeProduct,
    cartCount,
  } = useShop();
  const { user, role, isAuthenticated } = useAuth();
  const { openChatWithProduct } = useChat();

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

  const product = products.find((p) => p.id === id);

  // Reset selections when navigating between products
  useEffect(() => {
    setQuantity(1);
    setSelectedColorId(null);
    setSelectedAccessoryId(null);
    setActiveGalleryIndex(0);
    setShowReviewForm(false);
  }, [id]);

  const colorOptions: ProductColorOption[] = useMemo(
    () => product?.colorOptions ?? [],
    [product]
  );
  const accessoryOptions: ProductAccessoryOption[] = useMemo(
    () => product?.accessoryOptions ?? [],
    [product]
  );

  // Build 5-view gallery (uses product.gallery if defined, or auto-constructs 5 rich views from colors, accessories & angles)
  const galleryItems: ProductGalleryItem[] = useMemo(() => {
    if (!product) return [];
    if (product.gallery && product.gallery.length > 0) {
      return product.gallery;
    }

    const c0 = colorOptions[0];
    const c1 = colorOptions[1] ?? c0;
    const c2 = colorOptions[2] ?? c0;
    const c3 = colorOptions[3] ?? c1;

    const a0 = accessoryOptions[0];
    const a1 = accessoryOptions[1] ?? a0;
    const a2 = accessoryOptions[2] ?? a0;
    const a3 = accessoryOptions[3] ?? a1;

    return [
      {
        id: 'g1',
        label: c0 ? `${c0.name}${a0 ? ` • ${a0.name}` : ''}` : 'Góc chính diện',
        angleTag: 'Góc chính diện',
        image: c0?.image || a0?.image || product.image,
        colorId: c0?.id,
        accessoryId: a0?.id,
        tintHex: c0?.hex,
        zoomMode: 'normal',
      },
      {
        id: 'g2',
        label: c1 ? `Màu ${c1.name}` : 'Phiên bản màu 2',
        angleTag: c1 ? `Màu ${c1.name}` : 'Góc nghiêng',
        image: c1?.image || a1?.image || product.image,
        colorId: c1?.id,
        accessoryId: a1?.id,
        tintHex: c1?.hex,
        zoomMode: c1?.image ? 'normal' : 'angleLeft',
      },
      {
        id: 'g3',
        label: a2 ? `${a2.emoji || '🎀'} ${a2.name}` : 'Phối phụ kiện',
        angleTag: a2 ? `Phụ kiện: ${a2.name}` : 'Phối phụ kiện',
        image: a2?.image || c2?.image || product.image,
        colorId: c2?.id,
        accessoryId: a2?.id,
        tintHex: c2?.hex,
        zoomMode: a2?.image || c2?.image ? 'normal' : 'angleRight',
      },
      {
        id: 'g4',
        label: c3 ? `${c3.name}${a3 ? ` • ${a3.name}` : ''}` : 'Phiên bản đặc biệt',
        angleTag: c3 ? `Màu ${c3.name}` : 'Phiên bản đặc biệt',
        image: c3?.image || a3?.image || product.image,
        colorId: c3?.id,
        accessoryId: a3?.id,
        tintHex: c3?.hex,
        zoomMode: c3?.image || a3?.image ? 'normal' : 'closeup',
      },
      {
        id: 'g5',
        label: 'Cận cảnh mũi móc & Đóng gói',
        angleTag: 'Cận cảnh chi tiết',
        image: product.image,
        colorId: c0?.id,
        accessoryId: a0?.id,
        tintHex: c0?.hex,
        zoomMode: 'detail',
      },
    ];
  }, [product, colorOptions, accessoryOptions]);

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
  const activeAccessory: ProductAccessoryOption | null =
    accessoryOptions.find((a) => a.id === selectedAccessoryId) ??
    accessoryOptions[0] ??
    null;

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
    if (item?.accessoryId) setSelectedAccessoryId(item.accessoryId);
  };

  const handleSelectColor = (colorOpt: ProductColorOption, idx: number) => {
    setSelectedColorId(colorOpt.id);
    const matchIdx = galleryItems.findIndex((g) => g.colorId === colorOpt.id);
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    } else if (idx < galleryItems.length) {
      setActiveGalleryIndex(idx);
    }
  };

  const handleSelectAccessory = (accOpt: ProductAccessoryOption, idx: number) => {
    setSelectedAccessoryId(accOpt.id);
    const matchIdx = galleryItems.findIndex((g) => g.accessoryId === accOpt.id);
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    } else if (idx < galleryItems.length) {
      setActiveGalleryIndex(idx);
    }
  };

  const accessoryDelta = activeAccessory?.priceDelta ?? 0;
  const effectivePrice = product.price + accessoryDelta;

  const selectedVariantSummary = [
    activeColor ? `Màu: ${activeColor.name}` : null,
    activeAccessory
      ? `Phụ kiện: ${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`
      : null,
  ]
    .filter(Boolean)
    .join(' • ');

  const buildVariantProduct = (): Product => {
    const suffixParts = [
      activeColor?.name,
      activeAccessory
        ? `${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`
        : undefined,
    ].filter(Boolean);
    const variantLabel = suffixParts.join(' - ');
    return {
      ...product,
      name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      color: activeColor ? activeColor.name : product.color,
      image: currentGalleryItem?.image || product.image,
      price: effectivePrice,
    };
  };

  const fav = isFavorite(product.id);
  const canReview = role === 'customer';
  const isAdmin = role === 'admin';

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

  const handleAddToCart = async () => {
    if (quantity > product.quantity) {
      Alert.alert('Không đủ hàng', `Chỉ còn ${product.quantity} sản phẩm trong kho.`);
      return;
    }
    await addToCart(buildVariantProduct(), quantity);
    router.push('/cart');
  };

  const handleBuyNow = () => {
    if (quantity > product.quantity) {
      Alert.alert('Không đủ hàng', `Chỉ còn ${product.quantity} sản phẩm trong kho.`);
      return;
    }

    if (!isAuthenticated) {
      const target = `/checkout?mode=buyNow&productId=${encodeURIComponent(product.id)}&quantity=${quantity}`;
      router.push({
        pathname: '/login',
        params: { redirect: target },
      });
      return;
    }

    router.push({
      pathname: '/checkout',
      params: {
        mode: 'buyNow',
        productId: product.id,
        quantity,
        selectedColor: activeColor?.name ?? '',
        selectedAccessory: activeAccessory
          ? `${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`
          : '',
        unitPrice: String(effectivePrice),
      },
    });
  };

  const handleDelete = () => {
    if (typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`Bạn có chắc muốn xóa "${product.name}"?`);
      if (ok) {
        removeProduct(product.id);
        router.replace('/');
      }
      return;
    }
    Alert.alert('Xóa sản phẩm', `Bạn có chắc muốn xóa "${product.name}"?`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          removeProduct(product.id);
          router.replace('/');
        },
      },
    ]);
  };

  const activeDisplayImage = currentGalleryItem?.image || product.image;
  const zoomMode = currentGalleryItem?.zoomMode || 'normal';

  const getZoomTransformStyle = () => {
    switch (zoomMode) {
      case 'closeup':
        return { transform: [{ scale: 1.18 }] };
      case 'detail':
        return { transform: [{ scale: 1.32 }] };
      case 'angleLeft':
        return { transform: [{ scale: 1.1 }, { translateX: -10 }] };
      case 'angleRight':
        return { transform: [{ scale: 1.1 }, { translateX: 10 }] };
      default:
        return undefined;
    }
  };

  const relatedNumColumns = windowWidth >= 960 ? 4 : windowWidth >= 640 ? 3 : 2;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 1. Top Boutique Navigation & Breadcrumb Bar */}
        <View style={[styles.topNavCard, isMobile && styles.topNavCardMobile]}>
          <View style={styles.topNavLeft}>
            <TouchableOpacity
              style={styles.navIconBtn}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}>
              <ChevronLeft size={20} color="#3D2B1F" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.navIconBtn}
              onPress={() => router.replace('/')}>
              <Home size={18} color="#3D2B1F" />
            </TouchableOpacity>

            <View style={styles.breadcrumbWrap}>
              <TouchableOpacity onPress={() => router.replace('/')}>
                <Text style={styles.breadcrumbLink}>Trang chủ</Text>
              </TouchableOpacity>
              <Text style={styles.breadcrumbSep}>›</Text>
              <Text style={styles.breadcrumbCategory}>
                {getCategoryEmoji(product.category)} {getCategoryLabel(product.category)}
              </Text>
              {!isMobile && (
                <>
                  <Text style={styles.breadcrumbSep}>›</Text>
                  <Text style={styles.breadcrumbCurrent} numberOfLines={1}>
                    {product.name}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.topNavRight}>
            {!isAdmin && (
              <>
                <TouchableOpacity
                  style={[styles.navIconBtn, fav && styles.navIconBtnFav]}
                  onPress={() => toggleFavorite(product.id)}>
                  <Heart
                    size={18}
                    color={fav ? COLORS.error : '#3D2B1F'}
                    fill={fav ? COLORS.error : 'transparent'}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.navIconBtn}
                  onPress={() => router.push('/cart')}>
                  <ShoppingCart size={18} color="#3D2B1F" />
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

        {/* 2. Hero 2-Column Showcase Card */}
        <View
          style={[
            styles.heroCard,
            isDesktop ? styles.heroCardDesktop : styles.heroCardMobile,
          ]}>
          {/* Left Column: Square Multi-Angle & Variant Gallery */}
          <View
            style={[
              styles.galleryColumn,
              isDesktop && styles.galleryColumnDesktop,
            ]}>
            <View
              style={[
                styles.mainImageFrame,
                activeColor?.hex
                  ? { borderColor: activeColor.hex }
                  : undefined,
              ]}>
              {activeDisplayImage ? (
                <Image
                  source={
                    typeof activeDisplayImage === 'string'
                      ? { uri: activeDisplayImage }
                      : (activeDisplayImage as any)
                  }
                  style={[styles.mainProductImage, getZoomTransformStyle()]}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imageEmoji}>
                    {getCategoryEmoji(product.category)}
                  </Text>
                </View>
              )}

              {/* Subtle color tint indicator ring when switching variants */}
              {activeColor?.hex && (
                <View
                  style={[
                    styles.colorAccentCorner,
                    { backgroundColor: activeColor.hex },
                  ]}
                />
              )}

              {/* Top-left Handmade & Angle Counter Pill */}
              <View style={styles.imageTopOverlayRow}>
                <View style={styles.angleCounterPill}>
                  <Camera size={13} color="#3D2B1F" />
                  <Text style={styles.angleCounterText}>
                    {safeGalleryIndex + 1}/{galleryItems.length} •{' '}
                    {currentGalleryItem?.angleTag || 'Góc chính'}
                  </Text>
                </View>

                <View style={styles.handmadeBadgePill}>
                  <Sparkles size={12} color="#8C684C" />
                  <Text style={styles.handmadeBadgeText}>100% Handmade</Text>
                </View>
              </View>

              {/* Prev / Next Gallery Arrows */}
              {galleryItems.length > 1 && (
                <>
                  <TouchableOpacity
                    style={[styles.galleryArrowBtn, styles.galleryArrowLeft]}
                    onPress={() =>
                      handleSelectGalleryIndex(
                        (safeGalleryIndex - 1 + galleryItems.length) %
                          galleryItems.length
                      )
                    }
                    activeOpacity={0.8}>
                    <ChevronLeft size={20} color="#3D2B1F" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.galleryArrowBtn, styles.galleryArrowRight]}
                    onPress={() =>
                      handleSelectGalleryIndex(
                        (safeGalleryIndex + 1) % galleryItems.length
                      )
                    }
                    activeOpacity={0.8}>
                    <ChevronRight size={20} color="#3D2B1F" />
                  </TouchableOpacity>
                </>
              )}

              {/* Bottom Variant Live Preview Overlay */}
              <View style={styles.imageBottomOverlay}>
                <View style={styles.livePreviewPill}>
                  {activeColor && (
                    <View
                      style={[
                        styles.livePreviewDot,
                        { backgroundColor: activeColor.hex },
                      ]}
                    />
                  )}
                  <Text style={styles.livePreviewText} numberOfLines={1}>
                    {currentGalleryItem?.label || selectedVariantSummary || product.name}
                  </Text>
                </View>
              </View>
            </View>

            {/* 5-Thumbnail Strip */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbnailStrip}>
              {galleryItems.map((gItem, idx) => {
                const isSelected = safeGalleryIndex === idx;
                const thumbImg = gItem.image || product.image;
                return (
                  <TouchableOpacity
                    key={gItem.id}
                    style={[
                      styles.thumbnailItem,
                      isSelected && styles.thumbnailItemSelected,
                    ]}
                    onPress={() => handleSelectGalleryIndex(idx)}
                    activeOpacity={0.8}>
                    <View style={styles.thumbnailImageWrap}>
                      {thumbImg ? (
                        <Image
                          source={
                            typeof thumbImg === 'string'
                              ? { uri: thumbImg }
                              : (thumbImg as any)
                          }
                          style={[
                            styles.thumbnailImage,
                            gItem.zoomMode === 'detail' && {
                              transform: [{ scale: 1.3 }],
                            },
                            gItem.zoomMode === 'closeup' && {
                              transform: [{ scale: 1.16 }],
                            },
                          ]}
                          resizeMode="cover"
                        />
                      ) : (
                        <Text style={{ fontSize: 22 }}>
                          {getCategoryEmoji(product.category)}
                        </Text>
                      )}
                      {gItem.tintHex && (
                        <View
                          style={[
                            styles.thumbColorDot,
                            { backgroundColor: gItem.tintHex },
                          ]}
                        />
                      )}
                    </View>
                    <Text
                      style={[
                        styles.thumbnailCaption,
                        isSelected && styles.thumbnailCaptionSelected,
                      ]}
                      numberOfLines={1}>
                      {gItem.angleTag}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Right Column: Product Info & Interactive Variant Customizer */}
          <View
            style={[
              styles.detailsColumn,
              isDesktop && styles.detailsColumnDesktop,
            ]}>
            {/* Category + Stock + Rating Badges */}
            <View style={styles.metaBadgesRow}>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryBadgeText}>
                  {getCategoryEmoji(product.category)} {getCategoryLabel(product.category)}
                </Text>
              </View>

              <View
                style={[
                  styles.stockStatusPill,
                  product.quantity <= 2 && styles.stockStatusPillLow,
                ]}>
                <View
                  style={[
                    styles.stockDot,
                    product.quantity <= 2 && { backgroundColor: '#D97706' },
                  ]}
                />
                <Text style={styles.stockStatusText}>
                  {product.quantity > 0
                    ? `Còn ${product.quantity} sản phẩm sẵn giao`
                    : 'Tạm hết hàng'}
                </Text>
              </View>

              <View style={styles.ratingBadgePill}>
                <Star size={13} color={COLORS.starYellow} fill={COLORS.starYellow} />
                <Text style={styles.ratingBadgeText}>
                  {product.rating.toFixed(1)} ({product.reviews.length} đánh giá)
                </Text>
              </View>
            </View>

            {/* Product Name */}
            <Text style={[styles.productTitle, isMobile && styles.productTitleMobile]}>
              {product.name}
            </Text>

            {/* Price Showcase Banner */}
            <View style={styles.priceBannerCard}>
              <View style={styles.priceMainRow}>
                <Text style={styles.effectivePriceText}>
                  {formatVND(effectivePrice)}
                </Text>
                {accessoryDelta > 0 && (
                  <View style={styles.priceBreakdownPill}>
                    <Text style={styles.priceBreakdownText}>
                      Giá gốc {formatVND(product.price)} + Phụ kiện{' '}
                      {formatVND(accessoryDelta)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.pricePerksRow}>
                <Gift size={13} color="#6E4F37" />
                <Text style={styles.pricePerkText}>
                  Miễn phí gói hộp quà thủ công & tặng kèm thiệp viết tay
                </Text>
              </View>
            </View>

            {/* Variant Customizer Section */}
            <View style={styles.customizerContainer}>
              {/* 1. Color Selector */}
              {colorOptions.length > 0 && (
                <View style={styles.variantSection}>
                  <View style={styles.variantLabelRow}>
                    <View style={styles.variantTitleLeft}>
                      <Palette size={15} color="#3D2B1F" />
                      <Text style={styles.variantSectionTitle}>
                        1. Chọn màu sắc ({colorOptions.length} tông màu)
                      </Text>
                    </View>
                    {activeColor && (
                      <Text style={styles.activeVariantValue}>
                        {activeColor.name}
                      </Text>
                    )}
                  </View>

                  <View style={styles.optionsGrid}>
                    {colorOptions.map((c, idx) => {
                      const isSelected = activeColor?.id === c.id;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.colorOptionCard,
                            isSelected && styles.optionCardSelected,
                          ]}
                          onPress={() => handleSelectColor(c, idx)}
                          activeOpacity={0.8}>
                          <View
                            style={[
                              styles.colorSwatchOuter,
                              isSelected && styles.colorSwatchOuterSelected,
                            ]}>
                            <View
                              style={[
                                styles.colorSwatchInner,
                                { backgroundColor: c.hex },
                              ]}
                            />
                          </View>
                          <Text
                            style={[
                              styles.optionCardLabel,
                              isSelected && styles.optionCardLabelSelected,
                            ]}>
                            {c.name}
                          </Text>
                          {isSelected && (
                            <Check size={14} color="#3D2B1F" strokeWidth={2.8} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* 2. Accessory Selector */}
              {accessoryOptions.length > 0 && (
                <View style={styles.variantSection}>
                  <View style={styles.variantLabelRow}>
                    <View style={styles.variantTitleLeft}>
                      <Sparkles size={15} color="#3D2B1F" />
                      <Text style={styles.variantSectionTitle}>
                        2. Chọn phụ kiện / kiểu phối ({accessoryOptions.length} tuỳ chọn)
                      </Text>
                    </View>
                  </View>

                  <View style={styles.accessoryGrid}>
                    {accessoryOptions.map((acc, idx) => {
                      const isSelected = activeAccessory?.id === acc.id;
                      return (
                        <TouchableOpacity
                          key={acc.id}
                          style={[
                            styles.accessoryOptionCard,
                            isSelected && styles.optionCardSelected,
                          ]}
                          onPress={() => handleSelectAccessory(acc, idx)}
                          activeOpacity={0.8}>
                          <View style={styles.accessoryLeft}>
                            <View style={styles.accessoryEmojiBox}>
                              <Text style={styles.accessoryEmojiText}>
                                {acc.emoji || '🎀'}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.optionCardLabel,
                                  isSelected && styles.optionCardLabelSelected,
                                ]}
                                numberOfLines={1}>
                                {acc.name}
                              </Text>
                              <Text style={styles.accessoryPriceSub}>
                                {acc.priceDelta && acc.priceDelta > 0
                                  ? `+${formatVND(acc.priceDelta)}`
                                  : 'Miễn phí phối kèm'}
                              </Text>
                            </View>
                          </View>
                          {isSelected && (
                            <View style={styles.selectedCheckCircle}>
                              <Check size={12} color="#FFFDF9" strokeWidth={3} />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Desktop Inline Purchase Bar (Customers) */}
            {!isAdmin && isDesktop && (
              <View style={styles.desktopPurchaseBlock}>
                <View style={styles.quantitySelector}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                    <Minus size={18} color="#3D2B1F" />
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() =>
                      setQuantity(Math.min(quantity + 1, product.quantity))
                    }>
                    <Plus size={18} color="#3D2B1F" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.addToCartBtn}
                  onPress={handleAddToCart}
                  activeOpacity={0.85}>
                  <ShoppingCart size={17} color={COLORS.primary} />
                  <Text style={styles.addToCartText}>{PD_ADD_TO_CART}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.buyNowBtn}
                  onPress={handleBuyNow}
                  activeOpacity={0.85}>
                  <Text style={styles.buyNowText}>
                    {PD_BUY_NOW} • {formatVND(effectivePrice * quantity)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Admin Actions or Client Product-Ping Chat Button */}
            {isAdmin ? (
              <View style={styles.adminActions}>
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => router.push(`/edit-product/${product.id}`)}>
                  <Edit3 size={16} color="#3D2B1F" />
                  <Text style={styles.adminBtnText}>Sửa sản phẩm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adminBtn}
                  onPress={() => openChatWithProduct(buildVariantProduct())}>
                  <MessageCircle size={16} color="#3D2B1F" />
                  <Text style={styles.adminBtnText}>Ping mẫu đang chọn cho khách</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.adminBtn, styles.adminBtnDanger]}
                  onPress={handleDelete}>
                  <Trash2 size={16} color={COLORS.error} />
                  <Text style={[styles.adminBtnText, { color: COLORS.error }]}>
                    Xóa sản phẩm
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.pingProductBanner}
                onPress={() => openChatWithProduct(buildVariantProduct())}
                activeOpacity={0.8}>
                <View style={styles.pingProductIconWrap}>
                  <MessageCircle size={18} color="#3D2B1F" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pingProductTitle}>
                    Tư vấn / Đặt riêng mẫu ({activeColor?.name || product.color}) cùng Admin
                  </Text>
                  <Text style={styles.pingProductSub}>
                    Bấm để gửi mẫu & phụ kiện đang chọn vào khung chat Tiệm Cuộn Len
                  </Text>
                </View>
                <ChevronRight size={18} color={COLORS.mediumText} />
              </TouchableOpacity>
            )}

            {/* 3 Boutique Trust Badges */}
            <View style={styles.trustGrid}>
              <View style={styles.trustBadgeItem}>
                <ShieldCheck size={16} color="#6E4F37" />
                <Text style={styles.trustBadgeText}>Len Cotton Milk an toàn</Text>
              </View>
              <View style={styles.trustBadgeItem}>
                <Gift size={16} color="#6E4F37" />
                <Text style={styles.trustBadgeText}>Hộp quà & thiệp miễn phí</Text>
              </View>
              <View style={styles.trustBadgeItem}>
                <Truck size={16} color="#6E4F37" />
                <Text style={styles.trustBadgeText}>Ship COD toàn quốc</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3. Story & Specifications Section (2 Columns on Desktop) */}
        <View
          style={[
            styles.infoCardsRow,
            isDesktop && styles.infoCardsRowDesktop,
          ]}>
          {/* Left Card: Description & Care Guide */}
          <View style={[styles.infoCard, isDesktop && { flex: 1.15 }]}>
            <Text style={styles.cardSectionTitle}>{PD_DESCRIPTION} sản phẩm</Text>
            <Text style={styles.description}>{product.description}</Text>

            <View style={styles.careGuideBox}>
              <Text style={styles.careGuideTitle}>
                🧶 Hướng dẫn bảo quản đồ len thủ công:
              </Text>
              <Text style={styles.careGuideItem}>
                • Giặt nhẹ bằng tay với dầu gội hoặc sữa tắm pha loãng, không vắt xoắn mạnh.
              </Text>
              <Text style={styles.careGuideItem}>
                • Phơi trên mặt phẳng nơi thoáng mát, tránh ánh nắng gắt trực tiếp để giữ màu pastel bền đẹp.
              </Text>
            </View>
          </View>

          {/* Right Card: Specifications Table */}
          <View style={[styles.infoCard, isDesktop && { flex: 0.85 }]}>
            <Text style={styles.cardSectionTitle}>{PD_PRODUCT_DETAILS}</Text>
            <View style={styles.detailGrid}>
              <DetailItem
                label="Danh mục"
                value={`${getCategoryEmoji(product.category)} ${getCategoryLabel(product.category)}`}
              />
              <DetailItem label={PD_MATERIAL} value={product.material} />
              <DetailItem
                label="Màu đang chọn"
                value={activeColor ? activeColor.name : product.color}
              />
              {activeAccessory && (
                <DetailItem
                  label="Phụ kiện phối kèm"
                  value={`${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`}
                />
              )}
              <DetailItem
                label={PD_STOCK}
                value={`${product.quantity} ${PD_STOCK_AVAILABLE}`}
              />
              <DetailItem label={PD_TAGS} value={product.tags.join(', ')} />
            </View>
          </View>
        </View>

        {/* 4. Customer Reviews Card */}
        <View style={styles.infoCard}>
          <View style={styles.reviewsHeader}>
            <View>
              <Text style={styles.cardSectionTitle}>
                {PD_REVIEWS} từ khách hàng ({product.reviews.length})
              </Text>
              <Text style={styles.reviewsSubtitle}>
                Chia sẻ cảm nhận của bạn về món đồ len thủ công này
              </Text>
            </View>
            {canReview && !showReviewForm && (
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewForm(true)}>
                <MessageSquare size={15} color="#3D2B1F" />
                <Text style={styles.writeReviewText}>Viết đánh giá</Text>
              </TouchableOpacity>
            )}
          </View>

          {showReviewForm && (
            <View style={styles.reviewForm}>
              <View style={styles.reviewStarsInput}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                    <Star
                      size={28}
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
                placeholder="Chia sẻ trải nghiệm của bạn về màu sắc và đường móc..."
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
            <View style={styles.emptyReviewsBox}>
              <Text style={styles.emptyReviewsEmoji}>🌟</Text>
              <Text style={styles.emptyReviewsText}>
                Sản phẩm đạt chuẩn 5.0★ thủ công tại tiệm. Hãy là người đầu tiên để lại lời nhắn nhé!
              </Text>
            </View>
          ) : (
            product.reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
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

        {/* 5. Related Products in the Same Category */}
        {relatedProducts.length > 0 && (
          <View style={styles.relatedSection}>
            <View style={styles.relatedHeaderRow}>
              <View>
                <Text style={styles.relatedTitle}>
                  Mẫu {getCategoryLabel(product.category).toLowerCase()} khác tại tiệm
                </Text>
                <Text style={styles.relatedSubtitle}>
                  Khám phá trọn bộ sưu tập 5 mẫu {getCategoryLabel(product.category).toLowerCase()} có sẵn nhiều màu & phụ kiện
                </Text>
              </View>
            </View>
            <View style={styles.relatedGrid}>
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

        <View style={{ height: isDesktop ? 48 : 130 }} />
      </ScrollView>

      {/* Mobile Sticky Bottom Action Bar — customers only */}
      {!isAdmin && !isDesktop && (
        <View style={styles.bottomBarOuter}>
          <View style={styles.bottomBar}>
            <View style={styles.quantitySelector}>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus size={18} color="#3D2B1F" />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{quantity}</Text>
              <TouchableOpacity
                style={styles.qtyBtn}
                onPress={() =>
                  setQuantity(Math.min(quantity + 1, product.quantity))
                }>
                <Plus size={18} color="#3D2B1F" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.addToCartBtn}
              onPress={handleAddToCart}>
              <Text style={styles.addToCartText} numberOfLines={1}>
                {PD_ADD_TO_CART}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buyNowBtn} onPress={handleBuyNow}>
              <Text style={styles.buyNowText} numberOfLines={1}>
                {PD_BUY_NOW}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
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
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.lg,
  },
  notFoundText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },

  /* 1. Top Nav & Breadcrumb */
  topNavCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3ECE2',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    marginBottom: SPACING.md,
  },
  topNavCardMobile: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  topNavLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    ...SHADOWS.small,
  },
  navIconBtnFav: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F5C9C0',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    color: COLORS.white,
    fontSize: 9.5,
    fontWeight: '800',
  },
  breadcrumbWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
    flex: 1,
    minWidth: 0,
  },
  breadcrumbLink: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  breadcrumbSep: {
    fontSize: 14,
    color: COLORS.lightText,
  },
  breadcrumbCategory: {
    fontSize: 13,
    fontWeight: '700',
    color: '#5C4332',
  },
  breadcrumbCurrent: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
    flex: 1,
  },

  /* 2. Hero 2-Column Showcase Card */
  heroCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  heroCardDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
    padding: 24,
  },
  heroCardMobile: {
    flexDirection: 'column',
    gap: 18,
    padding: 14,
    borderRadius: 22,
  },
  galleryColumn: {
    width: '100%',
  },
  galleryColumnDesktop: {
    width: '46%',
    maxWidth: 480,
  },
  mainImageFrame: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F3ECE2',
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#E5D6C5',
  },
  mainProductImage: {
    width: '100%',
    height: '100%',
  },
  colorAccentCorner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.85,
  },
  imagePlaceholder: {
    width: 180,
    height: 180,
    backgroundColor: COLORS.softPurple,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: {
    fontSize: 72,
  },
  imageTopOverlayRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  angleCounterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 253, 249, 0.92)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    ...SHADOWS.small,
  },
  angleCounterText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  handmadeBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(243, 236, 226, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  handmadeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6E4F37',
  },
  galleryArrowBtn: {
    position: 'absolute',
    top: '46%',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 253, 249, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    ...SHADOWS.small,
  },
  galleryArrowLeft: {
    left: 10,
  },
  galleryArrowRight: {
    right: 10,
  },
  imageBottomOverlay: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    alignItems: 'center',
  },
  livePreviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(61, 43, 31, 0.84)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    maxWidth: '94%',
  },
  livePreviewDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFDF9',
  },
  livePreviewText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FAF6F0',
  },

  /* Thumbnail Strip */
  thumbnailStrip: {
    gap: 10,
    paddingTop: 14,
    paddingBottom: 2,
  },
  thumbnailItem: {
    width: 78,
    alignItems: 'center',
    gap: 5,
  },
  thumbnailItemSelected: {
    transform: [{ translateY: -2 }],
  },
  thumbnailImageWrap: {
    width: 74,
    height: 74,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#F3ECE2',
    borderWidth: 2,
    borderColor: '#E5D6C5',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbColorDot: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#FFFDF9',
  },
  thumbnailCaption: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.mediumText,
    textAlign: 'center',
  },
  thumbnailCaptionSelected: {
    fontWeight: '800',
    color: '#3D2B1F',
  },

  /* Right Column */
  detailsColumn: {
    width: '100%',
  },
  detailsColumnDesktop: {
    flex: 1,
    minWidth: 0,
  },
  metaBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5C4332',
  },
  stockStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F0F9EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBE7B8',
  },
  stockStatusPillLow: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  stockStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2E5A27',
  },
  ratingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FDF6EA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3DFC1',
  },
  ratingBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4332',
  },
  productTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#2C1E14',
    lineHeight: 33,
  },
  productTitleMobile: {
    fontSize: 22,
    lineHeight: 28,
  },

  /* Price Showcase Card */
  priceBannerCard: {
    marginTop: 12,
    backgroundColor: '#F6EFE6',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    gap: 6,
  },
  priceMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  effectivePriceText: {
    fontSize: 28,
    fontWeight: '900',
    color: '#6E4F37',
  },
  priceBreakdownPill: {
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  priceBreakdownText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  pricePerksRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pricePerkText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C4332',
  },

  /* Variant Customizer */
  customizerContainer: {
    marginTop: 16,
    gap: 16,
  },
  variantSection: {
    gap: 9,
  },
  variantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  variantTitleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  variantSectionTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  activeVariantValue: {
    fontSize: 12.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderColor: '#E5D6C5',
  },
  optionCardSelected: {
    backgroundColor: '#E8D8C6',
    borderColor: '#8C684C',
  },
  colorSwatchOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(61, 43, 31, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
  },
  colorSwatchOuterSelected: {
    borderColor: '#3D2B1F',
    borderWidth: 1.5,
  },
  colorSwatchInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  optionCardLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  optionCardLabelSelected: {
    fontWeight: '900',
    color: '#2C1E14',
  },
  accessoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accessoryOptionCard: {
    width: '48.5%',
    minWidth: 155,
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 15,
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderColor: '#E5D6C5',
    gap: 6,
  },
  accessoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  accessoryEmojiBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  accessoryEmojiText: {
    fontSize: 16,
  },
  accessoryPriceSub: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mediumText,
    marginTop: 1,
  },
  selectedCheckCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6E4F37',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Desktop Purchase Block */
  desktopPurchaseBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EDE0D1',
  },
  quantitySelector: {
    width: 104,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F3ECE2',
    borderRadius: 15,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFDF9',
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2B1F',
    minWidth: 24,
    textAlign: 'center',
  },
  addToCartBtn: {
    flex: 1,
    height: 48,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 12,
  },
  addToCartText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  buyNowBtn: {
    flex: 1.25,
    height: 48,
    backgroundColor: '#3D2B1F',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    ...SHADOWS.small,
  },
  buyNowText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FAF6F0',
  },

  /* Ping & Admin Buttons */
  adminActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    flexWrap: 'wrap',
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3ECE2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  adminBtnDanger: {
    backgroundColor: '#FDF0ED',
    borderColor: '#F5C9C0',
  },
  adminBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  pingProductBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F3ECE2',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  pingProductIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  pingProductTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  pingProductSub: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    marginTop: 2,
  },

  /* Trust Highlights Row */
  trustGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  trustBadgeItem: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF6F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EAE0D5',
  },
  trustBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4332',
  },

  /* 3. Story & Specifications Cards */
  infoCardsRow: {
    marginTop: 18,
    gap: 16,
  },
  infoCardsRowDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  infoCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    marginTop: 16,
    ...SHADOWS.small,
  },
  cardSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
    marginBottom: 10,
  },
  description: {
    fontSize: 14.5,
    lineHeight: 22,
    color: '#4A3525',
  },
  careGuideBox: {
    marginTop: 14,
    backgroundColor: '#F6EFE6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    gap: 4,
  },
  careGuideTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
    marginBottom: 2,
  },
  careGuideItem: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#5C4332',
  },
  detailGrid: {
    gap: 4,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EFE6DC',
    gap: 12,
  },
  detailLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  detailValue: {
    fontSize: 13.5,
    fontWeight: '600',
    color: COLORS.mediumText,
    textAlign: 'right',
    flex: 1,
  },

  /* 4. Reviews Section */
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  reviewsSubtitle: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    marginTop: -4,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#D8C3AD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  writeReviewText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  emptyReviewsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF6F0',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAE0D5',
  },
  emptyReviewsEmoji: {
    fontSize: 20,
  },
  emptyReviewsText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.mediumText,
    lineHeight: 18,
  },
  reviewForm: {
    backgroundColor: '#FAF6F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  reviewStarsInput: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  reviewInput: {
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.darkText,
    minHeight: 80,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  reviewFormActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  cancelReviewBtn: {
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#EFE6DC',
  },
  cancelReviewText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  submitReviewBtn: {
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: '#3D2B1F',
  },
  submitReviewText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FAF6F0',
  },
  reviewCard: {
    backgroundColor: '#FAF6F0',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#EAE0D5',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: 4,
    lineHeight: 18,
  },

  /* 5. Related Products */
  relatedSection: {
    marginTop: 24,
  },
  relatedHeaderRow: {
    marginBottom: 12,
  },
  relatedTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#2C1E14',
  },
  relatedSubtitle: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  relatedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },

  /* Mobile Sticky Bottom Bar */
  bottomBarOuter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomBar: {
    width: '100%',
    maxWidth: 840,
    backgroundColor: '#FFFDF9',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.large,
  },
});
