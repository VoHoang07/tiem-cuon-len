import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  Plus,
  Trash2,
  Camera,
  Image as ImageIcon,
  Palette,
  Gift,
  Sparkles,
  X,
} from 'lucide-react-native';
import {
  ProductColorOption,
  ProductAccessoryOption,
} from '@/types/product';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { inferColorHex } from '@/utils/generateProductDescription';
import { formatVND } from '@/utils/formatCurrency';

export const PRESET_COLOR_SWATCHES = [
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

export const PRESET_ACCESSORIES: Array<{
  name: string;
  emoji: string;
  priceDelta: number;
}> = [
  { name: 'Ôm dâu tây đỏ', emoji: '🍓', priceDelta: 0 },
  { name: 'Đeo nơ lụa cổ', emoji: '🎀', priceDelta: 0 },
  { name: 'Đội mũ hoa cúc', emoji: '🌼', priceDelta: 10000 },
  { name: 'Đeo túi chéo mini', emoji: '👜', priceDelta: 10000 },
  { name: 'Hộp quà mica + Đèn LED', emoji: '🎁', priceDelta: 15000 },
];

const EMOJI_CHOICES = ['🍓', '🎀', '🌼', '🎁', '👑', '🧣', '✨', '🧸', '🌸', '👜'];
const PRICE_DELTA_CHIPS = [0, 5000, 10000, 15000, 25000];

/**
 * Compress a base64 data URI on Web so multiple variant photos fit comfortably
 * in Supabase & localStorage without slowing down page loads.
 */
export async function compressDataUriIfWeb(
  dataUri: string,
  maxSide: number = 2560,
  quality: number = 0.98
): Promise<string> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return dataUri;
  }
  if (dataUri.length < 10_500_000) {
    return dataUri;
  }
  return new Promise((resolve) => {
    try {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width || maxSide;
        let h = img.height || maxSide;
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
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed || dataUri);
      };
      img.onerror = () => resolve(dataUri);
      img.src = dataUri;
    } catch {
      resolve(dataUri);
    }
  });
}

export async function pickCompressedImageFromLibrary(): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Cần quyền truy cập', 'Vui lòng cấp quyền truy cập thư viện ảnh.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.6,
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
  });
  if (!result.canceled && result.assets[0]?.base64) {
    const rawUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    return await compressDataUriIfWeb(rawUri);
  }
  return null;
}

export async function takeCompressedPhoto(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Cần quyền máy ảnh', 'Vui lòng cấp quyền sử dụng máy ảnh.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsEditing: true,
    aspect: [1, 1],
    base64: true,
  });
  if (!result.canceled && result.assets[0]?.base64) {
    const rawUri = `data:image/jpeg;base64,${result.assets[0].base64}`;
    return await compressDataUriIfWeb(rawUri);
  }
  return null;
}

interface ProductVariantsEditorProps {
  colorOptions: ProductColorOption[];
  onChangeColorOptions: (next: ProductColorOption[]) => void;
  accessoryOptions: ProductAccessoryOption[];
  onChangeAccessoryOptions: (next: ProductAccessoryOption[]) => void;
  extraPhotos: string[];
  onChangeExtraPhotos: (next: string[]) => void;
  mainImage?: string | null;
}

