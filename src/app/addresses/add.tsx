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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  MapPin,
  Home,
  User,
  Phone,
  Building2,
  Navigation,
  Briefcase,
  Check,
} from 'lucide-react-native';
import { useAddresses } from '@/store/AddressContext';
import { useAuth } from '@/store/AuthContext';
import { useAutoLocation } from '@/hooks/useAutoLocation';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

const QUICK_CITIES = [
  'TP. Hồ Chí Minh',
  'Hà Nội',
  'Đà Nẵng',
  'Cần Thơ',
  'Hải Phòng',
  'Bình Dương',
];

const QUICK_DISTRICTS_BY_CITY: Record<string, string[]> = {
  'TP. Hồ Chí Minh': ['Quận 1', 'Quận 3', 'Quận 7', 'Bình Thạnh', 'TP. Thủ Đức', 'Phú Nhuận'],
  'Hồ Chí Minh': ['Quận 1', 'Quận 3', 'Quận 7', 'Bình Thạnh', 'TP. Thủ Đức', 'Phú Nhuận'],
  'Hà Nội': ['Hoàn Kiếm', 'Ba Đình', 'Đống Đa', 'Cầu Giấy', 'Hai Bà Trưng', 'Tây Hồ'],
  'Đà Nẵng': ['Hải Châu', 'Thanh Khê', 'Sơn Trà', 'Ngũ Hành Sơn', 'Liên Chiểu'],
};

