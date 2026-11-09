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
  const {
    loginWithOAuth,
    loginWithVerifiedOAuthToken,
    oauthClientConfig,
    saveOAuthClientConfig,
  } = useAuth();

  const [busy, setBusy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [draftGoogleClientId, setDraftGoogleClientId] = useState(
    oauthClientConfig.googleClientId
  );
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const originUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://www.tiemcuonlen.shop';
  const callbackUrl = `${supabaseUrl}/auth/v1/callback`;

  const launchGoogleAccountChooser = async (clientId: string) => {
    const cleanClientId = clientId.trim();
    if (!cleanClientId) {
      setShowSetup(true);
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    const loaded = await loadGoogleGsiScript();
    const g = (typeof window !== 'undefined' && (window as any).google) || null;
    if (!loaded || !g?.accounts) {
      setBusy(false);
      setErrorMsg(
        'Trình duyệt đang chặn cửa sổ Google. Vui lòng tắt chặn quảng cáo hoặc mở bằng Chrome / Safari.'
      );
      return;
    }

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

    const launchOAuth2PopupFallback = () => {
      try {
        const tokenClient = g.accounts.oauth2.initTokenClient({
          client_id: cleanClientId,
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
        setErrorMsg(
          'Google Client ID chưa hợp lệ hoặc chưa thêm tên miền vào Authorized JavaScript origins.'
        );
      }
    };

    // Prefer Chrome native FedCM modal ("Continue to tiemcuonlen.shop with google.com") just like Pinterest/YouTube
    if (g.accounts.id) {
      try {
        let handled = false;
        g.accounts.id.initialize({
          client_id: cleanClientId,
          use_fedcm_for_prompt: true,
          ux_mode: 'popup',
          auto_select: false,
          callback: async (credentialResponse: any) => {
            if (credentialResponse?.credential) {
              handled = true;
              await handleVerifiedToken(String(credentialResponse.credential));
            } else {
              setBusy(false);
            }
          },
        });

        g.accounts.id.prompt((notification: any) => {
          if (
            !handled &&
            (notification?.isNotDisplayed?.() ||
              notification?.isSkippedMoment?.())
          ) {
            launchOAuth2PopupFallback();
          }
        });
        return;
      } catch {
        // Fallback to OAuth2 popup below
      }
    }

    launchOAuth2PopupFallback();
  };

  const handleGooglePress = async () => {
    if (busy) return;
    setErrorMsg(null);
    setShowSetup(false);

    if (oauthClientConfig.googleClientId) {
      await launchGoogleAccountChooser(oauthClientConfig.googleClientId);
      return;
    }

    setBusy(true);
    const res = await loginWithOAuth('google', redirectPath);
    setBusy(false);

    if (res.needsClientPopup) {
      setDraftGoogleClientId(oauthClientConfig.googleClientId);
      setShowSetup(true);
    }
  };

  const handleSaveAndLaunchGoogle = async () => {
    const clean = draftGoogleClientId.trim();
    if (!clean.includes('.apps.googleusercontent.com')) {
      setErrorMsg(
        'Vui lòng dán đúng Google Client ID (có đuôi .apps.googleusercontent.com).'
      );
      return;
    }
    await saveOAuthClientConfig({ googleClientId: clean });
    setShowSetup(false);
    await launchGoogleAccountChooser(clean);
  };

  return (
    <View style={styles.container}>
      {/* Pinterest-style Full-Width Rounded Pill "Tiếp tục với Google" Button */}
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

      {/* One-Time Google Client ID Setup Box (Only shown if Google Client ID isn't configured yet) */}
      {showSetup && (
        <View style={styles.setupCard}>
          <View style={styles.setupHeader}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                flex: 1,
              }}>
              <KeyRound size={14} color="#92400E" />
              <Text style={styles.setupTitle}>
                Kích hoạt bảng chọn tài khoản Google (Cài 1 lần)
              </Text>
            </View>
            <TouchableOpacity onPress={() => setShowSetup(false)}>
              <X size={15} color="#78716C" />
            </TouchableOpacity>
          </View>

          <Text style={styles.setupDesc}>
            Để hiện bảng đen <Text style={{ fontWeight: '800' }}>&quot;Continue to tiemcuonlen.shop with google.com&quot;</Text> giống Pinterest, bạn dán mã <Text style={{ fontWeight: '800' }}>Google Client ID</Text> (tạo miễn phí tại <Text style={{ fontWeight: '700' }}>console.cloud.google.com → Credentials → Create OAuth Client ID → Web application</Text>):
          </Text>

          <TouchableOpacity
            style={styles.copyCallbackRow}
            onPress={() => {
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                void navigator.clipboard.writeText(originUrl);
                setCopiedOrigin(true);
                setTimeout(() => setCopiedOrigin(false), 2000);
              }
            }}
            activeOpacity={0.8}>
            {copiedOrigin ? (
              <Check size={13} color="#059669" />
            ) : (
              <Copy size={13} color="#5C4033" />
            )}
            <Text style={styles.copyCallbackText} numberOfLines={1}>
              {copiedOrigin
                ? 'Đã chép! Dán vào Authorized JavaScript origins'
                : `Authorized JS Origin: ${originUrl} (Chạm để chép)`}
            </Text>
          </TouchableOpacity>

          <Text style={[styles.setupDesc, { fontSize: 10.5, color: '#78716C' }]}>
            Redirect URI (nếu bật trong Supabase): {callbackUrl}
          </Text>

          <TextInput
            style={styles.setupInput}
            placeholder="Dán mã dạng: 123456789-abcxyz.apps.googleusercontent.com"
            placeholderTextColor="#9A897A"
            value={draftGoogleClientId}
            onChangeText={(t) => {
              setDraftGoogleClientId(t);
              setErrorMsg(null);
            }}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={styles.saveSetupBtn}
            onPress={() => void handleSaveAndLaunchGoogle()}
            activeOpacity={0.85}>
            <Text style={styles.saveSetupBtnText}>
              Lưu & Hiện bảng chọn tài khoản Google
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
