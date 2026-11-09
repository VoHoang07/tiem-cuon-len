import { COLORS, SHADOWS, SPACING } from '@/constants/theme';
import { useProducts } from '@/store/ProductContext';
import {
    Category,
    Product,
    ProductAccessoryOption,
    ProductColorOption,
    ProductGalleryItem,
} from '@/types/product';
import {
    calculateSmartCombo2Price,
    DEFAULT_COMBO_OPTION_ID,
    isComboColorOption,
} from '@/utils/comboPricing';
import {
    generateUuidFilename,
    MAX_PROCESSED_DATA_URI_BYTES,
    validateBase64ImageUpload,
    validateWebFileUpload,
} from '@/utils/fileUploadGuard';
import {
    generateProductDescription,
    inferCategory,
    inferColorHex,
} from '@/utils/generateProductDescription';
import { getCategoryEmoji, getCategoryLabel } from '@/utils/getCategoryEmoji';
import {
    AdminProductDraft,
    clearWorkingDraft,
    deleteAdminDraft,
    isDraftMeaningful,
    loadAdminDrafts,
    loadWorkingDraft,
    saveAdminDraft,
    saveWorkingDraft,
} from '@/utils/productDraftStore';
import {
    CoverCollageLayout,
    generateAutoCoverCollage,
    processProductPhotoStudio,
    STUDIO_RETOUCH_PRESETS,
    StudioRetouchPreset,
} from '@/utils/studioPhotoProcessor';
import * as ImagePicker from 'expo-image-picker';
import {
    Camera,
    Check,
    ChevronLeft,
    FileText,
    Image as ImageIcon,
    Maximize2,
    Plus,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MAX_WIDTH = 1040;

const COLOR_SWATCHES = [
  { name: 'Kem Sữa', hex: '#F5EBE0' },
  { name: 'Trắng Tinh', hex: '#FAF7F2' },
  { name: 'Trắng Ngà', hex: '#FDF8F0' },
  { name: 'Be Yến Mạch', hex: '#E6D5C3' },
  { name: 'Hồng Phấn', hex: '#F4ACB7' },
  { name: 'Hồng Đào', hex: '#FEC5BB' },
  { name: 'Hồng Sen', hex: '#EC4899' },
  { name: 'Hồng Đất', hex: '#D98A82' },
  { name: 'Đỏ Dâu', hex: '#E63946' },
  { name: 'Đỏ Rượu', hex: '#991B1B' },
  { name: 'Đỏ Cam', hex: '#EF4444' },
  { name: 'Cam Đào', hex: '#F4A261' },
  { name: 'Cam Đất', hex: '#E07A5F' },
  { name: 'Vàng Bơ', hex: '#FDE047' },
  { name: 'Vàng Tươi', hex: '#FACC15' },
  { name: 'Vàng Mù Tạt', hex: '#D97706' },
  { name: 'Xanh Bơ', hex: '#B7E4C7' },
  { name: 'Xanh Mint', hex: '#6EE7B7' },
  { name: 'Xanh Matcha', hex: '#84A98C' },
  { name: 'Xanh Lá', hex: '#22C55E' },
  { name: 'Xanh Rêu', hex: '#3F6212' },
  { name: 'Xanh Dương', hex: '#93C5FD' },
  { name: 'Xanh Baby', hex: '#BAE6FD' },
  { name: 'Xanh Ngọc', hex: '#2DD4BF' },
  { name: 'Xanh Biển', hex: '#2563EB' },
  { name: 'Xanh Navy', hex: '#1E3A8A' },
  { name: 'Tím Khoai Môn', hex: '#CDB4DB' },
  { name: 'Tím Lavender', hex: '#A78BFA' },
  { name: 'Tím Huế', hex: '#7E22CE' },
  { name: 'Nâu Caramel', hex: '#A67B5B' },
  { name: 'Nâu Sữa', hex: '#C69C6D' },
  { name: 'Nâu Socola', hex: '#5C4033' },
  { name: 'Xám Khói', hex: '#9CA3AF' },
  { name: 'Đen Tuyền', hex: '#1F2937' },
];

function resolveImgUri(src: any): string | null {
  if (!src) return null;
  if (typeof src === 'string') return src;
  if (typeof src === 'object' && typeof src.uri === 'string') return src.uri;
  return null;
}

const ZODIAC_FILENAME_MAP: Record<string, string> = {
  bach_duong: 'Bạch Dương ♈',
  kim_nguu: 'Kim Ngưu ♉',
  song_tu: 'Song Tử ♊',
  cu_giai: 'Cự Giải ♋',
  su_tu: 'Sư Tử ♌',
  xu_nu: 'Xử Nữ ♍',
  thien_binh: 'Thiên Bình ♎',
  thien_yet: 'Thiên Yết ♏',
  nhan_ma: 'Nhân Mã ♐',
  ma_ket: 'Ma Kết ♑',
  bao_binh: 'Bảo Bình ♒',
  song_ngu: 'Song Ngư ♓',
};

function isGenericCameraFilename(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return true;
  if (/^(img|dsc|pxl| pic|image|photo|screenshot|screen[\s_-]*shot|untitled|whatsapp|att|cam|cap|download|file|mẫu|mau)[\s_-]*\d*/i.test(s)) {
    return true;
  }
  if (/^z\d{8,}/i.test(s)) return true;
  if (/^[0-9a-f]{8,}(-[0-9a-f]{4,})+/i.test(s)) return true;
  if (/^[\d\s_.-]+$/.test(s)) return true;
  return false;
}

function formatVariantNameFromFilename(fileName: string, fallbackIdx: number): string {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .trim();
  if (isGenericCameraFilename(base)) {
    return `Mẫu #${fallbackIdx + 1}`;
  }
  const stripped = base.replace(/^\d+[\s_-]*/, '').trim();
  if (!stripped || isGenericCameraFilename(stripped)) {
    return `Mẫu #${fallbackIdx + 1}`;
  }
  const norm = stripped.toLowerCase().replace(/[\s-]+/g, '_');
  if (ZODIAC_FILENAME_MAP[norm]) {
    return ZODIAC_FILENAME_MAP[norm];
  }
  const readable = stripped.replace(/[_-]+/g, ' ').trim();
  return readable || `Mẫu #${fallbackIdx + 1}`;
}

function isPlaceholderOrPresetColorName(val: string): boolean {
  const trimmed = (val || '').trim();
  if (!trimmed) return true;
  if (/^(chưa chọn màu|mẫu|ảnh|phân loại|màu)(\s*mẫu)?\s*#?\d*$/i.test(trimmed)) return true;
  return COLOR_SWATCHES.some(
    (sw) => sw.name.toLowerCase() === trimmed.toLowerCase()
  );
}

function encodeCanvasHd(canvas: HTMLCanvasElement, quality: number = 0.94): string {
  try {
    const webp = canvas.toDataURL('image/webp', quality);
    if (webp && webp.startsWith('data:image/webp')) {
      return webp;
    }
  } catch {
    // Fallback to JPEG below
  }
  return canvas.toDataURL('image/jpeg', quality);
}

let currentDefaultStudioPreset: StudioRetouchPreset = 'vivid_stitch_1x1';
const rawPhotoBackupMemory = new Map<string, string>();

/**
 * Optimizes any uploaded photo (1:1, 3:4, 4:3, 9:16, 16:9, or small image) on Web
 * into a razor-sharp 1440x1440 (1:1 Square) Ultra-HD WebP/JPEG (quality 0.94)
 * using the AI Studio Retoucher (Unsharp Mask yarn-stitch sharpening + Studio Lighting + Backdrop Framing)
 * while keeping 100% of the real product intact.
 */
async function optimizeHdImageIfWeb(
  dataUri: string,
  maxSide: number = 1440,
  quality: number = 0.94,
  frameMode: 'auto' | 'contain_square' | 'cover_square' = 'auto',
  presetOverride?: StudioRetouchPreset
): Promise<string> {
  const sourceRaw = rawPhotoBackupMemory.get(dataUri) || dataUri;
  const out = await processProductPhotoStudio(sourceRaw, {
    maxSide,
    quality,
    frameMode,
    preset: presetOverride ?? currentDefaultStudioPreset,
  });
  if (out && out !== sourceRaw) {
    if (rawPhotoBackupMemory.size > 40) {
      const firstKey = rawPhotoBackupMemory.keys().next().value;
      if (firstKey) rawPhotoBackupMemory.delete(firstKey);
    }
    rawPhotoBackupMemory.set(out, sourceRaw);
  }
  return out;
}

async function pickMultipleHdImages(): Promise<{
  uri: string;
  fileName: string;
  labelHint?: string;
}[]> {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  ) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
      let settled = false;
      const finish = (
        items: { uri: string; fileName: string; labelHint?: string }[]
      ) => {
        if (settled) return;
        settled = true;
        resolve(items);
      };
      input.onchange = async () => {
        const fileList = input.files ? Array.from(input.files) : [];
        if (fileList.length === 0) {
          finish([]);
          return;
        }
        const results: { uri: string; fileName: string; labelHint?: string }[] = [];
        for (let idx = 0; idx < fileList.length; idx++) {
          const file = fileList[idx];
          // 1. Validate file size & Magic Bytes before reading
          const check = await validateWebFileUpload(file);
          if (!check.valid) {
            Alert.alert(
              'Tệp tải lên bị từ chối',
              check.error || 'Định dạng file ảnh không hợp lệ.'
            );
            continue;
          }

          const dataUri = await new Promise<string | null>((resFile) => {
            const reader = new FileReader();
            reader.onload = () =>
              resFile(typeof reader.result === 'string' ? reader.result : null);
            reader.onerror = () => resFile(null);
            reader.readAsDataURL(file);
          });
          if (dataUri) {
            const optimized = await optimizeHdImageIfWeb(dataUri);
            const postCheck = validateBase64ImageUpload(
              optimized,
              MAX_PROCESSED_DATA_URI_BYTES
            );
            if (!postCheck.valid) {
              Alert.alert(
                'Ảnh vượt quá giới hạn',
                postCheck.error || 'Không thể xử lý ảnh này.'
              );
              continue;
            }
            // Automatically rename file to random UUID v4 before saving
            const uuidName =
              postCheck.uuidFileName ||
              check.uuidFileName ||
              generateUuidFilename(check.ext || 'webp');
            results.push({
              uri: optimized,
              fileName: uuidName,
              labelHint: formatVariantNameFromFilename(file.name, idx),
            });
          }
        }
        finish(results);
      };
      input.oncancel = () => finish([]);
      input.click();
    });
  }

  const single = await pickHdImage(false);
  return single
    ? [{ uri: single, fileName: generateUuidFilename('jpg') }]
    : [];
}

