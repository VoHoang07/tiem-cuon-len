import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import {
    QUICK_CITIES,
    VIETNAM_PROVINCES,
    fetchDistrictsForCity,
    fetchWardsForDistrict,
    getBuiltinDistrictsForCity,
    getBuiltinWardsForDistrict,
    matchVietnamProvince,
    parseSmartVietnameseAddress,
    removeVietnameseTones,
} from '@/data/vietnamLocations';
import {
    searchVietnamAddressSuggestions,
    useAutoLocation,
    type ResolvedAddress,
} from '@/hooks/useAutoLocation';
import { useAddresses } from '@/store/AddressContext';
import { useAuth } from '@/store/AuthContext';
import { validateVietnamRealPhone } from '@/utils/contactTrustValidator';
import { validateAddressSchema } from '@/utils/schemaValidator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    Briefcase,
    Building2,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronUp,
    Home,
    MapPin,
    Navigation,
    Phone,
    Search,
    Sparkles,
    User,
    X,
} from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const ADDRESS_DRAFT_SESSION_KEY = '__tcl_add_address_draft_v1';

export default function AddAddressScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const isCompactMobile = windowWidth < 480;
  const { user } = useAuth();
  const { userAddresses, addAddress, updateAddress } = useAddresses();

  const existing = id ? userAddresses.find((a) => a.id === id) : undefined;

  const savedDraft = useMemo(() => {
    if (existing) return null;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const raw = window.sessionStorage.getItem(ADDRESS_DRAFT_SESSION_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return null;
  }, [existing]);

  const [fullName, setFullName] = useState(
    existing?.fullName ?? savedDraft?.fullName ?? user?.name ?? ''
  );
  const [phone, setPhone] = useState(existing?.phone ?? savedDraft?.phone ?? '');
  const phoneTrust = useMemo(() => validateVietnamRealPhone(phone), [phone]);
  const phoneDigitsOnly = phone.replace(/[^0-9]/g, '');
  const [city, setCity] = useState(existing?.city ?? savedDraft?.city ?? '');
  const [district, setDistrict] = useState(
    existing?.district ?? savedDraft?.district ?? ''
  );
  const [ward, setWard] = useState(existing?.ward ?? savedDraft?.ward ?? '');
  const [detailAddress, setDetailAddress] = useState(
    existing?.detailAddress ?? savedDraft?.detailAddress ?? ''
  );
  const [addressTag, setAddressTag] = useState<'home' | 'office'>(
    existing?.addressTag === 'office' || savedDraft?.addressTag === 'office'
      ? 'office'
      : 'home'
  );
  const [isDefault, setIsDefault] = useState(
    existing?.isDefault ?? savedDraft?.isDefault ?? userAddresses.length === 0
  );

  // Administrative cascading state (63 Provinces -> Districts -> Wards)
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [availableDistricts, setAvailableDistricts] = useState<string[]>(() =>
    getBuiltinDistrictsForCity(existing?.city ?? savedDraft?.city ?? '')
  );
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [showAllDistricts, setShowAllDistricts] = useState(false);

  const [availableWards, setAvailableWards] = useState<string[]>(() =>
    getBuiltinWardsForDistrict(existing?.district ?? savedDraft?.district ?? '')
  );
  const [loadingWards, setLoadingWards] = useState(false);
  const [showAllWards, setShowAllWards] = useState(false);

  // Smart Address Search / Paste state
  const [smartSearchQuery, setSmartSearchQuery] = useState('');
  const [smartSuggestions, setSmartSuggestions] = useState<ResolvedAddress[]>([]);
  const [searchingAddress, setSearchingAddress] = useState(false);
  const [smartParseSuccess, setSmartParseSuccess] = useState<string | null>(null);

  // Persist draft address inputs to sessionStorage while typing
  useEffect(() => {
    if (existing) return;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem(
          ADDRESS_DRAFT_SESSION_KEY,
          JSON.stringify({
            fullName,
            phone,
            city,
            district,
            ward,
            detailAddress,
            addressTag,
            isDefault,
          })
        );
      }
    } catch {
      // ignore
    }
  }, [
    existing,
    fullName,
    phone,
    city,
    district,
    ward,
    detailAddress,
    addressTag,
    isDefault,
  ]);

  // Load districts whenever `city` changes
  useEffect(() => {
    let active = true;
    const trimmedCity = city.trim();
    if (!trimmedCity) {
      setAvailableDistricts([]);
      return;
    }
    const builtin = getBuiltinDistrictsForCity(trimmedCity);
    if (builtin.length > 0) {
      setAvailableDistricts(builtin);
    }
    setLoadingDistricts(true);
    fetchDistrictsForCity(trimmedCity)
      .then((list) => {
        if (active && list.length > 0) {
          setAvailableDistricts(list);
        }
      })
      .finally(() => {
        if (active) setLoadingDistricts(false);
      });
    return () => {
      active = false;
    };
  }, [city]);

  // Load wards whenever `city` or `district` changes
  useEffect(() => {
    let active = true;
    const trimmedDistrict = district.trim();
    if (!trimmedDistrict) {
      setAvailableWards([]);
      return;
    }
    const builtin = getBuiltinWardsForDistrict(trimmedDistrict);
    if (builtin.length > 0) {
      setAvailableWards(builtin);
    }
    setLoadingWards(true);
    fetchWardsForDistrict(city, trimmedDistrict)
      .then((list) => {
        if (active && list.length > 0) {
          setAvailableWards(list);
        }
      })
      .finally(() => {
        if (active) setLoadingWards(false);
      });
    return () => {
      active = false;
    };
  }, [city, district]);

  // Debounced live address search via OpenStreetMap Nominatim
  useEffect(() => {
    const q = smartSearchQuery.trim();
    if (q.length < 3) {
      setSmartSuggestions([]);
      setSearchingAddress(false);
      return;
    }

    let cancelled = false;
    setSearchingAddress(true);
    const timer = setTimeout(async () => {
      const results = await searchVietnamAddressSuggestions(q, city);
      if (!cancelled) {
        setSmartSuggestions(results);
        setSearchingAddress(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [smartSearchQuery, city]);

  const [showErrorShake, setShowErrorShake] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const triggerFormShake = (msg: string) => {
    setShowErrorShake(true);
    setErrorMessage(msg);
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -4, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const {
    getCurrentLocation,
    loading: locationLoading,
    error: locationError,
    setError: setLocationError,
    notice: locationNotice,
    setNotice: setLocationNotice,
  } = useAutoLocation();
  const [locationSuccess, setLocationSuccess] = useState(false);

  const handleAutoLocation = async () => {
    setLocationError(null);
    setLocationNotice(null);
    setLocationSuccess(false);
    setSmartParseSuccess(null);

    const resolved = await getCurrentLocation();
    if (resolved) {
      if (resolved.city) setCity(resolved.city);
      if (resolved.district) setDistrict(resolved.district);
      if (resolved.ward) setWard(resolved.ward);
      if (resolved.detailAddress) setDetailAddress(resolved.detailAddress);
      setLocationSuccess(true);
      if (errorMessage) setErrorMessage(null);
    }
  };

  const handleApplyResolvedSuggestion = (item: ResolvedAddress) => {
    if (item.city) setCity(item.city);
    if (item.district) setDistrict(item.district);
    if (item.ward) setWard(item.ward);
    if (item.detailAddress) setDetailAddress(item.detailAddress);
    setSmartSuggestions([]);
    setSmartSearchQuery('');
    setLocationError(null);
    setErrorMessage(null);
    setSmartParseSuccess('Đã tự động điền địa chỉ từ kết quả tìm kiếm!');
  };

  const handleSmartParseAddress = () => {
    const raw = smartSearchQuery.trim();
    if (!raw) return;

    if (smartSuggestions.length > 0) {
      handleApplyResolvedSuggestion(smartSuggestions[0]);
      return;
    }

    const parsed = parseSmartVietnameseAddress(raw);
    if (parsed.city) setCity(parsed.city);
    if (parsed.district) setDistrict(parsed.district);
    if (parsed.ward) setWard(parsed.ward);
    if (parsed.detailAddress) setDetailAddress(parsed.detailAddress);
    setSmartSearchQuery('');
    setSmartSuggestions([]);
    setLocationError(null);
    setErrorMessage(null);
    setSmartParseSuccess('Đã tách và điền nhanh địa chỉ vào các ô bên dưới!');
  };

  const handleSelectCityChip = (selectedCity: string) => {
    const isDifferent =
      removeVietnameseTones(city) !== removeVietnameseTones(selectedCity);
    setCity(selectedCity);
    if (isDifferent) {
      setDistrict('');
      setWard('');
    }
    setShowAllProvinces(false);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSelectDistrictChip = (selectedDistrict: string) => {
    const isDifferent =
      removeVietnameseTones(district) !== removeVietnameseTones(selectedDistrict);
    setDistrict(selectedDistrict);
    if (isDifferent) {
      setWard('');
    }
    setShowAllDistricts(false);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSelectWardChip = (selectedWard: string) => {
    setWard(selectedWard);
    setShowAllWards(false);
    if (errorMessage) setErrorMessage(null);
  };

  // Filtered provinces when user types in City input or expands all 63 provinces
  const displayedProvinces = useMemo(() => {
    const q = removeVietnameseTones(city);
    const isExactMatch = VIETNAM_PROVINCES.some(
      (p) => removeVietnameseTones(p) === q
    );
    if (q.length >= 1 && !isExactMatch) {
      const matches = VIETNAM_PROVINCES.filter((p) =>
        removeVietnameseTones(p).includes(q)
      );
      if (matches.length > 0) return matches.slice(0, 18);
    }
    if (showAllProvinces) {
      return VIETNAM_PROVINCES;
    }
    return QUICK_CITIES;
  }, [city, showAllProvinces]);

  // Filtered districts based on selected City & user typing in District input
  const displayedDistricts = useMemo(() => {
    if (availableDistricts.length === 0) return [];
    const q = removeVietnameseTones(district);
    const isExactMatch = availableDistricts.some(
      (d) => removeVietnameseTones(d) === q
    );
    if (q.length >= 1 && !isExactMatch) {
      const matches = availableDistricts.filter((d) =>
        removeVietnameseTones(d).includes(q)
      );
      if (matches.length > 0) return matches;
    }
    return showAllDistricts
      ? availableDistricts
      : availableDistricts.slice(0, 8);
  }, [availableDistricts, district, showAllDistricts]);

  // Filtered wards based on selected District & user typing in Ward input
  const displayedWards = useMemo(() => {
    if (availableWards.length === 0) return [];
    const q = removeVietnameseTones(ward);
    const isExactMatch = availableWards.some(
      (w) => removeVietnameseTones(w) === q
    );
    if (q.length >= 1 && !isExactMatch) {
      const matches = availableWards.filter((w) =>
        removeVietnameseTones(w).includes(q)
      );
      if (matches.length > 0) return matches;
    }
    return showAllWards ? availableWards : availableWards.slice(0, 8);
  }, [availableWards, ward, showAllWards]);

  const handleSave = () => {
    const canonicalCity = matchVietnamProvince(city) || city.trim();
    const validation = validateAddressSchema({
      fullName,
      phone,
      city: canonicalCity,
      district,
      ward,
      detailAddress,
      isDefault,
    });

    if (!validation.success || !validation.data) {
      const msg =
        validation.error ||
        'Vui lòng điền đầy đủ Họ tên, Số điện thoại, Tỉnh/Thành phố và Địa chỉ cụ thể.';
      triggerFormShake(msg);
      return;
    }
    setShowErrorShake(false);
    setErrorMessage(null);

    const clean = validation.data;

    if (existing) {
      if (existing.userId !== (user?.id ?? '')) {
        Alert.alert('Từ chối truy cập', 'Bạn không có quyền chỉnh sửa địa chỉ này.');
        return;
      }
      updateAddress(existing.id, {
        fullName: clean.fullName,
        phone: clean.phone,
        city: clean.city,
        district: clean.district,
        ward: clean.ward,
        detailAddress: clean.detailAddress,
        isDefault: clean.isDefault,
        addressTag,
      });
      if (router.canGoBack()) router.back();
      else router.replace('/addresses');
    } else {
      const added = addAddress({
        userId: user?.id ?? '',
        fullName: clean.fullName,
        phone: clean.phone,
        city: clean.city,
        district: clean.district,
        ward: clean.ward,
        detailAddress: clean.detailAddress,
        isDefault: clean.isDefault,
        addressTag,
      });
      if (!added) {
        Alert.alert('Địa chỉ trùng', 'Địa chỉ này đã tồn tại trong sổ địa chỉ.');
        return;
      }
      try {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.removeItem(ADDRESS_DRAFT_SESSION_KEY);
        }
      } catch {
        // ignore
      }
      if (router.canGoBack()) router.back();
      else router.replace('/addresses');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top Header */}
      <View style={styles.headerWrap}>
        <View
          style={[
            styles.headerInner,
            isCompactMobile && { paddingHorizontal: 12 },
          ]}>
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
          <View style={{ width: isCompactMobile ? 44 : 76 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isCompactMobile && { paddingHorizontal: 12 },
        ]}
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

        {locationNotice ? (
          <View style={styles.locationNotice}>
            <Text style={styles.locationNoticeText}>💡 {locationNotice}</Text>
          </View>
        ) : null}

        {locationError ? (
          <View style={styles.locationError}>
            <Text style={styles.locationErrorText}>{locationError}</Text>
          </View>
        ) : null}

        {smartParseSuccess ? (
          <View style={styles.smartSuccessBanner}>
            <Check size={15} color="#2E7D32" strokeWidth={2.5} />
            <Text style={styles.smartSuccessText}>{smartParseSuccess}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.locationError}>
            <Text style={styles.locationErrorText}>⚠️ {errorMessage}</Text>
          </View>
        ) : null}

        {/* Smart Search & Paste Full Address Card */}
        <View style={styles.smartSearchCard}>
          <View style={styles.smartSearchHeader}>
            <Sparkles size={14} color="#6E4F37" />
            <Text style={styles.smartSearchTitle}>
              Tìm kiếm địa chỉ hoặc dán nhanh địa chỉ đầy đủ
            </Text>
          </View>
          <View style={styles.smartSearchInputRow}>
            <Search size={16} color="#8C7A6B" />
            <TextInput
              style={styles.smartSearchInput}
              value={smartSearchQuery}
              onChangeText={(txt) => {
                setSmartSearchQuery(txt);
                if (smartParseSuccess) setSmartParseSuccess(null);
              }}
              onSubmitEditing={handleSmartParseAddress}
              placeholder="Gõ tên đường, tòa nhà hoặc dán: 123 Nguyễn Huệ, Bến Nghé, Q1, TP.HCM"
              placeholderTextColor="#B5A698"
            />
            {searchingAddress ? (
              <ActivityIndicator size="small" color="#6E4F37" />
            ) : smartSearchQuery.trim().length > 0 ? (
              <>
                <TouchableOpacity
                  onPress={() => {
                    setSmartSearchQuery('');
                    setSmartSuggestions([]);
                  }}
                  style={styles.clearIconBtn}>
                  <X size={14} color="#8C7A6B" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smartApplyBtn}
                  onPress={handleSmartParseAddress}
                  activeOpacity={0.8}>
                  <Text style={styles.smartApplyBtnText}>Điền nhanh</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>

          {smartSuggestions.length > 0 && (
            <View style={styles.suggestionsList}>
              {smartSuggestions.map((item, idx) => (
                <TouchableOpacity
                  key={`${item.label}_${idx}`}
                  style={[
                    styles.suggestionItem,
                    idx === smartSuggestions.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => handleApplyResolvedSuggestion(item)}
                  activeOpacity={0.75}>
                  <MapPin size={15} color="#6E4F37" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionMainText} numberOfLines={2}>
                      {item.label}
                    </Text>
                    <Text style={styles.suggestionSubText}>
                      {[item.ward, item.district, item.city]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                  <Text style={styles.suggestionSelectLabel}>Chọn</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Section 1: Recipient Contact Card */}
        <Animated.View
          style={[
            styles.sectionCard,
            showErrorShake &&
              (fullName.trim().length < 2 || phone.replace(/[^0-9]/g, '').length < 9) &&
              styles.sectionCardError,
            { transform: [{ translateX: shakeAnim }] },
          ]}>
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
            <View
              style={[
                styles.inputBox,
                showErrorShake && fullName.trim().length < 2 && styles.inputBoxError,
              ]}>
              <User
                size={17}
                color={showErrorShake && fullName.trim().length < 2 ? '#DC2626' : '#9C8B7A'}
              />
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={(txt) => {
                  setFullName(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="VD: Nguyễn Minh Anh"
                placeholderTextColor="#B5A698"
              />
            </View>
          </View>

          <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>
              Số điện thoại liên hệ <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                (showErrorShake && !phoneTrust.valid) ||
                (phoneDigitsOnly.length >= 10 && !phoneTrust.valid)
                  ? styles.inputBoxError
                  : phoneTrust.valid
                  ? { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }
                  : null,
              ]}>
              <Phone
                size={17}
                color={
                  (showErrorShake && !phoneTrust.valid) ||
                  (phoneDigitsOnly.length >= 10 && !phoneTrust.valid)
                    ? '#DC2626'
                    : phoneTrust.valid
                    ? '#16A34A'
                    : '#9C8B7A'
                }
              />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={(txt) => {
                  setPhone(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="VD: 0912 345 678 (Viettel, Vina, Mobi...)"
                placeholderTextColor="#B5A698"
                keyboardType="phone-pad"
                maxLength={12}
              />
            </View>

            {/* Real-time Carrier Verification or Anti-Fake Phone Feedback */}
            {phoneTrust.valid ? (
              <View
                style={{
                  marginTop: 7,
                  backgroundColor: '#ECFDF5',
                  borderWidth: 1,
                  borderColor: '#A7F3D0',
                  borderRadius: 9,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '800',
                    color: '#065F46',
                  }}>
                  ✅ SĐT nhà mạng {phoneTrust.carrier} hợp lệ — Shipper sẽ gọi số này khi giao hàng tận tay bạn
                </Text>
              </View>
            ) : phoneDigitsOnly.length >= 10 && phoneTrust.error ? (
              <View
                style={{
                  marginTop: 7,
                  backgroundColor: '#FEF2F2',
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  borderRadius: 9,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '700',
                    color: '#B91C1C',
                    lineHeight: 16,
                  }}>
                  ⚠️ {phoneTrust.error}
                </Text>
              </View>
            ) : null}

            {/* Customer Privacy & COD Open-Box Inspection Trust Shield */}
            <View
              style={{
                marginTop: 9,
                backgroundColor: '#FFFBEB',
                borderWidth: 1,
                borderColor: '#FDE68A',
                borderRadius: 10,
                paddingHorizontal: 11,
                paddingVertical: 8,
                gap: 3,
              }}>
              <Text
                style={{
                  fontSize: 11.5,
                  fontWeight: '800',
                  color: '#92400E',
                }}>
                🛡️ Cam kết bảo vệ khách hàng từ Tiệm Cuộn Len:
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: '#78350F',
                  lineHeight: 16,
                }}>
                • <Text style={{ fontWeight: '800' }}>Được Đồng Kiểm 100%:</Text> Bạn được mở hộp kiểm tra đúng mẫu len, đúng màu mới thanh toán cho Shipper.{'\n'}
                • <Text style={{ fontWeight: '800' }}>Bảo mật SĐT tuyệt đối:</Text> SĐT chỉ dùng để Bưu tá gọi giao hàng — Tiệm cam kết <Text style={{ fontWeight: '800' }}>không bao giờ gọi làm phiền/quảng cáo</Text>.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Section 2: Delivery Address Card */}
        <Animated.View
          style={[
            styles.sectionCard,
            showErrorShake &&
              (city.trim().length < 2 || detailAddress.trim().length < 3) &&
              styles.sectionCardError,
            { transform: [{ translateX: shakeAnim }] },
          ]}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionIconBadge}>
              <MapPin size={15} color="#6E4F37" />
            </View>
            <Text style={styles.sectionTitle}>Địa chỉ giao hàng</Text>
          </View>

          {/* City + 63 Provinces Quick Selector */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRowBetween}>
              <Text style={styles.fieldLabel}>
                Tỉnh / Thành phố <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.expandToggleBtn}
                onPress={() => setShowAllProvinces((prev) => !prev)}
                activeOpacity={0.75}>
                <Text style={styles.expandToggleText}>
                  {showAllProvinces ? 'Thu gọn danh sách' : 'Chọn từ 63 Tỉnh/Thành'}
                </Text>
                {showAllProvinces ? (
                  <ChevronUp size={14} color="#6E4F37" />
                ) : (
                  <ChevronDown size={14} color="#6E4F37" />
                )}
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.inputBox,
                showErrorShake && city.trim().length < 2 && styles.inputBoxError,
              ]}>
              <Building2
                size={17}
                color={showErrorShake && city.trim().length < 2 ? '#DC2626' : '#9C8B7A'}
              />
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={(txt) => {
                  setCity(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="Nhập hoặc chọn nhanh Tỉnh / Thành phố"
                placeholderTextColor="#B5A698"
              />
              {city.length > 0 && (
                <TouchableOpacity
                  onPress={() => {
                    setCity('');
                    setDistrict('');
                    setWard('');
                  }}
                  style={styles.clearIconBtn}>
                  <X size={14} color="#8C7A6B" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.quickChipsWrap}>
              {displayedProvinces.map((c) => {
                const active =
                  removeVietnameseTones(city) === removeVietnameseTones(c);
                return (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.quickChip,
                      active && styles.quickChipActive,
                    ]}
                    onPress={() => handleSelectCityChip(c)}
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
              {!showAllProvinces && displayedProvinces.length <= QUICK_CITIES.length && (
                <TouchableOpacity
                  style={styles.moreChipBtn}
                  onPress={() => setShowAllProvinces(true)}
                  activeOpacity={0.75}>
                  <Text style={styles.moreChipBtnText}>+ Tất cả 63 Tỉnh/Thành</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 2-Column Row: District & Ward */}
          <View
            style={[
              styles.twoColRow,
              isCompactMobile && { flexDirection: 'column', gap: 0 },
            ]}>
            <View style={[styles.fieldGroup, { flex: 1, minWidth: 0 }]}>
              <View style={styles.labelRowBetween}>
                <Text style={styles.fieldLabel}>Quận / Huyện</Text>
                {loadingDistricts && (
                  <ActivityIndicator size="small" color="#8C7A6B" />
                )}
              </View>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={district}
                  onChangeText={(txt) => {
                    setDistrict(txt);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="VD: Quận 1"
                  placeholderTextColor="#B5A698"
                />
                {district.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setDistrict('');
                      setWard('');
                    }}
                    style={styles.clearIconBtn}>
                    <X size={14} color="#8C7A6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <View style={[styles.fieldGroup, { flex: 1, minWidth: 0 }]}>
              <View style={styles.labelRowBetween}>
                <Text style={styles.fieldLabel}>Phường / Xã</Text>
                {loadingWards && (
                  <ActivityIndicator size="small" color="#8C7A6B" />
                )}
              </View>
              <View style={styles.inputBox}>
                <TextInput
                  style={styles.input}
                  value={ward}
                  onChangeText={(txt) => {
                    setWard(txt);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="VD: Phường Bến Nghé"
                  placeholderTextColor="#B5A698"
                />
                {ward.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setWard('')}
                    style={styles.clearIconBtn}>
                    <X size={14} color="#8C7A6B" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Dynamic District Quick Chips */}
          {displayedDistricts.length > 0 && (
            <View style={styles.cascadingGroupBox}>
              <View style={styles.cascadingGroupHeader}>
                <Text style={styles.cascadingGroupLabel}>
                  Gợi ý Quận / Huyện ({city.trim() || 'Tỉnh đã chọn'}):
                </Text>
                {availableDistricts.length > 8 && (
                  <TouchableOpacity
                    onPress={() => setShowAllDistricts((prev) => !prev)}>
                    <Text style={styles.expandToggleText}>
                      {showAllDistricts
                        ? 'Thu gọn'
                        : `Xem hết (${availableDistricts.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.quickChipsWrap}>
                {displayedDistricts.map((d) => {
                  const active =
                    removeVietnameseTones(district) === removeVietnameseTones(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.quickChip,
                        active && styles.quickChipActive,
                      ]}
                      onPress={() => handleSelectDistrictChip(d)}
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
            </View>
          )}

          {/* Dynamic Ward Quick Chips */}
          {displayedWards.length > 0 && (
            <View style={styles.cascadingGroupBox}>
              <View style={styles.cascadingGroupHeader}>
                <Text style={styles.cascadingGroupLabel}>
                  Gợi ý Phường / Xã ({district.trim()}):
                </Text>
                {availableWards.length > 8 && (
                  <TouchableOpacity
                    onPress={() => setShowAllWards((prev) => !prev)}>
                    <Text style={styles.expandToggleText}>
                      {showAllWards
                        ? 'Thu gọn'
                        : `Xem hết (${availableWards.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.quickChipsWrap}>
                {displayedWards.map((w) => {
                  const active =
                    removeVietnameseTones(ward) === removeVietnameseTones(w);
                  return (
                    <TouchableOpacity
                      key={w}
                      style={[
                        styles.quickChip,
                        active && styles.quickChipActive,
                      ]}
                      onPress={() => handleSelectWardChip(w)}
                      activeOpacity={0.75}>
                      <Text
                        style={[
                          styles.quickChipText,
                          active && styles.quickChipTextActive,
                        ]}>
                        {w}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Street / Detail Address */}
          <View style={[styles.fieldGroup, { marginBottom: 0 }]}>
            <Text style={styles.fieldLabel}>
              Số nhà, tên đường, tòa nhà <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={[
                styles.inputBox,
                showErrorShake && detailAddress.trim().length < 3 && styles.inputBoxError,
              ]}>
              <MapPin
                size={17}
                color={
                  showErrorShake && detailAddress.trim().length < 3 ? '#DC2626' : '#9C8B7A'
                }
              />
              <TextInput
                style={styles.input}
                value={detailAddress}
                onChangeText={(txt) => {
                  setDetailAddress(txt);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="VD: 123 Nguyễn Huệ, Lầu 2"
                placeholderTextColor="#B5A698"
              />
            </View>
          </View>
        </Animated.View>

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
          isCompactMobile && { paddingHorizontal: 12 },
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
    flex: 1,
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
    marginBottom: 12,
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
    minWidth: 0,
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
  locationNotice: {
    backgroundColor: '#FFF8EB',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1D6A7',
  },
  locationNoticeText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#7A5216',
    lineHeight: 18,
  },
  locationError: {
    backgroundColor: '#FDF0ED',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F5C6CB',
  },
  locationErrorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  smartSuccessBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#EDF6EE',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#B8DCBD',
  },
  smartSuccessText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#2E7D32',
  },

  /* Smart Search & Paste Box */
  smartSearchCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  smartSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  smartSearchTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5C4033',
  },
  smartSearchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FAF7F2',
    borderRadius: 11,
    paddingHorizontal: 10,
    minHeight: 42,
    borderWidth: 1,
    borderColor: '#E5DBD0',
  },
  smartSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 13.5,
    color: '#3D2B1F',
    paddingVertical: 6,
  },
  clearIconBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFE7DC',
  },
  smartApplyBtn: {
    backgroundColor: '#6E4F37',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  smartApplyBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFDF9',
  },
  suggestionsList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EFE7DC',
    paddingTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3ECE2',
  },
  suggestionMainText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3D2B1F',
    lineHeight: 18,
  },
  suggestionSubText: {
    fontSize: 11.5,
    color: '#8C7A6B',
    marginTop: 2,
  },
  suggestionSelectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4033',
    alignSelf: 'center',
    paddingLeft: 6,
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
  sectionCardError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
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
  labelRowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5C4738',
    marginBottom: 4,
  },
  expandToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 2,
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E4F37',
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
  inputBoxError: {
    borderColor: '#DC2626',
    borderWidth: 1.5,
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 14.5,
    color: '#3D2B1F',
    paddingVertical: 8,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cascadingGroupBox: {
    backgroundColor: '#FAF7F2',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#EFE7DC',
  },
  cascadingGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cascadingGroupLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#7D6B5D',
  },
  quickChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
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
  moreChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#EFE5D8',
    borderWidth: 1,
    borderColor: '#D6C4AE',
  },
  moreChipBtnText: {
    fontSize: 12,
    color: '#5C4033',
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
    flexWrap: 'wrap',
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
