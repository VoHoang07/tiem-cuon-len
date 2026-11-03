import React, { useState, useMemo, type ComponentType } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Home,
  HelpCircle,
  MessageCircle,
  Search,
  ShoppingBag,
  CreditCard,
  Truck,
  RotateCcw,
  Package,
  ClipboardList,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Clock,
  Copy,
  Check,
  ArrowRight,
  Store,
  X,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

type FaqCategory = 'all' | 'order' | 'payment' | 'shipping' | 'policy';

interface FaqItem {
  q: string;
  a: string;
  category: Exclude<FaqCategory, 'all'>;
}

interface GuideCardData {
  id: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  badge: string;
  title: string;
  summary: string;
  steps: string[];
  actionLabel: string;
  onAction: () => void;
}

const CUSTOMER_FAQ: FaqItem[] = [
  {
    category: 'order',
    q: 'Làm sao để chọn đúng màu len và phụ kiện kèm theo?',
    a: 'Tại trang chi tiết sản phẩm, bạn chỉ cần chạm vào từng ô Màu sắc (ảnh sẽ tự động đổi theo đúng màu đó) và chọn Phụ kiện đi kèm (nơ, chuông, cài áo, bó hoa...). Giá sản phẩm sẽ tự động cập nhật minh bạch trước khi thêm vào giỏ.',
  },
  {
    category: 'order',
    q: 'Sản phẩm "Hàng Order (Đặt đan theo mẫu)" mất bao lâu để hoàn thiện?',
    a: 'Các mẫu có sẵn sẽ được đóng gói gửi đi trong ngày. Với các mẫu "Đặt đan thủ công theo mẫu", nghệ nhân của tiệm sẽ móc mới tỉ mỉ trong khoảng 1–3 ngày trước khi bàn giao cho đơn vị vận chuyển.',
  },
  {
    category: 'payment',
    q: 'Thanh toán chuyển khoản VietQR xác nhận như thế nào?',
    a: 'Khi chọn Chuyển khoản ngân hàng, hệ thống tạo mã VietQR đã điền sẵn đúng Số tiền và Nội dung chuyển khoản của đơn hàng. Ngay sau khi bạn chuyển khoản thành công, hệ thống tự động xác nhận đơn trong 3–5 giây mà không cần chụp màn hình biên lai.',
  },
  {
    category: 'payment',
    q: 'Tiệm có nhận thanh toán khi nhận hàng (COD) không?',
    a: 'Có! Bạn có thể chọn "Thanh toán khi nhận hàng (COD)" ở bước Đặt hàng để kiểm tra kiện hàng và thanh toán tiền mặt trực tiếp cho bưu tá.',
  },
  {
    category: 'shipping',
    q: 'Phí vận chuyển và điều kiện Miễn phí vận chuyển (Freeship)?',
    a: 'Tiệm hỗ trợ 3 hình thức: (1) Giao Tiết Kiệm toàn quốc (20.000₫ nội thành TP.HCM, 30.000₫ liên tỉnh — Miễn phí 0₫ cho mọi đơn từ 199.000₫); (2) Giao Hỏa Tốc 2h nội thành TP.HCM; (3) Nhận trực tiếp tại Tiệm Cuộn Len (0₫).',
  },
  {
    category: 'shipping',
    q: 'Làm sao để tra cứu hành trình đơn hàng và mã vận đơn?',
    a: 'Bạn vào mục "Đơn hàng của tôi", chọn đơn cần xem. Tại đây có Timeline 4 bước trực quan cùng Mã vận đơn và nút "Tra cứu hành trình đơn hàng" dẫn thẳng tới trang định vị của Viettel Post, GHTK, GHN, J&T hoặc SPX.',
  },
  {
    category: 'policy',
    q: 'Chính sách bảo hành & đổi trả đồ thủ công tại tiệm như thế nào?',
    a: 'Tiệm hỗ trợ đổi mới hoặc hoàn tiền 100% trong vòng 7 ngày nếu sản phẩm bị bung mối len, hư hỏng do vận chuyển hoặc giao sai phân loại màu/phụ kiện đã đặt. Bạn chỉ cần bấm "Chat trực tiếp với Tiệm" ngay trên web để được xử lý trong ngày.',
  },
];

