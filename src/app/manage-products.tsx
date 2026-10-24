import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  Plus,
  Edit3,
  Trash2,
  Package,
  Search,
  X,
  Home,
  Layers,
  AlertTriangle,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { CategoryChips } from '@/components/CategoryChips';
import { COLORS, SPACING, SHADOWS, CATEGORIES } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import { Product, Category } from '@/types/product';

export default function ManageProductsScreen() {
  const router = useRouter();
  const { products, removeProduct } = useShop();
  const { role } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');

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

  const filteredProducts = useMemo(() => {
    let list = [...products];
    if (selectedCategory !== 'All') {
      list = list.filter((p) => p.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.material.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedCategory, search]);

  const totalStock = useMemo(
    () => products.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
    [products]
  );
  const lowStockCount = useMemo(
    () => products.filter((p) => p.quantity <= 2).length,
    [products]
  );

  const handleDelete = (product: Product) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.confirm) {
      const ok = window.confirm(`Bạn có chắc muốn xóa "${product.name}" khỏi kho không?`);
      if (ok) removeProduct(product.id);
      return;
    }
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

  const renderItem = ({ item }: { item: Product }) => (
    <View style={styles.constrainedRow}>
      <TouchableOpacity
        style={styles.productItem}
        onPress={() => router.push(`/product/${item.id}`)}
        activeOpacity={0.8}>
        <View style={styles.productImageContainer}>
          {item.image ? (
            <Image
              source={typeof item.image === 'string' ? { uri: item.image } : (item.image as any)}
              style={styles.productThumb}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.productEmoji}>
              {getCategoryEmoji(item.category)}
            </Text>
          )}
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.productPrice}>
            {formatVND(item.price)}
          </Text>
          <View style={styles.productMeta}>
            <View style={[styles.stockPill, item.quantity <= 2 && styles.stockPillLow]}>
              <Text style={[styles.productStock, item.quantity <= 2 && styles.productStockLow]}>
                Kho: {item.quantity}
              </Text>
            </View>
            <Text style={styles.productCategory}>
              {getCategoryEmoji(item.category)} {getCategoryLabel(item.category)}
            </Text>
          </View>
        </View>

        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => router.push(`/edit-product/${item.id}`)}>
            <Edit3 size={17} color="#3D2B1F" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete(item)}>
            <Trash2 size={17} color={COLORS.error} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );

  const ListHeader = (
    <View style={styles.constrained}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
            <Home size={19} color={COLORS.darkText} />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>Quản lý kho sản phẩm</Text>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => router.push('/add-product')}>
          <Plus size={18} color="#3D2B1F" />
          <Text style={styles.headerAddText}>Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Package size={19} color="#3D2B1F" />
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel}>Mẫu sản phẩm</Text>
        </View>
        <View style={styles.statCard}>
          <Layers size={19} color="#3D2B1F" />
          <Text style={styles.statNumber}>{totalStock}</Text>
          <Text style={styles.statLabel}>Tổng tồn kho</Text>
        </View>
        <View style={styles.statCard}>
          <AlertTriangle size={19} color={lowStockCount > 0 ? '#D97706' : '#3D2B1F'} />
          <Text style={styles.statNumber}>{lowStockCount}</Text>
          <Text style={styles.statLabel}>Sắp hết hàng</Text>
        </View>
      </View>

      {/* Add Product Button */}
      <TouchableOpacity
        style={styles.addBtn}
        onPress={() => router.push('/add-product')}
        activeOpacity={0.85}>
        <Plus size={20} color="#3D2B1F" />
        <Text style={styles.addBtnText}>Thêm sản phẩm thủ công mới</Text>
      </TouchableOpacity>

      {/* Search & Category Filter */}
      <View style={styles.searchBar}>
        <Search size={17} color={COLORS.mediumText} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm sản phẩm trong kho..."
          placeholderTextColor={COLORS.lightText}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={COLORS.mediumText} />
          </TouchableOpacity>
        )}
      </View>

      <CategoryChips
        categories={[...CATEGORIES]}
        selected={selectedCategory}
        onSelect={setSelectedCategory}
      />

      <Text style={styles.sectionTitle}>
        Danh sách sản phẩm ({filteredProducts.length})
      </Text>
    </View>
  );

  const ListEmpty = (
    <View style={[styles.constrained, styles.empty]}>
      <Package size={48} color={COLORS.lightText} />
      <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào</Text>
      <Text style={styles.emptySubtext}>
        Nhấn "Thêm sản phẩm thủ công mới" để bổ sung mặt hàng vào kho
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        data={filteredProducts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.cream,
  },
  listContent: {
    paddingBottom: SPACING.xxxl + 90,
  },
  constrained: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  constrainedRow: {
    width: '100%',
    maxWidth: 840,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  headerAddText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: 10,
    marginBottom: SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
    color: '#3D2B1F',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11.5,
    color: COLORS.mediumText,
    marginTop: 2,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#D8C3AD',
    marginHorizontal: SPACING.lg,
    borderRadius: 18,
    paddingVertical: 14,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: '#C4AA90',
    ...SHADOWS.small,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    marginHorizontal: SPACING.lg,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.darkText,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2B1F',
    marginTop: 4,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  productItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    marginHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    ...SHADOWS.small,
  },
  productImageContainer: {
    width: 60,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
    overflow: 'hidden',
  },
  productThumb: {
    width: '100%',
    height: '100%',
  },
  productEmoji: {
    fontSize: 26,
  },
  productInfo: {
    flex: 1,
    gap: 3,
  },
  productName: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.primary,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  stockPill: {
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockPillLow: {
    backgroundColor: '#FEF3C7',
  },
  productStock: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  productStockLow: {
    color: '#B45309',
  },
  productCategory: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  productActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FDF0ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F5C9C0',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
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