async function pickHdImage(useCamera: boolean = false): Promise<string | null> {
  // On Web: use direct native file input + FileReader with Magic Bytes & Size verification
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof document !== 'undefined'
  ) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif';
      if (useCamera) {
        input.setAttribute('capture', 'environment');
      }
      let settled = false;
      const finish = (val: string | null) => {
        if (settled) return;
        settled = true;
        resolve(val);
      };
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          finish(null);
          return;
        }
        const check = await validateWebFileUpload(file);
        if (!check.valid) {
          Alert.alert(
            'Tệp tải lên bị từ chối',
            check.error || 'Định dạng file ảnh không hợp lệ.'
          );
          finish(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = async () => {
          const rawDataUri = typeof reader.result === 'string' ? reader.result : null;
          if (!rawDataUri) {
            finish(null);
            return;
          }
          const finalUri = await optimizeHdImageIfWeb(rawDataUri);
          const postCheck = validateBase64ImageUpload(
            finalUri,
            MAX_PROCESSED_DATA_URI_BYTES
          );
          if (!postCheck.valid) {
            Alert.alert(
              'Ảnh không hợp lệ',
              postCheck.error || 'Dung lượng ảnh sau xử lý vượt quá giới hạn.'
            );
            finish(null);
            return;
          }
          finish(finalUri);
        };
        reader.onerror = () => finish(null);
        reader.readAsDataURL(file);
      };
      input.oncancel = () => finish(null);
      input.click();
    });
  }

  if (useCamera) {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Cần quyền máy ảnh', 'Vui lòng cấp quyền sử dụng máy ảnh.');
      return null;
    }
    const res = await ImagePicker.launchCameraAsync({
      quality: 1,
      allowsEditing: false,
      base64: true,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      const check = validateBase64ImageUpload(res.assets[0].base64);
      if (!check.valid) {
        Alert.alert('Ảnh bị từ chối', check.error || 'Định dạng ảnh không hợp lệ.');
        return null;
      }
      return `data:${check.mime || 'image/jpeg'};base64,${res.assets[0].base64}`;
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
    allowsEditing: false,
    base64: true,
  });
  if (!res.canceled && res.assets[0]?.base64) {
    const check = validateBase64ImageUpload(res.assets[0].base64);
    if (!check.valid) {
      Alert.alert('Ảnh bị từ chối', check.error || 'Định dạng ảnh không hợp lệ.');
      return null;
    }
    return `data:${check.mime || 'image/jpeg'};base64,${res.assets[0].base64}`;
  }
  return null;
}

export interface ProductStudioFormProps {
  mode: 'add' | 'edit';
  initialProduct?: Product;
  initialDraftId?: string;
  onBack: () => void;
  onSubmitProduct: (product: Product) => Promise<void> | void;
}

