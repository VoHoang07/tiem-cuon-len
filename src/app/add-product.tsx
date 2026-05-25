import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, ChevronLeft, Sparkles, Image as ImageIcon, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { Product, Category, Review } from '@/types/product';
import { COLORS, SPACING, SHADOWS, CATEGORIES } from '@/constants/theme';
import { generateProductDescription, inferCategory } from '@/utils/generateProductDescription';
import {
  AP_TITLE,
  AP_TAKE_PHOTO,
  AP_CAMERA_SUBTEXT,
  AP_PRODUCT_NAME,
  AP_PRODUCT_NAME_PLACEHOLDER,
  AP_PRICE,
  AP_PRICE_PLACEHOLDER,
  AP_CATEGORY,
  AP_MATERIAL,
  AP_MATERIAL_PLACEHOLDER,
  AP_COLOR_FIELD,
  AP_COLOR_PLACEHOLDER,
  AP_QUANTITY,
  AP_QUANTITY_PLACEHOLDER,
  AP_TAGS_LABEL,
  AP_TAGS_PLACEHOLDER,
  AP_GENERATE_BTN,
  AP_GENERATED_LABEL,
  AP_DESCRIPTION_LABEL,
  AP_DESCRIPTION_PLACEHOLDER,
  AP_SUBMIT_BTN,
  AP_CAMERA_PERMISSION_TITLE,
  AP_CAMERA_PERMISSION_MSG,
  AP_CHOOSE_FROM_GALLERY,
  AP_GALLERY_PERMISSION_TITLE,
  AP_GALLERY_PERMISSION_MSG,
  AP_CHANGE_IMAGE,
  AP_REMOVE_IMAGE,
  AP_NAME_REQUIRED,
  AP_PRICE_REQUIRED,
  AP_MATERIAL_REQUIRED,
  AP_COLOR_REQUIRED,
  AP_QUANTITY_REQUIRED,
  AP_DESC_REQUIRED,
  AP_REQUIRED_TITLE,
  AP_SUCCESS_TITLE,
  AP_SUCCESS_MSG,
  AUTH_ACCESS_DENIED,
  } from '@/constants/strings';
import { BottomNav } from '@/components/BottomNav';

