import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Plus,
  Edit3,
  Trash2,
  Package,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SPACING, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji } from '@/utils/getCategoryEmoji';
import { Product } from '@/types/product';

export default function ManageProductsScreen() {
  const router = useRouter();
  const { products, removeProduct } = useShop();
  const { role } = useAuth();

  // Access control: redirect customer to home
  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Bạn không có quyền truy cập</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = (product: Product) => {
    Alert.alert(
      'Xóa sản phẩm',
      `Bạn có chắc muốn xóa "${product.name}" không?`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: () => removeProduct(product.id),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quản lý sản phẩm</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Package size={20} color={COLORS.primary} />
            <Text style={styles.statNumber}>{products.length}</Text>
            <Text style={styles.statLabel}>Tổng sản phẩm</Text>
          </View>
        </View>

        {/* Add Product Button */}
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/add-product')}>
          <Plus size={20} color={COLORS.white} />
          <Text style={styles.addBtnText}>Thêm sản phẩm mới</Text>
        </TouchableOpacity>

        {/* Product List */}
        <View style={styles.productList}>
          <Text style={styles.sectionTitle}>Tất cả sản phẩm</Text>

          {products.length === 0 ? (
            <View style={styles.empty}>
              <Package size={48} color={COLORS.lightText} />
              <Text style={styles.emptyText}>Chưa có sản phẩm nào</Text>
              <Text style={styles.emptySubtext}>
                Nhấn "Thêm sản phẩm mới" để bắt đầu
              </Text>
            </View>
          ) : (
            products.map((product) => (
              <View key={product.id} style={styles.productItem}>
                <View style={styles.productImageContainer}>
                  <Text style={styles.productEmoji}>
                    {getCategoryEmoji(product.category)}
                  </Text>
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {product.name}
                  </Text>
                  <Text style={styles.productPrice}>
                    {formatVND(product.price)}
                  </Text>
                  <View style={styles.productMeta}>
                    <Text style={styles.productStock}>
                      SL: {product.quantity}
                    </Text>
                    <Text style={styles.productCategory}>
                      {product.category}
                    </Text>
                  </View>
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                      router.push(`/edit-product/${product.id}`)
                    }>
                    <Edit3 size={18} color={COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(product)}>
                    <Trash2 size={18} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.darkText,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.darkText,
    marginTop: SPACING.sm,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    marginHorizontal: SPACING.lg,
    borderRadius: 16,
    paddingVertical: 14,
    marginBottom: SPACING.xl,
    ...SHADOWS.medium,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  productList: {
    paddingHorizontal: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.md,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  productImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 10,
    backgroundColor: COLORS.softBeige,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  productEmoji: {
    fontSize: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
  },
  productPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },
  productMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 2,
  },
  productStock: {
    fontSize: 12,
    color: COLORS.mediumText,
  },
  productCategory: {
    fontSize: 12,
    color: COLORS.mediumText,
  },
  productActions: {
    flexDirection: 'column',
    gap: SPACING.sm,
  },
  editBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.lightPurple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.mediumText,
  },
  emptySubtext: {
    fontSize: 13,
    color: COLORS.lightText,
    textAlign: 'center',
  },
  accessDenied: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 120,
  },
  accessDeniedText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.warmBrown,
  },
  });
