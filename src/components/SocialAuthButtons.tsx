import { useAuth } from '@/store/AuthContext';
import { validateRealCustomerEmail } from '@/utils/contactTrustValidator';
import { recordSecurityAudit } from '@/utils/securityGuard';
import { CheckCircle2, Mail, ShieldCheck, Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface SocialAuthButtonsProps {
  redirectPath?: string;
  onSuccess?: () => void;
  compact?: boolean;
}

export function SocialAuthButtons({
  redirectPath,
  onSuccess,
  compact = false,
}: SocialAuthButtonsProps) {
  const { loginWithOAuth, loginWithVerifiedGmailQuick } = useAuth();
  const [busyProvider, setBusyProvider] = useState<'google' | 'facebook' | 'quick' | null>(null);
  const [showQuickGmailPanel, setShowQuickGmailPanel] = useState(false);
  const [quickPlatformLabel, setQuickPlatformLabel] = useState<'Google / Gmail' | 'Facebook'>('Google / Gmail');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickName, setQuickName] = useState('');
  const [savedDeviceEmail, setSavedDeviceEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const prev =
          window.localStorage.getItem('tcl_guest_notify_email_v1') || '';
        if (prev && prev.includes('@')) {
          setSavedDeviceEmail(prev.trim().toLowerCase());
          setQuickEmail(prev.trim().toLowerCase());
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const emailTrust = validateRealCustomerEmail(quickEmail);

  const handleSocialPress = async (provider: 'google' | 'facebook') => {
    if (busyProvider) return;
    setErrorMsg(null);
    setBusyProvider(provider);

    const res = await loginWithOAuth(provider, redirectPath);
    setBusyProvider(null);

    if (res.fallbackToQuickGmail) {
      setQuickPlatformLabel(
        provider === 'facebook' ? 'Facebook' : 'Google / Gmail'
      );
      setShowQuickGmailPanel(true);
    }
  };

  const handleQuickGmailSubmit = async (overrideEmail?: string) => {
    if (busyProvider) return;
    const targetEmail = (overrideEmail ?? quickEmail).trim();
    const check = validateRealCustomerEmail(targetEmail);
    if (!check.valid) {
      if (check.suggestion) {
        setQuickEmail(check.suggestion);
      }
      setErrorMsg(
        check.error ||
          'Vui lòng chọn hoặc nhập đúng tài khoản Gmail thật đang dùng trên máy.'
      );
      return;
    }

    setErrorMsg(null);
    setBusyProvider('quick');
    const result = await loginWithVerifiedGmailQuick(
      check.normalized,
      quickName.trim() || undefined
    );
    setBusyProvider(null);

    if (!result.success) {
      setErrorMsg(result.error || 'Không thể xác thực tài khoản này.');
      return;
    }

    recordSecurityAudit({
      eventType: 'AUTH_LOGIN_SUCCESS',
      severity: 'INFO',
      path: redirectPath || '/login',
      method: 'VERIFIED_GMAIL_QUICK_LOGIN',
      userEmail: check.normalized,
      details: {
        provider: quickPlatformLabel,
        verifiedRealAccount: true,
      },
    });

    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Anti-Scam Real Account Verification Header */}
      <View style={styles.trustBanner}>
        <ShieldCheck size={15} color="#047857" />
        <Text style={styles.trustBannerText}>
          Đăng nhập nhanh 1 chạm — Xác nhận <Text style={{ fontWeight: '900' }}>Acc thật 100%</Text> (Chống đơn ảo / Scam & Ưu tiên duyệt đơn ngay)
        </Text>
      </View>

      {/* Social Buttons Row */}
      <View style={styles.buttonsGrid}>
        {/* 1. Google / Existing Gmail Button */}
        <TouchableOpacity
          style={[styles.socialBtn, styles.googleBtn]}
          onPress={() => void handleSocialPress('google')}
          disabled={busyProvider !== null}
          activeOpacity={0.85}>
          {busyProvider === 'google' ? (
            <ActivityIndicator size="small" color="#3B281E" />
          ) : (
            <View style={styles.googleLogoBadge}>
              <Text style={styles.googleLogoText}>G</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.googleBtnTitle}>
              Tiếp tục bằng Google / Gmail có sẵn
            </Text>
            <Text style={styles.googleBtnSub}>
              Chọn nhanh Gmail đang dùng trên điện thoại / máy tính
            </Text>
          </View>
          <View style={styles.verifiedMiniTag}>
            <Text style={styles.verifiedMiniTagText}>✓ Acc thật</Text>
          </View>
        </TouchableOpacity>

        {/* 2. Facebook Button */}
        <TouchableOpacity
          style={[styles.socialBtn, styles.facebookBtn]}
          onPress={() => void handleSocialPress('facebook')}
          disabled={busyProvider !== null}
          activeOpacity={0.85}>
          {busyProvider === 'facebook' ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <View style={styles.fbLogoBadge}>
              <Text style={styles.fbLogoText}>f</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.fbBtnTitle}>Tiếp tục bằng Facebook</Text>
            <Text style={styles.fbBtnSub}>
              Xác thực nhanh bằng tài khoản Facebook chính chủ
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* 1-Tap Saved Gmail Chip if browser already has a verified Gmail stored */}
      {savedDeviceEmail && !showQuickGmailPanel ? (
        <TouchableOpacity
          style={styles.oneTapSavedGmailBtn}
          onPress={() => void handleQuickGmailSubmit(savedDeviceEmail)}
          activeOpacity={0.85}>
          <CheckCircle2 size={15} color="#059669" />
          <Text style={styles.oneTapSavedGmailText}>
            ⚡ Vào ngay bằng Gmail trên máy:{' '}
            <Text style={{ fontWeight: '900', textDecorationLine: 'underline' }}>
              {savedDeviceEmail}
            </Text>
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Inline Instant Verified Gmail Selector (Opens automatically in TikTok/Zalo WebViews or when selecting device Gmail) */}
      {showQuickGmailPanel && (
        <View style={styles.quickPanel}>
          <View style={styles.quickPanelHeader}>
            <Sparkles size={15} color="#047857" />
            <Text style={styles.quickPanelTitle}>
              Chọn Gmail thật đang có trên máy ({quickPlatformLabel} — Không cần mật khẩu)
            </Text>
          </View>
          <Text style={styles.quickPanelDesc}>
            💡 Chạm vào ô Gmail bên dưới, bàn phím điện thoại / trình duyệt sẽ tự hiện sẵn tài khoản Gmail của bạn để chọn 1 chạm:
          </Text>

          {savedDeviceEmail ? (
            <TouchableOpacity
              style={styles.savedChipInModal}
              onPress={() => void handleQuickGmailSubmit(savedDeviceEmail)}
              activeOpacity={0.85}>
              <Mail size={14} color="#047857" />
              <Text style={styles.savedChipInModalText}>
                Dùng ngay Gmail có sẵn: {savedDeviceEmail}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={styles.quickInputsCol}>
            <TextInput
              style={[
                styles.quickInput,
                quickEmail.trim().length > 3 &&
                  (emailTrust.valid
                    ? styles.quickInputValid
                    : styles.quickInputInvalid),
              ]}
              placeholder="Chạm để chọn Gmail có sẵn trên máy (VD: tenban@gmail.com)"
              placeholderTextColor="#9A897A"
              value={quickEmail}
              onChangeText={(t) => {
                setQuickEmail(t);
                if (errorMsg) setErrorMsg(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="done"
              onSubmitEditing={() => void handleQuickGmailSubmit()}
            />

            <TextInput
              style={styles.quickInput}
              placeholder="Tên hiển thị của bạn (Tùy chọn — VD: Nguyễn Khánh Ly)"
              placeholderTextColor="#9A897A"
              value={quickName}
              onChangeText={setQuickName}
              autoComplete="name"
              textContentType="name"
              returnKeyType="go"
              onSubmitEditing={() => void handleQuickGmailSubmit()}
            />
          </View>

          {emailTrust.suggestion ? (
            <TouchableOpacity
              onPress={() => setQuickEmail(emailTrust.suggestion!)}
              style={styles.suggestionPill}>
              <Text style={styles.suggestionPillText}>
                💡 Ý bạn là: {emailTrust.suggestion}? (Chạm để sửa ngay)
              </Text>
            </TouchableOpacity>
          ) : null}

          {errorMsg ? (
            <Text style={styles.errorText}>⚠️ {errorMsg}</Text>
          ) : null}

          <TouchableOpacity
            style={styles.quickConfirmBtn}
            onPress={() => void handleQuickGmailSubmit()}
            disabled={busyProvider !== null}
            activeOpacity={0.85}>
            {busyProvider === 'quick' ? (
              <ActivityIndicator size="small" color="#FFFDF9" />
            ) : (
              <>
                <CheckCircle2 size={16} color="#FFFDF9" />
                <Text style={styles.quickConfirmBtnText}>
                  Xác nhận Acc thật & Đăng nhập ngay
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
    marginBottom: 14,
  },
  containerCompact: {
    marginBottom: 10,
  },
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  trustBannerText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: '700',
    color: '#065F46',
  },
  buttonsGrid: {
    gap: 8,
  },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  googleBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D6C6B6',
  },
  googleLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.5,
    borderColor: '#EA4335',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleLogoText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#EA4335',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  googleBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#2C1E14',
  },
  googleBtnSub: {
    fontSize: 11,
    color: '#6E5A49',
    marginTop: 1,
  },
  verifiedMiniTag: {
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedMiniTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#065F46',
  },
  facebookBtn: {
    backgroundColor: '#1877F2',
    borderWidth: 1,
    borderColor: '#166FE5',
  },
  fbLogoBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#1877F2',
  },
  fbBtnTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  fbBtnSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 1,
  },
  oneTapSavedGmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#34D399',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  oneTapSavedGmailText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#065F46',
  },
  quickPanel: {
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 14,
    padding: 13,
    gap: 9,
  },
  quickPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickPanelTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#065F46',
  },
  quickPanelDesc: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#4A3728',
  },
  savedChipInModal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  savedChipInModalText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  quickInputsCol: {
    gap: 8,
  },
  quickInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D8C6B4',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#2C1E14',
  },
  quickInputValid: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  quickInputInvalid: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  suggestionPill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  suggestionPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#DC2626',
  },
  quickConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#059669',
    borderRadius: 11,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  quickConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
});
