import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import {
  ChevronLeft,
  Camera,
  Image as ImageIcon,
  Plus,
  Trash2,
  Sparkles,
  Check,
  X,
} from 'lucide-react-native';
import {
  Product,
  Category,
  ProductColorOption,
  ProductAccessoryOption,
  ProductGalleryItem,
} from '@/types/product';
import { COLORS, SPACING, SHADOWS, CATEGORIES } from '@/constants/theme';
import {
  generateProductDescription,
  inferCategory,
  inferColorHex,
} from '@/utils/generateProductDescription';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import { formatVND } from '@/utils/formatCurrency';

const MAX_WIDTH = 1040;

const COLOR_SWATCHES = [
  { name: 'Kem Sữa', hex: '#F5EBE0' },
  { name: 'Trắng Tinh', hex: '#FAF7F2' },
  { name: 'Hồng Phấn', hex: '#F4ACB7' },
  { name: 'Đỏ Dâu', hex: '#E63946' },
  { name: 'Vàng Bơ', hex: '#FDE047' },
  { name: 'Cam Đào', hex: '#F4A261' },
  { name: 'Xanh Bơ', hex: '#B7E4C7' },
  { name: 'Xanh Dương', hex: '#93C5FD' },
  { name: 'Tím Khoai Môn', hex: '#CDB4DB' },
  { name: 'Nâu Caramel', hex: '#A67B5B' },
];

const QUICK_ACCESSORIES = [
  { name: 'Ôm dâu tây đỏ', emoji: '🍓', priceDelta: 0 },
  { name: 'Đeo nơ lụa cổ', emoji: '🎀', priceDelta: 0 },
  { name: 'Đội mũ hoa cúc', emoji: '🌼', priceDelta: 10000 },
  { name: 'Đeo túi chéo mini', emoji: '👜', priceDelta: 10000 },
  { name: 'Hộp quà mica + Đèn LED', emoji: '🎁', priceDelta: 15000 },
];

const PRICE_DELTAS = [0, 5000, 10000, 15000, 25000];
const EMOJI_LIST = ['🍓', '🎀', '🌼', '🎁', '👜', '👑', '🧣', '✨', '🌸'];

/**
 * Keep full HD sharpness (up to 1600px at 0.92 quality).
 * If the image is already reasonably sized (< 950KB), keep original dataURI untouched.
 */
async function optimizeHdImageIfWeb(
  dataUri: string,
  maxSide: number = 1600,
  quality: number = 0.92
): Promise<string> {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof document === 'undefined'
  ) {
    return dataUri;
  }
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        const origW = img.width || maxSide;
        const origH = img.height || maxSide;
        if (origW <= maxSide && origH <= maxSide && dataUri.length < 1_300_000) {
          resolve(dataUri);
          return;
        }
        let w = origW;
        let h = origH;
        if (w > maxSide || h > maxSide) {
          if (w >= h) {
            h = Math.round((h * maxSide) / w);
            w = maxSide;
          } else {
            w = Math.round((w * maxSide) / h);
            h = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUri);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL('image/jpeg', quality);
        resolve(out || dataUri);
      };
      img.onerror = () => resolve(dataUri);
      img.src = dataUri;
    } catch {
      resolve(dataUri);
    }
  });
}

async function pickHdImage(useCamera: boolean = false): Promise<string | null> {
  if (useCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền máy ảnh', 'Vui lòng cấp quyền sử dụng máy ảnh.');
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const mime = res.assets[0].mimeType || 'image/jpeg';
      return await optimizeHdImageIfWeb(`data:${mime};base64,${res.assets[0].base64}`);
    }
    return null;
  }

  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Cần quyền thư viện', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync({
    quality: 1,
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
  });
  if (!res.canceled && res.assets[0]?.base64) {
    const mime = res.assets[0].mimeType || 'image/jpeg';
    return await optimizeHdImageIfWeb(`data:${mime};base64,${res.assets[0].base64}`);
  }
  return null;
}

export interface ProductStudioFormProps {
  mode: 'add' | 'edit';
  initialProduct?: Product;
  onBack: () => void;
  onSubmitProduct: (product: Product) => Promise<void> | void;
}

