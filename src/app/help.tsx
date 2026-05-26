import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, HelpCircle, Mail, Phone, MessageCircle, Home } from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function HelpScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
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

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Liên hệ</Text>
          <ContactItem icon={Mail} label="Email" value="support@tiemcuonlen.com" />
          <ContactItem icon={Phone} label="Điện thoại" value="0912 345 678" />
          <ContactItem icon={MessageCircle} label="Zalo" value="Tiệm Cuộn Len" />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Câu hỏi thường gặp</Text>
          <FaqItem question="Làm sao để đặt hàng?" answer="Chọn sản phẩm yêu thích, thêm vào giỏ hàng và tiến hành thanh toán." />
          <FaqItem question="Phí vận chuyển bao nhiêu?" answer="Hiện tại chúng tôi miễn phí vận chuyển cho tất cả đơn hàng." />
          <FaqItem question="Đổi trả như thế nào?" answer="Bạn có thể đổi trả trong vòng 7 ngày nếu sản phẩm bị lỗi từ nhà sản xuất." />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function ContactItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.contactItem}>
      <Icon size={20} color={COLORS.primary} />
      <View>
        <Text style={styles.contactLabel}>{label}</Text>
        <Text style={styles.contactValue}>{value}</Text>
      </View>
    </View>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.faqItem}>
      <View style={styles.faqHeader}>
        <HelpCircle size={16} color={COLORS.primary} />
        <Text style={styles.faqQuestion}>{question}</Text>
      </View>
      <Text style={styles.faqAnswer}>{answer}</Text>
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
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
  section: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
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
  faqItem: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 4,
  },
  faqQuestion: { fontSize: 14, fontWeight: '600', color: COLORS.darkText },
  faqAnswer: { fontSize: 13, color: COLORS.mediumText, lineHeight: 18, marginLeft: SPACING.xxl },
});
