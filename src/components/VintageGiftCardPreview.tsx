import { Sparkles } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface VintageGiftCardPreviewProps {
  value: string;
  onChange: (formattedNote: string) => void;
  compact?: boolean;
}

const WISH_TEMPLATES = [
  {
    label: '🎂 Sinh nhật',
    text: 'Chúc mừng sinh nhật! Mong mọi điều ngọt ngào, bình an và rạng rỡ nhất luôn bên bạn mỗi ngày nhé!',
  },
  {
    label: '💝 Người thương',
    text: 'Gửi tặng em món quà nhỏ đan bằng cả tấm lòng. Mong em lúc nào cũng mỉm cười thật tươi nhé!',
  },
  {
    label: '🎓 Tốt nghiệp',
    text: 'Chúc mừng cột mốc rực rỡ của bạn! Chúc hành trình phía trước luôn thuận buồm xuôi gió và tỏa sáng!',
  },
  {
    label: '🌷 Cảm ơn',
    text: 'Cảm ơn bạn thật nhiều vì đã luôn đồng hành và dịu dàng với mình. Mong bạn thích món quà nhỏ này nha!',
  },
];

function parseFormattedGiftNote(raw: string): {
  from: string;
  to: string;
  message: string;
} {
  if (!raw) return { from: '', to: '', message: '' };
  const match = raw.match(/^\[Từ:\s*(.*?)\s*\|\s*Gửi:\s*(.*?)\]\s*(.*)$/s);
  if (match) {
    return {
      from: match[1] || '',
      to: match[2] || '',
      message: match[3] || '',
    };
  }
  return { from: '', to: '', message: raw };
}

function buildFormattedGiftNote(from: string, to: string, message: string): string {
  const f = from.trim();
  const t = to.trim();
  const m = message.trim();
  if (!f && !t && !m) return '';
  if (f || t) {
    return `[Từ: ${f || 'Ẩn danh'} | Gửi: ${t || 'Người thương'}] ${m}`.trim();
  }
  return m;
}

const AIRMAIL_STRIPES = Array.from({ length: 18 }, (_, i) => i);

