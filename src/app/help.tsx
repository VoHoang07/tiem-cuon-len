import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { useChat } from '@/store/ChatContext';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import {
    ArrowRight,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    ClipboardList,
    Clock,
    Copy,
    CreditCard,
    Gift,
    HelpCircle,
    Home,
    Mail,
    MessageCircle,
    Package,
    Phone,
    RotateCcw,
    Search,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    Truck,
    X,
} from 'lucide-react-native';
import React, { useMemo, useState, type ComponentType } from 'react';
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
  badgeBg: string;
  badgeColor: string;
  title: string;
  summary: string;
  steps: string[];
  actionLabel: string;
  onAction: () => void;
}

const SHOP_HOTLINE_RAW = '0775111750';
const SHOP_HOTLINE_DISPLAY = '0775 111 750';
const SHOP_EMAIL = 'tiemcuonlen@gmail.com';

const CUSTOMER_FAQ: FaqItem[] = [
  {
    category: 'order',
    q: 'Cách chọn mẫu màu, Combo 2 mẫu và Set Quà Tặng (+25.000₫)?',
    a: 'Tại trang sản phẩm, bạn chạm vào từng mẫu màu để xem đúng ảnh & giá của mẫu đó (hoặc chọn gói Combo 2 mẫu để tự động giảm giá cặp). Về đóng gói: mặc định là "Tự dùng / Tiêu chuẩn (0₫)", hoặc bạn chọn "🎁 Set Quà Tặng Đặc Biệt (+25.000₫)" để kèm hộp quà cứng và thiệp viết tay theo lời nhắn.',
  },
  {
    category: 'order',
    q: 'Sản phẩm đan thủ công mất bao lâu để hoàn thiện và gửi đi?',
    a: 'Mỗi sản phẩm tại Tiệm đều được đan móc mới tỉ mỉ trong khoảng 5–6 ngày (Giai đoạn 1: Xưởng đan thủ công). Ngay khi hoàn thiện 100%, Tiệm sẽ đóng hộp và bàn giao cho SPX Express (Giai đoạn 2: Vận chuyển).',
  },
  {
    category: 'shipping',
    q: 'Làm sao để tra cứu tiến độ đan & bản đồ trạm SPX khi chưa đăng nhập?',
    a: 'Bạn chỉ cần vào mục "Theo dõi đơn" (/orders) và gõ đủ 10 số Điện thoại nhận hàng (hoặc mã đơn CUONLEN-...). Hệ thống sẽ tự động hiển thị tiến độ xưởng đan và bản đồ lộ trình các trạm bưu cục SPX Express trực tiếp trên điện thoại.',
  },
  {
    category: 'shipping',
    q: 'Phí vận chuyển và điều kiện Miễn phí vận chuyển (Freeship)?',
    a: 'Phí giao tiêu chuẩn nội thành TP.HCM là 15.000₫, ngoại tỉnh 25.000₫, và Tự động Miễn phí vận chuyển (0₫) cho mọi đơn hàng từ 299.000₫ trở lên. Ngoài ra Tiệm hỗ trợ Giao hỏa tốc trong ngày tại TP.HCM.',
  },
  {
    category: 'payment',
    q: 'Thanh toán chuyển khoản VietQR và COD hoạt động như thế nào?',
    a: '• Với COD (Thanh toán khi nhận hàng): Bạn được Mở hộp đồng kiểm 100% trước khi thanh toán cho bưu tá.\n• Với Chuyển khoản VietQR: Hệ thống tạo mã QR điền sẵn Số tiền & Nội dung; ngay sau khi bạn quét mã chuyển khoản, SePay sẽ tự động xác nhận đơn trong vài giây.',
  },
  {
    category: 'policy',
    q: 'Làm sao để nhận Gói Quà 60.000₫ và Mã giảm 15.000₫ sau khi nhận hàng?',
    a: 'Khi đơn hàng chuyển sang "Hoàn thành", bạn bấm sang mục "Đánh giá" ngay kế bên:\n• Mục 1 (Nhận Gói Quà 60.000₫ = Giảm 25k + Tặng 01 SP 35k giá 0₫): Đăng Video/Story khui hàng lên FB/IG/TikTok kèm tên & link tiemcuonlen.shop rồi tải ảnh màn hình lên.\n• Mục 2 (Nhận Mã -15.000₫): Follow Fanpage FB & Chia sẻ bài công khai rồi tải ảnh màn hình lên. Tiệm sẽ duyệt và gửi mã riêng ngay trong khung Chat!',
  },
  {
    category: 'policy',
    q: 'Chính sách bảo hành & đổi trả đồ thủ công tại Tiệm?',
    a: 'Tiệm cam kết hỗ trợ đổi mới hoặc hoàn tiền 100% trong vòng 7 ngày nếu sản phẩm bị bung mối len, hư hỏng do vận chuyển hoặc giao sai mẫu đã đặt. Bạn chỉ cần nhắn qua khung Chat trên web hoặc Zalo 0775 111 750.',
  },
];

