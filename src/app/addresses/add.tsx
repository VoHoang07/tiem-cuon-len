import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Home } from 'lucide-react-native';
import { useAddresses } from '@/store/AddressContext';
import { useAuth } from '@/store/AuthContext';
import { useAutoLocation } from '@/hooks/useAutoLocation';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function AddAddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { userAddresses, addAddress, updateAddress } = useAddresses();

  const existing = id ? userAddresses.find((a) => a.id === id) : undefined;

  const [fullName, setFullName] = useState(existing?.fullName ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [district, setDistrict] = useState(existing?.district ?? '');
  const [ward, setWard] = useState(existing?.ward ?? '');
  const [detailAddress, setDetailAddress] = useState(existing?.detailAddress ?? '');
  const [isDefault, setIsDefault] = useState(existing?.isDefault ?? false);

  const { getCurrentLocation, loading: locationLoading, error: locationError, setError: setLocationError } = useAutoLocation();

  const handleAutoLocation = async () => {
    setLocationError(null);
    const resolved = await getCurrentLocation();
    if (resolved) {
      if (resolved.city) setCity(resolved.city);
      if (resolved.district) setDistrict(resolved.district);
      if (resolved.ward) setWard(resolved.ward);
      if (resolved.detailAddress) setDetailAddress(resolved.detailAddress);
    }
  };

  const handleSave = () => {
    if (!fullName.trim() || !phone.trim() || !city.trim() || !detailAddress.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng điền đầy đủ Họ tên, SĐT, Thành phố và Địa chỉ cụ thể.');
      return;
    }

    if (existing) {
      updateAddress(existing.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        district: district.trim(),
        ward: ward.trim(),
        detailAddress: detailAddress.trim(),
        isDefault,
      });
      if (router.canGoBack()) router.back(); else router.replace('/addresses');
      } else {
      const added = addAddress({
        userId: user?.id ?? '',
        fullName: fullName.trim(),
        phone: phone.trim(),
        city: city.trim(),
        district: district.trim(),
        ward: ward.trim(),
        detailAddress: detailAddress.trim(),
        isDefault,
      });
      if (!added) {
        Alert.alert('Địa chỉ trùng', 'Địa chỉ này đã tồn tại.');
        return;
      }
      if (router.canGoBack()) router.back(); else router.replace('/addresses');
      }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/addresses'); }} style={styles.backBtn}>
              <ChevronLeft size={24} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
              <Home size={20} color={COLORS.darkText} />
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{existing ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.form}>
          <TouchableOpacity
            style={[styles.locationBtn, locationLoading && styles.locationBtnDisabled]}
            onPress={handleAutoLocation}
            disabled={locationLoading}
            activeOpacity={0.7}>
            {locationLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <MapPin size={20} color={COLORS.primary} />
            )}
            <Text style={styles.locationBtnText}>
              {locationLoading ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
            </Text>
          </TouchableOpacity>

          {locationError ? (
            <View style={styles.locationError}>
              <Text style={styles.locationErrorText}>{locationError}</Text>
            </View>
          ) : null}

          <FormField label="Họ và tên" value={fullName} onChangeText={setFullName} placeholder="VD: Nguyễn Văn A" />
          <FormField label="Số điện thoại" value={phone} onChangeText={setPhone} placeholder="VD: 0912345678" keyboardType="phone-pad" />
          <FormField label="Thành phố" value={city} onChangeText={setCity} placeholder="VD: Hồ Chí Minh" />
          <FormField label="Quận/Huyện" value={district} onChangeText={setDistrict} placeholder="VD: Quận 1" />
          <FormField label="Phường/Xã" value={ward} onChangeText={setWard} placeholder="VD: Bến Nghé" />
          <FormField label="Địa chỉ cụ thể" value={detailAddress} onChangeText={setDetailAddress} placeholder="VD: 123 Nguyễn Huệ" />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Đặt làm địa chỉ mặc định</Text>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={isDefault ? COLORS.primary : COLORS.white}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>{existing ? 'Lưu thay đổi' : 'Lưu địa chỉ'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'phone-pad';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.lightText}
        keyboardType={keyboardType}
      />
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.darkText },
  form: { paddingHorizontal: SPACING.lg },
  locationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.softBeige,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    marginBottom: SPACING.lg,
  },
  locationBtnDisabled: {
    opacity: 0.6,
  },
  locationBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.primary,
  },
  locationError: {
    backgroundColor: '#FDF0ED',
    borderRadius: 10,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  locationErrorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  fieldGroup: { marginBottom: SPACING.lg },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: COLORS.darkText, marginBottom: SPACING.xs },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.darkText,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    ...SHADOWS.small,
  },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.darkText },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  saveBtnText: { fontSize: 18, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
});
