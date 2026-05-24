import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ShopProvider } from '@/store/ShopContext';
import { AuthProvider, useAuth } from '@/store/AuthContext';
import { OrderProvider } from '@/store/OrderContext';
import { AddressProvider } from '@/store/AddressContext';
import { COLORS } from '@/constants/theme';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <ShopProvider>
        <OrderProvider>
          <AddressProvider>
            <AuthGate>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: COLORS.cream },
                  animation: 'slide_from_right',
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
              </Stack>
            </AuthGate>
          </AddressProvider>
        </OrderProvider>
      </ShopProvider>
    </AuthProvider>
  );
}
