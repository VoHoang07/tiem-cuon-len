import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ShopProvider } from '@/store/ShopContext';
import { COLORS } from '@/constants/theme';

export default function RootLayout() {
  return (
    <ShopProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.cream },
          animation: 'slide_from_right',
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="add-product" />
        <Stack.Screen name="manage-products" />
        <Stack.Screen name="cart" />
        <Stack.Screen name="favorites" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="checkout" />
      </Stack>
    </ShopProvider>
  );
}