const ADMIN_FAQ: FaqItem[] = [
  {
    category: 'order',
    q: 'Làm sao để đăng sản phẩm có nhiều màu, phụ kiện và chế độ Hàng Order?',
    a: 'Vào tab "Thêm" (+) hoặc trang Sửa sản phẩm: bạn có thể thêm nhiều Phân loại màu (kèm ảnh riêng cho từng màu), thêm các tuỳ chọn Phụ kiện cộng thêm giá, và chuyển trạng thái kho giữa "Có sẵn theo số lượng" hoặc "Hàng Order (Đặt đan theo mẫu)".',
  },
  {
    category: 'shipping',
    q: 'Quy trình lên đơn Ship và gửi Mã vận đơn cho khách chỉ trong 10 giây?',
    a: 'Tại chi tiết đơn hàng, bạn bấm "📋 Chép đơn Ship" (hệ thống tự động tính tiền thu hộ COD = 0₫ nếu khách đã chuyển khoản QR, hoặc bằng tổng đơn nếu khách chọn COD). Sau đó dán vào web Viettel Post / GHTK / Goship, rồi chọn Hãng vận chuyển + nhập Mã vận đơn và bấm "Lưu & Báo đang giao".',
  },
  {
    category: 'payment',
    q: 'Làm sao để kiểm tra các giao dịch chuyển khoản VietQR tự động?',
    a: 'Khi khách chuyển khoản đúng nội dung đơn hàng, Webhook SePay sẽ tự động chuyển trạng thái đơn từ "Chờ thanh toán" sang "Đang xử lý" và gửi thông báo về kho đơn. Bạn có thể cấu hình tài khoản ngân hàng nhận tiền tại mục "Phương thức thanh toán".',
  },
  {
    category: 'policy',
    q: 'Làm sao để tư vấn khi khách gửi câu hỏi kèm sản phẩm qua Chat?',
    a: 'Nhấn vào biểu tượng nút Chat nổi ở góc dưới phải hoặc nút "Mở Hộp thư Khách hàng" ngay trên trang này. Bạn sẽ thấy danh sách từng khách hàng cùng thẻ sản phẩm họ đang quan tâm để phản hồi tức thì.',
  },
];