export default function AddAddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { userAddresses, addAddress, updateAddress } = useAddresses();

  const existing = id ? userAddresses.find((a) => a.id === id) : undefined;

  const [fullName, setFullName] = useState(existing?.fullName ?? user?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [district, setDistrict] = useState(existing?.district ?? '');
  const [ward, setWard] = useState(existing?.ward ?? '');
  const [detailAddress, setDetailAddress] = useState(existing?.detailAddress ?? '');
  const [addressTag, setAddressTag] = useState<'home' | 'office'>('home');
  const [isDefault, setIsDefault] = useState(
    existing?.isDefault ?? userAddresses.length === 0
  );

  const {
    getCurrentLocation,
    loading: locationLoading,
    error: locationError,
    setError: setLocationError,
  } = useAutoLocation();
  const [locationSuccess, setLocationSuccess] = useState(false);

  const handleAutoLocation = async () => {
    setLocationError(null);
    setLocationSuccess(false);
    const resolved = await getCurrentLocation();
    if (resolved) {
      if (resolved.city) setCity(resolved.city);
      if (resolved.district) setDistrict(resolved.district);
      if (resolved.ward) setWard(resolved.ward);
      if (resolved.detailAddress) setDetailAddress(resolved.detailAddress);
      setLocationSuccess(true);
    }
  };

  const suggestedDistricts = QUICK_DISTRICTS_BY_CITY[city.trim()] ?? [];

  const handleSave = () => {
    if (
      !fullName.trim() ||
      !phone.trim() ||
      !city.trim() ||
      !detailAddress.trim()
    ) {
      Alert.alert(
        'Thiếu thông tin',
        'Vui lòng điền đầy đủ Họ tên, Số điện thoại, Tỉnh/Thành phố và Địa chỉ cụ thể.'
      );
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
      if (router.canGoBack()) router.back();
      else router.replace('/addresses');
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
        Alert.alert('Địa chỉ trùng', 'Địa chỉ này đã tồn tại trong sổ địa chỉ.');
        return;
      }
      if (router.canGoBack()) router.back();
      else router.replace('/addresses');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.headerWrap}>
        <View style={styles.headerInner}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/addresses');
              }}
              style={styles.iconBtn}>
              <ChevronLeft size={20} color="#3D2B1F" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.replace('/')}>
              <Home size={18} color="#3D2B1F" />
            </TouchableOpacity>
          </View>
          <View style={styles.headerTitleBox}>
            <Text style={styles.headerTitle}>
              {existing ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ nhận hàng'}
            </Text>
            <Text style={styles.headerSubtitle}>
              Thông tin giao hàng nhanh & chính xác
            </Text>
          </View>
          <View style={{ width: 76 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* GPS Quick-Fill Banner Card */}
        <TouchableOpacity
          style={[
            styles.gpsCard,
            locationSuccess && styles.gpsCardSuccess,
            locationLoading && styles.gpsCardDisabled,
          ]}
          onPress={handleAutoLocation}
          disabled={locationLoading}
          activeOpacity={0.8}>
          <View style={styles.gpsIconCircle}>
            {locationLoading ? (
              <ActivityIndicator size="small" color="#6E4F37" />
            ) : locationSuccess ? (
              <Check size={18} color="#2E7D32" strokeWidth={2.5} />
            ) : (
              <Navigation size={18} color="#6E4F37" />
            )}
          </View>
          <View style={styles.gpsTextCol}>
            <Text style={styles.gpsTitle}>
              {locationLoading
                ? 'Đang xác định vị trí của bạn...'
                : locationSuccess
                  ? 'Đã tự động điền vị trí hiện tại'
                  : 'Định vị tự động vị trí hiện tại'}
            </Text>
            <Text style={styles.gpsSubtitle}>
              {locationSuccess
                ? 'Bạn có thể kiểm tra hoặc chỉnh sửa thêm số nhà bên dưới'
                : 'Tự động điền nhanh Tỉnh/Thành, Quận/Huyện & Phường/Xã'}
            </Text>
          </View>
          <View style={styles.gpsActionPill}>
            <Text style={styles.gpsActionText}>
              {locationLoading ? 'Đang lấy...' : locationSuccess ? 'Lấy lại' : 'Lấy vị trí'}
            </Text>
          </View>
        </TouchableOpacity>

        {locationError ? (
          <View style={styles.locationError}>
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        ) : null}

        {/* Section 1: Recipient Contact Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <User size={15} color="#6E4F37" />
            </View>
            <Text style={styles.sectionTitle}>Thông tin người nhận</Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Họ và tên người nhận <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <User size={17} color="#9C8B7A" />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="VD: Nguyễn Minh Anh"
                placeholderTextColor="#B5A698"
              />
            </View>
          </View>

          <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>
              Số điện thoại liên hệ <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <Phone size={17} color="#9C8B7A" />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="VD: 0912 345 678"
                placeholderTextColor="#B5A698"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        {/* Section 2: Delivery Address Card */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <MapPin size={15} color="#6E4F37" />
            </View>
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          </View>

          {/* City + Quick Chips */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Tỉnh / Thành phố <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <Building2 size={17} color="#9C8B7A" />
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Nhập hoặc chọn nhanh Tỉnh / Thành phố"
                placeholderTextColor="#B5A698"
              />
            </View>
            <View style={styles.quickChipsWrap}>
              {QUICK_CITIES.map((c) => {
                const active = city.trim().toLowerCase() === c.toLowerCase();
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.quickChip,
                      active && styles.quickChipActive,
                    ]}
                    onPress={() => setCity(c)}
                    activeOpacity={0.75}>
                    <Text
                      style={[
                        styles.quickChipText,
                        active && styles.quickChipTextActive,
                      ]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 2-Column Row: District & Ward */}
          <View style={styles.twoColRow}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Quận / Huyện</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={district}
                  onChangeText={setDistrict}
                  placeholder="VD: Quận 1"
                  placeholderTextColor="#B5A698"
                />
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Phường / Xã</Text>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={ward}
                  onChangeText={setWard}
                  placeholder="VD: Bến Nghé"
                  placeholderTextColor="#B5A698"
                />
              </View>
            </View>
          </View>

          {suggestedDistricts.length > 0 && (
            <View style={[styles.quickChipsWrap, { marginTop: -6, marginBottom: 14 }]}>
              {suggestedDistricts.map((d) => {
                const active = district.trim().toLowerCase() === d.toLowerCase();
                return (
                  <TouchableOpacity
                    key={d}
                    style={[
                      styles.quickChip,
                      active && styles.quickChipActive,
                    ]}
                    onPress={() => setDistrict(d)}
                    activeOpacity={0.75}>
                    <Text
                      style={[
                        styles.quickChipText,
                        active && styles.quickChipTextActive,
                      ]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Street / Detail Address */}
          <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>
              Số nhà, tên đường, tòa nhà <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputBox}>
              <MapPin size={17} color="#9C8B7A" />
              <TextInput
                style={styles.input}
                value={detailAddress}
                onChangeText={setDetailAddress}
                placeholder="VD: 123 Nguyễn Huệ, Lầu 2"
                placeholderTextColor="#B5A698"
              />
            </View>
          </View>
        </View>

        {/* Section 3: Address Type & Default Toggle */}
        <View style={styles.sectionCard}>
          <View style={styles.tagRow}>
            <Text style={styles.fieldLabelInline}>Loại địa chỉ</Text>
            <View style={styles.tagPillsRight}>
              <TouchableOpacity
                style={[
                  styles.typePill,
                  addressTag === 'home' && styles.typePillActive,
                ]}
                onPress={() => setAddressTag('home')}
                activeOpacity={0.8}>
                <Home
                  size={14}
                  color={addressTag === 'home' ? '#3D2B1F' : '#8C7A6B'}
                />
                <Text
                  style={[
                    styles.typePillText,
                    addressTag === 'home' && styles.typePillTextActive,
                  ]}>
                  Nhà riêng
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.typePill,
                  addressTag === 'office' && styles.typePillActive,
                ]}
                onPress={() => setAddressTag('office')}
                activeOpacity={0.8}>
                <Briefcase
                  size={14}
                  color={addressTag === 'office' ? '#3D2B1F' : '#8C7A6B'}
                />
                <Text
                  style={[
                    styles.typePillText,
                    addressTag === 'office' && styles.typePillTextActive,
                  ]}>
                  Văn phòng
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.cardDivider} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.switchLabel}>Đặt làm địa chỉ mặc định</Text>
              <Text style={styles.switchSublabel}>
                Tự động chọn địa chỉ này khi bạn thanh toán đơn hàng
              </Text>
            </View>
            <Switch
              value={isDefault}
              onValueChange={setIsDefault}
              trackColor={{ false: '#E2D8CC', true: '#C8A98E' }}
              thumbColor={isDefault ? '#5C4033' : '#FFFDF9'}
            />
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky Bottom Save Button Bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}>
        <View style={styles.bottomBarInner}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            activeOpacity={0.85}>
            <Check size={18} color="#FFFDF9" strokeWidth={2.5} />
            <Text style={styles.saveBtnText}>
              {existing ? 'Lưu thay đổi địa chỉ' : 'Hoàn tất & Lưu địa chỉ'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  headerWrap: {
    backgroundColor: '#FAF7F2',
    borderBottomWidth: 1,
    borderBottomColor: '#EFE7DC',
  },
  headerInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleBox: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8C7A6B',
    marginTop: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: 14,
  },

  /* GPS Quick Fill Card */
  gpsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F4ECE1',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2D4C3',
    marginBottom: 14,
  },
  gpsCardSuccess: {
    backgroundColor: '#EDF6EE',
    borderColor: '#B8DCBD',
  },
  gpsCardDisabled: {
    opacity: 0.65,
  },
  gpsIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D8C8',
  },
  gpsTextCol: {
    flex: 1,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  gpsSubtitle: {
    fontSize: 12,
    color: '#7D6B5D',
    marginTop: 2,
  },
  gpsActionPill: {
    backgroundColor: '#5C4033',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  gpsActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFDF9',
  },
  locationError: {
    backgroundColor: '#FDF0ED',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  locationErrorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },

  /* Section Cards */
  sectionCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    ...SHADOWS.small,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F4ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4738',
    marginBottom: 6,
  },
  requiredStar: {
    color: '#D9534F',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: '#3D2B1F',
    paddingVertical: 8,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#F5EFE6',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  quickChipActive: {
    backgroundColor: '#EADBC8',
    borderColor: '#6E4F37',
  },
  quickChipText: {
    fontSize: 12,
    color: '#6E5A4B',
    fontWeight: '500',
  },
  quickChipTextActive: {
    color: '#3D2B1F',
    fontWeight: '700',
  },

  /* Address Type & Default Switch */
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  fieldLabelInline: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  tagPillsRight: {
    flexDirection: 'row',
    gap: 8,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FAF7F2',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  typePillActive: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
  },
  typePillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#7D6B5D',
  },
  typePillTextActive: {
    color: '#3D2B1F',
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#F0E8DD',
    marginVertical: 14,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  switchSublabel: {
    fontSize: 12,
    color: '#8C7A6B',
    marginTop: 2,
  },

  /* Sticky Bottom Bar */
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 253, 249, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#EAE0D3',
    paddingTop: 10,
    paddingHorizontal: SPACING.lg,
  },
  bottomBarInner: {
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5C4033',
    borderRadius: 14,
    paddingVertical: 14,
    ...SHADOWS.small,
  },
  saveBtnText: {
    fontSize: 15.5,
    fontWeight: '700',
    color: '#FFFDF9',
  },
});
