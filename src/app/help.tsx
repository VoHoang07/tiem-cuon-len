import React, { useState, type ComponentType } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Home,
  HelpCircle,
  Mail,
  Phone,
  MessageCircle,
  Search,
  ShoppingBag,
  CreditCard,
  Truck,
  RotateCcw,
  Package,
  ClipboardList,
  CheckCircle,
  Settings,
  User,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

type FaqItem = { q: string; a: string };

const CUSTOMER_FAQ: FaqItem[] = [
  { q: 'Làm sao để đặt hàng?', a: 'Chọn sản phẩm yêu thích, thêm vào giỏ hàng, chọn phương thức thanh toán và địa chỉ giao hàng, sau đó xác nhận đơn.' },
  { q: 'Có những phương thức thanh toán nào?', a: 'Chuyển khoản ngân hàng (VietQR), Ví MoMo, Ví ZaloPay, và Thanh toán khi nhận hàng (COD).' },
  { q: 'Phí vận chuyển bao nhiêu?', a: 'Hiện tại Tiệm Cuộn Len miễn phí vận chuyển cho tất cả đơn hàng.' },
  { q: 'Đổi trả như thế nào?', a: 'Bạn có thể đổi trả trong vòng 7 ngày nếu sản phẩm bị lỗi từ nhà sản xuất. Vui lòng liên hệ shop để được hỗ trợ.' },
  { q: 'Làm sao để theo dõi đơn hàng?', a: 'Vào mục Đơn hàng trong Profile để xem trạng thái đơn hàng. Bạn sẽ nhận được thông báo khi trạng thái thay đổi.' },
  { q: 'Sản phẩm có giống hình ảnh không?', a: 'Sản phẩm được chụp thực tế. Tuy nhiên do tính chất thủ công, mỗi sản phẩm có thể khác biệt nhẹ, tạo nên nét độc đáo riêng.' },
];

const ADMIN_FAQ: FaqItem[] = [
  { q: 'Làm sao để thêm sản phẩm?', a: 'Vào tab Thêm (dấu +) ở thanh điều hướng, chụp ảnh sản phẩm, điền thông tin và nhấn Đăng sản phẩm.' },
  { q: 'Quản lý đơn hàng như thế nào?', a: 'Vào mục Đơn hàng để xem tất cả đơn. Nhấn vào đơn để xem chi tiết và cập nhật trạng thái đơn hàng.' },
  { q: 'Làm sao để xác nhận thanh toán?', a: 'Khi khách chuyển khoản, vào Đơn hàng → chọn đơn có trạng thái "Chờ xác nhận" → cập nhật sang "Đang xử lý".' },
  { q: 'Các trạng thái đơn hàng có ý nghĩa gì?', a: 'pending_payment = Chờ thanh toán, awaiting_confirmation = Chờ xác nhận, Đang xử lý = Đã xác nhận, Đang chuẩn bị hàng, Đang giao, Hoàn thành.' },
  { q: 'Quản lý phương thức thanh toán ở đâu?', a: 'Vào Profile → Phương thức thanh toán. Tại đây bạn có thể bật/tắt, chỉnh sửa thông tin ngân hàng và đặt phương thức mặc định.' },
  { q: 'Làm sao để sửa hoặc xoá sản phẩm?', a: 'Vào Profile → Quản lý sản phẩm, chọn sản phẩm cần sửa/xoá. Hoặc từ trang chi tiết sản phẩm, nhấn nút Sửa/Xoá.' },
];