export function ProductStudioForm({
  mode,
  initialProduct,
  initialDraftId,
  onBack,
  onSubmitProduct,
}: ProductStudioFormProps) {
  const {
    shopCategories,
    addShopCategory,
    removeShopCategory,
    resetShopCategories,
  } = useProducts();
  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isDesktop = windowWidth >= 820;
  const isMobile = windowWidth < 640;

  const [name, setName] = useState(initialProduct?.name ?? '');
  const [price, setPrice] = useState(
    initialProduct?.price ? String(initialProduct.price) : ''
  );
  const [category, setCategory] = useState<Category>(
    initialProduct?.category ?? 'Crochet'
  );
  const [showCatManager, setShowCatManager] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('🧢');
  const [newCatLine, setNewCatLine] = useState<'len' | 'kem_nhung'>('len');
  const [material, setMaterial] = useState(
    initialProduct?.material ?? 'Len Cotton Milk'
  );
  const [isMadeToOrder, setIsMadeToOrder] = useState<boolean>(
    initialProduct?.isMadeToOrder !== undefined
      ? initialProduct.isMadeToOrder
      : true
  );
  const [quantity, setQuantity] = useState(
    initialProduct?.quantity !== undefined && initialProduct.quantity < 900
      ? String(initialProduct.quantity)
      : '10'
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
        price:
          c.price !== undefined && Number(c.price) > 0
            ? Number(c.price)
            : initialProduct.price,
        image: c.image || (idx === 0 ? initialProduct.image : undefined),
      }));
    }
    if (initialProduct) {
      return [
        {
          id: 'c_1',
          name: initialProduct.color || 'Kem Sữa',
          hex: inferColorHex(initialProduct.color || 'Kem Sữa', 0),
          price: initialProduct.price,
          image: initialProduct.image,
        },
      ];
    }
    return [];
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

  const [coverImage, setCoverImage] = useState<string | null>(() => {
    return typeof initialProduct?.image === 'string'
      ? initialProduct.image
      : null;
  });

  /* ---- Admin Draft Persistence (mode === 'add') ---- */
  const [currentDraftId, setCurrentDraftId] = useState<string>(
    () => initialDraftId || `draft_${Date.now()}`
  );
  const [savedDrafts, setSavedDrafts] = useState<AdminProductDraft[]>([]);
  const [draftStatusMsg, setDraftStatusMsg] = useState<string | null>(null);
  const [frameFitMode, setFrameFitMode] = useState<'contain_square' | 'cover_square'>('contain_square');
  const [studioPreset, setStudioPreset] = useState<StudioRetouchPreset>('vivid_stitch_1x1');
  const [isStudioBusy, setIsStudioBusy] = useState<boolean>(false);
  const [previewPackagingId, setPreviewPackagingId] = useState<'no_box' | 'gift_box_letter'>('no_box');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const draftHydratedRef = useRef(false);

  const applyDraftToForm = (d: AdminProductDraft) => {
    setCurrentDraftId(d.id);
    setName(d.name ?? '');
    setPrice(d.price ?? '');
    setCategory(d.category ?? 'Crochet');
    setMaterial(d.material ?? 'Len Cotton Milk');
    setIsMadeToOrder(d.isMadeToOrder !== false);
    setQuantity(d.quantity ?? '10');
    setDescription(d.description ?? '');
    setTags(d.tags ?? '');
    setCoverImage(d.coverImage ?? null);
    if (Array.isArray(d.colorOptions) && d.colorOptions.length > 0) {
      const isLegacyEmptyDefaults =
        d.colorOptions.length <= 2 &&
        d.colorOptions.every(
          (c) => !c.image && (c.name === 'Kem Sữa' || c.name === 'Hồng Phấn')
        );
      const fallbackDraftPrice = Number((d.price || '').replace(/[^0-9]/g, ''));
      setColorOptions(
        isLegacyEmptyDefaults
          ? []
          : d.colorOptions.map((c) => ({
              ...c,
              price:
                c.price !== undefined && Number(c.price) > 0
                  ? Number(c.price)
                  : fallbackDraftPrice > 0
                  ? fallbackDraftPrice
                  : undefined,
            }))
      );
    } else {
      setColorOptions([]);
    }
    setExtraPhotos(Array.isArray(d.extraPhotos) ? d.extraPhotos : []);
    setActiveSlot({ type: 'cover' });
    setDraftStatusMsg('Đã khôi phục bản nháp để đăng tiếp');
  };

  useEffect(() => {
    if (mode !== 'add') return;
    let mounted = true;
    (async () => {
      const list = await loadAdminDrafts();
      if (!mounted) return;
      setSavedDrafts(list);

      if (initialDraftId) {
        const target = list.find((d) => d.id === initialDraftId);
        if (target) {
          applyDraftToForm(target);
          draftHydratedRef.current = true;
          return;
        }
      }

      const working = await loadWorkingDraft();
      if (!mounted) return;
      if (working && isDraftMeaningful(working)) {
        applyDraftToForm(working);
      } else if (list.length > 0 && isDraftMeaningful(list[0])) {
        applyDraftToForm(list[0]);
      }
      draftHydratedRef.current = true;
    })();
    return () => {
      mounted = false;
    };
  }, [mode, initialDraftId]);

  const buildCurrentDraftObject = (): AdminProductDraft => ({
    id: currentDraftId,
    updatedAt: new Date().toISOString(),
    name,
    price,
    category,
    material,
    isMadeToOrder,
    quantity,
    description,
    tags,
    coverImage,
    colorOptions,
    extraPhotos,
  });

  // Auto-save working draft + admin drafts list whenever Admin edits fields or uploads photos
  useEffect(() => {
    if (mode !== 'add' || !draftHydratedRef.current) return;
    const draftObj = buildCurrentDraftObject();
    if (!isDraftMeaningful(draftObj)) return;

    const timer = setTimeout(async () => {
      await saveWorkingDraft(draftObj);
      const nextList = await saveAdminDraft(draftObj);
      setSavedDrafts(nextList);
      setDraftStatusMsg('Đã tự động lưu nháp bên Admin');
    }, 450);

    return () => clearTimeout(timer);
  }, [
    mode,
    currentDraftId,
    name,
    price,
    category,
    material,
    isMadeToOrder,
    quantity,
    description,
    tags,
    coverImage,
    colorOptions,
    extraPhotos,
  ]);

  const handleResetBlankDraft = async () => {
    await clearWorkingDraft();
    const freshId = `draft_${Date.now()}`;
    setCurrentDraftId(freshId);
    setName('');
    setPrice('');
    setCategory('Crochet');
    setMaterial('Len Cotton Milk');
    setIsMadeToOrder(true);
    setQuantity('10');
    setDescription('');
    setTags('');
    setCoverImage(null);
    setColorOptions([]);
    setExtraPhotos([]);
    setActiveSlot({ type: 'cover' });
    setDraftStatusMsg('Đã mở mẫu mới trắng');
  };

  const handleDeleteSavedDraft = async (draftIdToRemove: string) => {
    const nextList = await deleteAdminDraft(draftIdToRemove);
    setSavedDrafts(nextList);
    if (draftIdToRemove === currentDraftId) {
      await handleResetBlankDraft();
    }
  };

  const handleSaveDraftOnly = async (exitAfterSave: boolean = true) => {
    const draftObj = buildCurrentDraftObject();
    if (!isDraftMeaningful(draftObj)) {
      if (exitAfterSave) onBack();
      else Alert.alert('Bản nháp trống', 'Hãy chọn ít nhất 1 ảnh hoặc nhập tên sản phẩm để lưu nháp.');
      return;
    }
    await saveWorkingDraft(draftObj);
    const nextList = await saveAdminDraft(draftObj);
    setSavedDrafts(nextList);
    setDraftStatusMsg('Đã lưu vào Bản nháp Admin');
    if (exitAfterSave) {
      onBack();
    } else {
      Alert.alert(
        'Đã lưu nháp bên Admin',
        'Bản nháp (gồm toàn bộ ảnh và phân loại) đã được lưu trong Kho SP của Admin. Khách hàng sẽ chưa thấy sản phẩm này cho đến khi bạn bấm "Đăng sản phẩm lên kệ".'
      );
    }
  };

  const handleBackPress = async () => {
    if (mode === 'add') {
      const draftObj = buildCurrentDraftObject();
      if (isDraftMeaningful(draftObj)) {
        await saveWorkingDraft(draftObj);
        await saveAdminDraft(draftObj);
      }
    }
    onBack();
  };

  // Track whether the admin is currently viewing/editing the Cover photo, a Color slot, or an Extra Angle slot
  const [activeSlot, setActiveSlot] = useState<
    | { type: 'cover' }
    | { type: 'color'; index: number }
    | { type: 'extra'; index: number }
  >({ type: 'cover' });

  const safeColorIdx =
    activeSlot.type === 'color' &&
    activeSlot.index >= 0 &&
    activeSlot.index < colorOptions.length
      ? activeSlot.index
      : 0;

  const activeColor = colorOptions[safeColorIdx] ?? colorOptions[0];

  const currentDisplayImage =
    activeSlot.type === 'cover'
      ? coverImage || initialProduct?.image || colorOptions.find((c) => c.image)?.image
      : activeSlot.type === 'extra'
      ? extraPhotos[activeSlot.index]
      : activeColor?.image || coverImage || initialProduct?.image;

  /* ---- Handlers for Photo Selection ---- */
  const handlePickCurrentSlotPhoto = async (useCamera: boolean = false) => {
    // If no photos uploaded yet and Admin taps the empty frame from gallery, allow uploading 1 or multiple product photos at once
    if (!useCamera && activeSlot.type === 'cover' && !coverImage && colorOptions.length === 0) {
      await handleBatchAddColorPhotos();
      return;
    }

    const uri = await pickHdImage(useCamera);
    if (!uri) return;

    if (activeSlot.type === 'cover') {
      setCoverImage(uri);
      if (colorOptions.length === 0) {
        const firstPhotoItem: ProductColorOption = {
          id: `c_${Date.now()}_1`,
          name: 'Chưa chọn màu',
          hex: '',
          image: uri,
        };
        setColorOptions([firstPhotoItem]);
        setActiveSlot({ type: 'color', index: 0 });
      }
    } else if (activeSlot.type === 'extra') {
      const next = [...extraPhotos];
      next[activeSlot.index] = uri;
      setExtraPhotos(next);
    } else {
      const next = colorOptions.map((c, i) =>
        i === safeColorIdx ? { ...c, image: uri } : c
      );
      setColorOptions(next);
      if (!coverImage) {
        setCoverImage(uri);
      }
    }
  };

  const handleToggleFrameFitCurrentPhoto = async () => {
    const rawCurrent = resolveImgUri(currentDisplayImage);
    if (!rawCurrent) return;
    const nextMode = frameFitMode === 'contain_square' ? 'cover_square' : 'contain_square';
    setFrameFitMode(nextMode);
    const reframed = await optimizeHdImageIfWeb(rawCurrent, 1440, 0.94, nextMode);
    if (!reframed) return;

    if (activeSlot.type === 'cover') {
      setCoverImage(reframed);
    } else if (activeSlot.type === 'extra') {
      const next = [...extraPhotos];
      next[activeSlot.index] = reframed;
      setExtraPhotos(next);
    } else {
      const next = colorOptions.map((c, i) =>
        i === safeColorIdx ? { ...c, image: reframed } : c
      );
      setColorOptions(next);
    }
  };

  const handleAddExtraAnglePhoto = async () => {
    const picked = await pickMultipleHdImages();
    if (picked.length === 0) return;
    const uris = picked.map((p) => p.uri);
    const next = [...extraPhotos, ...uris];
    setExtraPhotos(next);
    setActiveSlot({ type: 'extra', index: next.length - 1 });
  };

  const handleBatchAddColorPhotos = async () => {
    const picked = await pickMultipleHdImages();
    if (picked.length === 0) return;

    const hasOnlyEmptyDefaults =
      colorOptions.length <= 2 &&
      colorOptions.every((c) => !c.image && (c.name === 'Kem Sữa' || c.name === 'Hồng Phấn'));

    const baseList = hasOnlyEmptyDefaults ? [] : [...colorOptions];
    const firstNewIdx = baseList.length;
    const newItems: ProductColorOption[] = picked.map((item, i) => {
      const idx = baseList.length + i;
      const hasCustomFileHint =
        item.labelHint && !/^Mẫu #\d+$/i.test(item.labelHint.trim());
      return {
        id: `c_${Date.now()}_${idx + 1}`,
        name: hasCustomFileHint ? item.labelHint! : 'Chưa chọn màu',
        hex: '',
        image: item.uri,
      };
    });

    const next = [...baseList, ...newItems];
    setColorOptions(next);
    if (!coverImage && next.length >= 2) {
      // Automatically merge variant photos into a 1440x1440 Studio Cover Collage!
      const collageItems = next
        .filter((c) => Boolean(c.image))
        .map((c) => ({ image: c.image as string, name: c.name }));
      const autoCollage = await generateAutoCoverCollage(collageItems, {
        layout: 'grid_auto',
        productTitle: name.trim(),
        preset: studioPreset,
      });
      if (autoCollage) {
        setCoverImage(autoCollage);
        setDraftStatusMsg('✨ Đã tự động làm nét các mẫu & ghép Ảnh Bìa tổng hợp');
      } else if (newItems[0]?.image) {
        setCoverImage(newItems[0].image);
      }
    } else if (!coverImage && newItems[0]?.image) {
      setCoverImage(newItems[0].image);
    }
    setActiveSlot({ type: 'color', index: firstNewIdx });
    };

    const handleSelectStudioPreset = async (preset: StudioRetouchPreset) => {
    currentDefaultStudioPreset = preset;
    setStudioPreset(preset);
    const rawCurrent = resolveImgUri(currentDisplayImage);
    if (!rawCurrent) return;
    setIsStudioBusy(true);
    try {
      const processed = await optimizeHdImageIfWeb(
        rawCurrent,
        1440,
        0.94,
        frameFitMode,
        preset
      );
      if (activeSlot.type === 'cover') {
        setCoverImage(processed);
      } else if (activeSlot.type === 'extra') {
        const next = [...extraPhotos];
        next[activeSlot.index] = processed;
        setExtraPhotos(next);
      } else {
        const next = colorOptions.map((c, i) =>
          i === safeColorIdx ? { ...c, image: processed } : c
        );
        setColorOptions(next);
      }
      setDraftStatusMsg('✨ Đã làm nét & ghép phông Studio cho ảnh đang chọn');
    } finally {
      setIsStudioBusy(false);
    }
    };

    const handleApplyPresetToAllPhotos = async () => {
    if (colorOptions.length === 0 && !coverImage) return;
    setIsStudioBusy(true);
    try {
      const updatedColors: ProductColorOption[] = [];
      for (const c of colorOptions) {
        if (c.image) {
          const nextUri = await optimizeHdImageIfWeb(
            c.image,
            1440,
            0.94,
            frameFitMode,
            studioPreset
          );
          updatedColors.push({ ...c, image: nextUri });
        } else {
          updatedColors.push(c);
        }
      }
      setColorOptions(updatedColors);
      if (updatedColors.filter((c) => Boolean(c.image)).length >= 2) {
        const collage = await generateAutoCoverCollage(
          updatedColors
            .filter((c) => Boolean(c.image))
            .map((c) => ({ image: c.image as string, name: c.name })),
          {
            layout: 'grid_auto',
            productTitle: name.trim(),
            preset: studioPreset,
          }
        );
        if (collage) setCoverImage(collage);
      } else if (coverImage) {
        const nextCover = await optimizeHdImageIfWeb(
          coverImage,
          1440,
          0.94,
          frameFitMode,
          studioPreset
        );
        setCoverImage(nextCover);
      }
      setDraftStatusMsg(
        `✨ Đã làm nét & ghép phông Studio đồng bộ cho toàn bộ ${updatedColors.length} mẫu!`
      );
    } finally {
      setIsStudioBusy(false);
    }
    };

    const handleGenerateCoverCollage = async (layout: CoverCollageLayout) => {
    const validVariantItems = colorOptions
      .filter((c) => Boolean(c.image))
      .map((c) => ({ image: c.image as string, name: c.name }));
    if (validVariantItems.length === 0 && coverImage) {
      validVariantItems.push({ image: coverImage, name: name.trim() });
    }
    if (validVariantItems.length === 0) {
      Alert.alert(
        'Chưa có ảnh mẫu',
        'Hãy tải ít nhất 2 ảnh mẫu phân loại lên trước để hệ thống tự động ghép thành Ảnh Bìa tổng hợp!'
      );
      return;
    }
    setIsStudioBusy(true);
    try {
      const collage = await generateAutoCoverCollage(validVariantItems, {
        layout,
        productTitle: name.trim(),
        preset: studioPreset,
      });
      if (collage) {
        setCoverImage(collage);
        setActiveSlot({ type: 'cover' });
        setDraftStatusMsg('🪄 Đã tự động ghép Ảnh Bìa tổng hợp từ các mẫu phân loại!');
      }
    } finally {
      setIsStudioBusy(false);
    }
    };

  const handleCaptureNewColorPhoto = async () => {
    const uri = await pickHdImage(true);
    if (!uri) return;
    const hasOnlyEmptyDefaults =
      colorOptions.length <= 2 &&
      colorOptions.every((c) => !c.image && (c.name === 'Kem Sữa' || c.name === 'Hồng Phấn'));
    const baseList = hasOnlyEmptyDefaults ? [] : [...colorOptions];
    const idx = baseList.length;
    const newColor: ProductColorOption = {
      id: `c_${Date.now()}_${idx + 1}`,
      name: 'Chưa chọn màu',
      hex: '',
      image: uri,
    };
    const next = [...baseList, newColor];
    setColorOptions(next);
    if (!coverImage) {
      setCoverImage(uri);
    }
    setActiveSlot({ type: 'color', index: next.length - 1 });
  };

  const handleUseCoverAsFirstVariant = () => {
    const baseImg = coverImage || initialProduct?.image;
    if (!baseImg) return;
    const newColor: ProductColorOption = {
      id: `c_${Date.now()}_1`,
      name: 'Chưa chọn màu',
      hex: '',
      image: baseImg,
    };
    setColorOptions([newColor]);
    setActiveSlot({ type: 'color', index: 0 });
  };

  const handleRemoveExtraPhoto = (idx: number) => {
    const next = extraPhotos.filter((_, i) => i !== idx);
    setExtraPhotos(next);
    setActiveSlot({ type: 'cover' });
  };

  /* ---- Handlers for Color Options (Photo-First, Independent Color Selection) ---- */
  const handleUpdateActiveColor = (patch: Partial<ProductColorOption>) => {
    const next = colorOptions.map((c, i) => {
      if (i !== safeColorIdx) return c;
      // Do NOT auto-overwrite hex based on name — color is chosen explicitly for the photo
      return { ...c, ...patch };
    });
    setColorOptions(next);
  };

  const handleRemoveColorOption = (idx: number) => {
    const next = colorOptions.filter((_, i) => i !== idx);
    setColorOptions(next);
    if (next.length === 0) {
      setActiveSlot({ type: 'cover' });
    } else {
      setActiveSlot({ type: 'color', index: Math.max(0, idx - 1) });
    }
  };

  const handleSelectSwatchFromPalette = (sw: { name: string; hex: string }) => {
    if (!activeColor) return;
    const shouldAutoFillName = isPlaceholderOrPresetColorName(activeColor.name);
    const next = colorOptions.map((c, i) => {
      if (i !== safeColorIdx) return c;
      return {
        ...c,
        hex: sw.hex,
        ...(shouldAutoFillName ? { name: sw.name } : {}),
      };
    });
    setColorOptions(next);

    // Only auto-advance to the next photo if the current photo already has its price set
    if (activeColor.price && Number(activeColor.price) > 0) {
      const nextUnassignedIdx = next.findIndex(
        (c, i) =>
          i > safeColorIdx &&
          Boolean(c.image) &&
          (!c.hex ||
            c.name.trim().toLowerCase() === 'chưa chọn màu' ||
            !c.price ||
            Number(c.price) <= 0)
      );
      if (nextUnassignedIdx !== -1) {
        setActiveSlot({ type: 'color', index: nextUnassignedIdx });
      }
    }
  };

  /* ---- Auto Generate Description ---- */
  const handleGenerateDescription = () => {
    if (!name.trim()) {
      Alert.alert('Thiếu tên sản phẩm', 'Vui lòng nhập tên sản phẩm trước khi tạo mô tả.');
      return;
    }
    const inferred =
      category === 'Crochet' && name.trim() ? inferCategory(name) : category;
    const resolvedColorName =
      activeColor?.name &&
      activeColor.name.trim().toLowerCase() !== 'chưa chọn màu'
        ? activeColor.name
        : 'Kem Sữa';
    const desc = generateProductDescription({
      name: name.trim(),
      category: inferred,
      material: material.trim() || 'Len Cotton Milk',
      color: resolvedColorName,
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
    if (isSubmitting) return;
    if (!name.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên sản phẩm.');
      return;
    }

    const fallbackPriceNum = Number(price.replace(/[^0-9]/g, ''));

    const cleanColors = colorOptions
      .filter((c) => Boolean(c.image) || c.name.trim().length > 0)
      .map((c, idx) => {
        const rawName = c.name.trim();
        const isUnset =
          !rawName || rawName.toLowerCase() === 'chưa chọn màu';
        const resolvedVariantPrice =
          c.price !== undefined && Number(c.price) > 0
            ? Number(c.price)
            : fallbackPriceNum > 0
            ? fallbackPriceNum
            : undefined;
        return {
          ...c,
          id: c.id || `c_${idx + 1}`,
          name: isUnset
            ? colorOptions.length === 1
              ? 'Kem Sữa'
              : `Mẫu #${idx + 1}`
            : rawName,
          hex: c.hex && c.hex.trim().length > 0 ? c.hex : '#F5EBE0',
          price: resolvedVariantPrice,
        };
      });

    if (cleanColors.length === 0) {
      Alert.alert(
        'Chưa có ảnh mẫu sản phẩm',
        'Vui lòng gửi ít nhất 1 ảnh sản phẩm lên ở phần "Ảnh sản phẩm & Chọn màu từng ảnh", sau đó nhập giá riêng cho từng mẫu.'
      );
      return;
    }

    const missingPriceIdx = cleanColors.findIndex(
      (c) => !c.price || Number(c.price) <= 0
    );
    if (missingPriceIdx !== -1) {
      setActiveSlot({ type: 'color', index: missingPriceIdx });
      Alert.alert(
        'Thiếu giá bán từng mẫu',
        `Vui lòng nhập giá bán (VNĐ) cho Ảnh #${missingPriceIdx + 1} (${cleanColors[missingPriceIdx].name}).`
      );
      return;
    }

    const numPrice =
      Number(cleanColors[0]?.price) ||
      cleanColors.reduce(
        (min, c) =>
          c.price && c.price > 0 && c.price < min ? c.price : min,
        Number(cleanColors[0]?.price || 0)
      );

    setIsSubmitting(true);
    try {

    const firstAvailableImg =
      coverImage ||
      cleanColors.find((c) => Boolean(c.image))?.image ||
      extraPhotos[0] ||
      initialProduct?.image ||
      null;

    // Ensure every color option has a valid image (falls back to firstAvailableImg if admin didn't pick a separate image)
    const normalizedColors = cleanColors.map((c) => ({
      ...c,
      image: c.image || firstAvailableImg || undefined,
    }));

    const cleanAccessories: ProductAccessoryOption[] = [
      {
        id: 'no_box',
        name: 'Tự dùng / Tiêu chuẩn',
        emoji: '🛍️',
        priceDelta: 0,
      },
      {
        id: 'gift_box_letter',
        name: 'Set Quà Tặng Đặc Biệt',
        emoji: '🎁',
        priceDelta: 25000,
      },
    ];

    const builtGallery: ProductGalleryItem[] = extraPhotos.map((uri, idx) => ({
      id: `g_extra_${idx + 1}`,
      label: `Góc chụp #${idx + 2}`,
      angleTag: `Góc #${idx + 2}`,
      image: uri,
      zoomMode: 'normal',
    }));

    const finalMaterial = material.trim() || 'Len Cotton Milk';
    const finalMainColor = normalizedColors[0]?.name || 'Kem Sữa';
    const finalQty = isMadeToOrder
      ? 999
      : quantity.trim() && !isNaN(Number(quantity)) && Number(quantity) >= 0
      ? Number(quantity)
      : 10;

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
      isMadeToOrder,
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

      if (mode === 'add') {
        await deleteAdminDraft(currentDraftId);
        await clearWorkingDraft();
      }
      await onSubmitProduct(productPayload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          isMobile && styles.scrollContentMobile,
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* 1. Top Navigation Bar (Synchronized with Product Detail) */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={handleBackPress}>
            <ChevronLeft size={18} color="#4A3728" />
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={styles.pageTitle} numberOfLines={1}>
              {isMobile
                ? mode === 'add'
                  ? 'Thêm sản phẩm'
                  : 'Sửa sản phẩm'
                : mode === 'add'
                ? 'Thêm mẫu sản phẩm mới'
                : 'Chỉnh sửa sản phẩm'}
            </Text>
            {mode === 'add' && draftStatusMsg ? (
              <Text style={styles.draftAutoStatusText} numberOfLines={1}>
                ✓ {draftStatusMsg}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={[
              styles.saveTopBtn,
              mode === 'add' && styles.saveDraftTopBtn,
            ]}
            onPress={() => {
              if (mode === 'add') {
                void handleSaveDraftOnly(true);
              } else {
                void handleSave();
              }
            }}
            activeOpacity={0.85}>
            <FileText size={15} color="#FFFDF9" />
            <Text style={styles.saveTopBtnText}>
              {mode === 'add' ? 'Lưu nháp' : 'Lưu cập nhật'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Saved Drafts Quick-Resume Bar (Only in Add mode when Admin has saved drafts) */}
        {mode === 'add' && (savedDrafts.length > 0 || isDraftMeaningful(buildCurrentDraftObject())) && (
          <View style={styles.draftBannerCard}>
            <View style={styles.draftBannerHeader}>
              <View style={styles.draftBannerTitleRow}>
                <FileText size={15} color="#92400E" />
                <Text style={styles.draftBannerTitle}>
                  Bản nháp bên Admin ({savedDrafts.length || 1} bản đang lưu — Khách chưa thấy)
                </Text>
              </View>
              <TouchableOpacity
                style={styles.newBlankDraftBtn}
                onPress={handleResetBlankDraft}
                activeOpacity={0.8}>
                <Plus size={13} color="#4A3728" />
                <Text style={styles.newBlankDraftBtnText}>Tạo mẫu mới trắng</Text>
              </TouchableOpacity>
            </View>

            {savedDrafts.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.draftChipsRow}>
                {savedDrafts.map((d, idx) => {
                  const isCurrent = d.id === currentDraftId;
                  const photoCount =
                    (d.coverImage ? 1 : 0) +
                    (d.colorOptions?.filter((c) => Boolean(c.image)).length || 0) +
                    (d.extraPhotos?.length || 0);
                  return (
                    <View
                      key={d.id || idx}
                      style={[
                        styles.draftChip,
                        isCurrent && styles.draftChipActive,
                      ]}>
                      <TouchableOpacity
                        style={styles.draftChipMainTap}
                        onPress={() => applyDraftToForm(d)}
                        activeOpacity={0.8}>
                        <Text
                          style={[
                            styles.draftChipName,
                            isCurrent && styles.draftChipNameActive,
                          ]}
                          numberOfLines={1}>
                          {d.name?.trim() || `Bản nháp #${idx + 1} (Chưa đặt tên)`}
                        </Text>
                        <Text style={styles.draftChipMeta}>
                          {photoCount} ảnh • {d.colorOptions?.length || 1} phân loại
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.draftChipDeleteBtn}
                        onPress={() => handleDeleteSavedDraft(d.id)}>
                        <X size={12} color="#B91C1C" />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </View>
        )}

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
                Platform.OS === 'web' && resolveImgUri(currentDisplayImage) ? (
                  React.createElement('img', {
                    src: resolveImgUri(currentDisplayImage)!,
                    alt: name || 'Sản phẩm',
                    decoding: 'async',
                    style: {
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    },
                  })
                ) : (
                  <Image
                    source={
                      typeof currentDisplayImage === 'string'
                        ? { uri: currentDisplayImage }
                        : (currentDisplayImage as any)
                    }
                    style={styles.mainImage}
                    resizeMode="cover"
                  />
                )
              ) : (
                <TouchableOpacity
                  style={styles.emptyImageTapArea}
                  onPress={() => handlePickCurrentSlotPhoto(false)}
                  activeOpacity={0.8}>
                  <ImageIcon size={44} color="#7A5230" />
                  <Text style={styles.emptyImageTitle}>
                    Bấm để gửi ảnh sản phẩm lên (1 hoặc nhiều ảnh)
                  </Text>
                  <Text style={styles.emptyImageSub}>
                    📸 Tải toàn bộ ảnh sản phẩm lên trước → Chọn màu cho từng ảnh ở bước sau
                  </Text>
                </TouchableOpacity>
              )}

              {/* Top-left slot indicator */}
              <View style={styles.slotBadge}>
                {activeSlot.type === 'cover' ? (
                  <Text style={styles.slotBadgeText}>
                    🌟 Ảnh Trang Bìa (Hiển thị đầu tiên)
                  </Text>
                ) : activeSlot.type === 'color' ? (
                  <>
                    <View
                      style={[
                        styles.slotDot,
                        { backgroundColor: activeColor?.hex || '#F5EBE0' },
                      ]}
                    />
                    <Text style={styles.slotBadgeText}>
                      Ảnh phân loại: {activeColor?.name || 'Màu #1'}
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
                    {activeSlot.type === 'cover'
                      ? coverImage
                        ? 'Đổi ảnh bìa'
                        : 'Chọn ảnh bìa'
                      : currentDisplayImage
                      ? 'Đổi ảnh mẫu này'
                      : 'Chọn ảnh từ máy'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoOverlayBtn}
                  onPress={() => handlePickCurrentSlotPhoto(true)}
                  activeOpacity={0.85}>
                  <Camera size={14} color="#3D2B1F" />
                  <Text style={styles.photoOverlayBtnText}>Chụp ảnh</Text>
                </TouchableOpacity>
                {currentDisplayImage ? (
                  <TouchableOpacity
                    style={styles.photoOverlayBtn}
                    onPress={handleToggleFrameFitCurrentPhoto}
                    activeOpacity={0.85}>
                    <Maximize2 size={13} color="#3D2B1F" />
                    <Text style={styles.photoOverlayBtnText}>
                      {frameFitMode === 'contain_square'
                        ? 'Đầy khung 1:1'
                        : 'Giữ trọn ảnh'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            {/* AI Studio Retouch, Smart Backdrop & 1-Click Cover Collage Toolbar */}
            <View
              style={{
                backgroundColor: '#FFFDF9',
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: '#E6D5C3',
                padding: 12,
                gap: 10,
                marginBottom: 8,
              }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} color="#B45309" />
                  <Text
                    style={{
                      fontSize: 12.5,
                      fontWeight: '800',
                      color: '#3B281E',
                    }}>
                    🪄 Phòng Lab Ảnh Studio Tự Động (Giữ nguyên 100% sản phẩm thật)
                  </Text>
                </View>
                {isStudioBusy && (
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: '800',
                      color: '#D97706',
                    }}>
                    ⏳ Đang xử lý Studio HD...
                  </Text>
                )}
              </View>

              {/* Row 1: Studio Backdrop & Yarn-Stitch Sharpening Presets */}
              <View style={{ gap: 5 }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '700',
                    color: '#6E5643',
                  }}>
                  1. Chọn chế độ Làm nét mũi len & Ghép phông nền Studio:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                  {STUDIO_RETOUCH_PRESETS.map((p) => {
                    const active = studioPreset === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => void handleSelectStudioPreset(p.id)}
                        disabled={isStudioBusy}
                        activeOpacity={0.82}
                        style={{
                          paddingHorizontal: 11,
                          paddingVertical: 6.5,
                          borderRadius: 999,
                          backgroundColor: active ? '#4A3427' : '#F7EFE6',
                          borderWidth: 1,
                          borderColor: active ? '#4A3427' : '#E2D2C1',
                        }}>
                        <Text
                          style={{
                            fontSize: 11.5,
                            fontWeight: '800',
                            color: active ? '#FFFDF9' : '#4A3427',
                          }}>
                          {p.shortLabel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {colorOptions.length > 1 && (
                  <TouchableOpacity
                    onPress={() => void handleApplyPresetToAllPhotos()}
                    disabled={isStudioBusy}
                    activeOpacity={0.85}
                    style={{
                      marginTop: 2,
                      backgroundColor: '#FEF3C7',
                      borderWidth: 1,
                      borderColor: '#F59E0B',
                      borderRadius: 9,
                      paddingVertical: 7,
                      paddingHorizontal: 10,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: '#92400E',
                      }}>
                      ⚡ Áp dụng phông & làm nét này cho TẤT CẢ {colorOptions.length} ảnh mẫu cùng lúc
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Row 2: 1-Click Auto Cover Collage from Variant Photos */}
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: '#EFE4D8',
                  paddingTop: 8,
                  gap: 6,
                }}>
                <Text
                  style={{
                    fontSize: 11.5,
                    fontWeight: '700',
                    color: '#6E5643',
                  }}>
                  2. Tự động gộp các ảnh mẫu thành Ảnh Bìa Chính (Không cần ghép tay):
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 6,
                  }}>
                  <TouchableOpacity
                    onPress={() => void handleGenerateCoverCollage('grid_auto')}
                    disabled={isStudioBusy}
                    activeOpacity={0.82}
                    style={{
                      flex: 1,
                      minWidth: 115,
                      backgroundColor: '#4A3427',
                      borderRadius: 9,
                      paddingVertical: 7.5,
                      paddingHorizontal: 9,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: '#FFFDF9',
                      }}
                      numberOfLines={1}>
                      🔲 Ghép Lưới (2–9 mẫu)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void handleGenerateCoverCollage('hero_strip')}
                    disabled={isStudioBusy}
                    activeOpacity={0.82}
                    style={{
                      flex: 1,
                      minWidth: 125,
                      backgroundColor: '#F7EFE6',
                      borderWidth: 1,
                      borderColor: '#D6C3B0',
                      borderRadius: 9,
                      paddingVertical: 7.5,
                      paddingHorizontal: 9,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: '#4A3427',
                      }}
                      numberOfLines={1}>
                      🌟 1 Lớn + Dãy Mẫu Nhỏ
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() =>
                      void handleGenerateCoverCollage('polaroid_fan')
                    }
                    disabled={isStudioBusy}
                    activeOpacity={0.82}
                    style={{
                      flex: 1,
                      minWidth: 115,
                      backgroundColor: '#F7EFE6',
                      borderWidth: 1,
                      borderColor: '#D6C3B0',
                      borderRadius: 9,
                      paddingVertical: 7.5,
                      paddingHorizontal: 9,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: '800',
                        color: '#4A3427',
                      }}
                      numberOfLines={1}>
                      🃏 Polaroid Xếp Quạt
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Thumbnail Strip: 1. Cover Photo + 2. Color Thumbnails + 3. Extra Angle Thumbnails + Add Button */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.thumbRow}>
              {/* 1. Dedicated Cover Photo Slot (Trang Bìa) */}
              <TouchableOpacity
                style={styles.thumbItemWrap}
                onPress={() => setActiveSlot({ type: 'cover' })}
                activeOpacity={0.8}>
                <View
                  style={[
                    styles.thumbBox,
                    activeSlot.type === 'cover' && styles.thumbBoxActive,
                  ]}>
                  {(coverImage || initialProduct?.image) ? (
                    Platform.OS === 'web' &&
                    resolveImgUri(coverImage || initialProduct?.image) ? (
                      React.createElement('img', {
                        src: resolveImgUri(coverImage || initialProduct?.image)!,
                        alt: 'Ảnh bìa',
                        decoding: 'async',
                        style: {
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          display: 'block',
                        },
                      })
                    ) : (
                      <Image
                        source={
                          typeof (coverImage || initialProduct?.image) === 'string'
                            ? { uri: (coverImage || initialProduct?.image) as string }
                            : ((coverImage || initialProduct?.image) as any)
                        }
                        style={styles.thumbImg}
                        resizeMode="cover"
                      />
                    )
                  ) : (
                    <View style={styles.thumbEmpty}>
                      <ImageIcon size={16} color="#D97706" />
                    </View>
                  )}
                  <View
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      backgroundColor: 'rgba(180, 83, 9, 0.88)',
                      paddingVertical: 2,
                      alignItems: 'center',
                    }}>
                    <Text
                      style={{
                        fontSize: 9,
                        fontWeight: '900',
                        color: '#FFFBEB',
                        letterSpacing: 0.4,
                      }}>
                      ★ BÌA
                    </Text>
                  </View>
                </View>
                <Text
                  style={[
                    styles.thumbLabelText,
                    { fontWeight: '800', color: '#92400E' },
                  ]}
                  numberOfLines={1}>
                  Ảnh bìa
                </Text>
              </TouchableOpacity>

              {/* 2. Color / Variant Thumbnails */}
              {colorOptions.map((c, idx) => {
                const isSelected =
                  activeSlot.type === 'color' && safeColorIdx === idx;
                const thumbImg = c.image;
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
                        Platform.OS === 'web' && resolveImgUri(thumbImg) ? (
                          React.createElement('img', {
                            src: resolveImgUri(thumbImg)!,
                            alt: c.name || 'Màu',
                            decoding: 'async',
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            },
                          })
                        ) : (
                          <Image
                            source={
                              typeof thumbImg === 'string'
                                ? { uri: thumbImg }
                                : (thumbImg as any)
                            }
                            style={styles.thumbImg}
                            resizeMode="cover"
                          />
                        )
                      ) : (
                        <View style={styles.thumbEmpty}>
                          <ImageIcon size={16} color="#8C7A6B" />
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.thumbDeleteMini}
                        onPress={() => handleRemoveColorOption(idx)}>
                        <X size={10} color="#FFF" />
                      </TouchableOpacity>
                      </View>
                      <View style={styles.thumbLabelRow}>
                      <View
                        style={[
                          styles.miniDot,
                          { backgroundColor: c.hex || '#F5EBE0' },
                        ]}
                      />
                      <Text style={styles.thumbLabelText} numberOfLines={1}>
                        {c.name || `Mẫu ${idx + 1}`}
                      </Text>
                      </View>
                      </TouchableOpacity>
                      );
                      })}

                      <TouchableOpacity
                      style={styles.thumbItemWrap}
                      onPress={handleBatchAddColorPhotos}
                      activeOpacity={0.8}>
                      <View
                      style={[
                      styles.addThumbBox,
                      { borderColor: '#D97706', backgroundColor: '#FFFBEB' },
                      ]}>
                      <Plus size={18} color="#B45309" />
                      </View>
                      <Text
                      style={[
                      styles.thumbLabelText,
                      { color: '#92400E', fontWeight: '700' },
                      ]}
                      numberOfLines={1}>
                      + Ảnh màu
                      </Text>
                      </TouchableOpacity>

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
                      {Platform.OS === 'web' ? (
                        React.createElement('img', {
                          src: uri,
                          alt: `Góc #${idx + 2}`,
                          decoding: 'async',
                          style: {
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            display: 'block',
                          },
                        })
                      ) : (
                        <Image
                          source={{ uri }}
                          style={styles.thumbImg}
                          resizeMode="cover"
                        />
                      )}
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
              <View style={styles.labelWithActionRow}>
                <Text style={styles.fieldLabel}>Danh mục</Text>
                <TouchableOpacity
                  style={styles.sparkleMiniBtn}
                  onPress={() => setShowCatManager((v) => !v)}
                  activeOpacity={0.75}>
                  <Plus size={12} color="#4A3728" />
                  <Text style={styles.sparkleMiniBtnText}>
                    {showCatManager ? 'Đóng tuỳ chỉnh' : 'Thêm / Xoá danh mục'}
                  </Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryChipsRow}>
                {shopCategories.map((catItem) => {
                  const cat = catItem.id;
                  const active = category === cat;
                  return (
                    <View
                      key={cat}
                      style={[
                        styles.catChip,
                        active && styles.catChipActive,
                        { flexDirection: 'row', alignItems: 'center', gap: 6 },
                      ]}>
                      <TouchableOpacity
                        onPress={() => setCategory(cat)}
                        activeOpacity={0.75}>
                        <Text
                          style={[
                            styles.catChipText,
                            active && styles.catChipTextActive,
                          ]}>
                          {catItem.emoji || getCategoryEmoji(cat)}{' '}
                          {catItem.label || getCategoryLabel(cat)}
                        </Text>
                      </TouchableOpacity>
                      {showCatManager && shopCategories.length > 1 && (
                        <TouchableOpacity
                          onPress={() => {
                            removeShopCategory(cat);
                            if (category === cat) {
                              const fallback = shopCategories.find(
                                (c) => c.id !== cat
                              );
                              if (fallback) setCategory(fallback.id);
                            }
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: active
                              ? 'rgba(255,255,255,0.22)'
                              : '#EFE3D6',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                          <X
                            size={11}
                            color={active ? '#FFFDF9' : '#7A5C45'}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {showCatManager && (
                <View
                  style={{
                    backgroundColor: '#FAF6F0',
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#E2D4C4',
                    padding: 12,
                    gap: 10,
                    marginTop: 4,
                  }}>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '700',
                      color: '#4A3728',
                    }}>
                    Tạo danh mục mới (hoặc bấm dấu × trên thẻ ở trên để xoá bớt)
                  </Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                    <TouchableOpacity
                      onPress={() => setNewCatLine('len')}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor:
                          newCatLine === 'len' ? '#5C4033' : '#FFFDF9',
                        borderWidth: 1,
                        borderColor:
                          newCatLine === 'len' ? '#5C4033' : '#DFD3C3',
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: newCatLine === 'len' ? '#FFFDF9' : '#5C4738',
                        }}>
                        🧶 Thuộc dòng Len
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setNewCatLine('kem_nhung')}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor:
                          newCatLine === 'kem_nhung' ? '#5C4033' : '#FFFDF9',
                        borderWidth: 1,
                        borderColor:
                          newCatLine === 'kem_nhung' ? '#5C4033' : '#DFD3C3',
                      }}>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color:
                            newCatLine === 'kem_nhung' ? '#FFFDF9' : '#5C4738',
                        }}>
                        🌸 Thuộc dòng Kẽm nhung
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6 }}>
                    {[
                      '🧢',
                      '🔑',
                      '🧶',
                      '🌻',
                      '👜',
                      '🧸',
                      '🧣',
                      '🎀',
                      '💐',
                      '🪴',
                      '🌸',
                      '🎁',
                      '✨',
                    ].map((emo) => (
                      <TouchableOpacity
                        key={emo}
                        onPress={() => setNewCatEmoji(emo)}
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor:
                            newCatEmoji === emo ? '#D8C3AD' : '#FFFDF9',
                          borderWidth: 1.5,
                          borderColor:
                            newCatEmoji === emo ? '#8C684C' : '#E5D6C5',
                        }}>
                        <Text style={{ fontSize: 16 }}>{emo}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 8,
                    }}>
                    <TextInput
                      style={[
                        styles.stdInput,
                        { flex: 1, minWidth: 160, height: 38, paddingVertical: 6 },
                      ]}
                      value={newCatLabel}
                      onChangeText={setNewCatLabel}
                      placeholder="Tên danh mục (VD: Mũ len, Hoa tốt nghiệp...)"
                      placeholderTextColor={COLORS.lightText}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (!newCatLabel.trim()) return;
                        const added = addShopCategory({
                          label: newCatLabel.trim(),
                          emoji: newCatEmoji,
                          craftLine: newCatLine,
                        });
                        if (added) {
                          setCategory(added.id);
                          setNewCatLabel('');
                        }
                      }}
                      style={{
                        backgroundColor: '#5C4033',
                        paddingHorizontal: 14,
                        height: 38,
                        borderRadius: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                      <Plus size={14} color="#FFFDF9" />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: '700',
                          color: '#FFFDF9',
                        }}>
                        Thêm
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={resetShopCategories}
                      style={{
                        backgroundColor: '#EFE3D6',
                        paddingHorizontal: 10,
                        height: 38,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#D8C3AD',
                      }}>
                      <Text
                        style={{
                          fontSize: 11.5,
                          fontWeight: '700',
                          color: '#5C4738',
                        }}>
                        Khôi phục mặc định
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
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

            {/* Material row (Price is now configured per individual uploaded product variant below) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Chất liệu</Text>
              <TextInput
                style={styles.stdInput}
                value={material}
                onChangeText={setMaterial}
                placeholder="Len Cotton Milk"
                placeholderTextColor={COLORS.lightText}
              />
            </View>

            {/* Stock / Order Mode Selector (Synchronized with Client) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Hình thức & Số lượng</Text>
              <View style={styles.stockModeRow}>
                <TouchableOpacity
                  style={[
                    styles.stockModePill,
                    isMadeToOrder && styles.stockModePillActive,
                  ]}
                  onPress={() => setIsMadeToOrder(true)}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.stockModeText,
                      isMadeToOrder && styles.stockModeTextActive,
                    ]}>
                    🧶 Sản phẩm Order (Đặt làm 5–6 ngày)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.stockModePill,
                    !isMadeToOrder && styles.stockModePillActive,
                  ]}
                  onPress={() => setIsMadeToOrder(false)}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.stockModeText,
                      !isMadeToOrder && styles.stockModeTextActive,
                    ]}>
                    📦 Có sẵn tại tiệm
                  </Text>
                </TouchableOpacity>

                {!isMadeToOrder && (
                  <View style={styles.stockQtyInlineWrap}>
                    <Text style={styles.stockQtyInlineLabel}>SL:</Text>
                    <TextInput
                      style={styles.stockQtyInlineInput}
                      value={quantity}
                      onChangeText={setQuantity}
                      placeholder="10"
                      placeholderTextColor={COLORS.lightText}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Packaging / Gift Box Options (Synchronized with Client Product Page) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Đóng gói & Quà tặng (Khách chọn khi mua)
              </Text>
              <View style={styles.stockModeRow}>
                <TouchableOpacity
                  style={[
                    styles.stockModePill,
                    previewPackagingId === 'no_box' && styles.stockModePillActive,
                  ]}
                  onPress={() => setPreviewPackagingId('no_box')}
                  activeOpacity={0.8}>
                  <Text
                    style={[
                      styles.stockModeText,
                      previewPackagingId === 'no_box' && styles.stockModeTextActive,
                    ]}>
                    🛍️ Tự dùng / Tiêu chuẩn (+0₫)
                    </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                    style={[
                    styles.stockModePill,
                    previewPackagingId === 'gift_box_letter' &&
                      styles.stockModePillActive,
                    ]}
                    onPress={() => setPreviewPackagingId('gift_box_letter')}
                    activeOpacity={0.8}>
                    <Text
                    style={[
                      styles.stockModeText,
                      previewPackagingId === 'gift_box_letter' &&
                        styles.stockModeTextActive,
                    ]}>
                    🎁 Set Quà Tặng Đặc Biệt (+25.000₫)
                    </Text>
                    </TouchableOpacity>
                    </View>
                    {activeColor?.price && Number(activeColor.price) > 0 ? (
                    <Text
                    style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: '#6E4F37',
                    marginTop: 2,
                    }}>
                    {previewPackagingId === 'gift_box_letter'
                    ? `💡 Giá hiển thị của Ảnh #${safeColorIdx + 1} khi chọn Set Quà Tặng Đặc Biệt: ${(
                        Number(activeColor.price) + 25000
                      ).toLocaleString('vi-VN')}₫`
                    : `💡 Giá hiển thị của Ảnh #${safeColorIdx + 1} khi chọn Tự dùng / Tiêu chuẩn: ${Number(
                        activeColor.price
                      ).toLocaleString('vi-VN')}₫`}
                    </Text>
              ) : null}
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

            {/* COLOR OPTIONS (Photo-first workflow: Upload product photos first -> Pick color & individual price for each photo afterwards) */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                Ảnh sản phẩm — Chỉnh màu & Giá bán riêng từng cái ({colorOptions.length} mẫu đã tải lên) *
              </Text>

              {/* STEP 1: Upload Product Photos First */}
              <View style={[styles.pillWrap, { marginBottom: 8 }]}>
                <TouchableOpacity
                  style={[
                    styles.addOptionPill,
                    {
                      backgroundColor: '#FEF3C7',
                      borderColor: '#F59E0B',
                      borderStyle: 'solid',
                      paddingVertical: 9,
                      paddingHorizontal: 14,
                    },
                  ]}
                  onPress={handleBatchAddColorPhotos}
                  activeOpacity={0.8}>
                  <Plus size={15} color="#92400E" />
                  <ImageIcon size={14} color="#92400E" />
                  <Text style={[styles.addOptionPillText, { color: '#92400E', fontWeight: '800' }]}>
                    Bước 1: Gửi ảnh sản phẩm lên (Chọn 1 hoặc nhiều ảnh)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addOptionPill}
                  onPress={handleCaptureNewColorPhoto}
                  activeOpacity={0.8}>
                  <Camera size={13} color="#4A3728" />
                  <Text style={styles.addOptionPillText}>Chụp ảnh sản phẩm</Text>
                </TouchableOpacity>

                {colorOptions.length === 0 && (coverImage || initialProduct?.image) ? (
                  <TouchableOpacity
                    style={styles.addOptionPill}
                    onPress={handleUseCoverAsFirstVariant}
                    activeOpacity={0.8}>
                    <Sparkles size={13} color="#4A3728" />
                    <Text style={styles.addOptionPillText}>
                      Chọn màu & giá cho ảnh bìa hiện tại
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.addOptionPill,
                    {
                      backgroundColor: '#FFF7ED',
                      borderColor: '#EA580C',
                      borderStyle: 'solid',
                    },
                  ]}
                  onPress={() => {
                    const existingIdx = colorOptions.findIndex((c) =>
                      isComboColorOption(c)
                    );
                    if (existingIdx !== -1) {
                      setActiveSlot({ type: 'color', index: existingIdx });
                      return;
                    }
                    const refUnit =
                      Number(colorOptions[0]?.price) ||
                      Number(price.replace(/\D/g, '')) ||
                      49000;
                    const suggestedComboPrice =
                      calculateSmartCombo2Price(refUnit);
                    const comboImg =
                      coverImage ||
                      colorOptions[0]?.image ||
                      initialProduct?.image ||
                      undefined;
                    const nextList: ProductColorOption[] = [
                      ...colorOptions,
                      {
                        id: DEFAULT_COMBO_OPTION_ID,
                        name:
                          colorOptions.length >= 2
                            ? '🎁 Combo 2 Mẫu Tự Chọn'
                            : '🎁 Combo 2 Sản Phẩm (Tiết kiệm)',
                        hex: '#D97706',
                        image: comboImg,
                        price: suggestedComboPrice,
                      },
                    ];
                    setColorOptions(nextList);
                    setActiveSlot({
                      type: 'color',
                      index: nextList.length - 1,
                    });
                  }}
                  activeOpacity={0.8}>
                  <Sparkles size={13} color="#C2410C" />
                  <Text
                    style={[
                      styles.addOptionPillText,
                      { color: '#C2410C', fontWeight: '800' },
                    ]}>
                    🎁 + Tạo phân loại Combo 2 mẫu (Tự tính giá ưu đãi)
                  </Text>
                </TouchableOpacity>
                </View>

              {/* STEP 2: List of uploaded photos to pick a color & price for each */}
              {colorOptions.length > 0 && (
                <View style={styles.pillWrap}>
                  {colorOptions.map((c, idx) => {
                    const selected =
                      activeSlot.type === 'color' && safeColorIdx === idx;
                    const pillThumb = resolveImgUri(c.image);
                    const isUnassigned =
                      !c.hex ||
                      !c.name.trim() ||
                      c.name.trim().toLowerCase() === 'chưa chọn màu';
                    const hasVariantPrice = Boolean(c.price && Number(c.price) > 0);
                    const needsAttention = isUnassigned || !hasVariantPrice;
                    return (
                      <TouchableOpacity
                        key={c.id || idx}
                        style={[
                          styles.optionPill,
                          selected && styles.optionPillSelected,
                          needsAttention &&
                            !selected && {
                              borderColor: '#F59E0B',
                              backgroundColor: '#FFFBEB',
                            },
                        ]}
                        onPress={() => setActiveSlot({ type: 'color', index: idx })}
                        activeOpacity={0.8}>
                        {pillThumb ? (
                          Platform.OS === 'web' ? (
                            React.createElement('img', {
                              src: pillThumb,
                              alt: c.name || `Ảnh #${idx + 1}`,
                              decoding: 'async',
                              style: {
                                width: 26,
                                height: 26,
                                borderRadius: 6,
                                objectFit: 'cover',
                                display: 'block',
                                border: '1px solid rgba(61,43,31,0.18)',
                              },
                            })
                          ) : (
                            <Image
                              source={{ uri: pillThumb }}
                              style={styles.optionPillThumb}
                              resizeMode="cover"
                            />
                          )
                        ) : (
                          <View style={styles.optionPillThumbEmpty}>
                            <ImageIcon size={12} color="#8C7A6B" />
                          </View>
                        )}
                        <View
                          style={[
                            styles.colorDot,
                            {
                              backgroundColor: isUnassigned
                                ? 'transparent'
                                : c.hex || '#F5EBE0',
                              borderStyle: isUnassigned ? 'dashed' : 'solid',
                              borderColor: isUnassigned
                                ? '#D97706'
                                : 'rgba(61,43,31,0.28)',
                            },
                          ]}
                        />
                        <Text
                          style={[
                            styles.optionPillText,
                            selected && styles.optionPillTextSelected,
                            needsAttention &&
                              !selected && {
                                color: '#B45309',
                                fontWeight: '700',
                              },
                          ]}
                          numberOfLines={1}>
                          {`Ảnh #${idx + 1}: ${
                            isUnassigned ? 'Chưa chọn màu' : c.name
                          } • ${
                            hasVariantPrice
                              ? `${Number(c.price).toLocaleString('vi-VN')}₫`
                              : 'Chưa nhập giá'
                          }`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {colorOptions.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyVariantPromptBox}
                  onPress={handleBatchAddColorPhotos}
                  activeOpacity={0.82}>
                  <ImageIcon size={22} color="#92400E" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.emptyVariantPromptTitle}>
                      Bước 1: Bấm vào đây để gửi ảnh sản phẩm lên trước
                    </Text>
                    <Text style={styles.emptyVariantPromptSub}>
                      Bạn có thể chọn 1 hoặc nhiều ảnh sản phẩm cùng lúc. Sau khi ảnh tải lên xong, bạn chỉnh màu và nhập giá bán riêng cho từng ảnh bên dưới.
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* Inline editor for the currently selected photo variant */}
              {activeColor && (
                <View style={styles.activeColorEditorBox}>
                  <View style={styles.activeColorTopRow}>
                    {/* Selected Photo Mini Card */}
                    <TouchableOpacity
                      style={styles.activeColorPhotoPreviewBox}
                      onPress={() => {
                        setActiveSlot({ type: 'color', index: safeColorIdx });
                        handlePickCurrentSlotPhoto(false);
                      }}
                      activeOpacity={0.85}>
                      {resolveImgUri(activeColor.image) ? (
                        Platform.OS === 'web' ? (
                          React.createElement('img', {
                            src: resolveImgUri(activeColor.image)!,
                            alt: activeColor.name || 'Ảnh mẫu',
                            decoding: 'async',
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            },
                          })
                        ) : (
                          <Image
                            source={{ uri: resolveImgUri(activeColor.image)! }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        )
                      ) : (
                        <View style={styles.activeColorPhotoEmpty}>
                          <ImageIcon size={18} color="#92400E" />
                          <Text style={styles.activeColorPhotoEmptyText}>
                            + Chọn ảnh
                          </Text>
                        </View>
                      )}
                      <View style={styles.activeColorPhotoIndexBadge}>
                        <Text style={styles.activeColorPhotoIndexText}>
                          Ảnh #{safeColorIdx + 1}/{colorOptions.length}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Right side: Step label + Prev/Next photo + Name input + Per-Variant Price input */}
                    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                      <View style={styles.activeColorStepMetaRow}>
                        <Text style={styles.activeColorStepLabel}>
                          {!activeColor.hex ||
                          activeColor.name.trim().toLowerCase() === 'chưa chọn màu'
                            ? `Bước 2: Chọn màu & giá riêng cho Ảnh #${safeColorIdx + 1}`
                            : `Ảnh #${safeColorIdx + 1} — Đã chọn màu: ${activeColor.name}`}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {activeColor.image && coverImage !== activeColor.image ? (
                            <TouchableOpacity
                              style={styles.useSwatchNameMiniBtn}
                              onPress={() => setCoverImage(String(activeColor.image))}
                              activeOpacity={0.8}>
                              <Text style={styles.useSwatchNameMiniBtnText}>
                                ★ Đặt làm ảnh bìa
                              </Text>
                            </TouchableOpacity>
                          ) : null}
                          {colorOptions.length > 1 && (
                            <>
                              <TouchableOpacity
                                style={[
                                  styles.useSwatchNameMiniBtn,
                                  safeColorIdx === 0 && { opacity: 0.45 },
                                ]}
                                disabled={safeColorIdx === 0}
                                onPress={() =>
                                  setActiveSlot({
                                    type: 'color',
                                    index: Math.max(0, safeColorIdx - 1),
                                  })
                                }
                                activeOpacity={0.8}>
                                <Text style={styles.useSwatchNameMiniBtnText}>
                                  ← Ảnh trước
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={[
                                  styles.useSwatchNameMiniBtn,
                                  safeColorIdx >= colorOptions.length - 1 && {
                                    opacity: 0.45,
                                  },
                                ]}
                                disabled={safeColorIdx >= colorOptions.length - 1}
                                onPress={() =>
                                  setActiveSlot({
                                    type: 'color',
                                    index: Math.min(
                                      colorOptions.length - 1,
                                      safeColorIdx + 1
                                    ),
                                  })
                                }
                                activeOpacity={0.8}>
                                <Text style={styles.useSwatchNameMiniBtnText}>
                                  Ảnh tiếp →
                                </Text>
                              </TouchableOpacity>
                            </>
                          )}
                        </View>
                      </View>

                      <View style={styles.activeColorInputRow}>
                        <View
                          style={[
                            styles.colorDotLarge,
                            { backgroundColor: activeColor.hex || '#F5EBE0' },
                          ]}
                        />
                        <TextInput
                          style={styles.activeColorNameInput}
                          value={
                            activeColor.name.trim().toLowerCase() === 'chưa chọn màu'
                              ? ''
                              : activeColor.name
                          }
                          onChangeText={(txt) =>
                            handleUpdateActiveColor({ name: txt })
                          }
                          placeholder="Chạm màu bên dưới hoặc tự gõ tên mẫu này..."
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
                            {activeColor.image ? 'Đổi ảnh' : 'Chọn ảnh'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteMiniBtn}
                          onPress={() => handleRemoveColorOption(safeColorIdx)}>
                          <Trash2 size={14} color={COLORS.error} />
                        </TouchableOpacity>
                      </View>

                      {/* Per-variant individual price row */}
                      <View style={styles.activeColorInputRow}>
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: '800',
                            color: '#6E4F37',
                            flexShrink: 0,
                          }}>
                          💰 Giá mẫu #{safeColorIdx + 1} (VNĐ) *:
                        </Text>
                        <TextInput
                          style={[
                            styles.activeColorNameInput,
                            {
                              borderColor:
                                activeColor.price && Number(activeColor.price) > 0
                                  ? '#B58969'
                                  : '#F59E0B',
                              backgroundColor: '#FFFDF9',
                              color: '#6E4F37',
                              fontWeight: '800',
                            },
                          ]}
                          value={
                            activeColor.price && Number(activeColor.price) > 0
                              ? String(activeColor.price)
                              : ''
                          }
                          onChangeText={(txt) => {
                            const digits = txt.replace(/[^0-9]/g, '');
                            handleUpdateActiveColor({
                              price: digits ? Number(digits) : undefined,
                            });
                          }}
                          placeholder="Nhập giá riêng mẫu này (VD: 45000)"
                          placeholderTextColor={COLORS.lightText}
                          keyboardType="numeric"
                        />
                        {activeColor.price && Number(activeColor.price) > 0 ? (
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '800',
                              color: '#3D2B1F',
                              flexShrink: 0,
                            }}>
                            {Number(activeColor.price).toLocaleString('vi-VN')}₫
                          </Text>
                        ) : null}
                        {colorOptions.length > 1 &&
                        activeColor.price &&
                        Number(activeColor.price) > 0 ? (
                          <TouchableOpacity
                            style={styles.useSwatchNameMiniBtn}
                            onPress={() => {
                              const currentPrice = Number(activeColor.price);
                              setColorOptions((prev) =>
                                prev.map((item) =>
                                  !item.price || Number(item.price) <= 0
                                    ? { ...item, price: currentPrice }
                                    : item
                                )
                              );
                            }}
                            activeOpacity={0.8}>
                            <Text style={styles.useSwatchNameMiniBtnText}>
                              Điền cho ảnh chưa có giá
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  <View style={styles.paletteHeaderRow}>
                    <Text style={styles.paletteSubLabel}>
                      Bước 2 — Chọn màu đại diện cho ảnh này ({COLOR_SWATCHES.length} màu len hoặc tự chọn mã màu):
                    </Text>
                    {Platform.OS === 'web' &&
                      React.createElement(
                        'label',
                        {
                          style: {
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            backgroundColor: '#EFE6DA',
                            padding: '4px 10px',
                            borderRadius: 999,
                            border: '1px solid #DBCAB8',
                            cursor: 'pointer',
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: '#4A3728',
                          },
                        },
                        React.createElement('input', {
                          type: 'color',
                          value:
                            /^#[0-9a-fA-F]{6}$/.test(activeColor.hex || '')
                              ? activeColor.hex
                              : '#F5EBE0',
                          onChange: (e: any) => {
                            const nextHex = e?.target?.value;
                            if (nextHex) {
                              handleUpdateActiveColor({ hex: nextHex });
                            }
                          },
                          style: {
                            width: 18,
                            height: 18,
                            border: 'none',
                            padding: 0,
                            background: 'transparent',
                            cursor: 'pointer',
                          },
                        }),
                        '🎨 Tự chọn màu bất kỳ'
                      )}
                  </View>

                  <View style={styles.swatchesGridWrap}>
                    {COLOR_SWATCHES.map((sw) => {
                      const isCurrent =
                        (activeColor.hex || '').toLowerCase() ===
                        sw.hex.toLowerCase();
                      return (
                        <TouchableOpacity
                          key={`${sw.name}_${sw.hex}`}
                          style={[
                            styles.swatchChipBtn,
                            isCurrent && styles.swatchChipBtnSelected,
                          ]}
                          onPress={() => handleSelectSwatchFromPalette(sw)}
                          activeOpacity={0.8}>
                          <View
                            style={[
                              styles.swatchCircle,
                              { backgroundColor: sw.hex },
                              isCurrent && styles.swatchCircleSelected,
                            ]}
                          />
                          <Text
                            style={[
                              styles.swatchChipText,
                              isCurrent && styles.swatchChipTextSelected,
                            ]}>
                            {isCurrent ? `✓ ${sw.name}` : sw.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {/* Primary Publish & Draft Buttons */}
            <View style={styles.bottomActionsRow}>
              {mode === 'add' && (
                <TouchableOpacity
                  style={styles.saveDraftBottomBtn}
                  onPress={() => void handleSaveDraftOnly(true)}
                  activeOpacity={0.85}>
                  <FileText size={16} color="#4A3728" />
                  <Text style={styles.saveDraftBottomBtnText}>
                    Lưu nháp (Chưa đăng)
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.submitPrimaryBtn,
                  { flex: 1 },
                  isSubmitting && { opacity: 0.65 },
                ]}
                disabled={isSubmitting}
                onPress={handleSave}
                activeOpacity={0.85}>
                <Check size={18} color="#FFFDF9" />
                <Text style={styles.submitPrimaryBtnText}>
                  {isSubmitting
                    ? 'Đang lưu & đồng bộ sản phẩm...'
                    : mode === 'add'
                    ? 'Đăng sản phẩm lên kệ'
                    : 'Lưu cập nhật sản phẩm'}
                </Text>
              </TouchableOpacity>
            </View>
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
    paddingBottom: 110,
  },
  scrollContentMobile: {
    paddingHorizontal: 12,
    paddingBottom: 120,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 8,
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#F2ECE1',
    flexShrink: 0,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A3728',
  },
  pageTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  saveTopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: '#5C4033',
    flexShrink: 0,
  },
  saveDraftTopBtn: {
    backgroundColor: '#92400E',
  },
  saveTopBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDF9',
  },
  draftAutoStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2E7D32',
    marginTop: 1,
  },
  draftBannerCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  draftBannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  draftBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  draftBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  newBlankDraftBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  newBlankDraftBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#78350F',
  },
  draftChipsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 2,
  },
  draftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5D6C5',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
  },
  draftChipActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#D97706',
    borderWidth: 1.5,
  },
  draftChipMainTap: {
    maxWidth: 190,
  },
  draftChipName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  draftChipNameActive: {
    color: '#92400E',
  },
  draftChipMeta: {
    fontSize: 10.5,
    color: '#78716C',
    marginTop: 1,
  },
  draftChipDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameSpecHintBox: {
    marginTop: 8,
    backgroundColor: '#FAF6F0',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  frameSpecHintText: {
    fontSize: 11.5,
    lineHeight: 16,
    color: '#6E5A4B',
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
    padding: 13,
    borderRadius: 18,
    gap: 15,
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
  stockModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  stockModePill: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
  },
  stockModePillActive: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
    borderWidth: 1.5,
  },
  stockModeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#5C4738',
  },
  stockModeTextActive: {
    fontWeight: '700',
    color: '#3D2B1F',
  },
  stockQtyInlineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF6F0',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6E4F37',
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  stockQtyInlineLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#5C4738',
  },
  stockQtyInlineInput: {
    minWidth: 42,
    fontSize: 13.5,
    fontWeight: '700',
    color: '#3D2B1F',
    paddingVertical: 2,
    textAlign: 'center',
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
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FAF6F0',
    borderWidth: 1,
    borderColor: '#E6DDD0',
    maxWidth: '100%',
  },
  optionPillSelected: {
    backgroundColor: '#F1E7DA',
    borderColor: '#6E4F37',
    borderWidth: 1.5,
  },
  optionPillThumb: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.18)',
  },
  optionPillThumbEmpty: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#EFE6DA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DBCAB8',
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
    flexShrink: 1,
  },
  optionPillTextSelected: {
    fontWeight: '700',
    color: '#3D2B1F',
  },
  addOptionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  emptyVariantPromptBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 13,
    padding: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#F59E0B',
    marginTop: 2,
  },
  emptyVariantPromptTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#92400E',
  },
  emptyVariantPromptSub: {
    fontSize: 11.5,
    color: '#78350F',
    marginTop: 2,
    lineHeight: 16,
  },
  activeColorEditorBox: {
    backgroundColor: '#FAF6F0',
    borderRadius: 13,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E6DDD0',
    gap: 10,
    marginTop: 2,
  },
  activeColorTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeColorPhotoPreviewBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EFE6DA',
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  activeColorPhotoEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeColorPhotoEmptyText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#92400E',
  },
  activeColorPhotoIndexBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(61, 43, 31, 0.78)',
    paddingVertical: 1.5,
    alignItems: 'center',
  },
  activeColorPhotoIndexText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  activeColorStepMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  activeColorStepLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5A4B',
  },
  useSwatchNameMiniBtn: {
    backgroundColor: '#EFE6DA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D6C3B0',
  },
  useSwatchNameMiniBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  activeColorInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    minWidth: 0,
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
    gap: 4,
    backgroundColor: '#EFE6DA',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#DBCAB8',
    flexShrink: 0,
  },
  pickColorImgBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  paletteHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  paletteSubLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5A4B',
  },
  paletteModeSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFE6DA',
    padding: 3,
    borderRadius: 999,
  },
  paletteModeBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  paletteModeBtnActive: {
    backgroundColor: '#5C4033',
  },
  paletteModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4738',
  },
  paletteModeBtnTextActive: {
    color: '#FFFDF9',
    fontWeight: '700',
  },
  swatchesGridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 2,
  },
  swatchChipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FFFDF9',
    borderWidth: 1,
    borderColor: '#E2D4C4',
  },
  swatchChipBtnSelected: {
    backgroundColor: '#F1E7DA',
    borderColor: '#5C4033',
    borderWidth: 1.5,
  },
  swatchChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#4A3728',
  },
  swatchChipTextSelected: {
    fontWeight: '700',
    color: '#3D2B1F',
  },
  swatchCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(61,43,31,0.22)',
  },
  swatchCircleSelected: {
    borderWidth: 2,
    borderColor: '#3D2B1F',
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
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 6,
  },
  saveDraftBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F2ECE1',
    borderWidth: 1.5,
    borderColor: '#C4AA90',
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  saveDraftBottomBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#4A3728',
  },
  submitPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5C4033',
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  submitPrimaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFDF9',
  },
});