export function ProductStudioForm({
  mode,
  initialProduct,
  onBack,
  onSubmitProduct,
}: ProductStudioFormProps) {
  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isDesktop = windowWidth >= 820;

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [price, setPrice] = useState(
    initialProduct?.price ? String(initialProduct.price) : ''
  );
  const [category, setCategory] = useState<Category>(
    initialProduct?.category ?? 'Crochet'
  );
  const [material, setMaterial] = useState(
    initialProduct?.material ?? 'Len Cotton Milk'
  );
  const [quantity, setQuantity] = useState(
    initialProduct?.quantity !== undefined ? String(initialProduct.quantity) : '20'
  );
  const [description, setDescription] = useState(
    initialProduct?.description ?? ''
  );
  const [tags, setTags] = useState(
    initialProduct?.tags ? initialProduct.tags.join(', ') : ''
  );

  const [colorOptions, setColorOptions] = useState<ProductColorOption[]>(() => {
    if (initialProduct?.colorOptions && initialProduct.colorOptions.length > 0) {
      return initialProduct.colorOptions.map((c, idx) => ({
        ...c,
        image: c.image || (idx === 0 ? initialProduct.image : undefined),
      }));
    }
    if (initialProduct) {
      return [
        {
          id: 'c_1',
          name: initialProduct.color || 'Kem Sữa',
          hex: inferColorHex(initialProduct.color || 'Kem Sữa', 0),
          image: initialProduct.image,
        },
      ];
    }
    return [
      { id: 'c_1', name: 'Kem Sữa', hex: '#F5EBE0' },
      { id: 'c_2', name: 'Hồng Phấn', hex: '#F4ACB7' },
    ];
  });

  const [accessoryOptions, setAccessoryOptions] = useState<
    ProductAccessoryOption[]
  >(() => {
    if (
      initialProduct?.accessoryOptions &&
      initialProduct.accessoryOptions.length > 0
    ) {
      return initialProduct.accessoryOptions;
    }
    if (initialProduct) return [];
    return [
      { id: 'a_1', name: 'Ôm dâu tây đỏ', emoji: '🍓', priceDelta: 0 },
    ];
  });

  const [extraPhotos, setExtraPhotos] = useState<string[]>(() => {
    if (!initialProduct?.gallery) return [];
    return initialProduct.gallery
      .filter(
        (g) =>
          typeof g.image === 'string' && !g.colorId && g.zoomMode !== 'closeup'
      )
      .map((g) => g.image as string);
  });

  // Track whether the admin is currently viewing/editing a Color slot or an Extra Angle slot
  const [activeSlot, setActiveSlot] = useState<
    { type: 'color'; index: number } | { type: 'extra'; index: number }
  >({ type: 'color', index: 0 });

  const safeColorIdx =
    activeSlot.type === 'color' &&
    activeSlot.index >= 0 &&
    activeSlot.index < colorOptions.length
      ? activeSlot.index
      : 0;

  const activeColor = colorOptions[safeColorIdx] ?? colorOptions[0];

  const currentDisplayImage =
    activeSlot.type === 'extra'
      ? extraPhotos[activeSlot.index]
      : activeColor?.image || colorOptions.find((c) => c.image)?.image || initialProduct?.image;

  /* ---- Handlers for Photo Selection ---- */
  const handlePickCurrentSlotPhoto = async (useCamera: boolean = false) => {
    const uri = await pickHdImage(useCamera);
    if (!uri) return;

    if (activeSlot.type === 'extra') {
      const next = [...extraPhotos];
      next[activeSlot.index] = uri;
      setExtraPhotos(next);
    } else {
      const next = colorOptions.map((c, i) =>
        i === safeColorIdx ? { ...c, image: uri } : c
      );
      setColorOptions(next);
    }
  };

  const handleAddExtraAnglePhoto = async () => {
    const uri = await pickHdImage(false);
    if (!uri) return;
    const next = [...extraPhotos, uri];
    setExtraPhotos(next);
    setActiveSlot({ type: 'extra', index: next.length - 1 });
  };

  const handleRemoveExtraPhoto = (idx: number) => {
    const next = extraPhotos.filter((_, i) => i !== idx);
    setExtraPhotos(next);
    setActiveSlot({ type: 'color', index: 0 });
  };

  /* ---- Handlers for Color Options ---- */
  const handleAddColorOption = () => {
    const nextIdx = colorOptions.length;
    const preset =
      COLOR_SWATCHES.find(
        (sw) =>
          !colorOptions.some(
            (c) => c.name.trim().toLowerCase() === sw.name.toLowerCase()
          )
      ) || COLOR_SWATCHES[nextIdx % COLOR_SWATCHES.length];

    const newColor: ProductColorOption = {
      id: `c_${Date.now()}_${nextIdx + 1}`,
      name: preset.name,
      hex: preset.hex,
      image: undefined,
    };
    const next = [...colorOptions, newColor];
    setColorOptions(next);
    setActiveSlot({ type: 'color', index: next.length - 1 });
  };

  const handleUpdateActiveColor = (patch: Partial<ProductColorOption>) => {
    const next = colorOptions.map((c, i) => {
      if (i !== safeColorIdx) return c;
      const updated = { ...c, ...patch };
      if (patch.name !== undefined && !patch.hex) {
        updated.hex = inferColorHex(patch.name, i);
      }
      return updated;
    });
    setColorOptions(next);
  };

  const handleRemoveColorOption = (idx: number) => {
    if (colorOptions.length <= 1) {
      Alert.alert('Cần ít nhất 1 màu', 'Sản phẩm cần có tối thiểu 1 phân loại màu.');
      return;
    }
    const next = colorOptions.filter((_, i) => i !== idx);
    setColorOptions(next);
    setActiveSlot({ type: 'color', index: Math.max(0, idx - 1) });
  };

  /* ---- Handlers for Accessory Options ---- */
  const handleAddAccessory = (preset?: {
    name: string;
    emoji: string;
    priceDelta: number;
  }) => {
    const idx = accessoryOptions.length;
    const next: ProductAccessoryOption = {
      id: `a_${Date.now()}_${idx + 1}`,
      name: preset?.name ?? '',
      emoji: preset?.emoji ?? EMOJI_LIST[idx % EMOJI_LIST.length],
      priceDelta: preset?.priceDelta ?? 0,
    };
    setAccessoryOptions([...accessoryOptions, next]);
  };

  const handleUpdateAccessory = (
    idx: number,
    patch: Partial<ProductAccessoryOption>
  ) => {
    setAccessoryOptions(
      accessoryOptions.map((a, i) => (i === idx ? { ...a, ...patch } : a))
    );
  };

  const handleRemoveAccessory = (idx: number) => {
    setAccessoryOptions(accessoryOptions.filter((_, i) => i !== idx));
  };

  /* ---- Auto Generate Description ---- */
  const handleGenerateDescription = () => {
    if (!name.trim()) {
      Alert.alert('Thiếu tên sản phẩm', 'Vui lòng nhập tên sản phẩm trước khi tạo mô tả.');
      return;
    }
    const inferred =
      category === 'Crochet' && name.trim() ? inferCategory(name) : category;
    const desc = generateProductDescription({
      name: name.trim(),
      category: inferred,
      material: material.trim() || 'Len Cotton Milk',
      color: activeColor?.name || 'Kem Sữa',
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setDescription(desc);
    if (inferred !== category) setCategory(inferred);
  };

  /* ---- Save Product ---- */
  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm.');
      return;
    }
    const numPrice = Number(price.replace(/[^0-9]/g, ''));
    if (!numPrice || numPrice <= 0) {
      Alert.alert('Thiếu giá bán', 'Vui lòng nhập giá bán hợp lệ (VNĐ).');
      return;
    }

    const cleanColors = colorOptions
      .filter((c) => c.name.trim().length > 0)
      .map((c, idx) => ({
        ...c,
        id: c.id || `c_${idx + 1}`,
        name: c.name.trim(),
      }));

    const firstAvailableImg =
      cleanColors.find((c) => Boolean(c.image))?.image ||
      extraPhotos[0] ||
      initialProduct?.image ||
      null;

    // Ensure every color option has a valid image (falls back to firstAvailableImg if admin didn't pick a separate image)
    const normalizedColors = cleanColors.map((c) => ({
      ...c,
      image: c.image || firstAvailableImg || undefined,
    }));

    const cleanAccessories = accessoryOptions
      .filter((a) => a.name.trim().length > 0)
      .map((a, idx) => ({
        ...a,
        id: a.id || `a_${idx + 1}`,
        name: a.name.trim(),
        priceDelta: Number(a.priceDelta || 0),
      }));

    const builtGallery: ProductGalleryItem[] = extraPhotos.map((uri, idx) => ({
      id: `g_extra_${idx + 1}`,
      label: `Góc chụp #${idx + 2}`,
      angleTag: `Góc #${idx + 2}`,
      image: uri,
      zoomMode: 'normal',
    }));

    const finalMaterial = material.trim() || 'Len Cotton Milk';
    const finalMainColor = normalizedColors[0]?.name || 'Kem Sữa';
    const finalQty =
      quantity.trim() && !isNaN(Number(quantity)) && Number(quantity) >= 0
        ? Number(quantity)
        : 20;

    const finalDesc =
      description.trim() ||
      generateProductDescription({
        name: name.trim(),
        category,
        material: finalMaterial,
        color: finalMainColor,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });

    const productPayload: Product = {
      ...(initialProduct || {}),
      id: initialProduct?.id || `user_${Date.now()}`,
      name: name.trim(),
      description: finalDesc,
      price: numPrice,
      image: firstAvailableImg,
      category,
      material: finalMaterial,
      color: finalMainColor,
      colorOptions: normalizedColors,
      accessoryOptions: cleanAccessories,
      gallery: builtGallery,
      quantity: finalQty,
      rating: initialProduct?.rating ?? 5,
      reviews: initialProduct?.reviews ?? [],
      isFavorite: initialProduct?.isFavorite ?? false,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: initialProduct?.createdAt || new Date().toISOString(),
    };

    await onSubmitProduct(productPayload);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* 1. Top Navigation Bar (Synchronized with Product Detail) */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <ChevronLeft size={18} color="#4A3728" />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>
            {mode === 'add' ? 'Thêm mẫu sản phẩm mới' : 'Chỉnh sửa sản phẩm'}
          </Text>

          <TouchableOpacity
            style={styles.saveTopBtn}
            onPress={handleSave}
            activeOpacity={0.85}>
            <Check size={16} color="#FFFDF9" />
            <Text style={styles.saveTopBtnText}>Lưu mẫu</Text>
          </TouchableOpacity>
        </View>

        {/* 2. Synchronized 2-Column Boutique Card (Matches product/[id].tsx 1:1) */}
        <View
          style={[
            styles.mainCard,
            isDesktop ? styles.mainCardDesktop : styles.mainCardMobile,
          ]}>
          {/* LEFT COLUMN: 1:1 Square HD Photo + Thumbnail Strip */}
          <View
            style={[styles.galleryCol, isDesktop && styles.galleryColDesktop]}>
            <View style={styles.mainImageFrame}>
              {currentDisplayImage ? (
                <Image
                  source={
                    typeof currentDisplayImage === 'string'
                      ? { uri: currentDisplayImage }
                      : (currentDisplayImage as any)
                  }
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ) : (
                <TouchableOpacity
                  style={styles.emptyImageTapArea}
                  onPress={() => handlePickCurrentSlotPhoto(false)}
                  activeOpacity={0.8}>
                  <ImageIcon size={44} color="#7A5230" />
                  <Text style={styles.emptyImageTitle}>
                    Bấm để tải ảnh sắc nét (HD)
                  </Text>
                  <Text style={styles.emptyImageSub}>
                    Đang chọn màu: {activeColor?.name || 'Màu #1'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Top-left slot indicator */}
              <View style={styles.slotBadge}>
                {activeSlot.type === 'color' ? (
                  <>
                    <View
                      style={[
                        styles.slotDot,
                        { backgroundColor: activeColor?.hex || '#F5EBE0' },
                      ]}
                    />
                    <Text style={styles.slotBadgeText}>
                      Ảnh màu: {activeColor?.name || 'Màu #1'}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.slotBadgeText}>
                    📸 Ảnh góc phụ #{activeSlot.index + 2}
                  </Text>
                )}
              </View>

              {/* Bottom overlay action buttons */}
              <View style={styles.photoOverlayActions}>
                <TouchableOpacity
                  style={styles.photoOverlayBtn}
                  onPress={() => handlePickCurrentSlotPhoto(false)}
                  activeOpacity={0.85}>
                  <ImageIcon size={14} color="#3D2B1F" />
                  <Text style={styles.photoOverlayBtnText}>
                    {currentDisplayImage ? 'Đổi ảnh mẫu này' : 'Chọn ảnh từ máy'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoOverlayBtn}
                  onPress={() => handlePickCurrentSlotPhoto(true)}
                  activeOpacity={0.85}>
                  <Camera size={14} color="#3D2B1F" />
                  <Text style={styles.photoOverlayBtnText}>Chụp ảnh</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Thumbnail Strip: Color Thumbnails + Extra Angle Thumbnails + Add Button */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}>
              {colorOptions.map((c, idx) => {
                const isSelected =
                  activeSlot.type === 'color' && safeColorIdx === idx;
                const thumbImg =
                  c.image ||
                  (idx === 0 ? initialProduct?.image : undefined);
                return (
                  <TouchableOpacity
                    key={c.id || idx}
                    style={styles.thumbItemWrap}
                    onPress={() => setActiveSlot({ type: 'color', index: idx })}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.thumbBox,
                        isSelected && styles.thumbBoxActive,
                      ]}>
                      {thumbImg ? (
                        <Image
                          source={
                            typeof thumbImg === 'string'
                              ? { uri: thumbImg }
                              : (thumbImg as any)
                          }
                          style={styles.thumbImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.thumbEmpty}>
                          <ImageIcon size={16} color="#8C7A6B" />
                        </View>
                      )}
                    </View>
                    <View style={styles.thumbLabelRow}>
                      <View
                        style={[
                          styles.miniDot,
                          { backgroundColor: c.hex || '#F5EBE0' },
                        ]}
                      />
                      <Text style={styles.thumbLabelText} numberOfLines={1}>
                        {c.name || `Màu ${idx + 1}`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              {extraPhotos.map((uri, idx) => {
                const isSelected =
                  activeSlot.type === 'extra' && activeSlot.index === idx;
                return (
                  <TouchableOpacity
                    key={`extra_${idx}`}
                    style={styles.thumbItemWrap}
                    onPress={() => setActiveSlot({ type: 'extra', index: idx })}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.thumbBox,
                        isSelected && styles.thumbBoxActive,
                      ]}>
                      <Image
                        source={{ uri }}
                        style={styles.thumbImg}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.thumbDeleteMini}
                        onPress={() => handleRemoveExtraPhoto(idx)}>
                        <X size={10} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.thumbLabelText}>Góc #{idx + 2}</Text>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                style={styles.thumbItemWrap}
                onPress={handleAddExtraAnglePhoto}
                activeOpacity={0.8}>
                <View style={styles.addThumbBox}>
                  <Plus size={18} color="#5C4738" />
                </View>
                <Text style={styles.thumbLabelText}>+ Góc chụp</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* RIGHT COLUMN: Synchronized Product Details & Options */}
          <View style={[styles.infoCol, isDesktop && styles.infoColDesktop]}>
            {/* Category Selector */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Danh mục</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsRow}>
                {CATEGORIES.filter((c) => c !== 'All').map((cat) => {
                  const active = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.catChip,
                        active && styles.catChipActive,
                      ]}
                      onPress={() => setCategory(cat)}>
                      <Text
                        style={[
                          styles.catChipText,
                          active && styles.catChipTextActive,
                        ]}>
                        {getCategoryEmoji(cat)} {getCategoryLabel(cat)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Product Name */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Tên sản phẩm *</Text>
              <TextInput
                style={styles.titleInput}
                value={name}
                onChangeText={setName}
                placeholder="VD: Móc Khoá Thỏ Tai Cụp Handmade"
                placeholderTextColor={COLORS.lightText}
              />
            </View>

            {/* Price + Quantity + Material on 1 compact row */}
            <View style={styles.compactRow}>
              <View style={[styles.fieldBlock, { flex: 1.2 }]}>
                <Text style={styles.fieldLabel}>Giá bán (VNĐ) *</Text>
                <TextInput
                  style={styles.priceInput}
                  value={price}
                  onChangeText={setPrice}
                  placeholder="VD: 65000"
                  placeholderTextColor={COLORS.lightText}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.fieldBlock, { flex: 0.7 }]}>
                <Text style={styles.fieldLabel}>Số lượng</Text>
                <TextInput
                  style={styles.stdInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="20"
                  placeholderTextColor={COLORS.lightText}
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.fieldBlock, { flex: 1.3 }]}>
                <Text style={styles.fieldLabel}>Chất liệu</Text>
                <TextInput
                  style={styles.stdInput}
                  value={material}
                  onChangeText={setMaterial}
                  placeholder="Len Cotton Milk"
                  placeholderTextColor={COLORS.lightText}
                />
              </View>
            </View>

            {/* Description with inline AI generator button */}
            <View style={styles.fieldBlock}>
              <View style={styles.labelWithActionRow}>
                <Text style={styles.fieldLabel}>Mô tả sản phẩm</Text>
                <TouchableOpacity
                  style={styles.sparkleMiniBtn}
                  onPress={handleGenerateDescription}
                  activeOpacity={0.8}>
                  <Sparkles size={13} color="#4A3728" />
                  <Text style={styles.sparkleMiniBtnText}>Tự tạo mô tả nhanh</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.descInput}
                value={description}
                onChangeText={setDescription}
                placeholder="Mô tả chất liệu, kích thước, ý nghĩa quà tặng..."
                placeholderTextColor={COLORS.lightText}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.divider} />

            {/* COLOR OPTIONS (Matches product/[id].tsx pill selector) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Màu sắc ({colorOptions.length} lựa chọn — chạm vào màu để đổi tên & ảnh bên trái)
              </Text>

              <View style={styles.pillWrap}>
                {colorOptions.map((c, idx) => {
                  const selected =
                    activeSlot.type === 'color' && safeColorIdx === idx;
                  return (
                    <TouchableOpacity
                      key={c.id || idx}
                      style={[
                        styles.optionPill,
                        selected && styles.optionPillSelected,
                      ]}
                      onPress={() => setActiveSlot({ type: 'color', index: idx })}
                      activeOpacity={0.8}>
                      <View
                        style={[
                          styles.colorDot,
                          { backgroundColor: c.hex || '#F5EBE0' },
                        ]}
                      />
                      <Text
                        style={[
                          styles.optionPillText,
                          selected && styles.optionPillTextSelected,
                        ]}>
                        {c.name || `Màu #${idx + 1}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  style={styles.addOptionPill}
                  onPress={handleAddColorOption}
                  activeOpacity={0.8}>
                  <Plus size={14} color="#4A3728" />
                  <Text style={styles.addOptionPillText}>Thêm màu</Text>
                </TouchableOpacity>
              </View>

              {/* Inline editor for the currently selected color */}
              {activeColor && (
                <View style={styles.activeColorEditorBox}>
                  <View style={styles.activeColorInputRow}>
                    <View
                      style={[
                        styles.colorDotLarge,
                        { backgroundColor: activeColor.hex || '#F5EBE0' },
                      ]}
                    />
                    <TextInput
                      style={styles.activeColorNameInput}
                      value={activeColor.name}
                      onChangeText={(txt) =>
                        handleUpdateActiveColor({ name: txt })
                      }
                      placeholder="Tên màu (VD: Kem Sữa, Hồng Phấn...)"
                      placeholderTextColor={COLORS.lightText}
                    />
                    <TouchableOpacity
                      style={styles.pickColorImgBtn}
                      onPress={() => {
                        setActiveSlot({ type: 'color', index: safeColorIdx });
                        handlePickCurrentSlotPhoto(false);
                      }}>
                      <ImageIcon size={13} color="#4A3728" />
                      <Text style={styles.pickColorImgBtnText}>
                        {activeColor.image ? 'Đổi ảnh màu này' : 'Gắn ảnh màu này'}
                      </Text>
                    </TouchableOpacity>
                    {colorOptions.length > 1 && (
                      <TouchableOpacity
                        style={styles.deleteMiniBtn}
                        onPress={() => handleRemoveColorOption(safeColorIdx)}>
                        <Trash2 size={14} color={COLORS.error} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.swatchesMiniRow}>
                    {COLOR_SWATCHES.map((sw) => {
                      const isCurrent =
                        (activeColor.hex || '').toLowerCase() ===
                        sw.hex.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={sw.hex}
                          style={[
                            styles.swatchCircle,
                            { backgroundColor: sw.hex },
                            isCurrent && styles.swatchCircleSelected,
                          ]}
                          onPress={() =>
                            handleUpdateActiveColor({
                              hex: sw.hex,
                              name: activeColor.name.startsWith('Màu')
                                ? sw.name
                                : activeColor.name,
                            })
                          }
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ACCESSORY OPTIONS (Matches product/[id].tsx accessory rows) */}
            <View style={styles.fieldBlock}>
              <View style={styles.labelWithActionRow}>
                <Text style={styles.fieldLabel}>
                  Phụ kiện gắn kèm ({accessoryOptions.length})
                </Text>
                <TouchableOpacity
                  style={styles.sparkleMiniBtn}
                  onPress={() => handleAddAccessory()}
                  activeOpacity={0.8}>
                  <Plus size={13} color="#4A3728" />
                  <Text style={styles.sparkleMiniBtnText}>Thêm phụ kiện</Text>
                </TouchableOpacity>
              </View>

              {/* Quick 1-click preset pills */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPresetsRow}>
                {QUICK_ACCESSORIES.map((qa) => (
                  <TouchableOpacity
                    key={qa.name}
                    style={styles.quickPresetChip}
                    onPress={() => handleAddAccessory(qa)}>
                    <Text style={styles.quickPresetChipText}>
                      + {qa.emoji} {qa.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={styles.accessoryList}>
                {accessoryOptions.map((acc, idx) => (
                  <View key={acc.id || idx} style={styles.accessoryRowCard}>
                    <TouchableOpacity
                      style={styles.emojiCycleBtn}
                      onPress={() => {
                        const cur = EMOJI_LIST.indexOf(acc.emoji || '🍓');
                        const nextEm =
                          EMOJI_LIST[(cur + 1) % EMOJI_LIST.length];
                        handleUpdateAccessory(idx, { emoji: nextEm });
                      }}>
                      <Text style={{ fontSize: 16 }}>{acc.emoji || '🍓'}</Text>
                    </TouchableOpacity>

                    <TextInput
                      style={styles.accNameInput}
                      value={acc.name}
                      onChangeText={(txt) =>
                        handleUpdateAccessory(idx, { name: txt })
                      }
                      placeholder="Tên phụ kiện (VD: Ôm dâu tây đỏ)"
                      placeholderTextColor={COLORS.lightText}
                    />

                    {/* Cycle / pick price delta */}
                    <View style={styles.accPricePills}>
                      {PRICE_DELTAS.map((val) => {
                        const active = (acc.priceDelta ?? 0) === val;
                        return (
                          <TouchableOpacity
                            key={val}
                            style={[
                              styles.accPriceMiniPill,
                              active && styles.accPriceMiniPillActive,
                            ]}
                            onPress={() =>
                              handleUpdateAccessory(idx, { priceDelta: val })
                            }>
                            <Text
                              style={[
                                styles.accPriceMiniText,
                                active && styles.accPriceMiniTextActive,
                              ]}>
                              {val === 0
                                ? 'Miễn phí'
                                : `+${Math.round(val / 1000)}k`}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <TouchableOpacity
                      style={styles.deleteMiniBtn}
                      onPress={() => handleRemoveAccessory(idx)}>
                      <Trash2 size={14} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            {/* Primary Save Button */}
            <TouchableOpacity
              style={styles.submitPrimaryBtn}
              onPress={handleSave}
              activeOpacity={0.85}>
              <Check size={18} color="#FFFDF9" />
              <Text style={styles.submitPrimaryBtnText}>
                {mode === 'add' ? 'Đăng sản phẩm lên kệ' : 'Lưu cập nhật sản phẩm'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAF7F2',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    width: '100%',
    maxWidth: MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    marginBottom: 10,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
  },
  backBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#4A3728',
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  saveTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 999,
    backgroundColor: '#5C4033',
  },
  saveTopBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFDF9',
  },

  /* 2-Column Boutique Card (Same as product/[id].tsx) */
  mainCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDE4D7',
    padding: 24,
    ...SHADOWS.small,
  },
  mainCardDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 32,
  },
  mainCardMobile: {
    flexDirection: 'column',
    padding: 16,
    gap: 18,
  },

  /* Left Column: 1:1 Square Frame + Thumbnails */
  galleryCol: {
    width: '100%',
  },
  galleryColDesktop: {
    flex: 0.95,
    maxWidth: 420,
  },
  mainImageFrame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#F7F2EA',
    borderWidth: 1,
    borderColor: '#EAE0D3',
    overflow: 'hidden',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  emptyImageTapArea: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 20,
  },
  emptyImageTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  emptyImageSub: {
    fontSize: 12.5,
    color: '#8C7A6B',
  },
  slotBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 253, 249, 0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5DACB',
  },
  slotDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.25)',
  },
  slotBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  photoOverlayActions: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoOverlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 253, 249, 0.94)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DFD2C3',
    ...SHADOWS.small,
  },
  photoOverlayBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  thumbRow: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
  },
  thumbItemWrap: {
    width: 66,
    alignItems: 'center',
    gap: 4,
  },
  thumbBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F7F2EA',
    borderWidth: 1.5,
    borderColor: '#EAE0D3',
    position: 'relative',
  },
  thumbBoxActive: {
    borderColor: '#5C4033',
    borderWidth: 2.5,
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbDeleteMini: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(185, 28, 28, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#FAF6F0',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C4B5A6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    maxWidth: '100%',
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.2)',
  },
  thumbLabelText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4738',
  },

  /* Right Column: Synchronized Info & Options */
  infoCol: {
    width: '100%',
    gap: 13,
  },
  infoColDesktop: {
    flex: 1.1,
  },
  fieldBlock: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#6E5A4B',
  },
  labelWithActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sparkleMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F2ECE1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  sparkleMiniBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  categoryChipsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  catChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  catChipActive: {
    backgroundColor: '#5C4033',
    borderColor: '#5C4033',
  },
  catChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#5C4738',
  },
  catChipTextActive: {
    color: '#FFFDF9',
    fontWeight: '700',
  },
  titleInput: {
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 13,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  compactRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priceInput: {
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: '#6E4F37',
  },
  stdInput: {
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  descInput: {
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    lineHeight: 20,
    color: '#4A3728',
    minHeight: 68,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0E8DD',
    marginVertical: 2,
  },

  /* Color Pills & Compact Active Color Editor */
  pillWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  optionPillSelected: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
    borderWidth: 1.5,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.2)',
  },
  optionPillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4738',
  },
  optionPillTextSelected: {
    fontWeight: '700',
    color: '#3D2B1F',
  },
  addOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B8A593',
  },
  addOptionPillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  activeColorEditorBox: {
    backgroundColor: '#FAF6F0',
    borderRadius: 13,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    gap: 8,
    marginTop: 2,
  },
  activeColorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorDotLarge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#4A3728',
  },
  activeColorNameInput: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#3D2B1F',
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  pickColorImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EFE6DA',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DBCAB8',
  },
  pickColorImgBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  swatchesMiniRow: {
    flexDirection: 'row',
    gap: 7,
    paddingVertical: 1,
  },
  swatchCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.22)',
  },
  swatchCircleSelected: {
    borderWidth: 2,
    borderColor: '#3D2B1F',
    transform: [{ scale: 1.12 }],
  },

  /* Accessories List */
  quickPresetsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickPresetChip: {
    backgroundColor: '#FAF6F0',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  quickPresetChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#5C4738',
  },
  accessoryList: {
    gap: 7,
  },
  accessoryRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FAF6F0',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  emojiCycleBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E2D4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accNameInput: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '600',
    color: '#3D2B1F',
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  accPricePills: {
    flexDirection: 'row',
    gap: 4,
  },
  accPriceMiniPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DFCBB4',
  },
  accPriceMiniPillActive: {
    backgroundColor: '#5C4033',
    borderColor: '#5C4033',
  },
  accPriceMiniText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4738',
  },
  accPriceMiniTextActive: {
    color: '#FFFDF9',
    fontWeight: '700',
  },
  deleteMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5C4033',
    height: 46,
    borderRadius: 999,
    marginTop: 6,
  },
  submitPrimaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFDF9',
  },
});