const ADMIN_FAQ: FaqItem[] = [
  {
    category: 'shipping',
    q: 'Quy trình 2 giai đoạn: Đan mẫu (5–6 ngày) và Lên đơn Goship SPX?',
    a: '• Giai đoạn 1 (Đang đan): Mở chi tiết đơn → Bấm 1 chạm cập nhật tiến độ ("Đang móc thân len", "Khâu ráp & Kiểm tra form"...) mà chưa gọi Shipper.\n• Giai đoạn 2 (Gửi hàng): Khi đan xong, bấm tạo vận đơn SPX trực tiếp trên web (hoặc tạo trên shop.goship.io). Hệ thống tự động đối chiếu theo SĐT/Mã đơn để gắn mã SPX, vẽ bản đồ trạm và gửi Gmail báo khách.',
  },
  {
    category: 'policy',
    q: 'Làm sao để duyệt ảnh minh chứng và cấp mã thưởng 60k / 15k cho khách?',
    a: 'Khi khách gửi ảnh màn hình ở mục "Đánh giá", ảnh sẽ hiện ngay trong Hộp thư Chat kèm nút "🎟️ Duyệt & Cấp Gói Quà 60k" hoặc "🎟️ Duyệt & Cấp mã -15.000₫". Bạn chỉ cần bấm 1 chạm, hệ thống sẽ tự tạo mã khóa 1-1 gửi vào khung Chat cho khách.',
  },
  {
    category: 'payment',
    q: 'Làm sao phân biệt đơn Chuyển khoản QR đã trả tiền hay chưa?',
    a: 'Đơn khách chọn QR nhưng chưa chuyển tiền sẽ hiện cảnh báo đỏ "⛔ CHƯA CHUYỂN KHOẢN" và hệ thống tự động khóa nút tạo đơn Ship. Chỉ khi SePay xác nhận tiền về (hoặc bạn bấm duyệt tay), đơn mới chuyển sang "Đang xử lý" với Thu COD = 0₫.',
  },
  {
    category: 'order',
    q: 'Làm sao để khôi phục đơn hàng cũ hoặc xuất file CSV đẩy đơn hàng loạt?',
    a: 'Tại trang Quản lý đơn (/orders), thanh công cụ Admin trên cùng có nút "🔄 Quét khôi phục đơn trên máy", "📂 Nhập CSV/JSON đơn cũ" và "📥 Xuất CSV Goship" để tải danh sách đơn đủ điều kiện lên Goship.io.',
  },
];