const CATEGORY_TABS: { key: FaqCategory; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'order', label: 'Đặt hàng & Sản phẩm' },
  { key: 'payment', label: 'Thanh toán' },
  { key: 'shipping', label: 'Vận chuyển' },
  { key: 'policy', label: 'Bảo hành & Hỗ trợ' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { openChat, unreadCount } = useChat();
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
        ? window.innerWidth
        : 1024;
  const isMobile = windowWidth < 640;
  const isAdmin = role === 'admin';

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<FaqCategory>('all');
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>(
    isAdmin ? 'admin-ship' : 'client-order'
  );
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const faqs = isAdmin ? ADMIN_FAQ : CUSTOMER_FAQ;

  const filteredFaqs = useMemo(() => {
    return faqs.filter((item) => {
      const matchCat =
        selectedCategory === 'all' || item.category === selectedCategory;
      const qLower = search.trim().toLowerCase();
      const matchSearch =
        !qLower ||
        item.q.toLowerCase().includes(qLower) ||
        item.a.toLowerCase().includes(qLower);
      return matchCat && matchSearch;
    });
  }, [faqs, selectedCategory, search]);

  const guideCards: GuideCardData[] = useMemo(() => {
    if (isAdmin) {
      return [
        {
          id: 'admin-ship',
          icon: Truck,
          badge: 'Vận đơn 10s',
          title: 'Lên đơn Ship & Đồng bộ Mã vận đơn',
          summary:
            'Sao chép phiếu giao hàng tự tính COD và gửi mã tra cứu hành trình cho khách.',
          steps: [
            'Mở đơn hàng cần gửi → Bấm nút "📋 Chép đơn Ship" để chép sẵn Tên, SĐT, Địa chỉ, Món đồ & Tiền thu hộ COD chuẩn xác.',
            'Mở nhanh cổng Goship / Viettel Post / GHTK / GHN ngay trong đơn để tạo phiếu gửi.',
            'Chọn Hãng vận chuyển, dán Mã vận đơn và bấm "Lưu & Báo đang giao" để khách tự tra cứu trực tiếp.',
          ],
          actionLabel: 'Mở Quản lý Đơn hàng',
          onAction: () => router.push('/orders'),
        },
        {
          id: 'admin-studio',
          icon: Package,
          badge: 'Studio SP',
          title: 'Đăng & Quản lý Sản phẩm Đa phân loại',
          summary:
            'Thêm ảnh chất lượng cao, nhiều màu sắc, phụ kiện kèm theo và chế độ Hàng Order.',
          steps: [
            'Tải ảnh đại diện sắc nét (hỗ trợ tỷ lệ vuông 1:1 chuẩn Studio).',
            'Thêm các phân loại Màu sắc (kèm ảnh riêng cho từng màu) và Phụ kiện (tự cộng giá chênh lệch).',
            'Chọn trạng thái "Có sẵn theo số lượng" hoặc "Hàng Order (Đặt đan theo mẫu 1–3 ngày)".',
          ],
          actionLabel: 'Mở Studio Thêm SP',
          onAction: () => router.push('/add-product'),
        },
        {
          id: 'admin-payment',
          icon: CreditCard,
          badge: 'VietQR 24/7',
          title: 'Cấu hình Ngân hàng & Tự động xác nhận',
          summary:
            'Quản lý tài khoản VietQR nhận tiền và đối soát giao dịch tự động qua SePay.',
          steps: [
            'Kiểm tra thông tin Ngân hàng, Số tài khoản và Chủ tài khoản nhận tiền tại mục Phương thức thanh toán.',
            'Đơn hàng chuyển khoản chỉ gửi thông báo sau khi hệ thống xác nhận khách đã thanh toán thành công.',
          ],
          actionLabel: 'Cấu hình Thanh toán',
          onAction: () => router.push('/payment-methods'),
        },
        {
          id: 'admin-chat',
          icon: MessageCircle,
          badge: 'Live Chat',
          title: 'Tư vấn & Chăm sóc Khách hàng Trực tuyến',
          summary:
            'Nhận tin nhắn kèm thẻ sản phẩm khách đang xem và phản hồi tức thì.',
          steps: [
            'Mở Hộp thư Chat để xem danh sách khách đang nhắn tư vấn.',
            'Bấm trực tiếp vào thẻ sản phẩm khách đính kèm để kiểm tra mẫu và báo thời gian hoàn thiện.',
          ],
          actionLabel: 'Mở Hộp thư Chat',
          onAction: () => openChat(),
        },
      ];
    }

    return [
      {
        id: 'client-order',
        icon: ShoppingBag,
        badge: 'Đặt mẫu dễ dàng',
        title: 'Cách chọn mẫu len & Đặt đan thủ công',
        summary:
          'Tuỳ chọn màu sắc, phối phụ kiện xinh xắn và đặt làm theo yêu cầu.',
        steps: [
          'Chọn sản phẩm yêu thích → Chạm vào từng phân loại Màu sắc và Phụ kiện để xem ảnh thực tế & giá tương ứng.',
          'Với sản phẩm "Đặt đan theo mẫu", tiệm sẽ móc mới thủ công trong 1–3 ngày và tặng kèm hộp quà.',
          'Nếu muốn phối màu riêng hoặc ghi thiệp viết tay, bấm nút Chat trên trang sản phẩm để nhắn trực tiếp cho tiệm.',
        ],
        actionLabel: 'Khám phá Sản phẩm',
        onAction: () => router.push('/'),
      },
      {
        id: 'client-payment',
        icon: CreditCard,
        badge: 'Tự động 3–5s',
        title: 'Thanh toán VietQR Tự động & COD',
        summary:
          'Quét mã QR hoặc mở thẳng ứng dụng ngân hàng tự điền sẵn thông tin.',
        steps: [
          'Chọn "Chuyển khoản ngân hàng (VietQR)" để quét mã hoặc mở App Ngân hàng tự điền sẵn Số tiền & Nội dung.',
          'Hệ thống tự động xác nhận thanh toán thành công sau 3–5 giây mà không cần gửi ảnh chụp màn hình.',
          'Hoặc chọn "Thanh toán khi nhận hàng (COD)" để kiểm tra hàng rồi mới thanh toán cho shipper.',
        ],
        actionLabel: 'Xem Giỏ hàng của tôi',
        onAction: () => router.push('/cart'),
      },
      {
        id: 'client-shipping',
        icon: Truck,
        badge: 'Freeship 199k',
        title: 'Vận chuyển & Tra cứu Hành trình Đơn',
        summary:
          'Theo dõi tiến độ đan mẫu 4 bước và định vị kiện hàng trực tuyến.',
        steps: [
          'Miễn phí vận chuyển toàn quốc cho mọi đơn từ 199.000₫ (hỗ trợ Giao Tiết Kiệm, Hỏa Tốc 2h TP.HCM & Nhận tại tiệm).',
          'Vào mục "Đơn hàng của tôi" để xem Timeline 4 bước: Đã đặt đơn → Đang đan mẫu → Đang vận chuyển → Giao thành công.',
          'Bấm nút "Tra cứu hành trình đơn hàng" để xem vị trí bưu kiện trên Viettel Post, GHTK, GHN, J&T hoặc SPX.',
        ],
        actionLabel: 'Tra cứu Đơn hàng',
        onAction: () => router.push('/orders'),
      },
      {
        id: 'client-policy',
        icon: RotateCcw,
        badge: 'Cam kết 100%',
        title: 'Bảo hành & Đổi trả Đồ Thủ Công 7 ngày',
        summary:
          'An tâm mua sắm với cam kết chất lượng sợi len Cotton Milk & Kẽm nhung loại 1.',
        steps: [
          'Mỗi sản phẩm đều được kiểm tra kỹ đường móc và đóng gói chống móp trước khi gửi đi.',
          'Hỗ trợ đổi mới hoặc hoàn tiền 100% trong 7 ngày nếu sản phẩm bị lỗi vận chuyển hoặc sai phân loại đã đặt.',
          'Mở khung Chat trực tuyến trên web để đội ngũ Tiệm Cuộn Len hỗ trợ bạn ngay lập tức.',
        ],
        actionLabel: 'Chat với Tiệm ngay',
        onAction: () => openChat(),
      },
    ];
  }, [isAdmin, router, openChat]);

  const handleCopySupportCode = async (value: string, key: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          isMobile && styles.containerMobile,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={styles.iconBtn}>
              <ChevronLeft size={22} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.replace('/')}>
              <Home size={19} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>
            {isAdmin ? 'Cẩm nang Quản trị' : 'Trung tâm Hỗ trợ'}
          </Text>
          <View style={{ width: 84 }} />
        </View>

        {/* Hero Support Banner */}
        <View style={[styles.heroCard, isMobile && styles.heroCardMobile]}>
          <View style={styles.heroTopRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                {isAdmin
                  ? 'Hệ thống Vận hành Tiệm Cuộn Len'
                  : 'Hỗ trợ trực tuyến • 08:00 – 22:00 hàng ngày'}
              </Text>
            </View>
            <View style={styles.brandBadge}>
              <Sparkles size={12} color="#6E5239" />
              <Text style={styles.brandBadgeText}>100% Handmade</Text>
            </View>
          </View>

          <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
            {isAdmin
              ? 'Quản lý Kho, Đơn hàng & Chăm sóc Khách hàng đồng bộ'
              : 'Tiệm Cuộn Len luôn sẵn sàng lắng nghe & hỗ trợ bạn 🧶'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isAdmin
              ? 'Tra cứu nhanh quy trình đăng mẫu Studio, lên đơn Ship tự tính COD và phản hồi tin nhắn khách hàng theo thời gian thực.'
              : 'Bạn cần tư vấn phối màu len, đặt đan mẫu riêng, viết thiệp quà tặng hay kiểm tra hành trình đơn hàng? Nhắn trực tiếp với tiệm ngay trên web nhé!'}
          </Text>

          {/* Primary Action Buttons */}
          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              style={styles.primaryChatBtn}
              onPress={() => openChat()}
              activeOpacity={0.85}>
              <MessageCircle size={18} color="#FFFDF9" />
              <Text style={styles.primaryChatBtnText}>
                {isAdmin
                  ? `Mở Hộp thư Khách hàng${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                  : 'Chat trực tiếp với Tiệm ngay'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryHeroBtn}
              onPress={() => router.push('/orders')}
              activeOpacity={0.8}>
              <ClipboardList size={17} color="#3D2B1F" />
              <Text style={styles.secondaryHeroBtnText}>
                {isAdmin ? 'Quản lý Đơn & Vận đơn' : 'Tra cứu Đơn hàng'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Service Highlights Bar */}
          <View style={styles.highlightsBar}>
            <View style={styles.highlightPill}>
              <Clock size={14} color="#5C4332" />
              <Text style={styles.highlightText}>Phản hồi trong vài phút</Text>
            </View>
            <View style={styles.highlightPill}>
              <ShieldCheck size={14} color="#2E7D32" />
              <Text style={styles.highlightText}>Bảo hành đổi trả 7 ngày</Text>
            </View>
            <View style={styles.highlightPill}>
              <Store size={14} color="#5C4332" />
              <Text style={styles.highlightText}>Gói quà & thiệp miễn phí</Text>
            </View>
          </View>
        </View>

        {/* Official Support Channels (No personal phone/Gmail exposed) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kênh hỗ trợ chính thức</Text>
            <Text style={styles.sectionSubtitle}>
              Kết nối nhanh chóng & bảo mật ngay trên hệ thống
            </Text>
          </View>

          <View
            style={[
              styles.channelsGrid,
              isMobile && styles.channelsGridMobile,
            ]}>
            {/* Channel 1: Live Chat on Web */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() => openChat()}
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#EFE6DC' }]}>
                <MessageCircle size={20} color="#3D2B1F" />
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelTitleRow}>
                  <Text style={styles.channelTitle}>Chat Trực Tuyến</Text>
                  <View style={styles.recommendTag}>
                    <Text style={styles.recommendTagText}>Nhanh nhất</Text>
                  </View>
                </View>
                <Text style={styles.channelDesc} numberOfLines={2}>
                  Nhắn tin & gửi mẫu sản phẩm trực tiếp cho Tiệm ngay trên web
                </Text>
              </View>
              <ArrowRight size={16} color="#7A5C44" />
            </TouchableOpacity>

            {/* Channel 2: Order & Tracking Portal */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() => router.push('/orders')}
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#EBF5EE' }]}>
                <Truck size={20} color="#2E7D32" />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelTitle}>Tra cứu Vận đơn 24/7</Text>
                <Text style={styles.channelDesc} numberOfLines={2}>
                  Xem tiến độ đan mẫu 4 bước & định vị kiện hàng trực tiếp
                </Text>
              </View>
              <ArrowRight size={16} color="#7A5C44" />
            </TouchableOpacity>

            {/* Channel 3: Official Brand Support Email */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() =>
                handleCopySupportCode('cskh@tiemcuonlen.shop', 'email')
              }
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#F6EFE6' }]}>
                <CheckCircle2 size={20} color="#6E5239" />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelTitle}>Hộp thư CSKH Tiệm</Text>
                <Text style={styles.channelDesc} numberOfLines={1}>
                  cskh@tiemcuonlen.shop
                </Text>
              </View>
              <View style={styles.copyMiniPill}>
                {copiedCode === 'email' ? (
                  <>
                    <Check size={12} color="#2E7D32" />
                    <Text style={[styles.copyMiniText, { color: '#2E7D32' }]}>
                      Đã chép
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color="#5C4332" />
                    <Text style={styles.copyMiniText}>Chép</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Interactive Step-by-Step Guides */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isAdmin ? 'Quy trình vận hành chuẩn' : 'Cẩm nang mua sắm nhanh'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Chạm vào từng mục để xem hướng dẫn chi tiết
            </Text>
          </View>

          <View style={styles.guidesList}>
            {guideCards.map((card) => {
              const Icon = card.icon;
              const expanded = expandedGuideId === card.id;
              return (
                <View
                  key={card.id}
                  style={[
                    styles.guideCard,
                    expanded && styles.guideCardExpanded,
                  ]}>
                  <TouchableOpacity
                    style={styles.guideCardHeader}
                    onPress={() =>
                      setExpandedGuideId(expanded ? null : card.id)
                    }
                    activeOpacity={0.75}>
                    <View style={styles.guideIconWrap}>
                      <Icon size={20} color={COLORS.primary} />
                    </View>
                    <View style={styles.guideHeaderContent}>
                      <View style={styles.guideTitleRow}>
                        <Text style={styles.guideTitle}>{card.title}</Text>
                        <View style={styles.guideBadge}>
                          <Text style={styles.guideBadgeText}>{card.badge}</Text>
                        </View>
                      </View>
                      <Text style={styles.guideSummary}>{card.summary}</Text>
                    </View>
                    {expanded ? (
                      <ChevronUp size={18} color="#6E5239" />
                    ) : (
                      <ChevronDown size={18} color="#9C8B7A" />
                    )}
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.guideBody}>
                      {card.steps.map((step, idx) => (
                        <View key={idx} style={styles.stepRow}>
                          <View style={styles.stepNumberCircle}>
                            <Text style={styles.stepNumberText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.stepText}>{step}</Text>
                        </View>
                      ))}

                      <TouchableOpacity
                        style={styles.guideActionBtn}
                        onPress={card.onAction}
                        activeOpacity={0.8}>
                        <Text style={styles.guideActionBtnText}>
                          {card.actionLabel}
                        </Text>
                        <ArrowRight size={14} color="#FFFDF9" />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Search & Categorized FAQ Section */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              Câu hỏi thường gặp ({filteredFaqs.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Giải đáp nhanh các thắc mắc phổ biến tại Tiệm Cuộn Len
            </Text>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <Search size={17} color="#8D7B68" />
            <TextInput
              style={styles.searchInput}
              placeholder="Nhập từ khoá cần tìm (VD: vận chuyển, VietQR, đổi trả...)"
              placeholderTextColor="#9C8B7A"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearSearchBtn}>
                <X size={15} color="#7A6855" />
              </TouchableOpacity>
            )}
          </View>

          {/* Category Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryChipsRow}>
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.categoryChip,
                    active && styles.categoryChipActive,
                  ]}
                  onPress={() => setSelectedCategory(tab.key)}
                  activeOpacity={0.75}>
                  <Text
                    style={[
                      styles.categoryChipText,
                      active && styles.categoryChipTextActive,
                    ]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* FAQ Accordion List */}
          <View style={styles.faqListCard}>
            {filteredFaqs.length === 0 ? (
              <View style={styles.emptyFaqBox}>
                <HelpCircle size={32} color="#B8A99A" />
                <Text style={styles.emptyFaqTitle}>
                  Không tìm thấy câu hỏi phù hợp
                </Text>
                <Text style={styles.emptyFaqSub}>
                  Bạn có thể nhắn trực tiếp qua khung Chat để được tiệm giải đáp
                  ngay nhé!
                </Text>
                <TouchableOpacity
                  style={styles.emptyFaqChatBtn}
                  onPress={() => openChat()}>
                  <MessageCircle size={15} color="#FFFDF9" />
                  <Text style={styles.emptyFaqChatBtnText}>
                    Hỏi trực tiếp qua Chat
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredFaqs.map((faq, i) => {
                const isExpanded = expandedFaqIndex === i;
                const isLast = i === filteredFaqs.length - 1;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[styles.faqItem, isLast && styles.faqItemLast]}
                    onPress={() => setExpandedFaqIndex(isExpanded ? null : i)}
                    activeOpacity={0.7}>
                    <View style={styles.faqHeader}>
                      <View
                        style={[
                          styles.faqIconCircle,
                          isExpanded && styles.faqIconCircleActive,
                        ]}>
                        <HelpCircle
                          size={15}
                          color={isExpanded ? '#FFFDF9' : '#6E5239'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.faqQuestion,
                          isExpanded && styles.faqQuestionActive,
                        ]}>
                        {faq.q}
                      </Text>
                      {isExpanded ? (
                        <ChevronUp size={17} color="#6E5239" />
                      ) : (
                        <ChevronDown size={17} color="#9C8B7A" />
                      )}
                    </View>
                    {isExpanded && (
                      <View style={styles.faqAnswerBox}>
                        <Text style={styles.faqAnswer}>{faq.a}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        </View>

        <View style={{ height: 50 }} />
      </ScrollView>
    </SafeAreaView>
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
  container: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingBottom: 40,
  },
  containerMobile: {
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EADFD2',
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  heroCard: {
    backgroundColor: '#EFE6DC',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DFCBB5',
    marginBottom: 20,
    ...SHADOWS.small,
  },
  heroCardMobile: {
    padding: 15,
    borderRadius: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E3D5C5',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#2E7D32',
  },
  liveBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 253, 249, 0.75)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E5239',
  },
  heroTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#2C1E14',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroTitleMobile: {
    fontSize: 18,
    lineHeight: 25,
  },
  heroSubtitle: {
    fontSize: 13.5,
    color: '#5C4738',
    lineHeight: 20,
    marginBottom: 16,
  },
  heroActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  primaryChatBtn: {
    flex: 1,
    minWidth: 210,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3D2B1F',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    ...SHADOWS.small,
  },
  primaryChatBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  secondaryHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#FFFDF9',
    paddingVertical: 13,
    paddingHorizontal: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  secondaryHeroBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  highlightsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(110, 82, 57, 0.14)',
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 253, 249, 0.65)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  highlightText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4A3728',
  },
  sectionBlock: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  channelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  channelsGridMobile: {
    flexDirection: 'column',
  },
  channelCard: {
    flex: 1,
    minWidth: 230,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFDF9',
    padding: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    ...SHADOWS.small,
  },
  channelCardMobile: {
    minWidth: 0,
    width: '100%',
  },
  channelIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  channelInfo: {
    flex: 1,
    minWidth: 0,
  },
  channelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  channelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  recommendTag: {
    backgroundColor: '#EBF5EE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recommendTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2E7D32',
  },
  channelDesc: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
    lineHeight: 16,
  },
  copyMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F5EFE6',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5D8C8',
  },
  copyMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4332',
  },
  guidesList: {
    gap: 10,
  },
  guideCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  guideCardExpanded: {
    borderColor: '#C8B096',
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  guideIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  guideHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  guideTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  guideTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  guideBadge: {
    backgroundColor: '#EFE6DC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  guideBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  guideSummary: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    marginTop: 3,
    lineHeight: 17,
  },
  guideBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0E8DC',
    backgroundColor: '#FAF6F0',
    gap: 9,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  stepNumberCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3D2B1F',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: '#3D2B1F',
    lineHeight: 19,
  },
  guideActionBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 4,
  },
  guideActionBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    paddingHorizontal: 13,
    marginBottom: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5D8C8',
    ...SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    color: COLORS.darkText,
    paddingVertical: 11,
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryChipsRow: {
    gap: 8,
    paddingBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#E3D5C5',
  },
  categoryChipActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  categoryChipText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5C4738',
  },
  categoryChipTextActive: {
    color: '#FFFDF9',
  },
  faqListCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E8DEC8',
    paddingHorizontal: 14,
    ...SHADOWS.small,
  },
  faqItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F0E8DC',
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  faqIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F5EFE6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqIconCircleActive: {
    backgroundColor: '#6E5239',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    lineHeight: 20,
  },
  faqQuestionActive: {
    color: '#3D2B1F',
    fontWeight: '800',
  },
  faqAnswerBox: {
    marginTop: 8,
    marginLeft: 36,
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#EDE2D3',
  },
  faqAnswer: {
    fontSize: 13,
    color: '#4A3728',
    lineHeight: 20,
  },
  emptyFaqBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 8,
  },
  emptyFaqTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  emptyFaqSub: {
    fontSize: 12.5,
    color: COLORS.mediumText,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyFaqChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 6,
  },
  emptyFaqChatBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFDF9',
  },
});
