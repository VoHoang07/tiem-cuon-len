import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { Product } from '@/types/product';
import { COLORS } from '@/constants/theme';
import { AUTH_ACCESS_DENIED } from '@/constants/strings';
import { ProductStudioForm } from '@/components/ProductStudioForm';

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { products, updateProduct } = useShop();
  const { role } = useAuth();

  const existingProduct = products.find((p) => p.id === id);

  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>{AUTH_ACCESS_DENIED}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!existingProduct) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Không tìm thấy sản phẩm</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleSubmit = async (updatedProduct: Product) => {
    await updateProduct(existingProduct.id, updatedProduct);
    router.replace(`/product/${existingProduct.id}`);
  };

  return (
    <ProductStudioForm
      key={existingProduct.id}
      mode="edit"
      initialProduct={existingProduct}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace(`/product/${existingProduct.id}`);
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
