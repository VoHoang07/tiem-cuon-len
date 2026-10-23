import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff, ChevronLeft, Home } from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import {
  LOGIN_EMAIL,
  LOGIN_EMAIL_PLACEHOLDER,
  LOGIN_PASSWORD,
  LOGIN_PASSWORD_PLACEHOLDER,
  LOGIN_BUTTON,
} from '@/constants/strings';
import { BrandLogo } from '@/components/BrandLogo';

export default function LoginScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCheckoutRedirect = Boolean(redirect && redirect.startsWith('/checkout'));

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập email và mật khẩu.');
      return;
    }
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.success) {
      router.replace((redirect || '/') as Href);
    } else {
      setError(result.error ?? 'Đăng nhập thất bại.');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* Top navigation to return to shop */}
          <View style={styles.topNav}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}>
              <ChevronLeft size={22} color={COLORS.darkText} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => router.replace('/')}>
              <Home size={18} color={COLORS.darkText} />
              <Text style={styles.homeBtnText}>Xem sản phẩm</Text>
            </TouchableOpacity>
          </View>

          {/* Logo / Header */}
          <View style={styles.headerSection}>
            <BrandLogo size="xl" variant="circular" />
            <Text style={styles.subtitle}>
              {isCheckoutRedirect
                ? 'Vui lòng đăng nhập để tiếp tục thanh toán'
                : 'Chào mừng trở lại'}
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{LOGIN_EMAIL}</Text>
              <View style={styles.inputContainer}>
                <Mail size={20} color={COLORS.lightText} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={LOGIN_EMAIL_PLACEHOLDER}
                  placeholderTextColor={COLORS.lightText}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{LOGIN_PASSWORD}</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color={COLORS.lightText} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={LOGIN_PASSWORD_PLACEHOLDER}
                  placeholderTextColor={COLORS.lightText}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeBtn}>
                  {showPassword ? (
                    <EyeOff size={20} color={COLORS.lightText} />
                  ) : (
                    <Eye size={20} color={COLORS.lightText} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Error */}
            {error !== '' && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginBtn, submitting && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={submitting}
              activeOpacity={0.8}>
              {submitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.loginBtnText}>{LOGIN_BUTTON}</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Register link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Chưa có tài khoản? </Text>
            <TouchableOpacity
              onPress={() =>
                router.replace(
                  redirect
                    ? { pathname: '/register', params: { redirect } }
                    : '/register'
                )
              }>
              <Text style={styles.footerLink}>Đăng ký</Text>
            </TouchableOpacity>
          </View>
          </ScrollView>
          </KeyboardAvoidingView>
          </SafeAreaView>
          );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  flex: {
    flex: 1,
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    marginTop: SPACING.md,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    ...SHADOWS.small,
  },
  homeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
    paddingBottom: 80,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.mediumText,
    marginTop: SPACING.md,
  },
  formSection: {
    gap: SPACING.lg,
  },
  fieldGroup: {
    gap: SPACING.xs,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
  },
  inputIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.darkText,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: SPACING.xs,
  },
  errorContainer: {
    backgroundColor: '#FDF0ED',
    borderRadius: 10,
    padding: SPACING.md,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
    marginTop: SPACING.sm,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnText: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.mediumText,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  });
