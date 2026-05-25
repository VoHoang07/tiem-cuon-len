import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, MapPin, Check, Trash2, Edit3 } from 'lucide-react-native';
import { useAddresses } from '@/store/AddressContext';
import { BottomNav } from '@/components/BottomNav';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function AddressesScreen() {
  const router = useRouter();
  const { userAddresses, removeAddress, setDefaultAddress } = useAddresses();
  const [refreshing, setRefreshing] = useState(false);

  const handleDelete = (id: string) => {
    Alert.alert('Xóa địa chỉ', 'Bạn có chắc muốn xóa địa chỉ này?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: () => removeAddress(id) },
    ]);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/addresses'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Địa chỉ giao hàng</Text>
          <View style={{ width: 40 }} />
        </View>

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/addresses/add')}>
          <Plus size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Thêm địa chỉ mới</Text>
        </TouchableOpacity>

        {userAddresses.length === 0 ? (
          <View style={styles.empty}>
            <MapPin size={64} color={COLORS.lightText} />
            <Text style={styles.emptyTitle}>Chưa có địa chỉ</Text>
            <Text style={styles.emptySubtext}>Vui lòng thêm địa chỉ giao hàng</Text>
          </View>
        ) : (
          <>
            {userAddresses.map((addr) => (
            <View key={addr.id} style={styles.addressCard}>
              <View style={styles.addressHeader}>
                <MapPin size={20} color={COLORS.primary} />
                <View style={styles.addressActions}>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => router.push(`/addresses/add?id=${addr.id}`)}>
                    <Edit3 size={16} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => removeAddress(addr.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Trash2 size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.addressName}>{addr.fullName}</Text>
              <Text style={styles.addressPhone}>{addr.phone}</Text>
              <Text style={styles.addressDetail}>
                {addr.detailAddress}, {addr.ward}, {addr.district}, {addr.city}
              </Text>

              <TouchableOpacity
                style={styles.defaultBtn}
                onPress={() => setDefaultAddress(addr.id)}>
                {addr.isDefault ? (
                  <Check size={18} color={COLORS.primary} />
                ) : (
                  <View style={styles.defaultCircle} />
                )}
                <Text style={styles.defaultText}>
                  {addr.isDefault ? 'Địa chỉ mặc định' : 'Đặt làm mặc định'}
                </Text>
              </TouchableOpacity>
            </View>
            ))}
            </>
            )}

        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomNav />
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.darkText },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
    ...SHADOWS.medium,
  },
  addBtnText: { fontSize: 16, fontWeight: '800', fontStyle: 'italic', color: COLORS.white },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: SPACING.md,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.darkText },
  emptySubtext: { fontSize: 14, color: COLORS.mediumText, textAlign: 'center' },
  addressCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  addressActions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressName: { fontSize: 16, fontWeight: '700', color: COLORS.darkText },
  addressPhone: { fontSize: 14, color: COLORS.mediumText, marginTop: 2 },
  addressDetail: { fontSize: 14, color: COLORS.mediumText, marginTop: 4, lineHeight: 20 },
  defaultBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  defaultCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.lightText,
  },
  defaultText: { fontSize: 14, fontWeight: '600', color: COLORS.mediumText },
  });
