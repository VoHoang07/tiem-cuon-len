import { COLORS } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { validateRealCustomerEmail } from '@/utils/contactTrustValidator';
import { recordSecurityAudit } from '@/utils/securityGuard';
import { ArrowRight, Mail, X } from 'lucide-react-native';
import React, { useState } from 'react';
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
}

export function SocialAuthButtons({
  redirectPath,
  onSuccess,
}: SocialAuthButtonsProps) {
  const { loginWithOAuth, loginWithVerifiedGmailQuick } = useAuth();
  const [busyProvider, setBusyProvider] = useState<
    'google' | 'facebook' | 'quick' | null
  >(null);
  const [showQuickGmailPanel, setShowQuickGmailPanel] = useState(false);
  const [quickEmail, setQuickEmail] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSocialPress = async (provider: 'google' | 'facebook') => {
    if (busyProvider) return;
    setErrorMsg(null);
    setBusyProvider(provider);

    const res = await loginWithOAuth(provider, redirectPath);
    setBusyProvider(null);

    if (res.fallbackToQuickGmail) {
      setShowQuickGmailPanel(true);
    }
  };

  const handleQuickGmailSubmit = async () => {
    if (busyProvider) return;
    const check = validateRealCustomerEmail(quickEmail.trim());
    if (!check.valid) {
      if (check.suggestion) {
        setQuickEmail(check.suggestion);
      }
      setErrorMsg(check.error || 'Vui lòng nhập đúng địa chỉ Gmail của bạn.');
      return;
    }

    setErrorMsg(null);
    setBusyProvider('quick');
    const result = await loginWithVerifiedGmailQuick(check.normalized);
    setBusyProvider(null);

    if (!result.success) {
      setErrorMsg(result.error || 'Không thể đăng nhập bằng email này.');
      return;
    }

    recordSecurityAudit({
      eventType: 'AUTH_LOGIN_SUCCESS',
      severity: 'INFO',
      path: redirectPath || '/login',
      method: 'VERIFIED_GMAIL_QUICK_LOGIN',
      userEmail: check.normalized,
      details: { verifiedRealAccount: true },
    });

    if (onSuccess) {
      onSuccess();
    }
  };

  return (
    <View style={styles.container}>
      {/* Clean Side-by-Side Social Login Buttons */}
      <View style={styles.row}>
        {/* Google */}
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => void handleSocialPress('google')}
          disabled={busyProvider !== null}
          activeOpacity={0.82}>
          {busyProvider === 'google' ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={styles.googleIconCircle}>
              <Text style={styles.googleIconLetter}>G</Text>
            </View>
          )}
          <Text style={styles.socialBtnText}>Google</Text>
        </TouchableOpacity>

        {/* Facebook */}
        <TouchableOpacity
          style={styles.socialBtn}
          onPress={() => void handleSocialPress('facebook')}
          disabled={busyProvider !== null}
          activeOpacity={0.82}>
          {busyProvider === 'facebook' ? (
            <ActivityIndicator size="small" color="#1877F2" />
          ) : (
            <View style={styles.fbIconCircle}>
              <Text style={styles.fbIconLetter}>f</Text>
            </View>
          )}
          <Text style={styles.socialBtnText}>Facebook</Text>
        </TouchableOpacity>
      </View>

      {/* Minimal Quick Gmail Input when OAuth redirects are unavailable */}
      {showQuickGmailPanel && (
        <View style={styles.quickBox}>
          <View style={styles.quickHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Mail size={14} color={COLORS.primary} />
              <Text style={styles.quickTitle}>Đăng nhập nhanh bằng Gmail</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setShowQuickGmailPanel(false);
                setErrorMsg(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={COLORS.lightText} />
            </TouchableOpacity>
          </View>

          <View style={styles.quickInputRow}>
            <TextInput
              style={styles.quickInput}
              placeholder="Chọn hoặc nhập Gmail của bạn..."
              placeholderTextColor={COLORS.lightText}
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
              returnKeyType="go"
              onSubmitEditing={() => void handleQuickGmailSubmit()}
            />
            <TouchableOpacity
              style={styles.quickSubmitBtn}
              onPress={() => void handleQuickGmailSubmit()}
              disabled={busyProvider !== null}
              activeOpacity={0.85}>
              {busyProvider === 'quick' ? (
                <ActivityIndicator size="small" color="#FFFDF9" />
              ) : (
                <ArrowRight size={17} color="#FFFDF9" />
              )}
            </TouchableOpacity>
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
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
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderColor: '#E5D8C8',
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  googleIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D6C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconLetter: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#EA4335',
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
  },
  fbIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fbIconLetter: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  quickBox: {
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderColor: '#DFCBB5',
    borderRadius: 14,
    padding: 11,
    gap: 8,
  },
  quickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  quickInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickInput: {
    flex: 1,
    minWidth: 0,
    height: 42,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#2C1E14',
  },
  quickSubmitBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: COLORS.error,
  },
});
