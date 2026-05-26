import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, Home } from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên hiển thị.');
      return;
    }
    setSaving(true);
    await updateProfile(name.trim());
    setSaving(false);
    if (router.canGoBack()) router.back(); else router.replace('/profile');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/profile'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/')}>
            <Home size={20} color={COLORS.darkText} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Chỉnh sửa Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.form}>
        <View style={styles.avatar}>
          <User size={40} color={COLORS.primary} />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email</Text>
          <View style={styles.inputDisabled}>
            <Text style={styles.disabledText}>{user?.email}</Text>
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

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}>
          <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
        </TouchableOpacity>
      </View>
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
  form: { paddingHorizontal: SPACING.lg, alignItems: 'center', paddingTop: SPACING.xxl },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: SPACING.xxl,
    ...SHADOWS.medium,
  },
  fieldGroup: { width: '100%', marginBottom: SPACING.lg },
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
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: SPACING.lg,
    ...SHADOWS.medium,
  },
  saveBtnText: { fontSize: 18, fontWeight: '900', fontStyle: 'italic', color: COLORS.white },
});