export default function AddProductScreen() {
  const router = useRouter();
  const { addProduct, products } = useShop();
  const { role } = useAuth();

  const [image, setImage] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<Category>('Crochet');
  const [material, setMaterial] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');
  const [generated, setGenerated] = useState(false);

  // Access control: redirect customer to home
  if (role !== 'admin') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.accessDenied}>
          <Text style={styles.accessDeniedText}>{AUTH_ACCESS_DENIED}</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(AP_CAMERA_PERMISSION_TITLE, AP_CAMERA_PERMISSION_MSG);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.5,
      allowsEditing: true,
      aspect: [1, 1],
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(AP_GALLERY_PERMISSION_TITLE, AP_GALLERY_PERMISSION_MSG);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.5,
      allowsEditing: true,
      aspect: [4, 5],
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const generateDescription = () => {
    if (!name.trim()) {
      Alert.alert(AP_REQUIRED_TITLE, AP_NAME_REQUIRED);
      return;
    }
    const inferredCategory =
      category === 'Crochet' && name.trim() ? inferCategory(name) : category;
    const desc = generateProductDescription({
      name: name.trim(),
      category: inferredCategory,
      material: material.trim() || 'Cotton Yarn',
      color: color.trim() || 'Pastel',
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    setDescription(desc);
    setGenerated(true);
    if (inferredCategory !== category) {
      setCategory(inferredCategory);
    }
  };

  const resetForm = () => {
    setImage(null);
    setName('');
    setPrice('');
    setCategory('Crochet');
    setMaterial('');
    setColor('');
    setQuantity('');
    setTags('');
    setDescription('');
    setGenerated(false);
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert(AP_REQUIRED_TITLE, AP_NAME_REQUIRED);
      return;
    }
    if (!price.trim() || isNaN(Number(price)) || Number(price) <= 0) {
      Alert.alert(AP_REQUIRED_TITLE, AP_PRICE_REQUIRED);
      return;
    }
    if (!material.trim()) {
      Alert.alert(AP_REQUIRED_TITLE, AP_MATERIAL_REQUIRED);
      return;
    }
    if (!color.trim()) {
      Alert.alert(AP_REQUIRED_TITLE, AP_COLOR_REQUIRED);
      return;
    }
    if (!quantity.trim() || isNaN(Number(quantity)) || Number(quantity) <= 0) {
      Alert.alert(AP_REQUIRED_TITLE, AP_QUANTITY_REQUIRED);
      return;
    }
    if (!description.trim()) {
      Alert.alert(AP_REQUIRED_TITLE, AP_DESC_REQUIRED);
      return;
    }

    const newProduct: Product = {
      id: `user_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      image,
      category,
      material: material.trim(),
      color: color.trim(),
      quantity: Number(quantity),
      rating: 5,
      reviews: [],
      isFavorite: false,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: new Date().toISOString(),
    };

    addProduct(newProduct);
    resetForm();
    Alert.alert(AP_SUCCESS_TITLE, AP_SUCCESS_MSG, [
      {
        text: 'OK',
        onPress: () => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/manage-products');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/manage-products'); }} style={styles.backBtn}>
            <ChevronLeft size={24} color={COLORS.darkText} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{AP_TITLE}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Image Capture */}
        {image ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: image }} style={styles.previewImageLarge} />
            <View style={styles.imageActionsRow}>
              <TouchableOpacity style={styles.imageActionBtn} onPress={takePhoto}>
                <Camera size={18} color={COLORS.primary} />
                <Text style={styles.imageActionText}>{AP_CHANGE_IMAGE}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imageActionBtn}
                onPress={pickFromGallery}>
                <ImageIcon size={18} color={COLORS.primary} />
                <Text style={styles.imageActionText}>{AP_CHANGE_IMAGE}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageActionBtn, styles.imageActionBtnDanger]}
                onPress={() => setImage(null)}>
                <X size={18} color={COLORS.error} />
                <Text style={styles.imageActionTextDanger}>{AP_REMOVE_IMAGE}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.imagePickerArea}>
            <View style={styles.imagePlaceholder}>
              <Camera size={48} color={COLORS.primary} />
              <Text style={styles.imagePlaceholderTitle}>Thêm ảnh sản phẩm</Text>
              <Text style={styles.imagePlaceholderSubtext}>
                Chụp ảnh hoặc chọn từ thư viện
              </Text>
            </View>
            <View style={styles.imageBtnRow}>
              <TouchableOpacity
                style={styles.imageBtn}
                onPress={takePhoto}>
                <Camera size={20} color={COLORS.white} />
                <Text style={styles.imageBtnText}>{AP_TAKE_PHOTO}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.imageBtn, styles.imageBtnOutline]}
                onPress={pickFromGallery}>
                <ImageIcon size={20} color={COLORS.primary} />
                <Text style={styles.imageBtnTextOutline}>
                  {AP_CHOOSE_FROM_GALLERY}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={styles.form}>
          <FormField
            label={AP_PRODUCT_NAME}
            value={name}
            onChangeText={setName}
            placeholder={AP_PRODUCT_NAME_PLACEHOLDER}
          />

          <FormField
            label={AP_PRICE}
            value={price}
            onChangeText={setPrice}
            placeholder={AP_PRICE_PLACEHOLDER}
            keyboardType="numeric"
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{AP_CATEGORY}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryRow}>
              {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[
                    styles.categoryChip,
                    category === cat && styles.categoryChipSelected,
                  ]}
                  onPress={() => setCategory(cat)}>
                  <Text
                    style={[
                      styles.categoryChipText,
                      category === cat && styles.categoryChipTextSelected,
                    ]}>
                    {cat}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <FormField
            label={AP_MATERIAL}
            value={material}
            onChangeText={setMaterial}
            placeholder={AP_MATERIAL_PLACEHOLDER}
          />

          <FormField
            label={AP_COLOR_FIELD}
            value={color}
            onChangeText={setColor}
            placeholder={AP_COLOR_PLACEHOLDER}
          />

          <FormField
            label={AP_QUANTITY}
            value={quantity}
            onChangeText={setQuantity}
            placeholder={AP_QUANTITY_PLACEHOLDER}
            keyboardType="numeric"
          />

          <FormField
            label={AP_TAGS_LABEL}
            value={tags}
            onChangeText={setTags}
            placeholder={AP_TAGS_PLACEHOLDER}
          />

          {/* Generate Description */}
          <TouchableOpacity
            style={styles.generateBtn}
            onPress={generateDescription}>
            <Sparkles size={20} color={COLORS.white} />
            <Text style={styles.generateBtnText}>{AP_GENERATE_BTN}</Text>
          </TouchableOpacity>

          {generated && (
            <View style={styles.descriptionPreview}>
              <Text style={styles.descriptionLabel}>{AP_GENERATED_LABEL}</Text>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>
          )}

          {/* Hidden description field for generated content */}
          {generated && description ? null : (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{AP_DESCRIPTION_LABEL}</Text>
              <TextInput
                style={styles.textArea}
                value={description}
                onChangeText={(t) => {
                  setDescription(t);
                  if (t.trim()) setGenerated(true);
                }}
                placeholder={AP_DESCRIPTION_PLACEHOLDER}
                placeholderTextColor={COLORS.lightText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitBtnText}>{AP_SUBMIT_BTN}</Text>
          </TouchableOpacity>

          <View style={{ height: 80 }} />
          </View>
          </ScrollView>
          <BottomNav />
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.lightText}
        keyboardType={keyboardType}
      />
    </View>
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
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  imagePickerArea: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xxxl,
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 20,
    backgroundColor: COLORS.lightPurple,
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  imagePlaceholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  imagePlaceholderSubtext: {
    fontSize: 13,
    color: COLORS.mediumText,
  },
  imageBtnRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  imageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 13,
  },
  imageBtnOutline: {
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  imageBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.white,
  },
  imageBtnTextOutline: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
  },
  imagePreviewContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  previewImageLarge: {
    width: '100%',
    height: 280,
    borderRadius: 20,
    resizeMode: 'cover',
    marginBottom: SPACING.md,
  },
  imageActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    justifyContent: 'center',
  },
  imageActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  imageActionBtnDanger: {
    backgroundColor: '#FDF0ED',
  },
  imageActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
  },
  imageActionTextDanger: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.error,
  },
  form: {
    paddingHorizontal: SPACING.lg,
  },
  fieldGroup: {
    marginBottom: SPACING.lg,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.darkText,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.darkText,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.darkText,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 100,
  },
  categoryRow: {
    gap: SPACING.sm,
  },
  categoryChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.mediumText,
  },
  categoryChipTextSelected: {
    color: COLORS.white,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 15,
    paddingVertical: 14,
    marginBottom: SPACING.lg,
  },
  generateBtnText: {
    fontSize: 16,
    fontWeight: '800',
    fontStyle: 'italic',
    color: COLORS.white,
  },
  descriptionPreview: {
    backgroundColor: COLORS.lightPurple,
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 22,
    color: COLORS.darkText,
  },
  submitBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    paddingVertical: 16,
    alignItems: 'center',
    ...SHADOWS.medium,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: '900',
    fontStyle: 'italic',
    color: COLORS.white,
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
