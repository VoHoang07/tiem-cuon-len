import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Home } from 'lucide-react-native';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function PrivacyScreen() {
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
          <Text style={styles.headerTitle}>Quyền riêng tư</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.content}>
          <Text style={styles.paragraph}>
            Tiệm Cuộn Len cam kết bảo vệ quyền riêng tư của khách hàng. Chúng tôi chỉ thu thập
            những thông tin cần thiết để xử lý đơn hàng và cải thiện trải nghiệm mua sắm.
          </Text>

          <Text style={styles.subheading}>Thông tin thu thập</Text>
          <Text style={styles.paragraph}>
            - Họ tên, email, số điện thoại và địa chỉ giao hàng.{'\n'}
            - Lịch sử đơn hàng và sản phẩm yêu thích.{'\n'}
            - Thông tin thanh toán (không lưu trữ dữ liệu thẻ).
          </Text>

          <Text style={styles.subheading}>Cách sử dụng thông tin</Text>
          <Text style={styles.paragraph}>
            Thông tin được sử dụng để xử lý đơn hàng, giao hàng, hỗ trợ khách hàng
            và gửi thông báo về chương trình khuyến mãi (nếu bạn đồng ý).
          </Text>

          <Text style={styles.subheading}>Bảo mật</Text>
          <Text style={styles.paragraph}>
            Chúng tôi áp dụng các biện pháp bảo mật để bảo vệ thông tin cá nhân của bạn.
            Dữ liệu được lưu trữ an toàn và không chia sẻ với bên thứ ba khi chưa có sự đồng ý.
          </Text>

          <Text style={styles.subheading}>Liên hệ</Text>
          <Text style={styles.paragraph}>
            Nếu bạn có câu hỏi về chính sách quyền riêng tư, vui lòng liên hệ:{'\n'}
            Email: privacy@tiemcuonlen.com
          </Text>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
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
  content: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.lg,
    ...SHADOWS.small,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.mediumText,
  },
});
