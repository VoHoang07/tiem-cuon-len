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
  MessageCircle,
  ShoppingCart,
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
  PD_REVIEWS,
  PD_ADD_TO_CART,
} from '@/constants/strings';

const PD_BUY_NOW = 'Mua ngay';
const MAX_WIDTH = 1040;

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

  // Build clean gallery from distinct variant photos + 1 close-up stitch view
  const galleryItems: ProductGalleryItem[] = useMemo(() => {
    if (!product) return [];
    if (product.gallery && product.gallery.length > 0) {
      return product.gallery;
    }

    const items: ProductGalleryItem[] = [];
    const c0 = colorOptions[0];
    const c1 = colorOptions[1];
    const a0 = accessoryOptions[0];
    const a1 = accessoryOptions[1];

    items.push({
      id: 'g1',
      label: c0 ? c0.name : 'Góc chính',
      angleTag: c0 ? c0.name : 'Góc chính',
      image: c0?.image || product.image,
      colorId: c0?.id,
      accessoryId: a0?.id,
      zoomMode: 'normal',
    });

    if (c1 && c1.image) {
      items.push({
        id: 'g2',
        label: c1.name,
        angleTag: c1.name,
        image: c1.image,
        colorId: c1.id,
        accessoryId: a1?.id ?? a0?.id,
        zoomMode: 'normal',
      });
    }

    items.push({
      id: 'g3',
      label: 'Cận cảnh mũi móc',
      angleTag: 'Cận cảnh',
      image: c0?.image || product.image,
      colorId: c0?.id,
      accessoryId: a0?.id,
      zoomMode: 'closeup',
    });

    return items;
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
    // Sync matching accessory index if available so photo & accessory stay harmonious
    if (accessoryOptions[idx]) {
      setSelectedAccessoryId(accessoryOptions[idx].id);
    }
    const matchIdx = galleryItems.findIndex((g) => g.colorId === colorOpt.id);
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    }
  };

  const handleSelectAccessory = (accOpt: ProductAccessoryOption, idx: number) => {
    setSelectedAccessoryId(accOpt.id);
    if (colorOptions[idx]) {
      setSelectedColorId(colorOptions[idx].id);
    }
    const matchIdx = galleryItems.findIndex((g) => g.accessoryId === accOpt.id);
    if (matchIdx !== -1) {
      setActiveGalleryIndex(matchIdx);
    }
  };

  const accessoryDelta = activeAccessory?.priceDelta ?? 0;
  const effectivePrice = product.price + accessoryDelta;

  const buildVariantProduct = (): Product => {
    const suffixParts = [
      activeColor?.name,
      activeAccessory?.name,
    ].filter(Boolean);
    const variantLabel = suffixParts.join(' - ');
    return {
      ...product,
      name: variantLabel ? `${product.name} (${variantLabel})` : product.name,
      color: activeColor ? activeColor.name : product.color,
      image: activeColor?.image || currentGalleryItem?.image || product.image,
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
      router.push('/(auth)/login');
      return;
    }
    router.push({
      pathname: '/checkout',
      params: {
        mode: 'buy_now',
        productId: product.id,
        quantity: String(quantity),
        selectedColor: activeColor?.name ?? product.color,
        selectedAccessory: activeAccessory
          ? `${activeAccessory.emoji ? `${activeAccessory.emoji} ` : ''}${activeAccessory.name}`
          : '',
        unitPrice: String(effectivePrice),
      },
    });
  };

  const handleDelete = () => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      const confirmed = window.confirm(
        `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`
      );
      if (confirmed) {
        removeProduct(product.id);
        router.replace('/');
      }
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

  const activeDisplayImage =
    currentGalleryItem?.image ||
    activeColor?.image ||
    activeAccessory?.image ||
    product.image;

  const isCloseupZoom = currentGalleryItem?.zoomMode === 'closeup';
  const relatedNumColumns = windowWidth >= 900 ? 4 : windowWidth >= 620 ? 3 : 2;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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

          {!isAdmin && (
            <View style={styles.topBarRight}>
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
            </View>
          )}
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

              <View style={styles.counterPill}>
                <Text style={styles.counterPillText}>
                  {safeGalleryIndex + 1} / {galleryItems.length}
                </Text>
              </View>
            </View>

            {/* Clean Square Thumbnails */}
            {galleryItems.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thumbRow}>
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
                      onPress={() => handleSelectGalleryIndex(idx)}
                      activeOpacity={0.85}>
                      {thumbImg ? (
                        <Image
                          source={
                            typeof thumbImg === 'string'
                              ? { uri: thumbImg }
                              : (thumbImg as any)
                          }
                          style={[
                            styles.thumbImg,
                            gItem.zoomMode === 'closeup' && {
                              transform: [{ scale: 1.22 }],
                            },
                          ]}
                          resizeMode="cover"
                        />
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
                {product.quantity > 0
                  ? `Còn ${product.quantity} sản phẩm`
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
                  (Đã gồm +{formatVND(accessoryDelta)} phụ kiện)
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
                  {colorOptions.map((c, idx) => {
                    const isSelected = activeColor?.id === c.id;
                    return (
                      <TouchableOpacity
                        key={c.id}
                        style={[
                          styles.optionPill,
                          isSelected && styles.optionPillSelected,
                        ]}
                        onPress={() => handleSelectColor(c, idx)}
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
                          {c.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* 2. Compact Accessory Pill Selector */}
            {accessoryOptions.length > 0 && (
              <View style={styles.selectorGroup}>
                <Text style={styles.selectorLabel}>
                  Phụ kiện đi kèm:{' '}
                  <Text style={styles.selectorValue}>
                    {activeAccessory?.name ?? 'Nguyên bản'}
                  </Text>
                </Text>
                <View style={styles.pillWrap}>
                  {accessoryOptions.map((acc, idx) => {
                    const isSelected = activeAccessory?.id === acc.id;
                    return (
                      <TouchableOpacity
                        key={acc.id}
                        style={[
                          styles.optionPill,
                          isSelected && styles.optionPillSelected,
                        ]}
                        onPress={() => handleSelectAccessory(acc, idx)}
                        activeOpacity={0.8}>
                        <Text style={styles.optionEmoji}>
                          {acc.emoji || '🎀'}
                        </Text>
                        <Text
                          style={[
                            styles.optionPillText,
                            isSelected && styles.optionPillTextSelected,
                          ]}>
                          {acc.name}
                          {acc.priceDelta && acc.priceDelta > 0
                            ? ` (+${formatVND(acc.priceDelta)})`
                            : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

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
                      setQuantity(Math.min(quantity + 1, product.quantity))
                    }>
                    <Plus size={16} color="#4A3728" />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.cartBtn}
                  onPress={handleAddToCart}
                  activeOpacity={0.85}>
                  <ShoppingCart size={16} color="#4A3728" />
                  <Text style={styles.cartBtnText}>{PD_ADD_TO_CART}</Text>
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
                🧶 Chất liệu: {product.material} • Tặng kèm hộp quà & thiệp viết tay
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
            {canReview && !showReviewForm && (
              <TouchableOpacity
                style={styles.writeReviewBtn}
                onPress={() => setShowReviewForm(true)}>
                <MessageSquare size={14} color="#4A3728" />
                <Text style={styles.writeReviewText}>Viết đánh giá</Text>
              </TouchableOpacity>
            )}
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
                  setQuantity(Math.min(quantity + 1, product.quantity))
                }>
                <Plus size={16} color="#4A3728" />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.cartBtn}
              onPress={handleAddToCart}>
              <Text style={styles.cartBtnText} numberOfLines={1}>
                {PD_ADD_TO_CART}
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
    fontSize: 14,
  },
  optionPillText: {
    fontSize: 13.5,
    color: '#5C4738',
    fontWeight: '500',
  },
  optionPillTextSelected: {
    color: '#3D2B1F',
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
