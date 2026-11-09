import {
    ComboSlotSelector,
    ComboStudioLiveView,
} from '@/components/ComboStudioLiveView';
import { SHADOWS } from '@/constants/theme';
import {
    buildCuratedComboProducts,
    CURATED_COMBO_DEFINITIONS,
    CuratedComboDefinition,
    getComboSlotCandidates,
} from '@/data/comboCatalog';
import { useAuth } from '@/store/AuthContext';
import { useCart } from '@/store/CartContext';
import { Product } from '@/types/product';
import {
    ComboSlotCandidate,
    composeComboStudioDataUrl,
} from '@/utils/comboStudioComposer';
import { formatVND } from '@/utils/formatCurrency';
import { useRouter } from 'expo-router';
import { Check, Minus, Plus, ShoppingCart, Sparkles, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

interface ComboShowcaseSectionProps {
  products: Product[];
}

export function ComboShowcaseSection({ products }: ComboShowcaseSectionProps) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isMobile = windowWidth < 640;
  const isDesktop = windowWidth >= 900;

  const [selectedThemeId, setSelectedThemeId] = useState<string>('all');
  const [activeComboModalDef, setActiveComboModalDef] =
    useState<CuratedComboDefinition | null>(null);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [modalSlot1Id, setModalSlot1Id] = useState<string | null>(null);
  const [modalSlot2Id, setModalSlot2Id] = useState<string | null>(null);
  const [modalComposedImg, setModalComposedImg] = useState<string | null>(null);
  const [comboModelNote, setComboModelNote] = useState<string>('');
  const [enableGiftSet, setEnableGiftSet] = useState<boolean>(false);
  const [giftNote, setGiftNote] = useState<string>('');
  const [qty, setQty] = useState<number>(1);
  const [addedToastId, setAddedToastId] = useState<string | null>(null);

  const hydratedCombos = useMemo(
    () => buildCuratedComboProducts(products),
    [products]
  );

  const byProductId = useMemo(() => {
    const map = new Map<string, Product>();
    for (const p of products) {
      if (p && p.id) map.set(p.id, p);
    }
    return map;
  }, [products]);

  const visibleDefs = useMemo(() => {
    if (selectedThemeId === 'all') return CURATED_COMBO_DEFINITIONS;
    return CURATED_COMBO_DEFINITIONS.filter((d) => d.id === selectedThemeId);
  }, [selectedThemeId]);

  const handleOpenComboModal = (def: CuratedComboDefinition) => {
    setActiveComboModalDef(def);
    setSelectedPkgId(def.packages[0]?.id || '');
    setComboModelNote('');
    setEnableGiftSet(false);
    setGiftNote('');
    setQty(1);
  };

  const activeModalPkg = useMemo(() => {
    if (!activeComboModalDef) return null;
    return (
      activeComboModalDef.packages.find((p) => p.id === selectedPkgId) ||
      activeComboModalDef.packages[0] ||
      null
    );
  }, [activeComboModalDef, selectedPkgId]);

  const activeBaseComboProd = useMemo(() => {
    if (!activeComboModalDef) return null;
    return (
      hydratedCombos.find((c) => c.id === activeComboModalDef.id) || null
    );
  }, [activeComboModalDef, hydratedCombos]);

  const {
    slot1Candidates: modalSlot1Candidates,
    slot2Candidates: modalSlot2Candidates,
    defaultSlot1: modalDefaultSlot1,
    defaultSlot2: modalDefaultSlot2,
  } = useMemo(
    () =>
      getComboSlotCandidates(
        activeBaseComboProd,
        activeModalPkg?.id,
        products
      ),
    [activeBaseComboProd, activeModalPkg?.id, products]
  );

  const selectedModalSlot1 = useMemo(
    () =>
      modalSlot1Candidates.find((c) => c.id === modalSlot1Id) ||
      modalDefaultSlot1 ||
      null,
    [modalSlot1Candidates, modalSlot1Id, modalDefaultSlot1]
  );
  const selectedModalSlot2 = useMemo(
    () =>
      modalSlot2Candidates.find((c) => c.id === modalSlot2Id) ||
      modalDefaultSlot2 ||
      null,
    [modalSlot2Candidates, modalSlot2Id, modalDefaultSlot2]
  );

  useEffect(() => {
    setModalSlot1Id(modalDefaultSlot1?.id || null);
    setModalSlot2Id(modalDefaultSlot2?.id || null);
    if (modalDefaultSlot1 && modalDefaultSlot2) {
      setComboModelNote(`${modalDefaultSlot1.label} + ${modalDefaultSlot2.label}`);
    }
  }, [
    activeComboModalDef?.id,
    activeModalPkg?.id,
    modalDefaultSlot1?.id,
    modalDefaultSlot2?.id,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedModalSlot1 && !selectedModalSlot2) {
      setModalComposedImg(null);
      return;
    }
    composeComboStudioDataUrl(
      selectedModalSlot1,
      selectedModalSlot2,
      activeComboModalDef?.themeBadge || '🎁 COMBO TIẾT KIỆM • TIỆM CUỘN LEN'
    ).then((url) => {
      if (!cancelled) setModalComposedImg(url);
    });
    return () => {
      cancelled = true;
    };
  }, [
    selectedModalSlot1,
    selectedModalSlot2,
    activeComboModalDef?.themeBadge,
  ]);

  const buildModalComboProduct = (): Product | null => {
    if (!activeComboModalDef || !activeModalPkg) return null;
    const baseComboProd = hydratedCombos.find(
      (c) => c.id === activeComboModalDef.id
    );
    if (!baseComboProd) return null;
    const accId = enableGiftSet ? 'gift_box_letter' : 'no_box';
    const accDelta = enableGiftSet ? 25000 : 0;
    const finalUnitPrice = activeModalPkg.price + accDelta;
    const pkgLabel = comboModelNote.trim()
      ? `${activeModalPkg.name}: ${comboModelNote.trim()}`.slice(0, 78)
      : activeModalPkg.name;
    const primaryProd = byProductId.get(activeModalPkg.primaryProductId);
    const chosenImg =
      modalComposedImg ||
      selectedModalSlot1?.image ||
      primaryProd?.image ||
      primaryProd?.colorOptions?.[0]?.image ||
      baseComboProd.image;

    return {
      ...baseComboProd,
      id: `${baseComboProd.id}__${activeModalPkg.id}__${accId}`,
      baseProductId: baseComboProd.id,
      color: pkgLabel,
      selectedColorId: activeModalPkg.id,
      selectedColorName: pkgLabel,
      selectedColorHex: activeModalPkg.hex,
      selectedAccessoryId: accId,
      selectedAccessoryName: enableGiftSet
        ? 'Set Quà Tặng Đặc Biệt (+25.000₫)'
        : 'Tự dùng / Tiêu chuẩn',
      selectedAccessoryEmoji: enableGiftSet ? '🎁' : '🛍️',
      giftCardNote: enableGiftSet ? giftNote.trim() : undefined,
      image: chosenImg,
      price: finalUnitPrice,
    };
  };

  const handleConfirmAddToCart = async () => {
    const built = buildModalComboProduct();
    if (!built || !activeComboModalDef) return;
    await addToCart(built, qty);
    const comboId = activeComboModalDef.id;
    setActiveComboModalDef(null);
    setAddedToastId(comboId);
    setTimeout(() => {
      setAddedToastId((prev) => (prev === comboId ? null : prev));
    }, 1800);
  };

  const handleConfirmBuyNow = () => {
    const built = buildModalComboProduct();
    if (!built || !activeComboModalDef || !activeModalPkg) return;
    setActiveComboModalDef(null);
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    router.push({
      pathname: '/checkout',
      params: {
        mode: 'buy_now',
        productId: activeComboModalDef.id,
        quantity: String(qty),
        selectedColorId: activeModalPkg.id,
        selectedColor: built.selectedColorName || activeModalPkg.name,
        selectedAccessoryId: enableGiftSet ? 'gift_box_letter' : 'no_box',
        selectedAccessory: enableGiftSet
          ? '🎁 Set Quà Tặng Đặc Biệt (+25.000₫)'
          : '🛍️ Tự dùng / Tiêu chuẩn',
        giftCardNote: enableGiftSet ? giftNote.trim() : '',
        unitPrice: String(built.price),
      },
    });
  };

  const renderDualPhotoBox = (def: CuratedComboDefinition) => {
    const p1 = byProductId.get(def.primaryProductId);
    const p2 = byProductId.get(def.secondaryProductId);
    const img1 = p1?.image || p1?.colorOptions?.[0]?.image || null;
    const img2 = p2?.image || p2?.colorOptions?.[1]?.image || p2?.colorOptions?.[0]?.image || img1;
    const savings = Math.max(0, def.originalPrice - def.price);

    return (
      <View style={styles.dualPhotoContainer}>
        <View style={styles.dualPhotoSplitRow}>
          <View style={styles.dualHalfBox}>
            {img1 ? (
              Platform.OS === 'web' ? (
                React.createElement('img', {
                  src: img1,
                  alt: p1?.name || def.shortTitle,
                  loading: 'lazy',
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
                  source={{ uri: img1 }}
                  style={styles.dualHalfImg}
                  resizeMode="cover"
                />
              )
            ) : (
              <View style={styles.dualPlaceholder}>
                <Text style={{ fontSize: 28 }}>🧶</Text>
              </View>
            )}
          </View>

          <View style={styles.dualDividerLine} />

          <View style={styles.dualHalfBox}>
            {img2 ? (
              Platform.OS === 'web' ? (
                React.createElement('img', {
                  src: img2,
                  alt: p2?.name || def.shortTitle,
                  loading: 'lazy',
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
                  source={{ uri: img2 }}
                  style={styles.dualHalfImg}
                  resizeMode="cover"
                />
              )
            ) : (
              <View style={styles.dualPlaceholder}>
                <Text style={{ fontSize: 28 }}>🎁</Text>
              </View>
            )}
          </View>
        </View>

        {/* Center Plus Circle */}
        <View style={styles.centerPlusCircle}>
          <Plus size={14} color="#5C4033" strokeWidth={3} />
        </View>

        {/* Top-left Theme Pill */}
        <View
          style={[
            styles.themeBadgeTopLeft,
            {
              backgroundColor: def.themeBg,
              borderColor: def.themeBorder,
            },
          ]}>
          <Text
            style={[styles.themeBadgeText, { color: def.themeColor }]}
            numberOfLines={1}>
            {def.themeBadge}
          </Text>
        </View>

        {/* Top-right Savings Pill */}
        {savings > 0 && (
          <View style={styles.savingsBadgeTopRight}>
            <Text style={styles.savingsBadgeText}>
              🔥 -{Math.round(savings / 1000)}k
            </Text>
          </View>
        )}

        {/* Bottom-left Freeship Tag if applicable */}
        {def.freeshipBadge && (
          <View style={styles.freeshipBottomBadge}>
            <Text style={styles.freeshipBottomBadgeText}>
              🚚 Tự động Freeship 0₫
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.sectionWrap, isMobile && styles.sectionWrapMobile]}>
      {/* Header Banner */}
      <View style={[styles.headerBox, isMobile && styles.headerBoxMobile]}>
        <View style={styles.headerTitleCol}>
          <View style={styles.headerTagPill}>
            <Sparkles size={12} color="#B45309" />
            <Text style={styles.headerTagText}>
              GỢI Ý PHỐI SẴN • MUA CHUNG TIẾT KIỆM HƠN
            </Text>
          </View>
          <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
            🎁 Combo Tiết Kiệm Được Yêu Thích Nhất
          </Text>
          <Text style={styles.sectionSub}>
            6 bộ Combo theo chủ đề Couple, Dễ thương, Quà tặng bạn gái & Vũ trụ Twinkle — tự chọn mẫu phối và tiết kiệm tới 39.000₫.
          </Text>
        </View>

        {/* Quick Theme Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.themeChipsRow}>
          <TouchableOpacity
            style={[
              styles.themeFilterChip,
              selectedThemeId === 'all' && styles.themeFilterChipActive,
            ]}
            onPress={() => setSelectedThemeId('all')}
            activeOpacity={0.8}>
            <Text
              style={[
                styles.themeFilterChipText,
                selectedThemeId === 'all' && styles.themeFilterChipTextActive,
              ]}>
              ✨ Tất cả (6 Combo)
            </Text>
          </TouchableOpacity>
          {CURATED_COMBO_DEFINITIONS.map((d) => {
            const active = selectedThemeId === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.themeFilterChip,
                  active && styles.themeFilterChipActive,
                ]}
                onPress={() =>
                  setSelectedThemeId((prev) => (prev === d.id ? 'all' : d.id))
                }
                activeOpacity={0.8}>
                <Text
                  style={[
                    styles.themeFilterChipText,
                    active && styles.themeFilterChipTextActive,
                  ]}>
                  {d.themeBadge.split(' ')[0]} {d.shortTitle}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Cards Grid on Desktop / Horizontal Scroll on Mobile */}
      <View
        style={[
          styles.cardsGrid,
          isDesktop && styles.cardsGridDesktop,
          !isDesktop && !isMobile && styles.cardsGridTablet,
        ]}>
        {visibleDefs.map((def) => {
          const isJustAdded = addedToastId === def.id;
          return (
            <View
              key={def.id}
              style={[
                styles.comboCard,
                isDesktop && styles.comboCardDesktop,
                !isDesktop && !isMobile && styles.comboCardTablet,
              ]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => router.push(`/product/${def.id}`)}>
                {renderDualPhotoBox(def)}
              </TouchableOpacity>

              <View style={styles.cardBody}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push(`/product/${def.id}`)}>
                  <Text style={styles.comboTitle} numberOfLines={2}>
                    {def.name}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.comboDesc} numberOfLines={2}>
                  {def.description}
                </Text>

                {/* Package count hint */}
                <View style={styles.pkgPreviewPill}>
                  <Text style={styles.pkgPreviewText} numberOfLines={1}>
                    📦 {def.packages[0]?.name}
                  </Text>
                </View>

                {/* Price & Action Footer */}
                <View style={styles.cardFooterRow}>
                  <View style={{ minWidth: 0 }}>
                    <View style={styles.priceLine}>
                      <Text style={styles.comboPriceText}>
                        {formatVND(def.price)}
                      </Text>
                      <Text style={styles.originalPriceText}>
                        {formatVND(def.originalPrice)}
                      </Text>
                    </View>
                    <Text style={styles.perComboHint}>
                      Tiết kiệm {formatVND(def.originalPrice - def.price)}
                    </Text>
                  </View>

                  <View style={styles.cardActionBtns}>
                    <TouchableOpacity
                      style={[
                        styles.pickComboBtn,
                        isJustAdded && { backgroundColor: '#2E7D32' },
                      ]}
                      onPress={() => handleOpenComboModal(def)}
                      activeOpacity={0.85}>
                      {isJustAdded ? (
                        <>
                          <Check size={13} color="#FFF" strokeWidth={2.6} />
                          <Text style={styles.pickComboBtnText}>Đã thêm</Text>
                        </>
                      ) : (
                        <>
                          <ShoppingCart size={13} color="#FFFDF9" />
                          <Text style={styles.pickComboBtnText}>
                            Phối mẫu & Mua
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Interactive Combo Customizer Modal */}
      {activeComboModalDef && activeModalPkg && (
        <Modal
          visible={Boolean(activeComboModalDef)}
          transparent
          animationType="fade"
          onRequestClose={() => setActiveComboModalDef(null)}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setActiveComboModalDef(null)}>
            <Pressable
              style={[styles.modalSheet, isMobile && styles.modalSheetMobile]}
              onPress={(e) => e.stopPropagation()}>
              {/* Top Header */}
              <View style={styles.modalHeaderRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={[
                      styles.modalThemePill,
                      {
                        backgroundColor: activeComboModalDef.themeBg,
                        borderColor: activeComboModalDef.themeBorder,
                      },
                    ]}>
                    <Text
                      style={[
                        styles.modalThemePillText,
                        { color: activeComboModalDef.themeColor },
                      ]}>
                      {activeComboModalDef.themeBadge}
                    </Text>
                  </View>
                  <Text style={styles.modalTitle} numberOfLines={2}>
                    {activeComboModalDef.name}
                  </Text>
                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalPrice}>
                      {formatVND(
                        activeModalPkg.price + (enableGiftSet ? 25000 : 0)
                      )}
                    </Text>
                    <Text style={styles.modalOldPrice}>
                      {formatVND(
                        activeModalPkg.originalPrice +
                          (enableGiftSet ? 25000 : 0)
                      )}
                    </Text>
                    <View style={styles.modalSaveBadge}>
                      <Text style={styles.modalSaveBadgeText}>
                        Tiết kiệm{' '}
                        {formatVND(
                          activeModalPkg.originalPrice - activeModalPkg.price
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.modalCloseBtn}
                  onPress={() => setActiveComboModalDef(null)}>
                  <X size={18} color="#5C4033" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ maxHeight: 460 }}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingBottom: 8 }}>
                {/* Live AI Studio Composite Preview of Selected Pair */}
                <ComboStudioLiveView
                  compact
                  slot1={selectedModalSlot1}
                  slot2={selectedModalSlot2}
                  themeBadge={activeComboModalDef.themeBadge}
                  onRandomize={
                    modalSlot1Candidates.length > 1 ||
                    modalSlot2Candidates.length > 1
                      ? () => {
                          const next1 =
                            modalSlot1Candidates[
                              Math.floor(
                                Math.random() * modalSlot1Candidates.length
                              )
                            ] || selectedModalSlot1;
                          const pool2 =
                            modalSlot2Candidates.length > 1
                              ? modalSlot2Candidates.filter(
                                  (c) => c.id !== next1?.id
                                )
                              : modalSlot2Candidates;
                          const next2 =
                            pool2[Math.floor(Math.random() * pool2.length)] ||
                            selectedModalSlot2;
                          if (next1) setModalSlot1Id(next1.id);
                          if (next2) setModalSlot2Id(next2.id);
                          if (next1 && next2) {
                            setComboModelNote(`${next1.label} + ${next2.label}`);
                          }
                        }
                      : undefined
                  }
                />

                {/* Step 1: Select Combo Package */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.modalStepLabel}>
                    1. Chọn gói phối trong Combo:
                  </Text>
                  <View style={{ gap: 7 }}>
                    {activeComboModalDef.packages.map((pkg) => {
                      const active = pkg.id === activeModalPkg.id;
                      return (
                        <TouchableOpacity
                          key={pkg.id}
                          style={[
                            styles.pkgOptionCard,
                            active && styles.pkgOptionCardActive,
                          ]}
                          onPress={() => setSelectedPkgId(pkg.id)}
                          activeOpacity={0.82}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={[
                                styles.pkgOptionTitle,
                                active && styles.pkgOptionTitleActive,
                              ]}>
                              {pkg.name}
                            </Text>
                            <Text style={styles.pkgOptionSub}>
                              Giá lẻ: {formatVND(pkg.originalPrice)} • Tiết kiệm{' '}
                              {formatVND(pkg.originalPrice - pkg.price)}
                            </Text>
                          </View>
                          <Text
                            style={[
                              styles.pkgOptionPrice,
                              active && { color: '#B45309' },
                            ]}>
                            {formatVND(pkg.price)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Step 2: Visual Slot 1 & Slot 2 Model Picker */}
                <ComboSlotSelector
                  slot1Candidates={modalSlot1Candidates}
                  slot2Candidates={modalSlot2Candidates}
                  selectedSlot1={selectedModalSlot1}
                  selectedSlot2={selectedModalSlot2}
                  onSelectSlot1={(cand: ComboSlotCandidate) => {
                    setModalSlot1Id(cand.id);
                    const s2Label = selectedModalSlot2?.label || '';
                    setComboModelNote(
                      s2Label ? `${cand.label} + ${s2Label}` : cand.label
                    );
                  }}
                  onSelectSlot2={(cand: ComboSlotCandidate) => {
                    setModalSlot2Id(cand.id);
                    const s1Label = selectedModalSlot1?.label || '';
                    setComboModelNote(
                      s1Label ? `${s1Label} + ${cand.label}` : cand.label
                    );
                  }}
                  customNote={comboModelNote}
                  onChangeCustomNote={setComboModelNote}
                />

                {/* Step 3: Packaging Option */}
                <View style={{ gap: 6 }}>
                  <Text style={styles.modalStepLabel}>3. Tuỳ chọn đóng gói:</Text>
                  <View style={styles.packagingRow}>
                    <TouchableOpacity
                      style={[
                        styles.packPill,
                        !enableGiftSet && styles.packPillActive,
                      ]}
                      onPress={() => setEnableGiftSet(false)}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.packPillText,
                          !enableGiftSet && styles.packPillTextActive,
                        ]}>
                        🛍️ Tự dùng / Tiêu chuẩn (+0₫)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.packPill,
                        enableGiftSet && styles.packPillActive,
                      ]}
                      onPress={() => setEnableGiftSet(true)}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.packPillText,
                          enableGiftSet && styles.packPillTextActive,
                        ]}>
                        🎁 Set Quà Tặng Đặc Biệt (+25.000₫)
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {enableGiftSet && (
                    <TextInput
                      style={styles.comboNoteInput}
                      placeholder="Nhập lời chúc viết tay trên thiệp (nếu có)..."
                      placeholderTextColor="#A3907E"
                      value={giftNote}
                      onChangeText={setGiftNote}
                      maxLength={180}
                    />
                  )}
                </View>

                {/* Step 4: Quantity */}
                <View style={styles.qtyRow}>
                  <Text style={styles.modalStepLabel}>Số lượng Combo:</Text>
                  <View style={styles.qtyStepper}>
                    <TouchableOpacity
                      style={styles.qtyStepBtn}
                      onPress={() => setQty((q) => Math.max(1, q - 1))}>
                      <Minus size={14} color="#3D2B1F" />
                    </TouchableOpacity>
                    <Text style={styles.qtyValueText}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.qtyStepBtn}
                      onPress={() => setQty((q) => Math.min(20, q + 1))}>
                      <Plus size={14} color="#3D2B1F" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>

              {/* Modal Bottom Actions */}
              <View style={styles.modalFooterActions}>
                <TouchableOpacity
                  style={styles.modalAddCartBtn}
                  onPress={handleConfirmAddToCart}
                  activeOpacity={0.85}>
                  <ShoppingCart size={15} color="#4A3728" />
                  <Text style={styles.modalAddCartBtnText}>Thêm vào giỏ</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBuyNowBtn}
                  onPress={handleConfirmBuyNow}
                  activeOpacity={0.85}>
                  <Text style={styles.modalBuyNowBtnText}>
                    Mua ngay •{' '}
                    {formatVND(
                      (activeModalPkg.price + (enableGiftSet ? 25000 : 0)) * qty
                    )}
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginTop: 18,
    marginBottom: 10,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#EADBC8',
    padding: 18,
    ...SHADOWS.small,
  },
  sectionWrapMobile: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
  },
  headerBox: {
    marginBottom: 14,
    gap: 10,
  },
  headerBoxMobile: {
    marginBottom: 12,
  },
  headerTitleCol: {
    gap: 4,
  },
  headerTagPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  headerTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#3B281E',
  },
  sectionTitleMobile: {
    fontSize: 17,
  },
  sectionSub: {
    fontSize: 13,
    color: '#6E5A4F',
    lineHeight: 19,
  },
  themeChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  themeFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F7EFE6',
    borderWidth: 1,
    borderColor: '#E3D3C1',
  },
  themeFilterChipActive: {
    backgroundColor: '#4A3427',
    borderColor: '#4A3427',
  },
  themeFilterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5C4638',
  },
  themeFilterChipTextActive: {
    color: '#FFFDF9',
  },
  cardsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  cardsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  comboCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DACB',
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  comboCardDesktop: {
    width: '32.2%',
  },
  comboCardTablet: {
    width: '48.5%',
  },
  dualPhotoContainer: {
    width: '100%',
    height: 176,
    backgroundColor: '#F6EFE7',
    position: 'relative',
    overflow: 'hidden',
  },
  dualPhotoSplitRow: {
    flexDirection: 'row',
    width: '100%',
    height: '100%',
  },
  dualHalfBox: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
  },
  dualHalfImg: {
    width: '100%',
    height: '100%',
  },
  dualDividerLine: {
    width: 2,
    height: '100%',
    backgroundColor: '#FFFDF9',
  },
  dualPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E9DF',
  },
  centerPlusCircle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -15,
    marginTop: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFDF9',
    borderWidth: 2,
    borderColor: '#D4A373',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.small,
  },
  themeBadgeTopLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  savingsBadgeTopRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  savingsBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  freeshipBottomBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(29, 78, 216, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 999,
  },
  freeshipBottomBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardBody: {
    padding: 12,
    gap: 7,
  },
  comboTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#3B281E',
    lineHeight: 20,
  },
  comboDesc: {
    fontSize: 12,
    color: '#6E5A4F',
    lineHeight: 17,
  },
  pkgPreviewPill: {
    backgroundColor: '#FAF3EB',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#EDE0D2',
  },
  pkgPreviewText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4033',
  },
  cardFooterRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  comboPriceText: {
    fontSize: 16.5,
    fontWeight: '900',
    color: '#B45309',
  },
  originalPriceText: {
    fontSize: 12,
    color: '#9A887B',
    textDecorationLine: 'line-through',
  },
  perComboHint: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  cardActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickComboBtn: {
    backgroundColor: '#4A3427',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pickComboBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(28, 19, 14, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFDF9',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5D5C5',
    gap: 12,
  },
  modalSheetMobile: {
    padding: 14,
    borderRadius: 16,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalThemePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 4,
  },
  modalThemePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  modalTitle: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#3B281E',
  },
  modalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  modalPrice: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B45309',
  },
  modalOldPrice: {
    fontSize: 13,
    color: '#9A887B',
    textDecorationLine: 'line-through',
  },
  modalSaveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  modalSaveBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3EAE0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalStepLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#4A3427',
  },
  pkgOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 11,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5D5C5',
  },
  pkgOptionCardActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#D97706',
  },
  pkgOptionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3B281E',
  },
  pkgOptionTitleActive: {
    fontWeight: '800',
    color: '#92400E',
  },
  pkgOptionSub: {
    fontSize: 11,
    color: '#7A685B',
    marginTop: 2,
  },
  pkgOptionPrice: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4A3427',
  },
  comboPickerBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    padding: 11,
    gap: 8,
  },
  comboPickerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  memberChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  memberChipBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  memberChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#78350F',
  },
  comboNoteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5D5C5',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#3B281E',
    minWidth: 0,
  },
  packagingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packPill: {
    flex: 1,
    minWidth: 140,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5D5C5',
    alignItems: 'center',
  },
  packPillActive: {
    backgroundColor: '#4A3427',
    borderColor: '#4A3427',
  },
  packPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3427',
  },
  packPillTextActive: {
    color: '#FFFDF9',
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F5ECE2',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyStepBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValueText: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#3B281E',
    minWidth: 20,
    textAlign: 'center',
  },
  modalFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  modalAddCartBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#4A3427',
    backgroundColor: '#FFFDF9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalAddCartBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4A3427',
  },
  modalBuyNowBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4A3427',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBuyNowBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFDF9',
  },
});
