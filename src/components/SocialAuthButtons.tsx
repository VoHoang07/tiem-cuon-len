import { COLORS } from '@/constants/theme';
import { useAuth } from '@/store/AuthContext';
import { recordSecurityAudit } from '@/utils/securityGuard';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const GOOGLE_CLIENT_ID =
  '18270939685-6b7grv7i462e2t9tracev3g74h1kc4a6.apps.googleusercontent.com';

interface SocialAuthButtonsProps {
  redirectPath?: string;
  onSuccess?: () => void;
}

function loadGoogleGsiScript(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(false);
  }
  const existing = document.getElementById(
    'google-gsi-sdk'
  ) as HTMLScriptElement | null;
  if (existing && (window as any).google?.accounts) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.id = 'google-gsi-sdk';
    script.src = 'https://accounts.google.com/gsi/client';
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
  const { loginWithVerifiedOAuthToken, oauthClientConfig } = useAuth();
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const activeClientId =
    oauthClientConfig.googleClientId?.trim() || GOOGLE_CLIENT_ID;

  useEffect(() => {
    void loadGoogleGsiScript();
  }, []);

  const handleVerifiedToken = async (token: string) => {
    const res = await loginWithVerifiedOAuthToken('google', token);
    setBusy(false);
    if (!res.success) {
      setErrorMsg(res.error || 'Xác thực Google thất bại.');
      return;
    }
    recordSecurityAudit({
      eventType: 'AUTH_LOGIN_SUCCESS',
      severity: 'INFO',
      path: redirectPath || '/login',
      method: 'GOOGLE_ACCOUNT_CHOOSER',
      details: { provider: 'google', verifiedRealAccount: true },
    });
    if (onSuccess) onSuccess();
  };

  const handleGooglePress = async () => {
    if (busy) return;
    setBusy(true);
    setErrorMsg(null);

    const loaded = await loadGoogleGsiScript();
    const g = (typeof window !== 'undefined' && (window as any).google) || null;
    if (!loaded || !g?.accounts?.oauth2) {
      setBusy(false);
      setErrorMsg(
        'Không thể mở cửa sổ Google. Vui lòng tắt chặn popup hoặc mở bằng Chrome / Safari.'
      );
      return;
    }

    try {
      const tokenClient = g.accounts.oauth2.initTokenClient({
        client_id: activeClientId,
        scope: 'openid email profile',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse?.error || !tokenResponse?.access_token) {
            setBusy(false);
            return;
          }
          await handleVerifiedToken(String(tokenResponse.access_token));
        },
        error_callback: () => {
          setBusy(false);
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch {
      setBusy(false);
      setErrorMsg('Không thể kết nối tới Google. Vui lòng thử lại.');
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.googlePillBtn}
        onPress={() => void handleGooglePress()}
        disabled={busy}
        activeOpacity={0.82}>
        <View style={styles.googleIconWrap}>
          {busy ? (
            <ActivityIndicator size="small" color="#4285F4" />
          ) : (
            <Text style={styles.googleLogoG}>G</Text>
          )}
        </View>
        <Text style={styles.googlePillText}>Tiếp tục với Google</Text>
        <View style={styles.googleIconSpacer} />
      </TouchableOpacity>

      {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  googlePillBtn: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DADCE0',
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  googleIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconSpacer: {
    width: 24,
    height: 24,
  },
  googleLogoG: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
    fontFamily: Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif',
  },
  googlePillText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 14.5,
    fontWeight: '700',
    color: '#202124',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
    textAlign: 'center',
  },
});
