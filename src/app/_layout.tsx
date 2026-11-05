import { Stack, useRouter, useSegments, usePathname, useGlobalSearchParams, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ShopProvider } from '@/store/ShopContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { OrderProvider } from '@/store/OrderContext';
import { AddressProvider } from '@/store/AddressContext';
import { PaymentMethodsProvider } from '@/store/PaymentMethodsContext';
import { ChatProvider } from '@/store/ChatContext';
import { BottomNav } from '@/components/BottomNav';
import { ShopChatWidget } from '@/components/ShopChatWidget';
import { YarnRollIntro } from '@/components/YarnRollIntro';
import { COLORS } from '@/constants/theme';
import { recordSecurityAudit } from '@/utils/securityGuard';

const PROTECTED_ROUTES = new Set([
  'checkout',
  'payment',
  'orders',
  'addresses',
  'add-product',
  'edit-product',
  'manage-products',
  'payment-methods',
]);

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{
    redirect?: string;
    mode?: string;
    productId?: string;
    quantity?: string;
  }>();

  useEffect(() => {
    if (isLoading) return;
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        const lastVisitLogged = Number(window.sessionStorage.getItem('tcl_session_audit_ts') || '0');
        if (Date.now() - lastVisitLogged > 15 * 60 * 1000) {
          window.sessionStorage.setItem('tcl_session_audit_ts', String(Date.now()));
          recordSecurityAudit({
            eventType: 'PAGE_VISIT',
            severity: 'INFO',
            path: pathname || '/',
            method: 'GET_SESSION',
            userEmail: user?.email || 'Khách (Guest)',
            userId: user?.id || null,
          });
        }
      }
    } catch {
      // ignore
    }
  }, [isLoading, user?.email, user?.id, pathname]);

  useEffect(() => {
    if (isLoading) return;

    const firstSegment = (segments[0] as string) ?? '';
    const inAuthGroup = firstSegment === 'login' || firstSegment === 'register';
    const isProfileEdit = firstSegment === 'profile' && (segments as string[])[1] === 'edit';
    const isProtected = PROTECTED_ROUTES.has(firstSegment) || isProfileEdit;

    if (!isAuthenticated && isProtected) {
      let targetPath = pathname || '/checkout';
      if (firstSegment === 'checkout' && params.mode === 'buyNow' && params.productId) {
        targetPath = `/checkout?mode=buyNow&productId=${encodeURIComponent(params.productId)}&quantity=${encodeURIComponent(params.quantity ?? '1')}`;
      }
      router.replace({
        pathname: '/login',
        params: { redirect: targetPath },
      });
    } else if (isAuthenticated && inAuthGroup) {
      const target = params.redirect || '/';
      router.replace(target as Href);
    }
  }, [isAuthenticated, isLoading, segments, pathname, params.redirect, params.mode, params.productId, params.quantity]);

  return <>{children}</>;
}

function BottomNavGate() {
  const pathname = usePathname();

  // Screens that should NOT show bottom nav
  const hiddenRoutes = [
    'login',
    'register',
    'cart',
    'checkout',
    'settings',
    'help',
    'privacy',
    'payment-methods',
  ];

  // Route patterns (dynamic segments)
  const hiddenPatterns = [
    /^product\/.+$/,
    /^edit-product\/.+$/,
    /^orders\/.+$/,
    /^addresses\/add$/,
    /^profile\/edit$/,
    /^payment\/.+$/,
  ];

  // Normalize pathname: remove leading slash
  const route = pathname.replace(/^\//, '');

  if (hiddenRoutes.includes(route)) return null;
  if (hiddenPatterns.some((p) => p.test(route))) return null;

  return <BottomNav />;
}

export default function RootLayout() {
  // Global Desktop Web Mouse-Drag Horizontal Scroll Engine for all horizontal ScrollViews & FlatLists
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    let activeEl: HTMLElement | null = null;
    let isDown = false;
    let startX = 0;
    let startScrollLeft = 0;
    let hasDragged = false;
    let lastDragEndTs = 0;

    const findHorizontalScrollable = (target: EventTarget | null): HTMLElement | null => {
      let node = target as HTMLElement | null;
      while (node && node !== document.body && node !== document.documentElement) {
        if (node instanceof HTMLElement) {
          const tag = node.tagName.toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'select') {
            return null;
          }
          if (node.scrollWidth > node.clientWidth + 4) {
            const style = window.getComputedStyle(node);
            if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
              return node;
            }
          }
        }
        node = node.parentElement;
      }
      return null;
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const scrollable = findHorizontalScrollable(e.target);
      if (!scrollable) return;
      activeEl = scrollable;
      isDown = true;
      hasDragged = false;
      startX = e.clientX;
      startScrollLeft = scrollable.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown || !activeEl) return;
      const dx = e.clientX - startX;
      if (!hasDragged && Math.abs(dx) > 5) {
        hasDragged = true;
        activeEl.style.cursor = 'grabbing';
        activeEl.style.userSelect = 'none';
      }
      if (hasDragged) {
        e.preventDefault();
        activeEl.scrollLeft = startScrollLeft - dx;
      }
    };

    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      if (activeEl) {
        activeEl.style.cursor = '';
        activeEl.style.userSelect = '';
      }
      if (hasDragged) {
        lastDragEndTs = Date.now();
      }
      activeEl = null;
    };

    const onClickCapture = (e: MouseEvent) => {
      if (hasDragged || Date.now() - lastDragEndTs < 140) {
        hasDragged = false;
        e.stopPropagation();
        e.preventDefault();
      }
    };

    const onDragStartCapture = (e: DragEvent) => {
      if (findHorizontalScrollable(e.target)) {
        e.preventDefault();
      }
    };

    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', endDrag, { passive: true });
    window.addEventListener('mouseleave', endDrag, { passive: true });
    window.addEventListener('click', onClickCapture, true);
    window.addEventListener('dragstart', onDragStartCapture, true);

    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);
      window.removeEventListener('mouseleave', endDrag);
      window.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('dragstart', onDragStartCapture, true);
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ShopProvider>
          <OrderProvider>
            <AddressProvider>
              <PaymentMethodsProvider>
                <ChatProvider>
                  <AuthGate>
                    <StatusBar style="dark" />
                    <View style={{ flex: 1 }}>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: COLORS.cream },
                          animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
                        }}>
                        <Stack.Screen name="login" />
                        <Stack.Screen name="register" />
                        <Stack.Screen name="index" />
                        <Stack.Screen name="product/[id]" />
                        <Stack.Screen name="add-product" />
                        <Stack.Screen name="edit-product/[id]" />
                        <Stack.Screen name="cart" />
                        <Stack.Screen name="favorites" />
                        <Stack.Screen name="profile" />
                        <Stack.Screen name="manage-products" />
                        <Stack.Screen name="checkout" />
                        <Stack.Screen name="orders/index" />
                        <Stack.Screen name="orders/[id]" />
                        <Stack.Screen name="addresses/index" />
                        <Stack.Screen name="addresses/add" />
                        <Stack.Screen name="profile/edit" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="help" />
                        <Stack.Screen name="privacy" />
                        <Stack.Screen name="payment-methods" />
                        <Stack.Screen name="payment/[orderId]" />
                      </Stack>
                      <BottomNavGate />
                      <ShopChatWidget />
                      <YarnRollIntro />
                    </View>
                  </AuthGate>
                </ChatProvider>
              </PaymentMethodsProvider>
            </AddressProvider>
          </OrderProvider>
        </ShopProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
