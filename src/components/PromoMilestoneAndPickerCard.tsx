import { formatVND } from '@/utils/formatCurrency';
import {
    evaluatePromoCode,
    getActivePromoVouchers,
    getBestApplicableVoucher,
    getNextUnlockableVoucher,
    getSelectedPromoCode,
    setSelectedPromoCode,
    subscribePromoChanges,
    type PromoVoucher,
} from '@/utils/promoEngine';
import { Check, Gift, Sparkles, Tag, X } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

interface PromoMilestoneAndPickerCardProps {
  subtotal: number;
  onPromoChange?: (result: { code: string; discountAmount: number }) => void;
}

export function PromoMilestoneAndPickerCard({
  subtotal,
  onPromoChange,
}: PromoMilestoneAndPickerCardProps) {
  const [vouchers, setVouchers] = useState<PromoVoucher[]>(() =>
    getActivePromoVouchers()
  );
  const [selectedCode, setSelectedCodeState] = useState<string>(() =>
    getSelectedPromoCode()
  );
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribePromoChanges(() => {
      setVouchers(getActivePromoVouchers());
      setSelectedCodeState(getSelectedPromoCode());
    });
    return unsub;
  }, []);

  // Auto-select the best eligible voucher if none selected or if subtotal unlocks a better tier
  useEffect(() => {
    const best = getBestApplicableVoucher(subtotal);
    if (!selectedCode && best) {
      setSelectedPromoCode(best.code);
      setSelectedCodeState(best.code);
      return;
    }
    if (selectedCode) {
      const currentEval = evaluatePromoCode(selectedCode, subtotal);
      if (!currentEval.valid && best) {
        setSelectedPromoCode(best.code);
        setSelectedCodeState(best.code);
      } else if (
        currentEval.valid &&
        best &&
        best.discountAmount > currentEval.discountAmount
      ) {
        setSelectedPromoCode(best.code);
        setSelectedCodeState(best.code);
      }
    }
  }, [subtotal, selectedCode]);

  const evalResult = useMemo(
    () => evaluatePromoCode(selectedCode, subtotal),
    [selectedCode, subtotal]
  );

  useEffect(() => {
    onPromoChange?.({
      code: evalResult.valid ? evalResult.code : '',
      discountAmount: evalResult.valid ? evalResult.discountAmount : 0,
    });
  }, [evalResult.valid, evalResult.code, evalResult.discountAmount, onPromoChange]);

  const nextUnlock = useMemo(
    () => getNextUnlockableVoucher(subtotal),
    [subtotal]
  );

  const progressPct = useMemo(() => {
    const maxTarget = 299000;
    return Math.min(100, Math.max(4, Math.round((subtotal / maxTarget) * 100)));
  }, [subtotal]);

  const handleApplyManual = () => {
    const cleaned = manualInput.trim().toUpperCase();
    if (!cleaned) return;
    const res = evaluatePromoCode(cleaned, subtotal);
    if (!res.valid) {
      setManualError(
        res.error || 'Mã giảm giá chưa đủ điều kiện hoặc không hợp lệ.'
      );
      return;
    }
    setManualError(null);
    setManualInput('');
    setSelectedPromoCode(res.code);
    setSelectedCodeState(res.code);
  };

  if (vouchers.length === 0) return null;

  return (
    <View style={styles.card}>
      {/* Milestone Upsell Bar */}
      <View style={styles.milestoneBox}>
        <View style={styles.milestoneHeader}>
          <Sparkles size={14} color="#B45309" />
          <Text style={styles.milestoneTitle}>
            {nextUnlock
              ? `💡 Mua thêm ${formatVND(nextUnlock.shortfall)} để mở khóa mã ${
                  nextUnlock.voucher.code
                } (${nextUnlock.voucher.title})!`
              : '🎉 Tuyệt vời! Đơn hàng đã mở khóa tối đa ưu đãi Khai Trương & Freeship!'}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPct}%` as any }]}
          />
        </View>

        <View style={styles.milestonesRow}>
          {[
            { label: '99k: -10k', target: 99000 },
            { label: '179k: -20k', target: 179000 },
            { label: '299k: -35k + Freeship', target: 299000 },
          ].map((m) => {
            const reached = subtotal >= m.target;
            return (
              <View key={m.target} style={styles.milestoneStep}>
                <View
                  style={[
                    styles.milestoneDot,
                    reached && styles.milestoneDotReached,
                  ]}>
                  {reached && <Check size={9} color="#FFFDF9" strokeWidth={3} />}
                </View>
                <Text
                  style={[
                    styles.milestoneStepText,
                    reached && styles.milestoneStepTextReached,
                  ]}>
                  {m.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* 1-Tap Quick Voucher Chips */}
      <View style={styles.pickerSection}>
        <View style={styles.pickerHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Tag size={14} color="#6E4F37" />
            <Text style={styles.pickerLabel}>
              Chọn nhanh Mã Giảm Giá Khai Trương:
            </Text>
          </View>
          {evalResult.valid && (
            <TouchableOpacity
              onPress={() => {
                setSelectedPromoCode('');
                setSelectedCodeState('');
              }}>
              <Text style={styles.clearCodeText}>Bỏ chọn</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.chipsWrap}>
          {vouchers.map((v) => {
            const eligible = subtotal >= v.minOrderSubtotal;
            const active = evalResult.valid && evalResult.code === v.code;
            const shortfall = Math.max(0, v.minOrderSubtotal - subtotal);

            return (
              <TouchableOpacity
                key={v.code}
                style={[
                  styles.voucherChip,
                  active && styles.voucherChipActive,
                  !eligible && styles.voucherChipLocked,
                ]}
                onPress={() => {
                  if (!eligible) {
                    setManualError(
                      `Mã ${v.code} áp dụng cho đơn từ ${formatVND(
                        v.minOrderSubtotal
                      )} (Chỉ thiếu ${formatVND(shortfall)} nữa!).`
                    );
                    return;
                  }
                  setManualError(null);
                  setSelectedPromoCode(v.code);
                  setSelectedCodeState(v.code);
                }}
                activeOpacity={0.8}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 5,
                    }}>
                    <Text
                      style={[
                        styles.chipCode,
                        active && { color: '#FFFDF9' },
                      ]}>
                      🎟️ {v.code}
                    </Text>
                    <Text
                      style={[
                        styles.chipDiscount,
                        active && { color: '#FDE68A' },
                      ]}>
                      (-{formatVND(v.discountAmount)})
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chipSub,
                      active && { color: '#F5EFE6' },
                    ]}
                    numberOfLines={1}>
                    {eligible
                      ? `✓ Đủ điều kiện (Đơn ≥${Math.round(
                          v.minOrderSubtotal / 1000
                        )}k)`
                      : `Cần thêm ${formatVND(shortfall)} (Đơn ≥${Math.round(
                          v.minOrderSubtotal / 1000
                        )}k)`}
                  </Text>
                </View>
                {active && <Check size={15} color="#FDE68A" strokeWidth={2.8} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Manual Code Input */}
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Nhập mã giảm giá (VD: KHAITRUONG20K)..."
            placeholderTextColor="#A1887F"
            value={manualInput}
            onChangeText={(txt) => {
              setManualInput(txt);
              if (manualError) setManualError(null);
            }}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleApplyManual}
          />
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={handleApplyManual}
            activeOpacity={0.85}>
            <Text style={styles.applyBtnText}>Áp dụng</Text>
          </TouchableOpacity>
        </View>

        {manualError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {manualError}</Text>
            <TouchableOpacity onPress={() => setManualError(null)}>
              <X size={13} color="#B91C1C" />
            </TouchableOpacity>
          </View>
        ) : null}

        {evalResult.valid && evalResult.voucher ? (
          <View style={styles.appliedBanner}>
            <Gift size={15} color="#065F46" />
            <Text style={styles.appliedBannerText}>
              Đã áp mã <Text style={{ fontWeight: '900' }}>{evalResult.code}</Text> — Giảm trực tiếp{' '}
              <Text style={{ fontWeight: '900' }}>
                -{formatVND(evalResult.discountAmount)}
              </Text>{' '}
              vào đơn hàng!
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    marginBottom: 8,
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#EBD7BF',
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  milestoneBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 10,
    gap: 7,
  },
  milestoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  milestoneTitle: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400E',
    lineHeight: 16,
  },
  progressTrack: {
    height: 7,
    backgroundColor: '#FDE68A',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#16A34A',
    borderRadius: 999,
  },
  milestonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  milestoneStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  milestoneDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D6C5B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotReached: {
    backgroundColor: '#16A34A',
  },
  milestoneStepText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  milestoneStepTextReached: {
    color: '#15803D',
    fontWeight: '800',
  },
  pickerSection: {
    gap: 8,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3B281E',
  },
  clearCodeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
    textDecorationLine: 'underline',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  voucherChip: {
    flexGrow: 1,
    minWidth: 145,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5EF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  voucherChipActive: {
    backgroundColor: '#4A3427',
    borderColor: '#4A3427',
  },
  voucherChipLocked: {
    opacity: 0.68,
    backgroundColor: '#F5F2EE',
  },
  chipCode: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#3B281E',
  },
  chipDiscount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#BE185D',
  },
  chipSub: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6E5643',
    marginTop: 2,
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  manualInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#3B281E',
  },
  applyBtn: {
    backgroundColor: '#6E4F37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
  },
  applyBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  appliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  appliedBannerText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
  },
});