const CATEGORY_TABS: { key: FaqCategory; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'order', label: 'Đặt mẫu & Combo' },
  { key: 'shipping', label: 'Vận chuyển SPX' },
  { key: 'payment', label: 'Thanh toán' },
  { key: 'policy', label: 'Quà 60k & Bảo hành' },
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
          badge: 'Tự động SPX',
          badgeBg: '#ECFDF5',
          badgeColor: '#059669',
          title: '1. Cập nhật tiến độ đan & Lên đơn Goship SPX',
          summary:
            'Báo tiến độ 5–6 ngày khi đang đan, chỉ tạo đơn SPX khi đã hoàn thiện mẫu.',
          steps: [
            'Giai đoạn 1 (Đang đan): Mở đơn hàng → Bấm chọn mốc tiến độ ("Đang móc thân len", "Khâu ráp & Kiểm tra form"...) để khách yên tâm theo dõi.',
            'Giai đoạn 2 (Gửi hàng): Khi đã đan xong 100%, bấm báo giá & tạo đơn SPX ngay trên web (hoặc tạo trên shop.goship.io).',
            'Hệ thống tự động đối chiếu SĐT/Mã đơn để lấy mã vận đơn SPX, hiển thị bản đồ trạm và gửi Gmail báo khách.',
          ],
          actionLabel: 'Mở Quản lý Đơn hàng',
          onAction: () => router.push('/orders'),
        },
        {
          id: 'admin-reward',
          icon: Gift,
          badge: 'Duyệt 1 chạm',
          badgeBg: '#FFF1EE',
          badgeColor: '#EE4D2D',
          title: '2. Duyệt ảnh Đánh giá & Cấp mã Quà 60k qua Chat',
          summary:
            'Cấp mã riêng khóa 1-1 (VD25- / FB15-) ngay trong hộp thư khi khách gửi ảnh màn hình.',
          steps: [
            'Khách hoàn thành đơn vào mục "Đánh giá" tải ảnh màn hình Story/Video hoặc Follow/Share FB.',
            'Tin nhắn kèm ảnh sẽ hiện trong Hộp thư Chat của bạn cùng nút bấm duyệt.',
            'Bấm "Duyệt & Cấp mã": hệ thống tự sinh mã riêng cho đúng tài khoản khách và nhắc bạn bỏ kèm quà 35k trên phiếu đơn tiếp theo.',
          ],
          actionLabel: 'Mở Hộp thư Chat',
          onAction: () => openChat(),
        },
        {
          id: 'admin-studio',
          icon: Package,
          badge: 'Cloudflare R2',
          badgeBg: '#EFF6FF',
          badgeColor: '#2563EB',
          title: '3. Đăng sản phẩm đa phân loại & Kho ảnh R2',
          summary:
            'Tải ảnh vuông 1:1 sắc nét lên đám mây R2, cài giá riêng cho từng mẫu màu.',
          steps: [
            'Tải ảnh bìa & ảnh từng phân loại màu (hệ thống tự động chuyển sang chuẩn WebP nhẹ mượt trên Cloudflare R2).',
            'Đặt giá riêng cho từng mẫu (VD: size nhỏ / size lớn) — các gói Combo sẽ tự động tính giá theo đúng 2 mẫu khách chọn.',
          ],
          actionLabel: 'Mở Studio Thêm SP',
          onAction: () => router.push('/add-product'),
        },
        {
          id: 'admin-payment',
          icon: CreditCard,
          badge: 'SePay 24/7',
          badgeBg: '#FEF3C7',
          badgeColor: '#B45309',
          title: '4. Đối soát VietQR tự động & Khóa đơn chưa thanh toán',
          summary:
            'Chặn nhầm lẫn đơn QR chưa chuyển khoản và tự động xác nhận khi tiền về.',
          steps: [
            'Đơn chuyển khoản chưa quét QR sẽ mang trạng thái chờ và hiện nhãn đỏ "⛔ CHƯA CHUYỂN KHOẢN".',
            'Ngay khi khách chuyển khoản đúng nội dung, SePay tự động chuyển đơn sang "Đang xử lý" (Thu COD = 0₫) và báo về Gmail tiemcuonlen@gmail.com.',
          ],
          actionLabel: 'Cấu hình Thanh toán',
          onAction: () => router.push('/payment-methods'),
        },
      ];
    }

    return [
      {
        id: 'client-order',
        icon: ShoppingBag,
        badge: 'Bước 1',
        badgeBg: '#FFF1EE',
        badgeColor: '#EE4D2D',
        title: '1. Chọn mẫu màu, Đóng gói & Áp mã giảm giá',
        summary:
          'Chọn mẫu lẻ hoặc ghép đôi Combo tiết kiệm, tùy chọn Set hộp quà + thiệp viết tay.',
        steps: [
          'Chạm vào từng phân loại màu để xem ảnh thực tế & giá tương ứng, hoặc chọn "Combo 2 mẫu" để được giảm giá cặp tự động.',
          'Chọn hình thức đóng gói: "Tự dùng / Tiêu chuẩn (0₫)" hoặc "🎁 Set Quà Tặng Đặc Biệt (+25.000₫)" kèm hộp quà & thiệp viết tay.',
          'Áp dụng mã TIEMLEN10K (-10k đơn lẻ đầu từ 159k), Freeship 0₫ (đơn từ 299k) hoặc VIP20K (-20k đơn từ 399k).',
        ],
        actionLabel: 'Khám phá Sản phẩm',
        onAction: () => router.push('/'),
      },
      {
        id: 'client-shipping',
        icon: Truck,
        badge: 'Bước 2',
        badgeBg: '#ECFDF5',
        badgeColor: '#059669',
        title: '2. Theo dõi tiến độ đan 5–6 ngày & Bản đồ SPX',
        summary:
          'Chỉ cần nhập 10 số điện thoại để xem tiến độ làm len và vị trí bưu cục SPX.',
        steps: [
          'Trong 5–6 ngày đầu: Theo dõi từng công đoạn nghệ nhân móc len, khâu ráp và đóng gói tại xưởng.',
          'Khi bàn giao SPX Express: Xem trực tiếp bản đồ lộ trình từ Kho Thủ Đức tới địa chỉ của bạn và từng trạm bưu cục SPX.',
          'Không cần đăng nhập vẫn tra cứu nhanh được tại mục "Theo dõi đơn" chỉ bằng 10 số SĐT nhận hàng.',
        ],
        actionLabel: 'Tra cứu Đơn hàng',
        onAction: () => router.push('/orders'),
      },
      {
        id: 'client-reward',
        icon: Gift,
        badge: 'Bước 3 • Quà 60k',
        badgeBg: '#FFF7ED',
        badgeColor: '#EA580C',
        title: '3. Vào mục "Đánh giá" nhận Gói Quà 60.000₫ & Mã -15k',
        summary:
          'Mở mục "Đánh giá" (ngay sau mục Hoàn thành) để gửi ảnh màn hình nhận mã qua Chat.',
        steps: [
          'Mục 1 (Gói Quà 60.000₫): Đăng Video/Story khui hàng lên FB, IG hoặc TikTok kèm tên & link tiemcuonlen.shop → Nhận mã giảm 25.000₫ + Chọn tặng 01 SP 35.000₫ miễn phí (0₫).',
          'Mục 2 (Mã -15.000₫): Follow Fanpage FB & Chia sẻ bài công khai → Nhận mã giảm 15.000₫ cho đơn tiếp theo.',
        ],
        actionLabel: 'Mở mục Đánh giá & Nhận quà',
        onAction: () => router.push('/orders'),
      },
      {
        id: 'client-policy',
        icon: RotateCcw,
        badge: 'Đảm bảo 100%',
        badgeBg: '#F1F5F9',
        badgeColor: '#334155',
        title: '4. Đồng kiểm khi nhận hàng & Bảo hành 7 ngày',
        summary:
          'Được mở hộp kiểm tra hàng trước khi thanh toán, hỗ trợ đổi mới 100% trong 7 ngày.',
        steps: [
          'Bạn được quyền Mở hộp kiểm tra đúng mẫu, đúng màu trước khi thanh toán tiền COD cho bưu tá.',
          'Đổi mới hoặc hoàn tiền 100% trong 7 ngày nếu sản phẩm bị lỗi vận chuyển hoặc sai phân loại.',
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

  const handleOpenExternalLink = async (
    url: string,
    copyFallbackValue: string,
    copyKey: string
  ) => {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (url.startsWith('http')) {
          window.open(url, '_blank', 'noopener,noreferrer');
        } else {
          window.location.href = url;
        }
        return;
      }
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        await handleCopySupportCode(copyFallbackValue, copyKey);
      }
    } catch {
      await handleCopySupportCode(copyFallbackValue, copyKey);
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
        {/* Clean Compact Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={styles.iconBtn}>
              <ChevronLeft size={21} color={COLORS.darkText} />
            </TouchableOpacity>
            {!isMobile && (
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.replace('/')}>
                <Home size={18} color={COLORS.darkText} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isAdmin ? 'Cẩm nang Vận hành' : 'Trung tâm Hỗ trợ'}
          </Text>
          <View style={{ width: isMobile ? 38 : 80 }} />
        </View>

        {/* Clean Hero Support Card */}
        <View style={[styles.heroCard, isMobile && styles.heroCardMobile]}>
          <View style={styles.heroTopRow}>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                {isAdmin
                  ? 'Hệ thống Vận hành • Tiệm Cuộn Len'
                  : 'Hỗ trợ trực tuyến • 08:00 – 22:00'}
              </Text>
            </View>
            <View style={styles.brandBadge}>
              <Sparkles size={11.5} color="#EE4D2D" />
              <Text style={styles.brandBadgeText}>Đồng kiểm 100%</Text>
            </View>
          </View>

          <Text style={[styles.heroTitle, isMobile && styles.heroTitleMobile]}>
            {isAdmin
              ? 'Quản lý Vận đơn SPX, Duyệt Quà 60k & Tư vấn Khách hàng'
              : 'Cần phối màu len, viết thiệp hay tra cứu đơn SPX?'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isAdmin
              ? 'Quy trình chuẩn từ lúc cập nhật tiến độ đan 5–6 ngày, đẩy vận đơn Goship SPX tự động đến duyệt ảnh tặng Gói Quà 60.000₫ qua Chat.'
              : 'Nhắn trực tiếp trên Web hoặc kết nối Zalo / Hotline 0775 111 750 để được Tiệm phản hồi và hỗ trợ ngay lập tức.'}
          </Text>

          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              style={styles.primaryChatBtn}
              onPress={() => openChat()}
              activeOpacity={0.85}>
              <MessageCircle size={17} color="#FFFFFF" />
              <Text style={styles.primaryChatBtnText}>
                {isAdmin
                  ? `Mở Hộp thư Chat${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                  : 'Chat trực tiếp với Tiệm'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryHeroBtn}
              onPress={() => router.push('/orders')}
              activeOpacity={0.8}>
              <ClipboardList size={16} color="#1E293B" />
              <Text style={styles.secondaryHeroBtnText}>
                {isAdmin ? 'Quản lý Đơn & SPX' : 'Tra cứu Đơn hàng'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.highlightsBar}>
            <View style={styles.highlightPill}>
              <Clock size={13} color="#059669" />
              <Text style={styles.highlightText}>Đan mới tỉ mỉ 5–6 ngày</Text>
            </View>
            <View style={styles.highlightPill}>
              <ShieldCheck size={13} color="#059669" />
              <Text style={styles.highlightText}>Mở hộp kiểm tra hàng</Text>
            </View>
            <View style={styles.highlightPill}>
              <Gift size={13} color="#EE4D2D" />
              <Text style={styles.highlightText}>Đánh giá nhận Quà 60k</Text>
            </View>
          </View>
        </View>

        {/* 4 Official Contact Channels (Updated Hotline & Zalo: 0775 111 750) */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Kênh liên hệ chính thức</Text>
            <Text style={styles.sectionSubtitle}>
              Chạm để mở nhanh Chat, Zalo, Gọi điện hoặc sao chép thông tin
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
                style={[styles.channelIconBox, { backgroundColor: '#FFF1EE' }]}>
                <MessageCircle size={19} color="#EE4D2D" />
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelTitleRow}>
                  <Text style={styles.channelTitle}>Chat Trực Tuyến</Text>
                  <View
                    style={[
                      styles.recommendTag,
                      { backgroundColor: '#FFF1EE' },
                    ]}>
                    <Text
                      style={[styles.recommendTagText, { color: '#EE4D2D' }]}>
                      Nhanh nhất
                    </Text>
                  </View>
                </View>
                <Text style={styles.channelDesc} numberOfLines={1}>
                  Gửi mẫu len & nhận mã quà ngay trên Web
                </Text>
              </View>
              <ArrowRight size={16} color="#64748B" />
            </TouchableOpacity>

            {/* Channel 2: Zalo (0775 111 750) */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() =>
                handleOpenExternalLink(
                  `https://zalo.me/${SHOP_HOTLINE_RAW}`,
                  SHOP_HOTLINE_RAW,
                  'zalo'
                )
              }
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#EFF6FF' }]}>
                <MessageCircle size={19} color="#0068FF" />
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelTitleRow}>
                  <Text style={styles.channelTitle}>Zalo Hỗ Trợ</Text>
                  <View
                    style={[
                      styles.recommendTag,
                      { backgroundColor: '#EFF6FF' },
                    ]}>
                    <Text
                      style={[styles.recommendTagText, { color: '#0068FF' }]}>
                      Zalo
                    </Text>
                  </View>
                </View>
                <Text style={styles.channelValueText}>
                  {SHOP_HOTLINE_DISPLAY}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyMiniPill}
                onPress={() => handleCopySupportCode(SHOP_HOTLINE_RAW, 'zalo')}
                activeOpacity={0.75}>
                {copiedCode === 'zalo' ? (
                  <>
                    <Check size={12} color="#059669" />
                    <Text style={[styles.copyMiniText, { color: '#059669' }]}>
                      Đã chép
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color="#475569" />
                    <Text style={styles.copyMiniText}>Chép số</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Channel 3: Phone Hotline (0775 111 750) */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() =>
                handleOpenExternalLink(
                  `tel:${SHOP_HOTLINE_RAW}`,
                  SHOP_HOTLINE_RAW,
                  'phone'
                )
              }
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#ECFDF5' }]}>
                <Phone size={19} color="#059669" />
              </View>
              <View style={styles.channelInfo}>
                <View style={styles.channelTitleRow}>
                  <Text style={styles.channelTitle}>Điện thoại / Hotline</Text>
                  <View
                    style={[
                      styles.recommendTag,
                      { backgroundColor: '#ECFDF5' },
                    ]}>
                    <Text
                      style={[styles.recommendTagText, { color: '#059669' }]}>
                      24/7
                    </Text>
                  </View>
                </View>
                <Text style={styles.channelValueText}>
                  {SHOP_HOTLINE_DISPLAY}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyMiniPill}
                onPress={() => handleCopySupportCode(SHOP_HOTLINE_RAW, 'phone')}
                activeOpacity={0.75}>
                {copiedCode === 'phone' ? (
                  <>
                    <Check size={12} color="#059669" />
                    <Text style={[styles.copyMiniText, { color: '#059669' }]}>
                      Đã chép
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color="#475569" />
                    <Text style={styles.copyMiniText}>Chép số</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>

            {/* Channel 4: Official Shop Gmail (tiemcuonlen@gmail.com) */}
            <TouchableOpacity
              style={[styles.channelCard, isMobile && styles.channelCardMobile]}
              onPress={() =>
                handleOpenExternalLink(
                  `mailto:${SHOP_EMAIL}?subject=Hỗ trợ từ Tiệm Cuộn Len`,
                  SHOP_EMAIL,
                  'email'
                )
              }
              activeOpacity={0.8}>
              <View
                style={[styles.channelIconBox, { backgroundColor: '#F8FAFC' }]}>
                <Mail size={19} color="#334155" />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelTitle}>Email Hỗ Trợ</Text>
                <Text style={styles.channelValueText} numberOfLines={1}>
                  {SHOP_EMAIL}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.copyMiniPill}
                onPress={() => handleCopySupportCode(SHOP_EMAIL, 'email')}
                activeOpacity={0.75}>
                {copiedCode === 'email' ? (
                  <>
                    <Check size={12} color="#059669" />
                    <Text style={[styles.copyMiniText, { color: '#059669' }]}>
                      Đã chép
                    </Text>
                  </>
                ) : (
                  <>
                    <Copy size={12} color="#475569" />
                    <Text style={styles.copyMiniText}>Chép</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step-by-Step Standard Workflow */}
        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {isAdmin
                ? 'Quy trình vận hành 4 bước chuẩn'
                : 'Quy trình đặt hàng & Nhận quà 60.000₫'}
            </Text>
            <Text style={styles.sectionSubtitle}>
              Chạm vào từng bước để xem chi tiết và mở trang tương ứng
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
                    <View
                      style={[
                        styles.guideIconWrap,
                        { backgroundColor: card.badgeBg },
                      ]}>
                      <Icon size={19} color={card.badgeColor} />
                    </View>
                    <View style={styles.guideHeaderContent}>
                      <View style={styles.guideTitleRow}>
                        <Text style={styles.guideTitle}>{card.title}</Text>
                        <View
                          style={[
                            styles.guideBadge,
                            { backgroundColor: card.badgeBg },
                          ]}>
                          <Text
                            style={[
                              styles.guideBadgeText,
                              { color: card.badgeColor },
                            ]}>
                            {card.badge}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.guideSummary}>{card.summary}</Text>
                    </View>
                    {expanded ? (
                      <ChevronUp size={18} color="#334155" />
                    ) : (
                      <ChevronDown size={18} color="#94A3B8" />
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
                        activeOpacity={0.85}>
                        <Text style={styles.guideActionBtnText}>
                          {card.actionLabel}
                        </Text>
                        <ArrowRight size={14} color="#FFFFFF" />
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
              Giải đáp nhanh về thời gian đan, bản đồ SPX, VietQR & Gói Quà 60k
            </Text>
          </View>

          <View style={styles.searchWrap}>
            <Search size={16} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm nhanh (VD: SPX, VietQR, quà 60k, đổi trả...)"
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearch('')}
                style={styles.clearSearchBtn}>
                <X size={15} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>

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

          <View style={styles.faqListCard}>
            {filteredFaqs.length === 0 ? (
              <View style={styles.emptyFaqBox}>
                <HelpCircle size={30} color="#94A3B8" />
                <Text style={styles.emptyFaqTitle}>
                  Không tìm thấy câu hỏi phù hợp
                </Text>
                <Text style={styles.emptyFaqSub}>
                  Nhắn trực tiếp qua khung Chat hoặc Zalo {SHOP_HOTLINE_DISPLAY}{' '}
                  để được Tiệm hỗ trợ ngay nhé!
                </Text>
                <TouchableOpacity
                  style={styles.emptyFaqChatBtn}
                  onPress={() => openChat()}>
                  <MessageCircle size={15} color="#FFFFFF" />
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
                    activeOpacity={0.75}>
                    <View style={styles.faqHeader}>
                      <View
                        style={[
                          styles.faqIconCircle,
                          isExpanded && styles.faqIconCircleActive,
                        ]}>
                        <HelpCircle
                          size={14}
                          color={isExpanded ? '#FFFFFF' : '#475569'}
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
                        <ChevronUp size={17} color="#0F172A" />
                      ) : (
                        <ChevronDown size={17} color="#94A3B8" />
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

        <View style={{ height: 48 }} />
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
    paddingVertical: 12,
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
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 18,
    ...SHADOWS.small,
  },
  heroCardMobile: {
    padding: 14,
    borderRadius: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  liveBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#1E293B',
  },
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF1EE',
    borderWidth: 1,
    borderColor: '#FFD5CC',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EE4D2D',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    lineHeight: 26,
    marginBottom: 6,
  },
  heroTitleMobile: {
    fontSize: 16.5,
    lineHeight: 23,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  heroActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  primaryChatBtn: {
    flex: 1,
    minWidth: 185,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#EE4D2D',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
  },
  primaryChatBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  secondaryHeroBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  highlightsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 11,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  highlightPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  highlightText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  sectionBlock: {
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 9,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  channelsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  channelsGridMobile: {
    flexDirection: 'column',
  },
  channelCard: {
    flex: 1,
    minWidth: 320,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  channelCardMobile: {
    minWidth: 0,
    width: '100%',
  },
  channelIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
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
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  recommendTag: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 5,
  },
  recommendTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  channelDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  channelValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  copyMiniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  copyMiniText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  guidesList: {
    gap: 9,
  },
  guideCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  guideCardExpanded: {
    borderColor: '#CBD5E1',
  },
  guideCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 13,
  },
  guideIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  guideBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  guideBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  guideSummary: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 17,
  },
  guideBody: {
    paddingHorizontal: 13,
    paddingBottom: 13,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  stepNumberCircle: {
    width: 19,
    height: 19,
    borderRadius: 9.5,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumberText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stepText: {
    flex: 1,
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
  },
  guideActionBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2C1E16',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 9,
    marginTop: 3,
  },
  guideActionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 9,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    color: '#0F172A',
    paddingVertical: 10,
  },
  clearSearchBtn: {
    padding: 4,
  },
  categoryChipsRow: {
    gap: 7,
    paddingBottom: 10,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryChipActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  faqListCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 13,
  },
  faqItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  faqIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqIconCircleActive: {
    backgroundColor: '#EE4D2D',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 19,
  },
  faqQuestionActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  faqAnswerBox: {
    marginTop: 8,
    marginLeft: 33,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  faqAnswer: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 19,
  },
  emptyFaqBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 7,
  },
  emptyFaqTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyFaqSub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyFaqChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EE4D2D',
    paddingHorizontal: 14,
    paddingVertical: 8.5,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyFaqChatBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
