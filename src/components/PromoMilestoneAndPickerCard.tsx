import { formatVND } from '@/utils/formatCurrency';
import {
    PROMO_OPT_OUT_SENTINEL,
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  const userManualChoiceRef = useRef<boolean>(false);

  useEffect(() => {
    const unsub = subscribePromoChanges(() => {
      setVouchers(getActivePromoVouchers());
      setSelectedCodeState(getSelectedPromoCode());
    });
    return unsub;
  }, []);

  // Auto-select the best eligible voucher ONLY when the user has not explicitly opted out (`__NONE__`)
  // and has not manually picked another valid voucher.
  useEffect(() => {
    if (selectedCode === PROMO_OPT_OUT_SENTINEL) {
      return;
    }

    const best = getBestApplicableVoucher(subtotal);
    if (!selectedCode) {
      if (best) {
        setSelectedPromoCode(best.code);
        setSelectedCodeState(best.code);
      }
      return;
    }

    const currentEval = evaluatePromoCode(selectedCode, subtotal);
    // If subtotal dropped below the currently selected voucher's minimum, fall back to the best eligible one
    if (!currentEval.valid) {
      const fallback = best ? best.code : '';
      setSelectedPromoCode(fallback);
      setSelectedCodeState(fallback);
      return;
    }

    // Only auto-upgrade to a higher tier if the user hasn't manually picked a specific voucher
    if (
      !userManualChoiceRef.current &&
      best &&
      best.discountAmount > currentEval.discountAmount
    ) {
      setSelectedPromoCode(best.code);
      setSelectedCodeState(best.code);
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

  const handleClearSelection = () => {
    userManualChoiceRef.current = true;
    setManualError(null);
    setSelectedPromoCode(PROMO_OPT_OUT_SENTINEL);
    setSelectedCodeState(PROMO_OPT_OUT_SENTINEL);
  };

  const handleSelectChip = (v: PromoVoucher) => {
    const eligible = subtotal >= v.minOrderSubtotal;
    const isCurrentlyActive = evalResult.valid && evalResult.code === v.code;

    // Clicking an already active voucher toggles it OFF (same as Bỏ chọn)
    if (isCurrentlyActive) {
      handleClearSelection();
      return;
    }

    if (!eligible) {
      const shortfall = Math.max(0, v.minOrderSubtotal - subtotal);
      setManualError(
        `Mã ${v.code} áp dụng cho đơn từ ${formatVND(
          v.minOrderSubtotal
        )} (Cần mua thêm ${formatVND(shortfall)} nữa).`
      );
      return;
    }

    userManualChoiceRef.current = true;
    setManualError(null);
    setSelectedPromoCode(v.code);
    setSelectedCodeState(v.code);
  };

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
    userManualChoiceRef.current = true;
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

      {/* 1-Tap Quick Voucher Chips (2x2 Balanced Grid) */}
      <View style={styles.pickerSection}>
        <View style={styles.pickerHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Tag size={13} color="#6E4F37" />
            <Text style={styles.pickerLabel}>
              Chọn Mã Giảm Giá Khai Trương:
            </Text>
          </View>
          {evalResult.valid ? (
            <TouchableOpacity
              style={styles.clearCodePill}
              onPress={handleClearSelection}
              activeOpacity={0.75}>
              <X size={11} color="#B91C1C" />
              <Text style={styles.clearCodeText}>Bỏ chọn mã</Text>
            </TouchableOpacity>
          ) : selectedCode === PROMO_OPT_OUT_SENTINEL ? (
            <Text style={{ fontSize: 10.5, color: '#8C7A6B', fontWeight: '700' }}>
              Đang không dùng mã
            </Text>
          ) : null}
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
                onPress={() => handleSelectChip(v)}
                activeOpacity={0.8}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 6,
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
                    ]}>
                    {active
                      ? '✓ Đang dùng (Chạm lần nữa để bỏ chọn)'
                      : eligible
                      ? `✓ Đủ điều kiện (Đơn ≥${Math.round(
                          v.minOrderSubtotal / 1000
                        )}k)`
                      : `Cần mua thêm ${formatVND(shortfall)} (Đơn ≥${Math.round(
                          v.minOrderSubtotal / 1000
                        )}k)`}
                  </Text>
                </View>
                {active && <Check size={14} color="#FDE68A" strokeWidth={2.8} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Manual Code Input */}
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Nhập mã giảm giá (VD: CHAOBAN10K)..."
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
            <Gift size={14} color="#065F46" />
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
    padding: 11,
    gap: 9,
  },
  milestoneBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 9,
    gap: 6,
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
    lineHeight: 15.5,
  },
  progressTrack: {
    height: 6,
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
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#D6C5B3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  milestoneDotReached: {
    backgroundColor: '#16A34A',
  },
  milestoneStepText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8C7A6B',
  },
  milestoneStepTextReached: {
    color: '#15803D',
    fontWeight: '800',
  },
  pickerSection: {
    gap: 7,
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
  clearCodePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  clearCodeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#B91C1C',
  },
  chipsWrap: {
    flexDirection: 'column',
    gap: 6,
  },
  voucherChip: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FAF5EF',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  voucherChipActive: {
    backgroundColor: '#4A3427',
    borderColor: '#4A3427',
  },
  voucherChipLocked: {
    opacity: 0.65,
    backgroundColor: '#F5F2EE',
  },
  chipCode: {
    fontSize: 11,
    fontWeight: '900',
    color: '#3B281E',
  },
  chipDiscount: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#9E3B46',
  },
  chipSub: {
    fontSize: 9.5,
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
    paddingVertical: 6.5,
    fontSize: 12,
    color: '#3B281E',
  },
  applyBtn: {
    backgroundColor: '#6E4F37',
    paddingHorizontal: 12,
    paddingVertical: 7.5,
    borderRadius: 9,
  },
  applyBtnText: {
    fontSize: 11.5,
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
    paddingVertical: 6.5,
  },
  appliedBannerText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
});
