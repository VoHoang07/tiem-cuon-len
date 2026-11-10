import { SHADOWS } from '@/constants/theme';
import {
    CURATED_COMBO_DEFINITIONS,
    CuratedComboDefinition,
} from '@/data/comboCatalog';
import { Product } from '@/types/product';
import { resolveImageUri } from '@/utils/comboStudioComposer';
import { formatVND } from '@/utils/formatCurrency';
import { useRouter } from 'expo-router';
import { ArrowRight, Plus, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';

interface ComboShowcaseSectionProps {
  products: Product[];
}

export function ComboShowcaseSection({ products }: ComboShowcaseSectionProps) {
  const router = useRouter();
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

  const renderDualPhotoBox = (def: CuratedComboDefinition) => {
    const p1 = byProductId.get(def.primaryProductId);
    const p2 = byProductId.get(def.secondaryProductId);
    const img1 = p1?.image || p1?.colorOptions?.[0]?.image || null;
    const img2 =
      p2?.image ||
      p2?.colorOptions?.[1]?.image ||
      p2?.colorOptions?.[0]?.image ||
      img1;
    const savings = Math.max(0, def.originalPrice - def.price);

    return (
      <View
        style={[
          styles.dualPhotoContainer,
          isMobile && styles.dualPhotoContainerMobile,
        ]}>
        <View style={styles.dualPhotoSplitRow}>
          <View style={styles.dualHalfBox}>
            {img1 ? (
              Platform.OS === 'web' && resolveImageUri(img1) ? (
                React.createElement('img', {
                  src: resolveImageUri(img1)!,
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
                  source={typeof img1 === 'string' ? { uri: img1 } : (img1 as any)}
                  style={styles.dualHalfImg}
                  resizeMode="cover"
                />
              )
            ) : (
              <View style={styles.dualPlaceholder}>
                <Text style={{ fontSize: 26 }}>🧶</Text>
              </View>
            )}
          </View>

          <View style={styles.dualDividerLine} />

          <View style={styles.dualHalfBox}>
            {img2 ? (
              Platform.OS === 'web' && resolveImageUri(img2) ? (
                React.createElement('img', {
                  src: resolveImageUri(img2)!,
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
                  source={typeof img2 === 'string' ? { uri: img2 } : (img2 as any)}
                  style={styles.dualHalfImg}
                  resizeMode="cover"
                />
              )
            ) : (
              <View style={styles.dualPlaceholder}>
                <Text style={{ fontSize: 26 }}>🎁</Text>
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

  const renderComboCard = (def: CuratedComboDefinition) => (
    <TouchableOpacity
      key={def.id}
      activeOpacity={0.88}
      onPress={() => router.push(`/product/${def.id}`)}
      style={[
        styles.comboCard,
        isMobile && styles.comboCardMobile,
        isDesktop && styles.comboCardDesktop,
        !isDesktop && !isMobile && styles.comboCardTablet,
      ]}>
      {renderDualPhotoBox(def)}

      <View style={styles.cardBody}>
        <Text style={styles.comboTitle} numberOfLines={2}>
          {def.name}
        </Text>

        <Text style={styles.comboDesc} numberOfLines={2}>
          {def.description}
        </Text>

        <View style={styles.pkgPreviewPill}>
          <Text style={styles.pkgPreviewText}>
            📦 {def.packages[0]?.name}
          </Text>
        </View>

        <View style={styles.cardFooterRow}>
          <View style={{ flex: 1, minWidth: 110 }}>
            <View style={styles.priceLine}>
              <Text style={styles.comboPriceText}>{formatVND(def.price)}</Text>
              <Text style={styles.originalPriceText}>
                {formatVND(def.originalPrice)}
              </Text>
            </View>
            <Text style={styles.perComboHint}>
              Tiết kiệm {formatVND(def.originalPrice - def.price)}
            </Text>
          </View>

          <View style={styles.pickComboBtn}>
            <Text style={styles.pickComboBtnText}>Xem & Phối mẫu</Text>
            <ArrowRight size={13} color="#FFFDF9" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

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
          <Text
            style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
            🎁 Combo Tiết Kiệm Được Yêu Thích Nhất
          </Text>
          <Text style={styles.sectionSub}>
            Chạm vào bộ Combo bất kỳ để xem trang chi tiết, tự tay chọn 2 mẫu bạn thích và xem ảnh ghép trực tiếp.
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

      {/* Mobile: Horizontal Swipe Strip (saves RAM & vertical scroll); Tablet/Desktop: Grid */}
      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileHorizontalRow}>
          {visibleDefs.map((def) => renderComboCard(def))}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.cardsGrid,
            isDesktop && styles.cardsGridDesktop,
            !isDesktop && !isMobile && styles.cardsGridTablet,
          ]}>
          {visibleDefs.map((def) => renderComboCard(def))}
        </View>
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
    marginBottom: 10,
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
  mobileHorizontalRow: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 4,
  },
  cardsGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  cardsGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
  },
  cardsGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  comboCardMobile: {
    width: 288,
  },
  comboCardDesktop: {
    width: '32%',
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
  dualPhotoContainerMobile: {
    height: 152,
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
    flexWrap: 'wrap',
    gap: 8,
  },
  priceLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
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
  pickComboBtn: {
    backgroundColor: '#4A3427',
    paddingHorizontal: 11,
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
});
