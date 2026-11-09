import { SHADOWS } from '@/constants/theme';
import { ComboSlotCandidate } from '@/utils/comboStudioComposer';
import { Plus, Sparkles } from 'lucide-react-native';
import React from 'react';
import {
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface ComboStudioLiveViewProps {
  slot1: ComboSlotCandidate | null;
  slot2: ComboSlotCandidate | null;
  themeBadge?: string;
  onRandomize?: () => void;
  compact?: boolean;
}

export function ComboStudioLiveView({
  slot1,
  slot2,
  themeBadge,
  onRandomize,
  compact = false,
}: ComboStudioLiveViewProps) {
  const img1 = slot1?.image || slot2?.image || null;
  const img2 = slot2?.image || slot1?.image || null;
  const label1 = slot1?.label || 'Mẫu #1';
  const label2 = slot2?.label || 'Mẫu #2';

  const renderPhoto = (uri: string | null, alt: string) => {
    if (!uri) {
      return (
        <View style={styles.photoFallback}>
          <Text style={{ fontSize: 28 }}>🧶</Text>
        </View>
      );
    }
    if (Platform.OS === 'web') {
      return React.createElement('img', {
        src: uri,
        alt,
        decoding: 'async',
        draggable: false,
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          userSelect: 'none',
        },
      });
    }
    return (
      <Image source={{ uri }} style={styles.nativePhoto} resizeMode="cover" />
    );
  };

  return (
    <View style={[styles.studioCanvas, compact && styles.studioCanvasCompact]}>
      {/* Top AI Studio Header */}
      <View style={styles.topHeaderBar}>
        <View style={styles.aiTagPill}>
          <Sparkles size={12} color="#F59E0B" />
          <Text style={styles.aiTagText} numberOfLines={1}>
            {themeBadge
              ? `${themeBadge} • AI PHỐI MẪU TRỰC TIẾP`
              : '✨ AI STUDIO COMBO • PHỐI MẪU TRỰC TIẾP'}
          </Text>
        </View>
        {onRandomize && (
          <TouchableOpacity
            style={styles.randomBtn}
            onPress={onRandomize}
            activeOpacity={0.8}>
            <Text style={styles.randomBtnText}>🎲 Đổi cặp gợi ý</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Center Dual Polaroid Stage */}
      <View style={styles.stageRow}>
        {/* Polaroid 1 */}
        <View style={styles.polaroidCard}>
          <View style={styles.polaroidPhotoBox}>
            {renderPhoto(img1, label1)}
            <View style={styles.slotIndexBadge}>
              <Text style={styles.slotIndexBadgeText}>MẪU #1</Text>
            </View>
          </View>
          <View style={styles.polaroidCaptionBox}>
            <Text style={styles.polaroidCaptionTitle} numberOfLines={2}>
              {label1}
            </Text>
          </View>
          </View>

          {/* Center Plus Connector */}
          <View style={styles.plusConnectorCircle}>
          <Plus size={compact ? 14 : 18} color="#B45309" strokeWidth={3} />
          </View>

          {/* Polaroid 2 */}
          <View style={styles.polaroidCard}>
          <View style={styles.polaroidPhotoBox}>
            {renderPhoto(img2, label2)}
            <View
              style={[
                styles.slotIndexBadge,
                { backgroundColor: 'rgba(180, 83, 9, 0.92)' },
              ]}>
              <Text style={styles.slotIndexBadgeText}>MẪU #2</Text>
            </View>
          </View>
          <View style={styles.polaroidCaptionBox}>
            <Text style={styles.polaroidCaptionTitle} numberOfLines={2}>
              {label2}
            </Text>
          </View>
          </View>
          </View>

          {/* Bottom Paired Summary Strip */}
          <View style={styles.bottomSummaryPill}>
          <Text style={styles.bottomSummaryLabel}>💝 Combo đang chọn:</Text>
          <Text style={styles.bottomSummaryValue}>
          {label1} + {label2}
          </Text>
          </View>
    </View>
  );
}

interface ComboSlotSelectorProps {
  slot1Candidates: ComboSlotCandidate[];
  slot2Candidates: ComboSlotCandidate[];
  selectedSlot1: ComboSlotCandidate | null;
  selectedSlot2: ComboSlotCandidate | null;
  onSelectSlot1: (c: ComboSlotCandidate) => void;
  onSelectSlot2: (c: ComboSlotCandidate) => void;
  customNote: string;
  onChangeCustomNote: (val: string) => void;
}

export function ComboSlotSelector({
  slot1Candidates,
  slot2Candidates,
  selectedSlot1,
  selectedSlot2,
  onSelectSlot1,
  onSelectSlot2,
  customNote,
  onChangeCustomNote,
}: ComboSlotSelectorProps) {
  const renderCandidateRow = (
    title: string,
    candidates: ComboSlotCandidate[],
    selected: ComboSlotCandidate | null,
    onSelect: (c: ComboSlotCandidate) => void
  ) => {
    if (candidates.length === 0) return null;
    return (
      <View style={styles.slotSection}>
        <View style={styles.slotHeaderRow}>
          <Text style={styles.slotHeaderTitle}>{title}</Text>
          <Text style={styles.slotHeaderSelected}>
            Đang chọn: {selected?.label || candidates[0]?.label}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.candidatesScrollRow}>
          {candidates.map((cand) => {
            const active = selected?.id === cand.id;
            return (
              <TouchableOpacity
                key={cand.id}
                style={[
                  styles.candCard,
                  active && styles.candCardActive,
                ]}
                onPress={() => onSelect(cand)}
                activeOpacity={0.82}>
                <View style={styles.candThumbBox}>
                  {cand.image ? (
                    Platform.OS === 'web' ? (
                      React.createElement('img', {
                        src: cand.image,
                        alt: cand.label,
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
                        source={{ uri: cand.image }}
                        style={styles.nativePhoto}
                        resizeMode="cover"
                      />
                    )
                  ) : (
                    <View style={styles.photoFallback}>
                      <Text style={{ fontSize: 14 }}>🧶</Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.candLabel,
                    active && styles.candLabelActive,
                  ]}
                  numberOfLines={1}>
                  {cand.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.selectorContainer}>
      <View style={styles.selectorBannerRow}>
        <Text style={styles.selectorBannerTitle}>
          💝 Phối 2 mẫu trong Combo (Chạm vào từng mẫu để xem ảnh ghép trực tiếp)
        </Text>
      </View>

      {renderCandidateRow(
        '1️⃣ Chọn Mẫu Thứ 1:',
        slot1Candidates,
        selectedSlot1,
        onSelectSlot1
      )}

      {renderCandidateRow(
        '2️⃣ Chọn Mẫu Thứ 2:',
        slot2Candidates,
        selectedSlot2,
        onSelectSlot2
      )}

      <View style={{ gap: 4, marginTop: 2 }}>
        <Text style={styles.noteInputLabel}>
          📝 Ghi chú mẫu phối của bạn (Tự động điền khi chạm chọn ở trên hoặc tự gõ):
        </Text>
        <TextInput
          style={styles.noteInput}
          placeholder="VD: Mẫu 1 + Mẫu 2..."
          placeholderTextColor="#A3907E"
          value={customNote}
          onChangeText={onChangeCustomNote}
          maxLength={60}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  studioCanvas: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F6ECE0',
    padding: 12,
    justifyContent: 'space-between',
    gap: 8,
  },
  studioCanvasCompact: {
    height: 220,
    borderRadius: 14,
    padding: 10,
  },
  topHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  aiTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#3B281E',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 1,
  },
  aiTagText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFDF9',
    letterSpacing: 0.3,
  },
  randomBtn: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#F59E0B',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 999,
  },
  randomBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  stageRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    position: 'relative',
  },
  polaroidCard: {
    flex: 1,
    height: '96%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 7,
    borderWidth: 1,
    borderColor: '#E6D7C6',
    justifyContent: 'space-between',
    ...SHADOWS.small,
  },
  polaroidPhotoBox: {
    flex: 1,
    borderRadius: 11,
    overflow: 'hidden',
    backgroundColor: '#F3EAE0',
    position: 'relative',
  },
  nativePhoto: {
    width: '100%',
    height: '100%',
  },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3EAE0',
  },
  slotIndexBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(59, 40, 30, 0.86)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  slotIndexBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  polaroidCaptionBox: {
    paddingTop: 6,
    paddingBottom: 2,
    alignItems: 'center',
  },
  polaroidCaptionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3B281E',
    textAlign: 'center',
  },
  plusConnectorCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFDF9',
    borderWidth: 2,
    borderColor: '#D97706',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: -12,
    zIndex: 5,
    ...SHADOWS.small,
  },
  bottomSummaryPill: {
    backgroundColor: '#FFFDF9',
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E5D5C5',
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  bottomSummaryLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#78350F',
  },
  bottomSummaryValue: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#3B281E',
    flexShrink: 1,
  },
  selectorContainer: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FCD34D',
    padding: 12,
    gap: 10,
  },
  selectorBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorBannerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#92400E',
  },
  slotSection: {
    gap: 6,
  },
  slotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  slotHeaderTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4A3427',
  },
  slotHeaderSelected: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#B45309',
    flexShrink: 1,
  },
  candidatesScrollRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  candCard: {
    width: 84,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    padding: 5,
    borderWidth: 1.5,
    borderColor: '#E5D5C5',
    alignItems: 'center',
    gap: 4,
  },
  candCardActive: {
    borderColor: '#D97706',
    backgroundColor: '#FEF3C7',
  },
  candThumbBox: {
    width: 72,
    height: 64,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3EAE0',
  },
  candLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3427',
    textAlign: 'center',
  },
  candLabelActive: {
    fontWeight: '900',
    color: '#92400E',
  },
  noteInputLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#6E5643',
  },
  noteInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2D4C5',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#3B2A1E',
    minWidth: 0,
  },
});
