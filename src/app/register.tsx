import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  Home,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { BrandLogo } from '@/components/BrandLogo';

export default function RegisterScreen() {
  const router = useRouter();
  const { redirect } = useLocalSearchParams<{ redirect?: string }>();
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<
    'name' | 'email' | 'password' | 'confirm' | null
  >(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCheckoutRedirect = Boolean(redirect && redirect.startsWith('/checkout'));

  // Animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(32)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 500,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        delay: 100,
        useNativeDriver: true,
      }),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -6,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 6,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.07,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 3200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [logoScale, logoOpacity, floatAnim, pulseAnim, cardOpacity, cardTranslateY]);

  const triggerShake = () => {
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

  const handlePressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      friction: 4,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handleRegister = async () => {
    setError('');

    if (!name.trim()) {
      setError('Vui lòng nhập họ tên.');
      triggerShake();
      return;
    }
    if (!email.trim()) {
      setError('Vui lòng nhập email.');
      triggerShake();
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.');
      triggerShake();
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      triggerShake();
      return;
    }

    setSubmitting(true);
    const result = await register(name.trim(), email.trim(), password);
    setSubmitting(false);

    if (result.success) {
      router.replace((redirect || '/') as Href);
    } else {
      setError(result.error ?? 'Đăng ký thất bại.');
      triggerShake();
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Ambient Animated Background Blobs */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <Animated.View
          style={[
            styles.ambientOrbTop,
            { transform: [{ scale: pulseAnim }, { translateY: floatAnim }] },
          ]}
        />
        <Animated.View
          style={[
            styles.ambientOrbBottom,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'web' ? 'padding' : undefined}
        keyboardVerticalOffset={0}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.centerWrapper}>
            <View style={styles.topNav}>
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/');
                }}>
                <ChevronLeft size={20} color={COLORS.darkText} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.homeBtn}
                onPress={() => router.replace('/')}>
                <Home size={16} color={COLORS.primary} />
                <Text style={styles.homeBtnText}>Khám phá sản phẩm</Text>
              </TouchableOpacity>
            </View>

            <Animated.View
              style={[
                styles.card,
                {
                  opacity: cardOpacity,
                  transform: [
                    { translateY: cardTranslateY },
                    { translateX: shakeAnim },
                  ],
                },
              ]}>
              <View style={styles.headerSection}>
                <Animated.View
                  style={[
                    styles.logoWrapper,
                    {
                      opacity: logoOpacity,
                      transform: [{ scale: logoScale }, { translateY: floatAnim }],
                    },
                  ]}>
                  <View style={styles.logoGlow} />
                  <BrandLogo size="lg" variant="circular" />
                  <View style={styles.floatingBadgeRight}>
                    <Text style={styles.floatingEmoji}>🧶</Text>
                  </View>
                </Animated.View>

                <View style={styles.welcomePill}>
                  <Sparkles size={13} color={COLORS.primary} />
                  <Text style={styles.welcomePillText}>THÀNH VIÊN MỚI</Text>
                </View>

                <Text style={styles.title}>
                  {isCheckoutRedirect ? 'Đăng ký để đặt hàng' : 'Tạo tài khoản mới'}
                </Text>
                <Text style={styles.subtitle}>
                  {isCheckoutRedirect
                    ? 'Tạo tài khoản nhanh trong 10 giây để tiếp tục thanh toán đơn hàng'
                    : 'Tham gia Tiệm Cuộn Len để mua sắm và theo dõi đơn hàng dễ dàng'}
                </Text>
              </View>

              <View style={styles.formSection}>
                {/* Name */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Họ tên</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'name' && styles.inputContainerFocused,
                    ]}>
                    <View
                      style={[
                        styles.iconBadge,
                        focusedField === 'name' && styles.iconBadgeFocused,
                      ]}>
                      <User
                        size={18}
                        color={focusedField === 'name' ? COLORS.primary : COLORS.lightText}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập họ tên của bạn"
                      placeholderTextColor={COLORS.lightText}
                      value={name}
                      onChangeText={setName}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                {/* Email */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'email' && styles.inputContainerFocused,
                    ]}>
                    <View
                      style={[
                        styles.iconBadge,
                        focusedField === 'email' && styles.iconBadgeFocused,
                      ]}>
                      <Mail
                        size={18}
                        color={focusedField === 'email' ? COLORS.primary : COLORS.lightText}
                      />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Nhập email của bạn"
                      placeholderTextColor={COLORS.lightText}
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="off"
                    />
                  </View>
                </View>

                {/* Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Mật khẩu</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'password' && styles.inputContainerFocused,
                    ]}>
                    <View
                      style={[
                        styles.iconBadge,
                        focusedField === 'password' && styles.iconBadgeFocused,
                      ]}>
                      <Lock
                        size={18}
                        color={focusedField === 'password' ? COLORS.primary : COLORS.lightText}
                      />
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === 'web' && !showPassword && styles.webPasswordMask,
                      ]}
                      placeholder="Ít nhất 6 ký tự"
                      placeholderTextColor={COLORS.lightText}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={Platform.OS === 'web' ? false : !showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      textContentType="oneTimeCode"
                    />
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Xác nhận mật khẩu</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      focusedField === 'confirm' && styles.inputContainerFocused,
                    ]}>
                    <View
                      style={[
                        styles.iconBadge,
                        focusedField === 'confirm' && styles.iconBadgeFocused,
                      ]}>
                      <Lock
                        size={18}
                        color={focusedField === 'confirm' ? COLORS.primary : COLORS.lightText}
                      />
                    </View>
                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === 'web' && !showPassword && styles.webPasswordMask,
                      ]}
                      placeholder="Nhập lại mật khẩu"
                      placeholderTextColor={COLORS.lightText}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      onFocus={() => setFocusedField('confirm')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={Platform.OS === 'web' ? false : !showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      spellCheck={false}
                      autoComplete="off"
                      textContentType="oneTimeCode"
                      onSubmitEditing={handleRegister}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}>
                      {showPassword ? (
                        <EyeOff size={19} color={COLORS.mediumText} />
                      ) : (
                        <Eye size={19} color={COLORS.lightText} />
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

                {/* Register Button */}
                <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                  <Pressable
                    style={[styles.registerBtn, submitting && styles.registerBtnDisabled]}
                    onPress={handleRegister}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={submitting}>
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <View style={styles.registerBtnContent}>
                        <Text style={styles.registerBtnText}>
                          {isCheckoutRedirect ? 'Đăng ký & Tiếp tục thanh toán' : 'Đăng ký tài khoản'}
                        </Text>
                        <View style={styles.registerBtnArrow}>
                          <ArrowRight size={18} color={COLORS.primary} />
                        </View>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </View>

              {/* Login link */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Đã có tài khoản? </Text>
                <TouchableOpacity
                  onPress={() =>
                    router.replace(
                      redirect
                        ? { pathname: '/login', params: { redirect } }
                        : '/login'
                    )
                  }>
                  <Text style={styles.footerLink}>Đăng nhập ngay</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.trustRow}>
                <ShieldCheck size={14} color={COLORS.mediumText} />
                <Text style={styles.trustText}>
                  Miễn phí đăng ký · Bảo mật thông tin khách hàng
                </Text>
              </View>
            </Animated.View>
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
  ambientContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  ambientOrbTop: {
    position: 'absolute',
    top: -90,
    left: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E8D5D0',
    opacity: 0.55,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -100,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#EDE4DD',
    opacity: 0.75,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  centerWrapper: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.12)',
    ...SHADOWS.small,
  },
  homeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.12)',
    ...SHADOWS.small,
  },
  homeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 28,
    paddingHorizontal: SPACING.xxl,
    paddingVertical: SPACING.xxl,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.1)',
    ...SHADOWS.large,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  logoGlow: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.15)',
  },
  floatingBadgeRight: {
    position: 'absolute',
    top: -2,
    right: -10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  floatingEmoji: {
    fontSize: 15,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: SPACING.xs,
  },
  welcomePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.mediumText,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  formSection: {
    gap: SPACING.md,
  },
  fieldGroup: {
    gap: 5,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkText,
    marginLeft: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF6F3',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E6DBD4',
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  inputContainerFocused: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  iconBadgeFocused: {
    backgroundColor: '#EFE4DC',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: COLORS.darkText,
    paddingVertical: 12,
  },
  webPasswordMask: {
    WebkitTextSecurity: 'disc',
  } as any,
  eyeBtn: {
    padding: SPACING.sm,
  },
  errorContainer: {
    backgroundColor: '#FDF0ED',
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(224, 75, 75, 0.25)',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  registerBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    marginTop: 6,
  },
  registerBtnDisabled: {
    opacity: 0.7,
  },
  registerBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  registerBtnText: {
    fontSize: 15.5,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  registerBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  footerText: {
    fontSize: 13.5,
    color: COLORS.mediumText,
  },
  footerLink: {
    fontSize: 13.5,
    fontWeight: '800',
    color: COLORS.primary,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.md,
  },
  trustText: {
    fontSize: 11.5,
    color: COLORS.mediumText,
  },
});