export default function HelpScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [search, setSearch] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const faqs = isAdmin ? ADMIN_FAQ : CUSTOMER_FAQ;

  const filteredFaqs = search
    ? faqs.filter((f) => f.q.toLowerCase().includes(search.toLowerCase()) || f.a.toLowerCase().includes(search.toLowerCase()))
    : faqs;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backBtn}>
              <ChevronLeft size={24} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={20} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Trợ giúp</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Search size={18} color={COLORS.lightText} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm câu hỏi..."
            placeholderTextColor={COLORS.lightText}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liên hệ</Text>
          <ContactRow icon={Mail} label="Email" value="vohoang1327@gmail.com" link="mailto:vohoang1327@gmail.com?subject=Hỗ trợ từ Tiệm Cuộn Len" />
          <ContactRow icon={Phone} label="Điện thoại" value="0387 966 507" link="tel:0387966507" />
          <ContactRow icon={MessageCircle} label="Zalo" value="0387 966 507" link="https://zalo.me/0387966507" />
        </View>

        {/* Guide for admin */}
        {isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hướng dẫn nhanh</Text>
            <GuideItem icon={Package} label="Thêm sản phẩm" />
            <GuideItem icon={ClipboardList} label="Quản lý đơn hàng" />
            <GuideItem icon={CheckCircle} label="Xác nhận thanh toán" />
            <GuideItem icon={Settings} label="Cập nhật trạng thái đơn hàng" />
            <GuideItem icon={CreditCard} label="Quản lý phương thức thanh toán" />
          </View>
        )}

        {!isAdmin && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hướng dẫn nhanh</Text>
            <GuideItem icon={ShoppingBag} label="Cách đặt hàng" />
            <GuideItem icon={CreditCard} label="Hướng dẫn thanh toán" />
            <GuideItem icon={Truck} label="Chính sách vận chuyển" />
            <GuideItem icon={RotateCcw} label="Đổi trả & hoàn tiền" />
            <GuideItem icon={User} label="Liên hệ shop" />
          </View>
        )}

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Câu hỏi thường gặp ({filteredFaqs.length})</Text>
          {filteredFaqs.length === 0 ? (
            <Text style={styles.noResult}>Không tìm thấy câu hỏi phù hợp.</Text>
          ) : (
            filteredFaqs.map((faq, i) => (
              <TouchableOpacity
                key={i}
                style={styles.faqItem}
                onPress={() => setExpandedIndex(expandedIndex === i ? null : i)}
                activeOpacity={0.6}>
                <View style={styles.faqHeader}>
                  <HelpCircle size={16} color={COLORS.primary} />
                  <Text style={styles.faqQuestion}>{faq.q}</Text>
                </View>
                {expandedIndex === i && <Text style={styles.faqAnswer}>{faq.a}</Text>}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactRow({ icon: Icon, label, value, link }: { icon: ComponentType<{ size?: number; color?: string }>; label: string; value: string; link?: string }) {
  const handlePress = async () => {
    if (!link) return;
    try {
      const supported = await Linking.canOpenURL(link);
      if (supported) {
        await Linking.openURL(link);
      } else {
        Alert.alert('Không thể mở ứng dụng', `Thiết bị không hỗ trợ mở ${label.toLowerCase()}.`);
      }
    } catch {
      Alert.alert('Không thể mở ứng dụng');
    }
  };

  const Wrapper = link ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.contactItem} onPress={handlePress} activeOpacity={0.6}>
      <Icon size={20} color={COLORS.primary} />
      <View>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </Wrapper>
  );
}

function GuideItem({ icon: Icon, label }: { icon: ComponentType<{ size?: number; color?: string }>; label: string }) {
  return (
    <View style={styles.guideItem}>
      <View style={styles.guideIcon}>
        <Icon size={18} color={COLORS.primary} />
      </View>
      <Text style={styles.guideLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.darkText, paddingVertical: 12 },
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.darkText, marginBottom: SPACING.md },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contactLabel: { fontSize: 12, color: COLORS.lightText },
  contactValue: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  guideIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideLabel: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  faqItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faqHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: COLORS.darkText, flex: 1 },
  faqAnswer: { fontSize: 13, color: COLORS.mediumText, lineHeight: 20, marginTop: SPACING.xs, marginLeft: SPACING.xxl },
  noResult: { fontSize: 14, color: COLORS.mediumText, textAlign: 'center', paddingVertical: SPACING.lg },
});
