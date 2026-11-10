import { PUBLIC_SHOP_URL, ShareModal } from '@/components/ShareModal';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { useOrders } from '@/store/OrderContext';
import { useShop } from '@/store/ShopContext';
import { Category } from '@/types/product';
import { useRouter } from 'expo-router';
import {
    ArrowUp,
    Clock,
    CornerDownRight,
    Edit3,
    Gift,
    HelpCircle,
    MessageCircle,
    MessageSquare,
    Package,
    Palette,
    PlusCircle,
    Share2,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Star,
    Trash2,
} from 'lucide-react-native';
import React from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

interface BoutiqueFooterProps {
  onSelectCategory?: (category: Category) => void;
  onScrollToTop?: () => void;
}

export const BoutiqueFooter = React.memo(function BoutiqueFooter({
  onSelectCategory,
  onScrollToTop,
}: BoutiqueFooterProps) {
  const router = useRouter();
  const { user, role } = useAuth();
  const { openChat, conversations, unreadCount } = useChat();
  const {
    products,
    shopReviews,
    addShopReview,
    removeShopReview,
    replyToShopReview,
  } = useShop();
  const { orders } = useOrders();
  const isAdmin = role === 'admin';
  const [showShareModal, setShowShareModal] = React.useState(false);
  const [showShopReviewForm, setShowShopReviewForm] = React.useState(false);
  const [reviewerName, setReviewerName] = React.useState(user?.name || '');
  const [shopRating, setShopRating] = React.useState(5);
  const [shopComment, setShopComment] = React.useState('');
  const [reviewStatusMsg, setReviewStatusMsg] = React.useState<string | null>(null);
  const [replyingReviewId, setReplyingReviewId] = React.useState<string | null>(null);
  const [replyDraftText, setReplyDraftText] = React.useState('');

  React.useEffect(() => {
    if (user?.name && !reviewerName.trim()) {
      setReviewerName(user.name);
    }
  }, [user?.name, reviewerName]);

  const formatReviewDate = (raw?: string) => {
    if (!raw) return '';
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('vi-VN');
    }
    return raw;
  };

  const avgShopRating = React.useMemo(() => {
    if (!shopReviews || shopReviews.length === 0) return '5.0';
    const sum = shopReviews.reduce((acc, r) => acc + (r.rating || 5), 0);
    return (sum / shopReviews.length).toFixed(1);
  }, [shopReviews]);

  const handleSubmitShopReview = () => {
    if (!shopComment.trim()) {
      Alert.alert('Thiếu nội dung', 'Vui lòng nhập đôi lời nhận xét về Tiệm nhé.');
      return;
    }
    const finalName = reviewerName.trim() || user?.name || 'Khách hàng Tiệm Len';
    addShopReview({
      id: `shop_rev_${Date.now()}`,
      userId: user?.email || user?.id || 'customer',
      userName: finalName,
      rating: shopRating,
      comment: shopComment.trim(),
      date: new Date().toISOString(),
    });
    setShopComment('');
    setShopRating(5);
    setShowShopReviewForm(false);
    setReviewStatusMsg('✅ Cảm ơn bạn! Đánh giá đã được đăng lên trang chủ Tiệm Cuộn Len.');
    setTimeout(() => setReviewStatusMsg(null), 4000);
  };

  const handleSaveAdminReply = (revId: string) => {
    replyToShopReview(revId, replyDraftText.trim());
    setReplyingReviewId(null);
    setReplyDraftText('');
    setReviewStatusMsg('✅ Đã lưu phản hồi của Tiệm cho đánh giá khách hàng.');
    setTimeout(() => setReviewStatusMsg(null), 3500);
  };

  const handleDeleteShopReview = (revId: string) => {
    removeShopReview(revId);
    if (replyingReviewId === revId) {
      setReplyingReviewId(null);
      setReplyDraftText('');
    }
    setReviewStatusMsg('🗑️ Đã xoá đánh giá khỏi trang chủ.');
    setTimeout(() => setReviewStatusMsg(null), 3000);
  };

  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isMobile = windowWidth < 720;

  const uniqueProductCount = React.useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    }).length;
  }, [products]);

  const pendingOrdersCount = React.useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === 'Đang xử lý' ||
          (o.status as string) === 'awaiting_confirmation' ||
          (o.status as string) === 'pending'
      ).length,
    [orders]
  );

  const handleCategoryPress = (cat: Category) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    }
    if (onScrollToTop) {
      onScrollToTop();
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* 1. Bespoke Crochet / Admin Studio Banner */}
      <View style={[styles.bespokeBanner, isMobile && styles.bespokeBannerMobile]}>
        {/* Decorative background yarn circles */}
        <View style={styles.decorCircleLarge} pointerEvents="none" />
        <View style={styles.decorCircleSmall} pointerEvents="none" />

        <View style={[styles.bespokeContentLeft, !isMobile && styles.bespokeContentLeftDesktop]}>
          <View style={styles.badgePill}>
            <Sparkles size={12} color="#3D2B1F" />
            <Text style={styles.badgePillText}>
              {isAdmin
                ? 'STUDIO QUẢN TRỊ • TIỆM CUỘN LEN'
                : 'NHẬN ĐẶT ĐAN MÓC THEO YÊU CẦU'}
            </Text>
          </View>

          <Text style={[styles.bespokeTitle, isMobile && styles.bespokeTitleMobile]}>
            {isAdmin
              ? 'Quản lý cửa tiệm & Tư vấn đơn đặt riêng của khách'
              : 'Bạn muốn một mẫu len mang dấu ấn riêng?'}
          </Text>

          <Text style={styles.bespokeDesc}>
            {isAdmin
              ? 'Theo dõi hộp thư khách hàng đang ping sản phẩm, phản hồi tư vấn phối màu theo yêu cầu và cập nhật kho mẫu len thủ công nhanh chóng.'
              : 'Tiệm nhận phối màu theo sở thích, điều chỉnh kích thước hoặc đan móc theo hình mẫu bạn gửi. Mỗi đơn hàng đều được gói hộp quà kèm thiệp viết tay miễn phí.'}
          </Text>

          {/* Highlight Pills */}
          <View style={styles.highlightsRow}>
            {isAdmin ? (
              <>
                <View style={styles.highlightChip}>
                  <Package size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {uniqueProductCount} mẫu trên kệ
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <MessageCircle size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {conversations.length} hội thoại
                    {unreadCount > 0 ? ` (${unreadCount} mới)` : ''}
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <ShoppingBag size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    {pendingOrdersCount} đơn chờ duyệt
                  </Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.highlightChip}>
                  <Palette size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Tuỳ chọn màu sắc & kiểu dáng
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <Gift size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Tặng kèm hộp quà & thiệp
                  </Text>
                </View>
                <View style={styles.highlightChip}>
                  <Clock size={13} color="#3D2B1F" />
                  <Text style={styles.highlightChipText}>
                    Hoàn thiện tỉ mỉ 5–6 ngày
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* CTA Buttons */}
        <View style={[styles.bespokeActions, isMobile && styles.bespokeActionsMobile]}>
          <TouchableOpacity
            style={styles.primaryCtaBtn}
            onPress={openChat}
            activeOpacity={0.85}>
            <MessageCircle size={17} color="#FAF5EE" />
            <Text style={styles.primaryCtaText}>
              {isAdmin
                ? unreadCount > 0
                  ? `Hộp thư khách (${unreadCount})`
                  : 'Mở hộp thư khách hàng'
                : 'Nhắn Tiệm đặt mẫu riêng'}
            </Text>
          </TouchableOpacity>

          {isAdmin ? (
            <TouchableOpacity
              style={styles.secondaryCtaBtn}
              onPress={() => router.push('/add-product')}
              activeOpacity={0.8}>
              <PlusCircle size={16} color="#3D2B1F" />
              <Text style={styles.secondaryCtaText}>Đăng mẫu len mới</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.secondaryCtaBtn}
              onPress={() => handleCategoryPress('All')}
              activeOpacity={0.8}>
              <Text style={styles.secondaryCtaText}>Khám phá kệ len sẵn có ↑</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 1.5 Shop Reviews Section (Đánh giá Shop) */}
      <View style={[styles.shopReviewCard, isMobile && styles.shopReviewCardMobile]}>
        <View style={styles.shopReviewHeader}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.shopReviewTitle}>⭐ Đánh giá Shop — Tiệm Cuộn Len</Text>
              <View style={styles.shopRatingPill}>
                <Star size={13} color="#F59E0B" fill="#F59E0B" />
                <Text style={styles.shopRatingPillText}>
                  {shopReviews.length > 0
                    ? `${avgShopRating}/5 (${shopReviews.length} đánh giá)`
                    : 'Chưa có đánh giá'}
                </Text>
              </View>
            </View>
            <Text style={styles.shopReviewSub}>
              Cảm nhận thực tế từ khách hàng sau khi nhận đơn hàng hoàn thành tại Tiệm
            </Text>
          </View>

          {!showShopReviewForm && (
            <TouchableOpacity
              style={styles.writeShopReviewBtn}
              onPress={() => setShowShopReviewForm(true)}
              activeOpacity={0.8}>
              <MessageSquare size={14} color="#FAF5EE" />
              <Text style={styles.writeShopReviewBtnText}>Viết đánh giá Shop</Text>
            </TouchableOpacity>
          )}
        </View>

        {reviewStatusMsg ? (
          <View style={styles.reviewStatusBanner}>
            <Text style={styles.reviewStatusBannerText}>{reviewStatusMsg}</Text>
          </View>
        ) : null}

        {showShopReviewForm && (
          <View style={styles.shopReviewFormBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#3D2B1F' }}>
                Chọn số sao đánh giá Tiệm:
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity key={star} onPress={() => setShopRating(star)}>
                    <Star
                      size={22}
                      color="#F59E0B"
                      fill={star <= shopRating ? '#F59E0B' : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TextInput
              style={styles.shopReviewerNameInput}
              value={reviewerName}
              onChangeText={setReviewerName}
              placeholder="Tên của bạn (VD: Minh Anh)"
              placeholderTextColor={COLORS.lightText}
            />

            <TextInput
              style={styles.shopReviewInput}
              value={shopComment}
              onChangeText={setShopComment}
              placeholder="Chia sẻ trải nghiệm tư vấn, đóng gói hộp quà, giao hàng của Tiệm..."
              placeholderTextColor={COLORS.lightText}
              multiline
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <TouchableOpacity
                style={styles.shopCancelBtn}
                onPress={() => {
                  setShowShopReviewForm(false);
                  setShopComment('');
                }}>
                <Text style={styles.shopCancelBtnText}>Huỷ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.shopSubmitBtn}
                onPress={handleSubmitShopReview}>
                <Text style={styles.shopSubmitBtnText}>Gửi đánh giá Shop</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {shopReviews.length === 0 ? (
          <View style={styles.emptyShopReviewsBox}>
            <Text style={styles.emptyShopReviewsTitle}>
              🧶 Chưa có đánh giá nào từ khách hàng
            </Text>
            <Text style={styles.emptyShopReviewsSub}>
              Hãy bấm &quot;Viết đánh giá Shop&quot; hoặc đánh giá sau khi nhận đơn hàng để chia sẻ cảm nhận thực tế cùng Tiệm Cuộn Len nhé!
            </Text>
          </View>
        ) : (
          <View style={[styles.shopReviewsGrid, isMobile && styles.shopReviewsGridMobile]}>
            {shopReviews.slice(0, 12).map((rev) => {
              const isReplyingThis = replyingReviewId === rev.id;
              return (
                <View
                  key={rev.id}
                  style={[
                    styles.shopReviewItem,
                    !isMobile && styles.shopReviewItemDesktop,
                  ]}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                      gap: 8,
                    }}>
                    <Text style={styles.shopReviewerName} numberOfLines={1}>
                      {rev.userName}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          size={12}
                          color="#F59E0B"
                          fill={s <= rev.rating ? '#F59E0B' : 'transparent'}
                        />
                      ))}
                    </View>
                  </View>

                  <Text style={styles.shopReviewComment}>{rev.comment}</Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 8,
                      marginTop: 7,
                    }}>
                    <Text style={styles.shopReviewDate}>
                      ✓ Khách hàng Tiệm Cuộn Len • {formatReviewDate(rev.date)}
                    </Text>

                    {isAdmin && (
                      <View style={styles.adminReviewActionsRow}>
                        <TouchableOpacity
                          style={styles.adminReplyTriggerBtn}
                          onPress={() => {
                            if (isReplyingThis) {
                              setReplyingReviewId(null);
                              setReplyDraftText('');
                            } else {
                              setReplyingReviewId(rev.id);
                              setReplyDraftText(rev.adminReply || '');
                            }
                          }}
                          activeOpacity={0.8}>
                          <Edit3 size={11} color="#3D2B1F" />
                          <Text style={styles.adminReplyTriggerText}>
                            {rev.adminReply ? 'Sửa phản hồi' : 'Trả lời'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.adminDeleteReviewBtn}
                          onPress={() => handleDeleteShopReview(rev.id)}
                          activeOpacity={0.8}>
                          <Trash2 size={11} color="#B91C1C" />
                          <Text style={styles.adminDeleteReviewText}>Xoá</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {/* Display Shop's Reply if present */}
                  {rev.adminReply ? (
                    <View style={styles.adminReplyDisplayBox}>
                      <View style={styles.adminReplyHeaderRow}>
                        <CornerDownRight size={12} color="#7A5230" />
                        <Text style={styles.adminReplyBadgeText}>
                          🧶 Phản hồi từ Tiệm Cuộn Len
                        </Text>
                        {rev.adminReplyDate ? (
                          <Text style={styles.adminReplyDateText}>
                            • {formatReviewDate(rev.adminReplyDate)}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.adminReplyBodyText}>
                        {rev.adminReply}
                      </Text>
                    </View>
                  ) : null}

                  {/* Inline Admin Reply Editor */}
                  {isAdmin && isReplyingThis && (
                    <View style={styles.adminReplyEditorBox}>
                      <TextInput
                        style={styles.adminReplyInput}
                        value={replyDraftText}
                        onChangeText={setReplyDraftText}
                        placeholder={`Nhập lời cảm ơn hoặc phản hồi gửi tới ${rev.userName}...`}
                        placeholderTextColor={COLORS.lightText}
                        multiline
                      />
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'flex-end',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}>
                        {rev.adminReply ? (
                          <TouchableOpacity
                            style={styles.adminDeleteReviewBtn}
                            onPress={() => {
                              replyToShopReview(rev.id, '');
                              setReplyingReviewId(null);
                              setReplyDraftText('');
                            }}
                            activeOpacity={0.8}>
                            <Text style={styles.adminDeleteReviewText}>
                              Xoá phản hồi
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                          style={styles.shopCancelBtn}
                          onPress={() => {
                            setReplyingReviewId(null);
                            setReplyDraftText('');
                          }}
                          activeOpacity={0.8}>
                          <Text style={styles.shopCancelBtnText}>Huỷ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.shopSubmitBtn}
                          onPress={() => handleSaveAdminReply(rev.id)}
                          activeOpacity={0.8}>
                          <Text style={styles.shopSubmitBtnText}>
                            Gửi phản hồi
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* 2. Minimalist Boutique Footer Card */}
      <View style={[styles.footerCard, isMobile && styles.footerCardMobile]}>
        <View style={[styles.columnsRow, isMobile && styles.columnsRowMobile]}>
          {/* Column 1: Brand Story */}
          <View style={[styles.brandCol, !isMobile && styles.brandColDesktop]}>
            <View style={styles.brandHeaderRow}>
              <View style={styles.brandIconCircle}>
                <Text style={styles.brandIconEmoji}>🧶</Text>
              </View>
              <View>
                <Text style={styles.brandName}>Tiệm Cuộn Len</Text>
                <Text style={styles.brandTagline}>LEN THỦ CÔNG VIỆT NAM</Text>
              </View>
            </View>

            <Text style={styles.brandBio}>
              Chuyên sản phẩm Len thủ công & Kẽm nhung: móc khoá, thú bông, hoa
              trang trí, túi xách và phụ kiện handmade chăm chút từng chi tiết.
            </Text>

            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>
                Mở cửa mỗi ngày (08:00 – 22:00) • Giao hàng toàn quốc
              </Text>
            </View>

            {/* Buyer Protection & Return Guarantee Badge */}
            <View style={styles.returnGuaranteeBox}>
              <View style={styles.returnGuaranteeHeader}>
                <ShieldCheck size={15} color="#065F46" />
                <Text style={styles.returnGuaranteeTitle}>
                  CAM KẾT ĐỔI TRẢ & ĐỒNG KIỂM 100%
                </Text>
              </View>
              <Text style={styles.returnGuaranteeDesc}>
                Cam kết đổi trả miễn phí 1-đổi-1 hoặc hoàn tiền 100% nếu sản phẩm bị lỗi đan móc, sai mẫu hoặc hỏng form do vận chuyển. Khách hàng hoàn toàn yên tâm khi thanh toán trước qua QR hoặc nhận hàng COD kiểm tra tại chỗ.
              </Text>
            </View>
            </View>

          {/* Column 2: Categories */}
          <View style={[styles.linksCol, !isMobile && styles.linksColDesktop]}>
            <Text style={styles.colTitle}>BỘ SƯU TẬP</Text>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('All')}>
              <Text style={styles.footerLinkText}>
                ✨ Tất cả sản phẩm ({uniqueProductCount} mẫu)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('VelvetWire')}>
              <Text style={styles.footerLinkText}>🌸 Sản phẩm Kẽm nhung</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Keychains')}>
              <Text style={styles.footerLinkText}>🔑 Móc khoá đáng yêu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Yarn')}>
              <Text style={styles.footerLinkText}>🧶 Len cuộn & Nguyên liệu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Crochet')}>
              <Text style={styles.footerLinkText}>🌻 Hoa len & Quà tặng</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Bags')}>
              <Text style={styles.footerLinkText}>👜 Túi xách & Ví len</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Dolls')}>
              <Text style={styles.footerLinkText}>🧸 Thú bông & Búp bê len</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => handleCategoryPress('Accessories')}>
              <Text style={styles.footerLinkText}>🧣 Phụ kiện & Decor len</Text>
            </TouchableOpacity>
          </View>

          {/* Column 3: Role-specific Quick Links */}
          <View style={[styles.linksCol, !isMobile && styles.linksColDesktop]}>
            <Text style={styles.colTitle}>
              {isAdmin ? 'QUẢN TRỊ TIỆM' : 'DÀNH CHO BẠN'}
            </Text>
            {isAdmin ? (
              <>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/manage-products')}>
                  <Text style={styles.footerLinkText}>📦 Quản lý kho sản phẩm</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/orders')}>
                  <Text style={styles.footerLinkText}>🛍️ Duyệt & quản lý đơn hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/payment-methods')}>
                  <Text style={styles.footerLinkText}>💳 Cấu hình tài khoản QR</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={openChat}>
                  <Text style={styles.footerLinkText}>💬 Hộp thư tư vấn khách hàng</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/cart')}>
                  <Text style={styles.footerLinkText}>🛒 Giỏ hàng của bạn</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/favorites')}>
                  <Text style={styles.footerLinkText}>🤍 Sản phẩm đã yêu thích</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={() => router.push('/orders')}>
                  <Text style={styles.footerLinkText}>📦 Theo dõi đơn đặt hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.footerLinkBtn}
                  onPress={openChat}>
                  <Text style={styles.footerLinkText}>💬 Chat tư vấn & Ping sản phẩm</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={styles.footerLinkBtn}
              onPress={() => setShowShareModal(true)}>
              <Text style={styles.footerLinkText}>🔗 Chia sẻ link Web qua Zalo / FB</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Divider & Copyright Bar */}
        <View style={[styles.bottomBar, isMobile && styles.bottomBarMobile]}>
          <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
            <Text style={styles.copyrightText}>
              © 2026 Tiệm Cuộn Len Handmade (tiemcuonlen.shop) • Đan móc thủ công bằng cả trái tim
            </Text>
            <Text style={styles.bottomGuaranteeText}>
              🛡️ Cam kết đổi trả nếu sản phẩm lỗi/hỏng form do vận chuyển — An tâm 100% khi thanh toán trước hoặc nhận COD.
            </Text>
          </View>

          <View style={styles.bottomActionsRow}>
            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => setShowShareModal(true)}>
              <Share2 size={13} color={COLORS.mediumText} />
              <Text style={styles.policyLinkText}>Chia sẻ Web</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => router.push('/privacy')}>
              <ShieldCheck size={13} color={COLORS.mediumText} />
              <Text style={styles.policyLinkText}>Bảo mật</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.policyLink}
              onPress={() => router.push('/help')}>
              <HelpCircle size={13} color={COLORS.mediumText} />
              <Text style={styles.policyLinkText}>Trợ giúp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backToTopBtn}
              onPress={handleBackToTop}
              activeOpacity={0.75}>
              <ArrowUp size={13} color="#3D2B1F" />
              <Text style={styles.backToTopText}>Đầu trang</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {showShareModal ? (
        <ShareModal
          visible={showShareModal}
          onClose={() => setShowShareModal(false)}
          type="website"
          title="Tiệm Cuộn Len Handmade (tiemcuonlen.shop)"
          subtitle="🧶 Chuyên sản phẩm Len thủ công & Kẽm nhung đặt làm theo mẫu"
          priceText="Freeship đơn trên 299.000₫"
          url={PUBLIC_SHOP_URL}
          shareText={`🧶 Tiệm Cuộn Len Handmade — Chuyên đan móc len thủ công & hoa kẽm nhung theo yêu cầu (móc khoá, thú bông, bó hoa, túi xách, phụ kiện).\n🎁 Có tuỳ chọn Set Quà Tặng Đặc Biệt xinh xắn, freeship cho tổng hoá đơn trên 299k!`}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    gap: 16,
  },
  containerMobile: {
    paddingHorizontal: 12,
    gap: 12,
  },

  /* 1. Bespoke Crochet Banner */
  bespokeBanner: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#D8C3AD',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1.5,
    borderColor: '#C5AC92',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 24,
    ...SHADOWS.small,
  },
  bespokeBannerMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
    gap: 16,
  },
  decorCircleLarge: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(250, 245, 238, 0.22)',
  },
  decorCircleSmall: {
    position: 'absolute',
    right: 110,
    bottom: -45,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(61, 43, 31, 0.05)',
  },
  bespokeContentLeft: {
    width: '100%',
    minWidth: 0,
  },
  bespokeContentLeftDesktop: {
    flex: 1,
    width: 'auto',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(250, 245, 238, 0.85)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    marginBottom: 10,
  },
  badgePillText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#3D2B1F',
    letterSpacing: 0.5,
  },
  bespokeTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#2C1E14',
    lineHeight: 28,
  },
  bespokeTitleMobile: {
    fontSize: 18,
    lineHeight: 24,
  },
  bespokeDesc: {
    fontSize: 13.5,
    color: '#4A3525',
    lineHeight: 20,
    marginTop: 6,
    maxWidth: 620,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  highlightChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(250, 245, 238, 0.72)',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(61, 43, 31, 0.1)',
  },
  highlightChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  bespokeActions: {
    flexDirection: 'column',
    gap: 9,
    minWidth: 225,
    flexShrink: 0,
  },
  bespokeActionsMobile: {
    minWidth: 0,
    width: '100%',
  },
  primaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
    ...SHADOWS.small,
  },
  primaryCtaText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  secondaryCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  secondaryCtaText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },

  /* 1.5 Shop Reviews Card */
  shopReviewCard: {
    backgroundColor: '#FAF5EE',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    gap: 14,
  },
  shopReviewCardMobile: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 20,
  },
  shopReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  shopReviewTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#2C1E14',
  },
  shopRatingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  shopRatingPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  shopReviewSub: {
    fontSize: 12.5,
    color: '#6E5239',
    marginTop: 3,
  },
  writeShopReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  writeShopReviewBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  shopReviewFormBox: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#D8C3AD',
    gap: 10,
  },
  reviewStatusBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  reviewStatusBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#065F46',
  },
  shopReviewerNameInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2C1E14',
    minWidth: 0,
  },
  shopReviewInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2C1E14',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  emptyShopReviewsBox: {
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E6D9C8',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyShopReviewsTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3D2B1F',
    textAlign: 'center',
  },
  emptyShopReviewsSub: {
    fontSize: 12,
    color: '#6E5239',
    textAlign: 'center',
    lineHeight: 18,
  },
  adminReviewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  adminReplyTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE6DA',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  adminReplyTriggerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  adminDeleteReviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  adminDeleteReviewText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  adminReplyDisplayBox: {
    marginTop: 10,
    backgroundColor: '#FAF5EE',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#8B5E3C',
    gap: 4,
  },
  adminReplyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  adminReplyBadgeText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#5C3D28',
  },
  adminReplyDateText: {
    fontSize: 11,
    color: '#8C7A6B',
  },
  adminReplyBodyText: {
    fontSize: 12.5,
    color: '#3D2B1F',
    lineHeight: 18,
  },
  adminReplyEditorBox: {
    marginTop: 10,
    backgroundColor: '#FAF6F0',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#D8C3AD',
    gap: 8,
  },
  adminReplyInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D2C0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#2C1E14',
    minHeight: 54,
    textAlignVertical: 'top',
  },
  shopCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#EDE3D5',
  },
  shopCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4332',
  },
  shopSubmitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3D2B1F',
  },
  shopSubmitBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FAF5EE',
  },
  shopReviewsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shopReviewsGridMobile: {
    flexDirection: 'column',
    gap: 10,
  },
  shopReviewItem: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: '#EAE0D5',
  },
  shopReviewItemDesktop: {
    flex: 1,
    minWidth: 240,
    width: 'auto',
  },
  shopReviewerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2C1E14',
    flex: 1,
    marginRight: 8,
  },
  shopReviewComment: {
    fontSize: 12.5,
    color: '#4A3525',
    lineHeight: 18,
  },
  shopReviewDate: {
    fontSize: 11,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 7,
  },

  /* 2. Minimalist Boutique Footer Card */
  footerCard: {
    backgroundColor: '#F3ECE2',
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 24,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  footerCardMobile: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 20,
  },
  columnsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 28,
  },
  columnsRowMobile: {
    flexDirection: 'column',
    gap: 20,
  },
  brandCol: {
    width: '100%',
    minWidth: 0,
  },
  brandColDesktop: {
    flex: 1.5,
    width: 'auto',
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  brandIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  brandIconEmoji: {
    fontSize: 20,
  },
  brandName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#2C1E14',
  },
  brandTagline: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A5C44',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  brandBio: {
    fontSize: 13,
    color: '#5C4332',
    lineHeight: 19,
    maxWidth: 420,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A3525',
  },
  returnGuaranteeBox: {
    marginTop: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    maxWidth: 420,
  },
  returnGuaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  returnGuaranteeTitle: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#065F46',
    letterSpacing: 0.3,
  },
  returnGuaranteeDesc: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 17,
    fontWeight: '600',
  },
  bottomGuaranteeText: {
    fontSize: 12,
    color: '#065F46',
    fontWeight: '700',
    lineHeight: 17,
  },

  linksCol: {
    width: '100%',
    gap: 7,
  },
  linksColDesktop: {
    flex: 1,
    width: 'auto',
  },
  colTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7A5C44',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  footerLinkBtn: {
    paddingVertical: 3,
  },
  footerLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3D2B1F',
  },

  /* Bottom Signature Bar */
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2D2C0',
    gap: 12,
  },
  bottomBarMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 10,
  },
  copyrightText: {
    fontSize: 12,
    color: '#7A6252',
    fontWeight: '500',
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  policyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  policyLinkText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  backToTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 12,
  },
  backToTopText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
});
