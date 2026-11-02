import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { Product } from '@/types/product';
import { COLORS } from '@/constants/theme';
import { AUTH_ACCESS_DENIED } from '@/constants/strings';
import { ProductStudioForm } from '@/components/ProductStudioForm';

export default function AddProductScreen() {
  const router = useRouter();
  const { addProduct } = useShop();
  const { role } = useAuth();

  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>{AUTH_ACCESS_DENIED}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSubmit = (newProduct: Product) => {
    addProduct(newProduct);
    router.replace(`/product/${newProduct.id}`);
  };

  return (
    <ProductStudioForm
      mode="add"
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/manage-products');
      }}
      onSubmitProduct={handleSubmit}
    />
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  accessDeniedText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
});
