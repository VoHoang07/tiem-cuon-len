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
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCheckoutRedirect = Boolean(redirect && redirect.startsWith('/checkout'));

  // Entrance & continuous animations
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(32)).current;

  const field1Anim = useRef(new Animated.Value(0)).current;
  const field2Anim = useRef(new Animated.Value(0)).current;
  const btnEnterAnim = useRef(new Animated.Value(0)).current;

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Logo spring entrance + staggered form fields
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
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 45,
        delay: 120,
        useNativeDriver: true,
      }),
      Animated.stagger(110, [
        Animated.timing(field1Anim, {
          toValue: 1,
          duration: 420,
          delay: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(field2Anim, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(btnEnterAnim, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // 2. Continuous gentle floating animation for logo & decorative elements
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -7,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 7,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Ambient background pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.08,
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
  }, [
    logoScale,
    logoOpacity,
    floatAnim,
    pulseAnim,
    cardOpacity,
    cardTranslateY,
    field1Anim,
    field2Anim,
    btnEnterAnim,
  ]);

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

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      triggerShake();
      return;
    }
    setSubmitting(true);
    const result = await login(email.trim(), password);
    setSubmitting(false);
    if (result.success) {
      router.replace((redirect || '/') as Href);
    } else {
      setError(result.error ?? 'Đăng nhập thất bại.');
      triggerShake();
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
            {/* Top navigation to return to shop */}
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

            {/* Animated Card Container */}
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
              {/* Animated Logo / Header */}
              <View style={styles.headerSection}>
                <Animated.View
                  style={[
                    styles.logoWrapper,
                    {
                      opacity: logoOpacity,
                      transform: [
                        { scale: logoScale },
                        { translateY: floatAnim },
                      ],
                    },
                  ]}>
                  <View style={styles.logoGlow} />
                  <BrandLogo size="xl" variant="circular" />
                  <View style={styles.floatingBadgeRight}>
                    <Text style={styles.floatingEmoji}>🧶</Text>
                  </View>
                  <View style={styles.floatingBadgeLeft}>
                    <Sparkles size={14} color={COLORS.primary} />
                  </View>
                </Animated.View>

                <View style={styles.welcomePill}>
                  <Sparkles size={13} color={COLORS.primary} />
                  <Text style={styles.welcomePillText}>TIỆM CUỘN LEN HANDMADE</Text>
                </View>

                <Text style={styles.title}>
                  {isCheckoutRedirect ? 'Đăng nhập để đặt hàng' : 'Chào mừng trở lại'}
                </Text>
                <Text style={styles.subtitle}>
                  {isCheckoutRedirect
                    ? 'Chỉ còn 1 bước nữa để hoàn tất đơn hàng len thủ công của bạn'
                    : 'Đăng nhập để lưu giỏ hàng, theo dõi đơn và nhận ưu đãi'}
                </Text>
              </View>

              {/* Form */}
              <View style={styles.formSection}>
                {/* Email */}
                <Animated.View
                  style={[
                    styles.fieldGroup,
                    {
                      opacity: field1Anim,
                      transform: [
                        {
                          translateY: field1Anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <Text style={styles.fieldLabel}>{LOGIN_EMAIL}</Text>
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
                      placeholder={LOGIN_EMAIL_PLACEHOLDER}
                      placeholderTextColor={COLORS.lightText}
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField(null)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </Animated.View>

                {/* Password */}
                <Animated.View
                  style={[
                    styles.fieldGroup,
                    {
                      opacity: field2Anim,
                      transform: [
                        {
                          translateY: field2Anim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [16, 0],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <Text style={styles.fieldLabel}>{LOGIN_PASSWORD}</Text>
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
                      style={styles.input}
                      placeholder={LOGIN_PASSWORD_PLACEHOLDER}
                      placeholderTextColor={COLORS.lightText}
                      value={password}
                      onChangeText={setPassword}
                      onFocus={() => setFocusedField('password')}
                      onBlur={() => setFocusedField(null)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      onSubmitEditing={handleLogin}
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
                </Animated.View>

                {/* Error */}
                {error !== '' && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Animated Login Button */}
                <Animated.View
                  style={{
                    opacity: btnEnterAnim,
                    transform: [
                      { scale: btnScale },
                      {
                        translateY: btnEnterAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [16, 0],
                        }),
                      },
                    ],
                  }}>
                  <Pressable
                    style={[styles.loginBtn, submitting && styles.loginBtnDisabled]}
                    onPress={handleLogin}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    disabled={submitting}>
                    {submitting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <View style={styles.loginBtnContent}>
                        <Text style={styles.loginBtnText}>
                          {isCheckoutRedirect ? 'Đăng nhập & Tiếp tục thanh toán' : LOGIN_BUTTON}
                        </Text>
                        <View style={styles.loginBtnArrow}>
                          <ArrowRight size={18} color={COLORS.primary} />
                        </View>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              </View>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>hoặc</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Register CTA */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>Bạn chưa có tài khoản?</Text>
                <TouchableOpacity
                  style={styles.registerOutlineBtn}
                  activeOpacity={0.8}
                  onPress={() =>
                    router.replace(
                      redirect
                        ? { pathname: '/register', params: { redirect } }
                        : '/register'
                    )
                  }>
                  <Text style={styles.registerOutlineText}>Tạo tài khoản mới ngay</Text>
                </TouchableOpacity>
              </View>

              {/* Security Note */}
              <View style={styles.trustRow}>
                <ShieldCheck size={14} color={COLORS.mediumText} />
                <Text style={styles.trustText}>
                  Bảo mật thông tin & đồng bộ giỏ hàng tự động
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
    right: -70,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#E8D5D0',
    opacity: 0.55,
  },
  ambientOrbBottom: {
    position: 'absolute',
    bottom: -100,
    left: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: '#EDE4DD',
    opacity: 0.75,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingVertical: SPACING.xxxl,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.1)',
    ...SHADOWS.large,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  logoWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  logoGlow: {
    position: 'absolute',
    width: 114,
    height: 114,
    borderRadius: 57,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: 'rgba(118, 83, 65, 0.15)',
  },
  floatingBadgeRight: {
    position: 'absolute',
    top: -2,
    right: -10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  floatingBadgeLeft: {
    position: 'absolute',
    bottom: 2,
    left: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  floatingEmoji: {
    fontSize: 16,
  },
  welcomePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: SPACING.sm,
  },
  welcomePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13.5,
    color: COLORS.mediumText,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: SPACING.sm,
  },
  formSection: {
    gap: SPACING.lg,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13.5,
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
    paddingVertical: 2,
  },
  inputContainerFocused: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
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
    fontSize: 15,
    color: COLORS.darkText,
    paddingVertical: 13,
  },
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
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
    marginTop: 4,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loginBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  loginBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginVertical: SPACING.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EAE0DA',
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.lightText,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm,
  },
  footerText: {
    fontSize: 13.5,
    color: COLORS.mediumText,
  },
  registerOutlineBtn: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#FAF6F3',
    paddingVertical: 12,
    alignItems: 'center',
  },
  registerOutlineText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: COLORS.primary,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: SPACING.xl,
  },
  trustText: {
    fontSize: 12,
    color: COLORS.mediumText,
  },
});