export function VintageGiftCardPreview({
  value,
  onChange,
  compact = false,
}: VintageGiftCardPreviewProps) {
  const initial = parseFormattedGiftNote(value);
  const [fromName, setFromName] = useState(initial.from);
  const [toName, setToName] = useState(initial.to);
  const [wishMessage, setWishMessage] = useState(initial.message);

  useEffect(() => {
    const parsed = parseFormattedGiftNote(value);
    const currentFormatted = buildFormattedGiftNote(fromName, toName, wishMessage);
    if (value !== currentFormatted) {
      setFromName(parsed.from);
      setToName(parsed.to);
      setWishMessage(parsed.message);
    }
  }, [value]);

  const handleUpdate = (nextFrom: string, nextTo: string, nextMsg: string) => {
    setFromName(nextFrom);
    setToName(nextTo);
    setWishMessage(nextMsg);
    onChange(buildFormattedGiftNote(nextFrom, nextTo, nextMsg));
  };

  const cursiveFont =
    Platform.OS === 'web'
      ? ('"Georgia", "Times New Roman", serif' as any)
      : undefined;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Header Title */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>
          💌 Viết Thiệp Vintage Xem Trước Trực Tiếp (Miễn phí kèm Set Quà)
        </Text>
      </View>

      {/* LIVE VINTAGE AIRMAIL POSTCARD PREVIEW */}
      <View style={styles.airmailOuterFrame}>
        {/* Top Airmail Red/Blue Border Bar */}
        <View style={styles.airmailStripeBar}>
          {AIRMAIL_STRIPES.map((idx) => (
            <View
              key={`top_${idx}`}
              style={[
                styles.airmailSegment,
                {
                  backgroundColor: idx % 2 === 0 ? '#9E3B33' : '#2C4A6F',
                },
              ]}
            />
          ))}
        </View>

        {/* Kraft Postcard Inner Paper */}
        <View style={styles.kraftPaperBody}>
          <View style={styles.postcardTopRow}>
            {/* Left: From / To Lines matching the real Kraft Card in the Gift Box */}
            <View style={styles.fromToColumn}>
              <View style={styles.scriptLineRow}>
                <Text style={[styles.scriptLabel, { fontFamily: cursiveFont }]}>
                  From:
                </Text>
                <View style={styles.dottedUnderline}>
                  <Text
                    style={[
                      styles.scriptHandwriting,
                      { fontFamily: cursiveFont },
                      !fromName && styles.scriptPlaceholder,
                    ]}>
                    {fromName || 'Tên của bạn...'}
                  </Text>
                </View>
              </View>

              <View style={styles.scriptLineRow}>
                <Text style={[styles.scriptLabel, { fontFamily: cursiveFont }]}>
                  To:
                </Text>
                <View style={styles.dottedUnderline}>
                  <Text
                    style={[
                      styles.scriptHandwriting,
                      { fontFamily: cursiveFont },
                      !toName && styles.scriptPlaceholder,
                    ]}>
                    {toName || 'Người nhận yêu thương...'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Right: Vintage Paris / Postage Stamp Emblem */}
            <View style={styles.vintageStampBox}>
              <Text style={styles.stampTopText}>PAR AVION</Text>
              <Text style={styles.stampIcon}>🗼</Text>
              <Text style={styles.stampBottomText}>TIỆM CUỘN LEN</Text>
            </View>
          </View>

          {/* Handwritten Message Preview Area */}
          <View style={styles.messagePreviewBox}>
            <Text
              style={[
                styles.messageHandwriting,
                { fontFamily: cursiveFont },
                !wishMessage && styles.scriptPlaceholder,
              ]}>
              &ldquo;
              {wishMessage ||
                'Lời chúc của bạn sẽ được nghệ nhân Tiệm Cuộn Len nắn nót viết tay lên tấm thiệp Vintage này và đặt trang trọng bên trong hộp quà lót rơm thơm...'}
              &rdquo;
            </Text>
          </View>
        </View>

        {/* Bottom Airmail Red/Blue Border Bar */}
        <View style={styles.airmailStripeBar}>
          {AIRMAIL_STRIPES.map((idx) => (
            <View
              key={`bot_${idx}`}
              style={[
                styles.airmailSegment,
                {
                  backgroundColor: idx % 2 === 0 ? '#2C4A6F' : '#9E3B33',
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Quick Wish Suggestion Chips */}
      <View style={styles.templatesWrap}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Sparkles size={12} color="#92400E" />
          <Text style={styles.templatesLabel}>Gợi ý lời chúc nhanh:</Text>
        </View>
        <View style={styles.templatesPillsRow}>
          {WISH_TEMPLATES.map((tpl) => (
            <TouchableOpacity
              key={tpl.label}
              style={styles.templatePill}
              onPress={() => handleUpdate(fromName, toName, tpl.text)}
              activeOpacity={0.8}>
              <Text style={styles.templatePillText}>{tpl.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Interactive Inputs: From + To + Message */}
      <View style={styles.inputsGrid}>
        <View style={styles.fromToInputsRow}>
          <View style={{ flex: 1, minWidth: 120, gap: 3 }}>
            <Text style={styles.inputFieldLabel}>Người gửi (From):</Text>
            <TextInput
              style={styles.smallInput}
              placeholder="VD: Anh Hoàng / Bạn thân..."
              placeholderTextColor="#A89888"
              value={fromName}
              onChangeText={(txt) => handleUpdate(txt, toName, wishMessage)}
              maxLength={40}
            />
          </View>

          <View style={{ flex: 1, minWidth: 120, gap: 3 }}>
            <Text style={styles.inputFieldLabel}>Người nhận (To):</Text>
            <TextInput
              style={styles.smallInput}
              placeholder="VD: Em Linh / Mẹ yêu..."
              placeholderTextColor="#A89888"
              value={toName}
              onChangeText={(txt) => handleUpdate(fromName, txt, wishMessage)}
              maxLength={40}
            />
          </View>
        </View>

        <View style={{ gap: 3 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text style={styles.inputFieldLabel}>
              Nội dung lời chúc viết tay lên thiệp:
            </Text>
            <Text style={styles.charCountText}>{wishMessage.length}/200</Text>
          </View>
          <TextInput
            style={styles.messageInput}
            placeholder="Nhập lời nhắn yêu thương để Tiệm viết tay lên thiệp..."
            placeholderTextColor="#A89888"
            value={wishMessage}
            onChangeText={(txt) => handleUpdate(fromName, toName, txt)}
            multiline
            numberOfLines={3}
            maxLength={200}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FDF8F0',
    borderWidth: 1.5,
    borderColor: '#E5CFAF',
    gap: 10,
  },
  containerCompact: {
    padding: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  headerTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#6E4726',
  },
  airmailOuterFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#C8AE8D',
    backgroundColor: '#EAD4B5',
  },
  airmailStripeBar: {
    flexDirection: 'row',
    height: 7,
    backgroundColor: '#F5E8D3',
    gap: 5,
    paddingHorizontal: 4,
  },
  airmailSegment: {
    flex: 1,
    height: '100%',
    transform: [{ skewX: '-28deg' }],
  },
  kraftPaperBody: {
    backgroundColor: '#EDD9BC',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  postcardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  fromToColumn: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  scriptLineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  scriptLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#4A3322',
    width: 44,
  },
  dottedUnderline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: '#8C6D53',
    paddingBottom: 2,
  },
  scriptHandwriting: {
    fontSize: 13.5,
    fontWeight: '700',
    fontStyle: 'italic',
    color: '#3B2416',
  },
  scriptPlaceholder: {
    color: '#8C745E',
    fontWeight: '500',
  },
  vintageStampBox: {
    width: 62,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#7A5C43',
    borderRadius: 6,
    backgroundColor: '#F4E6CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampTopText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#2C4A6F',
    letterSpacing: 0.5,
  },
  stampIcon: {
    fontSize: 16,
    marginVertical: 1,
  },
  stampBottomText: {
    fontSize: 6.5,
    fontWeight: '800',
    color: '#8C3B32',
    textAlign: 'center',
  },
  messagePreviewBox: {
    backgroundColor: 'rgba(255, 251, 244, 0.52)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(140, 109, 83, 0.28)',
  },
  messageHandwriting: {
    fontSize: 13,
    fontStyle: 'italic',
    lineHeight: 19,
    color: '#3B2416',
  },
  templatesWrap: {
    gap: 5,
  },
  templatesLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#78350F',
  },
  templatesPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  templatePill: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  templatePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400E',
  },
  inputsGrid: {
    gap: 8,
  },
  fromToInputsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  inputFieldLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#5C4033',
  },
  charCountText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#8C7A6B',
  },
  smallInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12.5,
    color: '#3B281E',
    minWidth: 0,
  },
  messageInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12.5,
    color: '#3B281E',
    minHeight: 60,
    textAlignVertical: 'top',
    minWidth: 0,
  },
});
