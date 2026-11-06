import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
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
  FileText,
} from 'lucide-react-native';
import { useShop } from '@/store/ShopContext';
import { useProducts } from '@/store/ProductContext';
import { useAuth } from '@/store/AuthContext';
import { CategoryChips } from '@/components/CategoryChips';
import { COLORS, SPACING, SHADOWS, CATEGORIES } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import { Product, Category } from '@/types/product';
import {
  AdminProductDraft,
  loadAdminDrafts,
  deleteAdminDraft,
} from '@/utils/productDraftStore';

export default function ManageProductsScreen() {
  const router = useRouter();
  const { products, removeProduct } = useShop();
  const { importProductsFromRawData } = useProducts();
  const { role, isLoading } = useAuth();
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth > 0 ? rawWidth : 390) < 640;

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('All');
  const [drafts, setDrafts] = useState<AdminProductDraft[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleImportFile = useCallback(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.json,text/csv,application/json';
    input.onchange = async (e: any) => {
      const file = e?.target?.files?.[0];
      if (!file) return;
      setIsImporting(true);
      setImportMessage(null);
      try {
        const text = await file.text();
        const count = await importProductsFromRawData(text);
        if (count > 0) {
          setImportMessage({
            type: 'success',
            text: `Đã khôi phục và đồng bộ thành công ${count} sản phẩm lên hệ thống mới!`,
          });
        } else {
          setImportMessage({
            type: 'error',
            text: 'Không tìm thấy sản phẩm hợp lệ trong file CSV/JSON vừa chọn.',
          });
        }
      } catch {
        setImportMessage({
          type: 'error',
          text: 'Lỗi đọc file CSV/JSON. Vui lòng thử lại.',
        });
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  }, [importProductsFromRawData]);

  const refreshDrafts = useCallback(async () => {
    const list = await loadAdminDrafts();
    setDrafts(list);
  }, []);

  useEffect(() => {
    void refreshDrafts();
  }, [refreshDrafts]);

  useFocusEffect(
    useCallback(() => {
      void refreshDrafts();
    }, [refreshDrafts])
  );

  const handleDeleteDraft = async (draft: AdminProductDraft) => {
    const next = await deleteAdminDraft(draft.id);
    setDrafts(next);
  };

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

  const madeToOrderCount = useMemo(
    () => products.filter((p) => p.isMadeToOrder !== false).length,
    [products]
  );
  const readyStockCount = useMemo(
    () => products.filter((p) => p.isMadeToOrder === false).length,
    [products]
  );

  // Access control: redirect customer to home
  if (!isLoading && role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>Bạn không có quyền truy cập</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleDelete = (product: Product) => {
    if (Platform.OS === 'web') {
      removeProduct(product.id);
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
        style={[styles.productItem, isMobile && styles.productItemMobile]}
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
            <View
              style={[
                styles.stockPill,
                item.isMadeToOrder === false && item.quantity <= 2 && styles.stockPillLow,
              ]}>
              <Text
                style={[
                  styles.productStock,
                  item.isMadeToOrder === false && item.quantity <= 2 && styles.productStockLow,
                ]}>
                {item.isMadeToOrder !== false
                  ? '🧶 Sản phẩm Order'
                  : `Kho: ${item.quantity}`}
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
      <View style={[styles.header, isMobile && styles.headerMobile]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backBtn}>
            <ChevronLeft size={22} color={COLORS.darkText} />
          </TouchableOpacity>
          {!isMobile && (
            <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/')}>
              <Home size={19} color={COLORS.darkText} />
            </TouchableOpacity>
          )}
        </View>
        <Text
          style={[styles.headerTitle, isMobile && styles.headerTitleMobile]}
          numberOfLines={1}>
          Quản lý kho sản phẩm
        </Text>
        <TouchableOpacity
          style={styles.headerAddBtn}
          onPress={() => router.push('/add-product')}>
          <Plus size={17} color="#3D2B1F" />
          <Text style={styles.headerAddText}>Thêm</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
        <View style={styles.statCard}>
          <Package size={19} color="#3D2B1F" />
          <Text style={styles.statNumber}>{products.length}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>Mẫu sản phẩm</Text>
        </View>
        <View style={styles.statCard}>
          <Layers size={19} color="#3D2B1F" />
          <Text style={styles.statNumber}>{madeToOrderCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>Mẫu Order</Text>
        </View>
        <View style={styles.statCard}>
          <AlertTriangle size={19} color="#3D2B1F" />
          <Text style={styles.statNumber}>{readyStockCount}</Text>
          <Text style={styles.statLabel} numberOfLines={1}>Mẫu có sẵn</Text>
        </View>
      </View>

      {/* Add Product & CSV Restore Buttons */}
      <View style={[styles.actionRowWrap, isMobile && styles.actionRowWrapMobile]}>
        <TouchableOpacity
          style={[styles.addBtn, styles.actionBtnFlex]}
          onPress={() => router.push('/add-product')}
          activeOpacity={0.85}>
          <Plus size={20} color="#3D2B1F" />
          <Text style={styles.addBtnText}>Thêm sản phẩm thủ công mới</Text>
        </TouchableOpacity>

        {Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.importCsvBtn, isImporting && { opacity: 0.65 }]}
            onPress={handleImportFile}
            disabled={isImporting}
            activeOpacity={0.85}>
            <FileText size={18} color="#5C4332" />
            <Text style={styles.importCsvBtnText}>
              {isImporting ? 'Đang khôi phục & đồng bộ...' : 'Nhập CSV / JSON khôi phục'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {importMessage && (
        <View
          style={[
            styles.importFeedbackBanner,
            isMobile && styles.addBtnMobile,
            importMessage.type === 'error' && styles.importFeedbackBannerError,
          ]}>
          <Text
            style={[
              styles.importFeedbackText,
              importMessage.type === 'error' && styles.importFeedbackTextError,
            ]}>
            {importMessage.text}
          </Text>
        </View>
      )}

      {/* Admin Saved Drafts Section (Only visible to Admin) */}
      {drafts.length > 0 && (
        <View style={[styles.draftsSectionBox, isMobile && styles.draftsSectionBoxMobile]}>
          <View style={styles.draftsHeaderRow}>
            <FileText size={16} color="#92400E" />
            <Text style={styles.draftsSectionTitle}>
              Bản nháp đang lưu ({drafts.length}) — Chưa đăng lên kệ
            </Text>
          </View>
          <Text style={styles.draftsSectionSub}>
            Bấm vào bản nháp để mở lại toàn bộ ảnh & thông tin đang nhập dở và đăng tiếp:
          </Text>

          {drafts.map((d, idx) => {
            const thumbUri =
              d.coverImage ||
              (d.colorOptions?.find((c) => typeof c.image === 'string')?.image as string | undefined) ||
              d.extraPhotos?.[0] ||
              null;
            const numPrice = Number((d.price || '').replace(/[^0-9]/g, ''));
            const photoCount =
              (d.coverImage ? 1 : 0) +
              (d.colorOptions?.filter((c) => Boolean(c.image)).length || 0) +
              (d.extraPhotos?.length || 0);

            return (
              <TouchableOpacity
                key={d.id || idx}
                style={styles.draftCardItem}
                onPress={() =>
                  router.push({
                    pathname: '/add-product',
                    params: { draftId: d.id },
                  })
                }
                activeOpacity={0.82}>
                <View style={styles.draftThumbWrap}>
                  {thumbUri ? (
                    <Image
                      source={{ uri: thumbUri }}
                      style={styles.productThumb}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={styles.productEmoji}>
                      {getCategoryEmoji(d.category || 'Crochet')}
                    </Text>
                  )}
                </View>

                <View style={styles.productInfo}>
                  <Text style={styles.productName} numberOfLines={1}>
                    {d.name?.trim() || `Bản nháp #${idx + 1} (Chưa đặt tên)`}
                  </Text>
                  <Text style={styles.draftMetaPrice}>
                    {numPrice > 0 ? formatVND(numPrice) : 'Chưa nhập giá'} • {photoCount} ảnh •{' '}
                    {d.colorOptions?.length || 1} phân loại
                  </Text>
                  <View style={styles.productMeta}>
                    <View style={styles.draftBadgePill}>
                      <Text style={styles.draftBadgeText}>📝 Bản nháp Admin</Text>
                    </View>
                    <Text style={styles.productCategory}>
                      {getCategoryEmoji(d.category || 'Crochet')}{' '}
                      {getCategoryLabel(d.category || 'Crochet')}
                    </Text>
                  </View>
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity
                    style={styles.resumeDraftBtn}
                    onPress={() =>
                      router.push({
                        pathname: '/add-product',
                        params: { draftId: d.id },
                      })
                    }>
                    <Edit3 size={15} color="#FFFDF9" />
                    <Text style={styles.resumeDraftBtnText}>Đăng tiếp</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => void handleDeleteDraft(d)}>
                    <Trash2 size={16} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Search & Category Filter */}
      <View style={[styles.searchBar, isMobile && styles.searchBarMobile]}>
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
    gap: 8,
  },
  headerMobile: {
    paddingHorizontal: 12,
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
    flex: 1,
    fontSize: 19,
    fontWeight: '900',
    color: '#3D2B1F',
    textAlign: 'center',
  },
  headerTitleMobile: {
    fontSize: 17,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 11,
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
  statsRowMobile: {
    paddingHorizontal: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
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
    textAlign: 'center',
  },
  actionRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  actionRowWrapMobile: {
    marginHorizontal: 12,
  },
  actionBtnFlex: {
    flex: 1,
    minWidth: 220,
    marginHorizontal: 0,
    marginBottom: 0,
  },
  importCsvBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    ...SHADOWS.small,
  },
  importCsvBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  importFeedbackBanner: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  importFeedbackBannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  importFeedbackText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065F46',
    textAlign: 'center',
  },
  importFeedbackTextError: {
    color: '#991B1B',
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
  addBtnMobile: {
    marginHorizontal: 12,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  draftsSectionBox: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: '#FFFBEB',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#F59E0B',
    gap: 8,
  },
  draftsSectionBoxMobile: {
    marginHorizontal: 12,
    padding: 12,
  },
  draftsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  draftsSectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#92400E',
  },
  draftsSectionSub: {
    fontSize: 12,
    color: '#78350F',
    marginBottom: 4,
  },
  draftCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 10,
  },
  draftThumbWrap: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  draftMetaPrice: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#92400E',
  },
  draftBadgePill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  draftBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  resumeDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#92400E',
    paddingHorizontal: 11,
    height: 36,
    borderRadius: 10,
  },
  resumeDraftBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFDF9',
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
  searchBarMobile: {
    marginHorizontal: 12,
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
    paddingHorizontal: 14,
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
  productItemMobile: {
    marginHorizontal: 12,
    padding: 10,
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
    minWidth: 0,
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
    flexWrap: 'wrap',
    gap: 6,
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
