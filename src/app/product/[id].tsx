import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heart, ChevronLeft, Minus, Plus, Star, MessageSquare, Edit3, Trash2, Home } from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { Product, Review } from '@/types/product';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
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

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { products, toggleFavorite, isFavorite, addToCart, addReview, removeProduct } = useShop();
  const { user, role } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [showReviewForm, setShowReviewForm] = useState(false);

  const product = products.find((p) => p.id === id);

  if (!product) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{PD_NOT_FOUND}</Text>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}>
          <Text style={styles.backLink}>{PD_GO_BACK}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const fav = isFavorite(product.id);

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

  const canReview = role === 'customer';
  const isAdmin = role === 'admin';

  const handleAddToCart = async () => {
    await addToCart(product, quantity);
    router.push('/cart');
  };

  const handleBuyNow = async () => {
    await addToCart(product, quantity);
    router.push('/checkout');
  };

  const handleDelete = () => {
    Alert.alert(
      'Xóa sản phẩm',
      `Bạn có chắc muốn xóa "${product.name}"?`,
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

  const categoryEmoji =
    product.category === 'Bags'
      ? '👜'
      : product.category === 'Dolls'
        ? '🧸'
        : product.category === 'Accessories'
          ? '🧣'
          : '🧶';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Image Area */}
        <View style={styles.imageArea}>
          <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
            <Home size={20} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.favBtn}
            onPress={() => toggleFavorite(product.id)}
            activeOpacity={0.7}>
            <Heart
              size={22}
              color={fav ? '#e74c3c' : '#8B5E4A'}
              fill={fav ? '#e74c3c' : 'transparent'}
            />
          </TouchableOpacity>
          {product.image ? (
            <Image
              source={{ uri: product.image }}
              style={styles.productImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Text style={styles.imageEmoji}>{categoryEmoji}</Text>
            </View>
          )}
        </View>

        {/* Product Info */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{product.name}</Text>
              <Text style={styles.category}>{product.category}</Text>
            </View>
            <Text style={styles.price}>{formatVND(product.price)}</Text>
          </View>

          {/* Rating */}
          <View style={styles.ratingRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                size={16}
                color={COLORS.starYellow}
                fill={star <= Math.round(product.rating) ? COLORS.starYellow : 'transparent'}
              />
            ))}
            <Text style={styles.ratingText}>
              {product.rating} ({product.reviews.length} {PD_REVIEWS.toLowerCase()})
            </Text>
          </View>

          {/* Admin Actions */}
          {isAdmin && (
            <View style={styles.adminActions}>
              <TouchableOpacity
                style={styles.adminBtn}
                onPress={() => router.push(`/edit-product/${product.id}`)}>
                <Edit3 size={16} color={COLORS.primary} />
                <Text style={styles.adminBtnText}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.adminBtn, styles.adminBtnDanger]}
                onPress={handleDelete}>
                <Trash2 size={16} color={COLORS.error} />
                <Text style={[styles.adminBtnText, { color: COLORS.error }]}>Xóa</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{PD_DESCRIPTION}</Text>
            <Text style={styles.description}>{product.description}</Text>
          </View>

          {/* Product Details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{PD_PRODUCT_DETAILS}</Text>
            <View style={styles.detailGrid}>
              <DetailItem label={PD_MATERIAL} value={product.material} />
              <DetailItem label={PD_COLOR} value={product.color} />
              <DetailItem label={PD_STOCK} value={`${product.quantity} ${PD_STOCK_AVAILABLE}`} />
              <DetailItem label={PD_TAGS} value={product.tags.join(', ')} />
            </View>
          </View>

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.reviewsHeader}>
              <Text style={styles.sectionTitle}>{PD_REVIEWS} ({product.reviews.length})</Text>
              {canReview && !showReviewForm && (
                <TouchableOpacity
                  style={styles.writeReviewBtn}
                  onPress={() => setShowReviewForm(true)}>
                  <MessageSquare size={16} color={COLORS.primary} />
                  <Text style={styles.writeReviewText}>Viết đánh giá</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Review Form */}
            {showReviewForm && (
              <View style={styles.reviewForm}>
                <View style={styles.reviewStarsInput}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                      <Star
                        size={28}
                        color={COLORS.starYellow}
                        fill={star <= reviewRating ? COLORS.starYellow : 'transparent'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  value={reviewText}
                  onChangeText={setReviewText}
                  placeholder="Chia sẻ trải nghiệm của bạn..."
                  placeholderTextColor={COLORS.lightText}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                <View style={styles.reviewFormActions}>
                  <TouchableOpacity
                    style={styles.cancelReviewBtn}
                    onPress={() => { setShowReviewForm(false); setReviewText(''); }}>
                    <Text style={styles.cancelReviewText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.submitReviewBtn} onPress={submitReview}>
                    <Text style={styles.submitReviewText}>Gửi đánh giá</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {product.reviews.map((review) => (
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
                  ))}
                  </View>

                  <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}>
            <Minus size={18} color={COLORS.primary} />
          </TouchableOpacity>
          <Text style={styles.qtyText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.qtyBtn}
            onPress={() => setQuantity(quantity + 1)}>
            <Plus size={18} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.addToCartBtn}
          onPress={handleAddToCart}>
          <Text style={styles.addToCartText} numberOfLines={1}>{PD_ADD_TO_CART}</Text>
          </TouchableOpacity>
          <TouchableOpacity
          style={styles.buyNowBtn}
          onPress={handleBuyNow}>
          <Text style={styles.buyNowText} numberOfLines={1}>{PD_BUY_NOW}</Text>
        </TouchableOpacity>
      </View>
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
  imageArea: {
    backgroundColor: COLORS.lightPurple,
    height: 350,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  homeBtn: {
    position: 'absolute',
    top: 16,
    left: 64,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  favBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
    backdropFilter: 'blur(8px)',
  },
  imagePlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: COLORS.softPurple,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageEmoji: {
    fontSize: 80,
  },
  infoSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  category: {
    fontSize: 14,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.md,
  },
  ratingText: {
    fontSize: 14,
    color: COLORS.mediumText,
    marginLeft: SPACING.sm,
  },
  section: {
    marginTop: SPACING.xxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.mediumText,
    opacity: 0.9,
  },
  detailGrid: {
    gap: SPACING.md,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  detailValue: {
    fontSize: 14,
    color: COLORS.mediumText,
  },
  reviewCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewUser: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    gap: SPACING.sm,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    ...SHADOWS.large,
  },
  quantitySelector: {
    width: 96,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cream,
    borderRadius: 18,
    paddingHorizontal: SPACING.sm,
  },
  qtyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  qtyText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.darkText,
    minWidth: 24,
    textAlign: 'center',
  },
  addToCartBtn: {
    flex: 1,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.primary,
  },
  buyNowBtn: {
    flex: 1.1,
    height: 52,
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyNowText: {
    fontSize: 13,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  reviewsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  writeReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  writeReviewText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  reviewForm: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  reviewStarsInput: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  reviewInput: {
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: SPACING.md,
    fontSize: 14,
    color: COLORS.darkText,
    minHeight: 80,
    marginBottom: SPACING.md,
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
    backgroundColor: COLORS.cream,
  },
  cancelReviewText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  submitReviewBtn: {
    borderRadius: 12,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
  },
  submitReviewText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  adminActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  adminBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  adminBtnDanger: {
    backgroundColor: '#FDF0ED',
  },
  adminBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  });