export function ProductVariantsEditor({
  colorOptions,
  onChangeColorOptions,
  accessoryOptions,
  onChangeAccessoryOptions,
  extraPhotos,
  onChangeExtraPhotos,
  mainImage,
}: ProductVariantsEditorProps) {
  /* ---- Color Options Handlers ---- */
  const handleAddColor = (preset?: { name: string; hex: string }) => {
    const idx = colorOptions.length;
    const name = preset?.name || `Màu số ${idx + 1}`;
    const hex = preset?.hex || inferColorHex(name, idx);
    const newColor: ProductColorOption = {
      id: `c_${Date.now()}_${idx + 1}`,
      name,
      hex,
      image: undefined,
    };
    onChangeColorOptions([...colorOptions, newColor]);
  };

  const handleUpdateColor = (
    index: number,
    patch: Partial<ProductColorOption>
  ) => {
    const next = colorOptions.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, ...patch };
      if (patch.name !== undefined && !patch.hex) {
        updated.hex = inferColorHex(patch.name, index);
      }
      return updated;
    });
    onChangeColorOptions(next);
  };

  const handleRemoveColor = (index: number) => {
    onChangeColorOptions(colorOptions.filter((_, i) => i !== index));
  };

  const handlePickColorImage = async (index: number, useCamera: boolean = false) => {
    const uri = useCamera
      ? await takeCompressedPhoto()
      : await pickCompressedImageFromLibrary();
    if (uri) {
      handleUpdateColor(index, { image: uri });
    }
  };

  /* ---- Accessory Options Handlers ---- */
  const handleAddAccessory = (preset?: {
    name: string;
    emoji: string;
    priceDelta: number;
  }) => {
    const idx = accessoryOptions.length;
    const newAcc: ProductAccessoryOption = {
      id: `a_${Date.now()}_${idx + 1}`,
      name: preset?.name || '',
      emoji: preset?.emoji || EMOJI_CHOICES[idx % EMOJI_CHOICES.length],
      priceDelta: preset?.priceDelta ?? 0,
    };
    onChangeAccessoryOptions([...accessoryOptions, newAcc]);
  };

  const handleUpdateAccessory = (
    index: number,
    patch: Partial<ProductAccessoryOption>
  ) => {
    const next = accessoryOptions.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    onChangeAccessoryOptions(next);
  };

  const handleRemoveAccessory = (index: number) => {
    onChangeAccessoryOptions(accessoryOptions.filter((_, i) => i !== index));
  };

  /* ---- Extra Gallery Photos Handlers ---- */
  const handleAddExtraPhoto = async (useCamera: boolean = false) => {
    const uri = useCamera
      ? await takeCompressedPhoto()
      : await pickCompressedImageFromLibrary();
    if (uri) {
      onChangeExtraPhotos([...extraPhotos, uri]);
    }
  };

  const handleRemoveExtraPhoto = (index: number) => {
    onChangeExtraPhotos(extraPhotos.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.wrapper}>
      {/* ================================================================ */}
      {/* 1. COLOR / VARIANT OPTIONS WITH PER-COLOR PHOTO                  */}
      {/* ================================================================ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBadge}>
            <Palette size={16} color="#4A3728" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              1. Các phiên bản Màu sắc & Ảnh theo màu ({colorOptions.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Khách bấm chọn màu nào trên web sẽ đổi sang đúng ảnh và tên màu đó
            </Text>
          </View>
        </View>

        {/* Quick Preset Color Chips */}
        <View style={styles.presetBlock}>
          <Text style={styles.presetLabel}>+ Chạm để thêm nhanh màu phổ biến:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetChipsRow}>
            {PRESET_COLOR_SWATCHES.map((sw) => {
              const exists = colorOptions.some(
                (c) => c.name.trim().toLowerCase() === sw.name.toLowerCase()
              );
              return (
                <TouchableOpacity
                  key={sw.name}
                  style={[styles.presetChip, exists && styles.presetChipAdded]}
                  onPress={() => handleAddColor(sw)}
                  activeOpacity={0.75}>
                  <View
                    style={[styles.swatchDot, { backgroundColor: sw.hex }]}
                  />
                  <Text style={styles.presetChipText}>+ {sw.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* List of Color Cards */}
        {colorOptions.map((c, idx) => {
          const displayImg = c.image || mainImage;
          return (
            <View key={c.id || idx} style={styles.variantItemCard}>
              <View style={styles.variantTopRow}>
                {/* Per-color Photo Picker */}
                <View style={styles.colorPhotoCol}>
                  <TouchableOpacity
                    style={styles.colorPhotoBox}
                    onPress={() => handlePickColorImage(idx, false)}
                    activeOpacity={0.8}>
                    {displayImg ? (
                      <Image
                        source={
                          typeof displayImg === 'string'
                            ? { uri: displayImg }
                            : (displayImg as any)
                        }
                        style={styles.colorPhotoImg}
                      />
                    ) : (
                      <View style={styles.colorPhotoEmpty}>
                        <ImageIcon size={20} color="#7A5230" />
                        <Text style={styles.colorPhotoEmptyText}>Ảnh màu</Text>
                      </View>
                    )}
                    <View style={styles.colorPhotoBadge}>
                      <Text style={styles.colorPhotoBadgeText}>
                        {c.image ? 'Đổi ảnh' : 'Chọn ảnh'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.miniPhotoBtnsRow}>
                    <TouchableOpacity
                      style={styles.miniPhotoBtn}
                      onPress={() => handlePickColorImage(idx, true)}>
                      <Camera size={12} color="#4A3728" />
                    </TouchableOpacity>
                    {c.image ? (
                      <TouchableOpacity
                        style={styles.miniPhotoBtn}
                        onPress={() => handleUpdateColor(idx, { image: undefined })}>
                        <X size={12} color={COLORS.error} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {/* Color Name + Swatch Selector */}
                <View style={styles.colorFieldsCol}>
                  <View style={styles.colorNameInputRow}>
                    <View
                      style={[
                        styles.activeColorCircle,
                        { backgroundColor: c.hex || '#F5EBE0' },
                      ]}
                    />
                    <TextInput
                      style={styles.variantNameInput}
                      value={c.name}
                      onChangeText={(txt) => handleUpdateColor(idx, { name: txt })}
                      placeholder={`Tên màu #${idx + 1} (VD: Kem Sữa, Hồng Đào...)`}
                      placeholderTextColor={COLORS.lightText}
                    />
                    <TouchableOpacity
                      style={styles.removeVariantBtn}
                      onPress={() => handleRemoveColor(idx)}>
                      <Trash2 size={15} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>

                  {/* Swatch Palette Row */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.swatchRow}>
                    {PRESET_COLOR_SWATCHES.map((sw) => {
                      const active =
                        (c.hex || '').toLowerCase() === sw.hex.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={sw.hex}
                          style={[
                            styles.swatchPickCircle,
                            { backgroundColor: sw.hex },
                            active && styles.swatchPickCircleActive,
                          ]}
                          onPress={() =>
                            handleUpdateColor(idx, { hex: sw.hex })
                          }
                        />
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          );
        })}

        <TouchableOpacity
          style={styles.addVariantBtn}
          onPress={() => handleAddColor()}
          activeOpacity={0.8}>
          <Plus size={16} color="#4A3728" />
          <Text style={styles.addVariantBtnText}>
            + Thêm phân loại màu sắc mới
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================================================================ */}
      {/* 2. ACCESSORY / ADD-ON OPTIONS WITH PRICE DELTA                   */}
      {/* ================================================================ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBadge}>
            <Gift size={16} color="#4A3728" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              2. Phụ kiện phối kèm & Giá cộng thêm ({accessoryOptions.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Khách tuỳ chọn phụ kiện đi kèm (Miễn phí hoặc cộng thêm tiền tự động)
            </Text>
          </View>
        </View>

        {/* Quick Preset Accessory Chips */}
        <View style={styles.presetBlock}>
          <Text style={styles.presetLabel}>+ Chạm để thêm nhanh phụ kiện mẫu:</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetChipsRow}>
            {PRESET_ACCESSORIES.map((acc) => (
              <TouchableOpacity
                key={acc.name}
                style={styles.presetChip}
                onPress={() => handleAddAccessory(acc)}
                activeOpacity={0.75}>
                <Text style={styles.presetChipText}>
                  {acc.emoji} {acc.name}{' '}
                  {acc.priceDelta > 0
                    ? `(+${Math.round(acc.priceDelta / 1000)}k)`
                    : '(Miễn phí)'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List of Accessory Cards */}
        {accessoryOptions.map((acc, idx) => (
          <View key={acc.id || idx} style={styles.variantItemCard}>
            <View style={styles.colorNameInputRow}>
              <Text style={styles.accEmojiPreview}>{acc.emoji || '🎀'}</Text>
              <TextInput
                style={styles.variantNameInput}
                value={acc.name}
                onChangeText={(txt) =>
                  handleUpdateAccessory(idx, { name: txt })
                }
                placeholder="Tên phụ kiện (VD: Ôm dâu tây, Đeo nơ lụa, Hộp quà LED...)"
                placeholderTextColor={COLORS.lightText}
              />
              <TouchableOpacity
                style={styles.removeVariantBtn}
                onPress={() => handleRemoveAccessory(idx)}>
                <Trash2 size={15} color={COLORS.error} />
              </TouchableOpacity>
            </View>

            {/* Emoji Picker Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiPickRow}>
              {EMOJI_CHOICES.map((em) => {
                const selected = (acc.emoji || '🎀') === em;
                return (
                  <TouchableOpacity
                    key={em}
                    style={[
                      styles.emojiChip,
                      selected && styles.emojiChipActive,
                    ]}
                    onPress={() =>
                      handleUpdateAccessory(idx, { emoji: em })
                    }>
                    <Text style={{ fontSize: 14 }}>{em}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Price Delta Row */}
            <View style={styles.priceDeltaRow}>
              <Text style={styles.priceDeltaLabel}>Giá cộng thêm:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.priceDeltaChips}>
                {PRICE_DELTA_CHIPS.map((val) => {
                  const selected = (acc.priceDelta ?? 0) === val;
                  return (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.priceDeltaChip,
                        selected && styles.priceDeltaChipActive,
                      ]}
                      onPress={() =>
                        handleUpdateAccessory(idx, { priceDelta: val })
                      }>
                      <Text
                        style={[
                          styles.priceDeltaChipText,
                          selected && styles.priceDeltaChipTextActive,
                        ]}>
                        {val === 0 ? 'Miễn phí' : `+${formatVND(val)}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TextInput
                style={styles.priceDeltaInput}
                value={
                  acc.priceDelta && acc.priceDelta > 0
                    ? String(acc.priceDelta)
                    : ''
                }
                onChangeText={(txt) => {
                  const num = Number(txt.replace(/[^0-9]/g, '')) || 0;
                  handleUpdateAccessory(idx, { priceDelta: num });
                }}
                placeholder="Số tiền khác"
                placeholderTextColor={COLORS.lightText}
                keyboardType="numeric"
              />
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.addVariantBtn}
          onPress={() => handleAddAccessory()}
          activeOpacity={0.8}>
          <Plus size={16} color="#4A3728" />
          <Text style={styles.addVariantBtnText}>
            + Thêm tuỳ chọn phụ kiện phối kèm
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================================================================ */}
      {/* 3. EXTRA GALLERY PHOTOS (GÓC CHỤP PHỤ / CẬN CẢNH)                */}
      {/* ================================================================ */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionTitleBadge}>
            <Sparkles size={16} color="#4A3728" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              3. Ảnh góc chụp phụ / Cận cảnh ({extraPhotos.length})
            </Text>
            <Text style={styles.sectionSubtitle}>
              Thêm các góc chụp nghiêng, mặt sau hoặc cận cảnh mũi móc cho bộ ảnh sản phẩm
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.extraPhotosRow}>
          {extraPhotos.map((uri, idx) => (
            <View key={idx} style={styles.extraPhotoCard}>
              <Image
                source={typeof uri === 'string' ? { uri } : (uri as any)}
                style={styles.extraPhotoImg}
              />
              <TouchableOpacity
                style={styles.extraPhotoRemoveBtn}
                onPress={() => handleRemoveExtraPhoto(idx)}>
                <X size={13} color="#FFF" />
              </TouchableOpacity>
              <Text style={styles.extraPhotoCaption}>Góc #{idx + 2}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.addExtraPhotoBox}
            onPress={() => handleAddExtraPhoto(false)}
            activeOpacity={0.8}>
            <ImageIcon size={20} color="#4A3728" />
            <Text style={styles.addExtraPhotoText}>+ Chọn ảnh</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addExtraPhotoBox}
            onPress={() => handleAddExtraPhoto(true)}
            activeOpacity={0.8}>
            <Camera size={20} color="#4A3728" />
            <Text style={styles.addExtraPhotoText}>+ Chụp ảnh</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
    marginVertical: 4,
  },
  sectionCard: {
    backgroundColor: '#FFFDF9',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E6D8C8',
    gap: 12,
    ...SHADOWS.small,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitleBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F3EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C1',
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 1,
  },
  presetBlock: {
    gap: 6,
    backgroundColor: '#FAF5EE',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDE2D4',
  },
  presetLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5239',
  },
  presetChipsRow: {
    flexDirection: 'row',
    gap: 7,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DFCBB4',
  },
  presetChipAdded: {
    backgroundColor: '#F1E7DA',
    borderColor: '#8B5E3C',
  },
  swatchDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.25)',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3D2B1F',
  },
  variantItemCard: {
    backgroundColor: '#FAF6F0',
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E5D8C8',
    gap: 9,
  },
  variantTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
  },
  colorPhotoCol: {
    alignItems: 'center',
    gap: 5,
  },
  colorPhotoBox: {
    width: 68,
    height: 68,
    borderRadius: 12,
    backgroundColor: '#F1E8DC',
    borderWidth: 1,
    borderColor: '#DBCAB8',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  colorPhotoImg: {
    width: '100%',
    height: '100%',
  },
  colorPhotoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  colorPhotoEmptyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7A5230',
  },
  colorPhotoBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(61, 43, 31, 0.72)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  colorPhotoBadgeText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#FFF',
  },
  miniPhotoBtnsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniPhotoBtn: {
    width: 26,
    height: 24,
    borderRadius: 7,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DFCBB4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorFieldsCol: {
    flex: 1,
    gap: 8,
  },
  colorNameInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeColorCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#4A3728',
  },
  variantNameInput: {
    flex: 1,
    backgroundColor: '#FFFDF9',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#3D2B1F',
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  removeVariantBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },
  swatchPickCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.22)',
  },
  swatchPickCircleActive: {
    borderWidth: 2.5,
    borderColor: '#3D2B1F',
    transform: [{ scale: 1.12 }],
  },
  addVariantBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#F3EAE0',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C4AA90',
  },
  addVariantBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A3728',
  },
  accEmojiPreview: {
    fontSize: 20,
    width: 28,
    textAlign: 'center',
  },
  emojiPickRow: {
    flexDirection: 'row',
    gap: 6,
  },
  emojiChip: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E2D4C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiChipActive: {
    backgroundColor: '#EADBC8',
    borderColor: '#6E4F37',
    borderWidth: 1.5,
  },
  priceDeltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceDeltaLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6E5239',
  },
  priceDeltaChips: {
    flexDirection: 'row',
    gap: 6,
  },
  priceDeltaChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#DFCBB4',
  },
  priceDeltaChipActive: {
    backgroundColor: '#4A3728',
    borderColor: '#4A3728',
  },
  priceDeltaChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4A3728',
  },
  priceDeltaChipTextActive: {
    color: '#FFF',
    fontWeight: '700',
  },
  priceDeltaInput: {
    minWidth: 96,
    backgroundColor: '#FFFDF9',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 12,
    color: '#3D2B1F',
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  extraPhotosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
  },
  extraPhotoCard: {
    width: 78,
    alignItems: 'center',
    gap: 4,
    position: 'relative',
  },
  extraPhotoImg: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: '#F1E8DC',
    borderWidth: 1,
    borderColor: '#DBCAB8',
  },
  extraPhotoRemoveBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(185, 28, 28, 0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  extraPhotoCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  addExtraPhotoBox: {
    width: 78,
    height: 78,
    borderRadius: 12,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#C4AA90',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addExtraPhotoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3728',
  },
});
