import { COLORS } from '@/constants/theme';
import { supabaseUrl } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { recordSecurityAudit } from '@/utils/securityGuard';
import { Check, Copy, KeyRound, X } from 'lucide-react-native';
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

function loadExternalScript(id: string, src: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  const existing = document.getElementById(id) as HTMLScriptElement | null;
  if (existing) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

export function SocialAuthButtons({
  redirectPath,
  onSuccess,
}: SocialAuthButtonsProps) {
  const {
    loginWithOAuth,
    loginWithVerifiedOAuthToken,
    oauthClientConfig,
    saveOAuthClientConfig,
  } = useAuth();

  const [busyProvider, setBusyProvider] = useState<'google' | 'facebook' | null>(
    null
  );
  const [setupProvider, setSetupProvider] = useState<'google' | 'facebook' | null>(
    null
  );
  const [draftGoogleClientId, setDraftGoogleClientId] = useState(
    oauthClientConfig.googleClientId
  );
  const [draftFbAppId, setDraftFbAppId] = useState(
    oauthClientConfig.facebookAppId
  );
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const callbackUrl = `${supabaseUrl}/auth/v1/callback`;

  const triggerGooglePopupWithClientId = async (clientId: string) => {
    const cleanClientId = clientId.trim();
    if (!cleanClientId) {
      setSetupProvider('google');
      return;
    }

    setBusyProvider('google');
    setErrorMsg(null);

    const loaded = await loadExternalScript(
      'google-gsi-sdk',
      'https://accounts.google.com/gsi/client'
    );
    const g = (typeof window !== 'undefined' && (window as any).google) || null;
    if (!loaded || !g?.accounts?.oauth2) {
      setBusyProvider(null);
      setErrorMsg(
        'Trình duyệt đang chặn cửa sổ Google. Vui lòng tắt chặn quảng cáo hoặc mở bằng Chrome / Safari.'
      );
      return;
    }

    try {
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: cleanClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            setBusyProvider(null);
            if (tokenResponse?.error !== 'popup_closed_by_user') {
              setErrorMsg('Đã hủy chọn tài khoản Google.');
            }
            return;
          }

          const res = await loginWithVerifiedOAuthToken(
            'google',
            String(tokenResponse.access_token)
          );
          setBusyProvider(null);

          if (!res.success) {
            setErrorMsg(res.error || 'Xác thực Google thất bại.');
            return;
          }

          recordSecurityAudit({
            eventType: 'AUTH_LOGIN_SUCCESS',
            severity: 'INFO',
            path: redirectPath || '/login',
            method: 'GOOGLE_OAUTH_POPUP',
            details: { provider: 'google', verifiedRealAccount: true },
          });

          if (onSuccess) onSuccess();
        },
        error_callback: () => {
          setBusyProvider(null);
        },
      });

      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch {
      setBusyProvider(null);
      setErrorMsg('Google Client ID chưa hợp lệ hoặc chưa thêm tên miền tiemcuonlen.shop.');
    }
  };

  const triggerFacebookPopupWithAppId = async (appId: string) => {
    const cleanAppId = appId.trim();
    if (!cleanAppId) {
      setSetupProvider('facebook');
      return;
    }

    setBusyProvider('facebook');
    setErrorMsg(null);

    const loaded = await loadExternalScript(
      'facebook-jssdk',
      'https://connect.facebook.net/vi_VN/sdk.js'
    );
    const FB = (typeof window !== 'undefined' && (window as any).FB) || null;
    if (!loaded || !FB) {
      setBusyProvider(null);
      setErrorMsg(
        'Trình duyệt đang chặn cửa sổ Facebook. Vui lòng mở bằng Chrome / Safari.'
      );
      return;
    }

    try {
      FB.init({
        appId: cleanAppId,
        cookie: true,
        xfbml: false,
        version: 'v19.0',
      });

      FB.login(
        async (response: any) => {
          const accessToken = response?.authResponse?.accessToken;
          if (!accessToken) {
            setBusyProvider(null);
            return;
          }
          const res = await loginWithVerifiedOAuthToken(
            'facebook',
            String(accessToken)
          );
          setBusyProvider(null);
          if (!res.success) {
            setErrorMsg(res.error || 'Xác thực Facebook thất bại.');
            return;
          }
          recordSecurityAudit({
            eventType: 'AUTH_LOGIN_SUCCESS',
            severity: 'INFO',
            path: redirectPath || '/login',
            method: 'FACEBOOK_OAUTH_POPUP',
            details: { provider: 'facebook', verifiedRealAccount: true },
          });
          if (onSuccess) onSuccess();
        },
        { scope: 'public_profile,email' }
      );
    } catch {
      setBusyProvider(null);
      setErrorMsg('Facebook App ID chưa hợp lệ.');
    }
  };

  const handleSocialPress = async (provider: 'google' | 'facebook') => {
    if (busyProvider) return;
    setErrorMsg(null);
    setSetupProvider(null);

    // 1. If Client ID / App ID is already configured, pop up the official Google / Facebook account chooser window immediately!
    if (provider === 'google' && oauthClientConfig.googleClientId) {
      await triggerGooglePopupWithClientId(oauthClientConfig.googleClientId);
      return;
    }
    if (provider === 'facebook' && oauthClientConfig.facebookAppId) {
      await triggerFacebookPopupWithAppId(oauthClientConfig.facebookAppId);
      return;
    }

    // 2. Otherwise check if Supabase OAuth Provider is enabled in Supabase Dashboard
    setBusyProvider(provider);
    const res = await loginWithOAuth(provider, redirectPath);
    setBusyProvider(null);

    if (res.needsClientPopup) {
      setDraftGoogleClientId(oauthClientConfig.googleClientId);
      setDraftFbAppId(oauthClientConfig.facebookAppId);
      setSetupProvider(provider);
    }
  };

  const handleSaveAndLaunchOAuth = async () => {
    if (setupProvider === 'google') {
      const clean = draftGoogleClientId.trim();
      if (!clean.includes('.apps.googleusercontent.com')) {
        setErrorMsg(
          'Vui lòng dán đúng Google Client ID (có đuôi .apps.googleusercontent.com).'
        );
        return;
      }
      await saveOAuthClientConfig({ googleClientId: clean });
      setSetupProvider(null);
      await triggerGooglePopupWithClientId(clean);
    } else if (setupProvider === 'facebook') {
      const clean = draftFbAppId.trim();
      if (!/^\d{8,25}$/.test(clean)) {
        setErrorMsg('Vui lòng dán đúng Facebook App ID (dãy số ID ứng dụng).');
        return;
      }
      await saveOAuthClientConfig({ facebookAppId: clean });
      setSetupProvider(null);
      await triggerFacebookPopupWithAppId(clean);
    }
  };

  return (
    <View style={styles.container}>
      {/* Clean Side-by-Side Google & Facebook Buttons */}
      <View style={styles.row}>
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

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

      {/* One-Time OAuth Client ID Setup Box (Only shown if Google/Facebook OAuth isn't configured yet in Supabase or App) */}
      {setupProvider && (
        <View style={styles.setupCard}>
          <View style={styles.setupHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
              <KeyRound size={14} color="#92400E" />
              <Text style={styles.setupTitle}>
                {setupProvider === 'google'
                  ? 'Kết nối Google OAuth (Cài 1 lần duy nhất)'
                  : 'Kết nối Facebook Login (Cài 1 lần duy nhất)'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSetupProvider(null)}>
              <X size={15} color="#78716C" />
            </TouchableOpacity>
          </View>

          {setupProvider === 'google' ? (
            <>
              <Text style={styles.setupDesc}>
                Để hiện bảng chọn các tài khoản Google đang lưu sẵn trên máy (giống YouTube / Goship), hãy dán{' '}
                <Text style={{ fontWeight: '800' }}>Google Client ID</Text> (từ{' '}
                <Text style={{ fontWeight: '700' }}>console.cloud.google.com</Text>{' '}
                → Credentials → OAuth Client ID Web) hoặc bật Google trong{' '}
                <Text style={{ fontWeight: '700' }}>
                  Supabase → Authentication → Providers → Google
                </Text>
                :
              </Text>
              <TextInput
                style={styles.setupInput}
                placeholder="VD: 123456789-abcxyz.apps.googleusercontent.com"
                placeholderTextColor="#9A897A"
                value={draftGoogleClientId}
                onChangeText={(t) => {
                  setDraftGoogleClientId(t);
                  setErrorMsg(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          ) : (
            <>
              <Text style={styles.setupDesc}>
                Để bật cửa sổ đăng nhập Facebook chính chủ, hãy dán{' '}
                <Text style={{ fontWeight: '800' }}>Facebook App ID</Text> (từ{' '}
                <Text style={{ fontWeight: '700' }}>developers.facebook.com</Text>) hoặc bật Facebook trong{' '}
                <Text style={{ fontWeight: '700' }}>
                  Supabase → Authentication → Providers → Facebook
                </Text>
                :
              </Text>
              <TextInput
                style={styles.setupInput}
                placeholder="VD: 987654321012345"
                placeholderTextColor="#9A897A"
                value={draftFbAppId}
                onChangeText={(t) => {
                  setDraftFbAppId(t);
                  setErrorMsg(null);
                }}
                keyboardType="numeric"
              />
            </>
          )}

          {/* Copy Callback URL helper for Supabase OAuth */}
          <TouchableOpacity
            style={styles.copyCallbackRow}
            onPress={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(callbackUrl);
                setCopiedCallback(true);
                setTimeout(() => setCopiedCallback(false), 2000);
              }
            }}
            activeOpacity={0.8}>
            {copiedCallback ? (
              <Check size={13} color="#059669" />
            ) : (
              <Copy size={13} color="#5C4033" />
            )}
            <Text style={styles.copyCallbackText} numberOfLines={1}>
              {copiedCallback
                ? 'Đã chép Callback URL!'
                : `Callback URL: ${callbackUrl}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.saveSetupBtn}
            onPress={() => void handleSaveAndLaunchOAuth()}
            activeOpacity={0.85}>
            <Text style={styles.saveSetupBtnText}>
              Lưu & Mở cửa sổ chọn tài khoản{' '}
              {setupProvider === 'google' ? 'Google' : 'Facebook'}
            </Text>
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
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
  setupCard: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  setupTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#78350F',
  },
  setupDesc: {
    fontSize: 11.5,
    lineHeight: 16.5,
    color: '#5C4033',
  },
  setupInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6C2AD',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    color: '#2C1E14',
  },
  copyCallbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  copyCallbackText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#78350F',
  },
  saveSetupBtn: {
    backgroundColor: '#4A3427',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSetupBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFDF9',
  },
});
