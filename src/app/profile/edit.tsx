import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Home, Check } from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import {
  ANIMAL_AVATARS,
  BrandAvatar,
  getAnimalAvatar,
} from '@/components/BrandTitle';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, guestAvatar, updateProfile, updateAvatar } = useAuth();
  const initialAnimal = getAnimalAvatar(
    user?.avatar ?? (!user ? guestAvatar : undefined),
    user?.id || user?.email || user?.name
  );
  const [name, setName] = useState(user?.name ?? '');
  const [selectedAvatar, setSelectedAvatar] = useState(initialAnimal.id);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (user && !name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.');
      return;
    }
    setSaving(true);
    if (user) {
      await updateProfile(name.trim(), selectedAvatar);
    } else {
      await updateAvatar(selectedAvatar);
    }
    setSaving(false);
    if (router.canGoBack()) router.back();
    else router.replace('/profile');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/profile');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.homeBtn}
            onPress={() => router.replace('/')}>
            <Home size={20} color={COLORS.darkText} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Chỉnh sửa hồ sơ</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.form}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={styles.avatarPreviewWrap}>
          <BrandAvatar size={92} avatarId={selectedAvatar} />
          <Text style={styles.avatarPreviewLabel}>
            {getAnimalAvatar(selectedAvatar).name}
          </Text>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Chọn ảnh đại diện thú cưng</Text>
          <View style={styles.animalGrid}>
            {ANIMAL_AVATARS.map((item) => {
              const active = selectedAvatar === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.animalOption,
                    { backgroundColor: item.bg },
                    active && [
                      styles.animalOptionActive,
                      { borderColor: item.border },
                    ],
                  ]}
                  onPress={() => setSelectedAvatar(item.id)}
                  activeOpacity={0.8}>
                  <Text style={styles.animalEmoji}>{item.emoji}</Text>
                  <Text
                    style={[
                      styles.animalName,
                      active && styles.animalNameActive,
                    ]}
                    numberOfLines={1}>
                    {item.name}
                  </Text>
                  {active && (
                    <View
                      style={[
                        styles.activeCheckBadge,
                        { backgroundColor: item.border },
                      ]}>
                      <Check size={10} color="#FFF" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {user ? (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View style={styles.inputDisabled}>
                <Text style={styles.disabledText}>{user.email}</Text>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Tên hiển thị</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Nhập tên hiển thị"
                placeholderTextColor={COLORS.lightText}
              />
            </View>
          </>
        ) : null}

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.cream },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
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
  form: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: 60,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  avatarPreviewWrap: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  avatarPreviewLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: '#5C4332',
  },
  animalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  animalOption: {
    width: '22.8%',
    flexGrow: 1,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5D8C8',
    position: 'relative',
  },
  animalOptionActive: {
    borderWidth: 2.5,
    ...SHADOWS.small,
  },
  animalEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  animalName: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#6E5A4B',
  },
  animalNameActive: {
    fontWeight: '800',
    color: '#3D2B1F',
  },
  activeCheckBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: { width: '100%', marginBottom: SPACING.lg },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.xs,
  },
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
  inputDisabled: {
    backgroundColor: COLORS.softBeige,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  disabledText: { fontSize: 15, color: COLORS.lightText },
  saveBtn: {
    width: '100%',
    backgroundColor: '#5C4033',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: SPACING.sm,
    ...SHADOWS.small,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
  },
});
