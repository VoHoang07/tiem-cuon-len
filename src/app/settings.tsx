import React, { type ComponentType } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Home,
  Bell,
  Globe,
  Shield,
  ChevronRight,
  User,
  Lock,
  MapPin,
  CreditCard,
  Store,
  Tag,
  Megaphone,
  FileText,
  LogOut,
  Package,
  ClipboardList,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { useLogout } from '@/hooks/useLogout';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { role } = useAuth();
  const { handleLogout } = useLogout();
  const isAdmin = role === 'admin';

  const comingSoon = () => {
    Alert.alert('Tính năng đang phát triển', 'Vui lòng quay lại sau.');
  };

  const sharedItems = [
    { icon: User, label: 'Chỉnh sửa Profile', onPress: () => router.push('/profile/edit') },
    { icon: Bell, label: 'Thông báo', value: 'Bật' },
    { icon: Globe, label: 'Ngôn ngữ', value: 'Tiếng Việt' },
    { icon: Lock, label: 'Đổi mật khẩu', onPress: comingSoon },
    { icon: Shield, label: 'Quyền riêng tư & bảo mật', onPress: () => router.push('/privacy') },
  ];

  const customerItems = [
    { icon: MapPin, label: 'Địa chỉ giao hàng', onPress: () => router.push('/addresses') },
    { icon: CreditCard, label: 'Phương thức thanh toán', onPress: () => router.push('/payment-methods') },
  ];

  const adminItems = [
    { icon: Store, label: 'Hồ sơ cửa hàng', onPress: comingSoon },
    { icon: CreditCard, label: 'Phương thức thanh toán', onPress: () => router.push('/payment-methods') },
    { icon: ClipboardList, label: 'Cài đặt trạng thái đơn hàng', onPress: comingSoon },
    { icon: Tag, label: 'Danh mục sản phẩm', onPress: comingSoon },
    { icon: Megaphone, label: 'Thông báo kinh doanh', onPress: comingSoon },
    { icon: FileText, label: 'Chính sách cửa hàng', onPress: comingSoon },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backBtn}>
              <ChevronLeft size={22} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={18} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Shared Settings */}
        <Section title="Tài khoản" items={sharedItems} />

        {/* Role-specific */}
        <Section title={isAdmin ? 'Quản lý cửa hàng' : 'Mua sắm'} items={isAdmin ? adminItems : customerItems} />

        {/* App Info */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionHeader}>Ứng dụng</Text>
          <SettingRow icon={Package} label="Phiên bản" value="1.0.0" isLast />
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Đăng xuất</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

interface SettingItem {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value?: string;
  onPress?: () => void;
}

function Section({ title, items }: { title: string; items: SettingItem[] }) {
  return (
    <View style={styles.menuSection}>
      <Text style={styles.sectionHeader}>{title}</Text>
      {items.map((item, i) => (
        <SettingRow
          key={item.label}
          icon={item.icon}
          label={item.label}
          value={item.value}
          onPress={item.onPress}
          isLast={i === items.length - 1}
        />
      ))}
    </View>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  onPress,
  isLast,
}: {
  icon: ComponentType<{ size?: number; color?: string }>;
  label: string;
  value?: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.settingItem, isLast && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={0.6}>
      <View style={styles.settingLeft}>
        <View style={styles.iconBox}>
          <Icon size={18} color={COLORS.primary} />
        </View>
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <View style={styles.settingRight}>
        {value ? <Text style={styles.settingValue}>{value}</Text> : null}
        {onPress ? <ChevronRight size={16} color={COLORS.lightText} /> : null}
      </View>
    </Wrapper>
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
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  homeBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkText },
  menuSection: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: SPACING.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.lightText,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingLabel: { fontSize: 15, fontWeight: '500', color: COLORS.darkText },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  settingValue: { fontSize: 13, color: COLORS.lightText },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.xl,
    paddingVertical: SPACING.md,
  },
  logoutText: { fontSize: 15, fontWeight: '600', color: COLORS.error },
});
