import { useAuth } from '@/store/AuthContext';
import { useOrders } from '@/store/OrderContext';
import { useProducts } from '@/store/ProductContext';
import { formatVND } from '@/utils/formatCurrency';
import {
    PROMO_OPT_OUT_SENTINEL,
    evaluatePromoCode,
    getActivePromoVouchers,
    getBestApplicableVoucher,
    getEligible35kBonusGiftChoices,
    getNextUnlockableVoucher,
    getSelectedBonusGiftId,
    getSelectedPromoCode,
    savePersonalVoucherToWallet,
    setSelectedBonusGiftId,
    setSelectedPromoCode,
    subscribePromoChanges,
    validatePromoCodeWithServer,
    type BonusGiftChoice,
    type PromoEvaluationContext,
    type PromoVoucher,
} from '@/utils/promoEngine';
import { Check, Gift, Sparkles, Tag, X } from 'lucide-react-native';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export interface AppliedPromoSelection {
  code: string;
  discountAmount: number;
  bonusGiftProductId?: string;
  bonusGiftProductName?: string;
  bonusGiftValue?: number;
}

interface PromoMilestoneAndPickerCardProps {
  /** Total cart subtotal (including Combos) — used for displaying Freeship 299k progress */
  subtotal: number;
  /** Subtotal of ONLY non-Combo retail items — strictly used for Voucher eligibility! */
  eligibleRetailSubtotal?: number;
  hasComboItems?: boolean;
  customerEmail?: string;
  customerPhone?: string;
  onPromoChange?: (result: AppliedPromoSelection) => void;
}

export function PromoMilestoneAndPickerCard({
  subtotal,
  eligibleRetailSubtotal,
  hasComboItems = false,
  customerEmail,
  customerPhone,
  onPromoChange,
}: PromoMilestoneAndPickerCardProps) {
  const { user } = useAuth();
  const { orders } = useOrders();
  const { products: catalogProducts } = useProducts();

  const retailSub =
    eligibleRetailSubtotal !== undefined ? eligibleRetailSubtotal : subtotal;

  const bonusGiftChoices = useMemo<BonusGiftChoice[]>(
    () => getEligible35kBonusGiftChoices(catalogProducts),
    [catalogProducts]
  );

  const [selectedGiftId, setSelectedGiftIdState] = useState<string>(() =>
    getSelectedBonusGiftId()
  );

  const promoCtx = useMemo<PromoEvaluationContext>(() => {
    const myValidOrders = (orders || []).filter(
      (o) =>
        o.status !== 'Đã hủy' &&
        ((user?.id && o.userId === user.id) ||
          (customerPhone &&
            o.shippingAddress?.phone &&
            o.shippingAddress.phone.replace(/[^0-9]/g, '') ===
              customerPhone.replace(/[^0-9]/g, '')))
    );
    const usedPromoCodes = myValidOrders
      .map((o) => o.shippingAddress?.promoCode)
      .filter((c): c is string => Boolean(c));

    return {
      hasPriorOrders: myValidOrders.length > 0,
      usedPromoCodes,
      hasComboItems,
    };
  }, [orders, user?.id, customerPhone, hasComboItems]);

  const [vouchers, setVouchers] = useState<PromoVoucher[]>(() =>
    getActivePromoVouchers(promoCtx)
  );
  const [selectedCode, setSelectedCodeState] = useState<string>(() =>
    getSelectedPromoCode()
  );
  const [manualInput, setManualInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [checkingServer, setCheckingServer] = useState(false);
  const userManualChoiceRef = useRef<boolean>(false);

  useEffect(() => {
    setVouchers(getActivePromoVouchers(promoCtx));
  }, [promoCtx]);

  useEffect(() => {
    const unsub = subscribePromoChanges(() => {
      setVouchers(getActivePromoVouchers(promoCtx));
      setSelectedCodeState(getSelectedPromoCode());
      setSelectedGiftIdState(getSelectedBonusGiftId());
    });
    return unsub;
  }, [promoCtx]);

  // Preserve manual opt-out (`__NONE__`) per Rule #20; otherwise pick best eligible voucher on retailSub
  useEffect(() => {
    if (selectedCode === PROMO_OPT_OUT_SENTINEL) {
      return;
    }

    const best = getBestApplicableVoucher(retailSub, promoCtx);
    if (!selectedCode) {
      if (best) {
        setSelectedPromoCode(best.code);
        setSelectedCodeState(best.code);
      }
      return;
    }

    const currentEval = evaluatePromoCode(selectedCode, retailSub, promoCtx);
    if (!currentEval.valid) {
      const fallback = best ? best.code : '';
      setSelectedPromoCode(fallback);
      setSelectedCodeState(fallback);
      return;
    }

    if (
      !userManualChoiceRef.current &&
      best &&
      best.discountAmount > currentEval.discountAmount
    ) {
      setSelectedPromoCode(best.code);
      setSelectedCodeState(best.code);
    }
  }, [retailSub, selectedCode, promoCtx]);

  const evalResult = useMemo(
    () => evaluatePromoCode(selectedCode, retailSub, promoCtx),
    [selectedCode, retailSub, promoCtx]
  );

  const isVd25GiftActive = Boolean(
    evalResult.valid &&
      (evalResult.code.startsWith('VD25-') ||
        evalResult.voucher?.grantsFreeGiftMaxPrice)
  );

  const activeBonusGift: BonusGiftChoice | null = useMemo(() => {
    if (!isVd25GiftActive || bonusGiftChoices.length === 0) return null;
    return (
      bonusGiftChoices.find((g) => g.id === selectedGiftId) ||
      bonusGiftChoices[0] ||
      null
    );
  }, [isVd25GiftActive, bonusGiftChoices, selectedGiftId]);

  useEffect(() => {
    if (isVd25GiftActive && activeBonusGift && selectedGiftId !== activeBonusGift.id) {
      setSelectedBonusGiftId(activeBonusGift.id);
      setSelectedGiftIdState(activeBonusGift.id);
    }
  }, [isVd25GiftActive, activeBonusGift, selectedGiftId]);

  useEffect(() => {
    onPromoChange?.({
      code: evalResult.valid ? evalResult.code : '',
      discountAmount: evalResult.valid ? evalResult.discountAmount : 0,
      bonusGiftProductId:
        evalResult.valid && activeBonusGift ? activeBonusGift.id : undefined,
      bonusGiftProductName:
        evalResult.valid && activeBonusGift
          ? activeBonusGift.displayLabel
          : undefined,
      bonusGiftValue:
        evalResult.valid && activeBonusGift
          ? activeBonusGift.originalPrice
          : undefined,
    });
  }, [
    evalResult.valid,
    evalResult.code,
    evalResult.discountAmount,
    activeBonusGift,
    onPromoChange,
  ]);

  const nextUnlock = useMemo(
    () => getNextUnlockableVoucher(retailSub, promoCtx),
    [retailSub, promoCtx]
  );

  const progressPct = useMemo(() => {
    const maxTarget = 399000;
    return Math.min(100, Math.max(4, Math.round((subtotal / maxTarget) * 100)));
  }, [subtotal]);

  const handleClearSelection = () => {
    userManualChoiceRef.current = true;
    setManualError(null);
    setSelectedPromoCode(PROMO_OPT_OUT_SENTINEL);
    setSelectedCodeState(PROMO_OPT_OUT_SENTINEL);
  };

  const handleSelectChip = async (v: PromoVoucher) => {
    const eligible = retailSub >= v.minOrderSubtotal;
    const isCurrentlyActive = evalResult.valid && evalResult.code === v.code;

    if (isCurrentlyActive) {
      handleClearSelection();
      return;
    }

    if (!eligible) {
      const shortfall = Math.max(0, v.minOrderSubtotal - retailSub);
      setManualError(
        retailSub <= 0 && hasComboItems
          ? 'Các gói Combo đã được giảm giá ưu đãi sẵn nên không áp chồng thêm Voucher. Bạn mua thêm sản phẩm lẻ để dùng mã nhé!'
          : `Mã ${v.code} áp dụng khi sản phẩm mua lẻ đạt từ ${formatVND(
              v.minOrderSubtotal
            )} (Cần mua thêm ${formatVND(shortfall)} sản phẩm lẻ nữa).`
      );
      return;
    }

    if (v.isPersonalMission) {
      setCheckingServer(true);
      const srv = await validatePromoCodeWithServer({
        promoCode: v.code,
        eligibleRetailSubtotal: retailSub,
        email: customerEmail || user?.email,
        phone: customerPhone,
      });
      setCheckingServer(false);
      if (srv.checkedOnServer && !srv.valid) {
        setManualError(
          srv.error || 'Mã thưởng riêng không hợp lệ với tài khoản hiện tại.'
        );
        return;
      }
    }

    userManualChoiceRef.current = true;
    setManualError(null);
    setSelectedPromoCode(v.code);
    setSelectedCodeState(v.code);
  };

  const handleApplyManual = async () => {
    const cleaned = manualInput.trim().toUpperCase();
    if (!cleaned) return;

    const localRes = evaluatePromoCode(cleaned, retailSub, promoCtx);
    if (!localRes.valid) {
      setManualError(
        localRes.error || 'Mã giảm giá chưa đủ điều kiện hoặc không hợp lệ.'
      );
      return;
    }

    setCheckingServer(true);
    const srv = await validatePromoCodeWithServer({
      promoCode: cleaned,
      eligibleRetailSubtotal: retailSub,
      email: customerEmail || user?.email,
      phone: customerPhone,
    });
    setCheckingServer(false);

    if (srv.checkedOnServer && !srv.valid) {
      setManualError(
        srv.error || 'Mã giảm giá không hợp lệ hoặc không thuộc tài khoản này.'
      );
      return;
    }

    if (cleaned.startsWith('VD25-') || cleaned.startsWith('FB15-')) {
      savePersonalVoucherToWallet({
        code: cleaned,
        discountAmount: srv.discountAmount || localRes.discountAmount,
        minRetailSubtotal: localRes.voucher?.minOrderSubtotal || 119000,
        title: srv.title || localRes.voucher?.title || 'Mã thưởng nhiệm vụ riêng',
      });
    }

    userManualChoiceRef.current = true;
    setManualError(null);
    setManualInput('');
    setSelectedPromoCode(localRes.code);
    setSelectedCodeState(localRes.code);
  };

  const isComboOnlyCart = hasComboItems && retailSub <= 0;

  return (
    <View style={styles.card}>
      {/* Milestone Upsell Bar (Direction 2: 159k -10k First Order | 299k Freeship | 399k -20k) */}
      <View style={styles.milestoneBox}>
        <View style={styles.milestoneHeader}>
          <Sparkles size={14} color="#B45309" />
          <Text style={styles.milestoneTitle}>
            {subtotal < 299000
              ? `🚚 Mua thêm ${formatVND(
                  299000 - subtotal
                )} để được Miễn phí vận chuyển toàn quốc (Đơn ≥299k)!`
              : nextUnlock && retailSub > 0
                ? `💡 Đã Freeship 0₫! Mua thêm ${formatVND(
                    nextUnlock.shortfall
                  )} sản phẩm lẻ để mở khóa mã ${nextUnlock.voucher.code} (-${formatVND(
                    nextUnlock.voucher.discountAmount
                  )})!`
                : '🎉 Đơn hàng đã được Miễn phí vận chuyển toàn quốc (0₫)!'}
          </Text>
        </View>

        <View style={styles.progressTrack}>
          <View
            style={[styles.progressFill, { width: `${progressPct}%` as any }]}
          />
        </View>

        <View style={styles.milestonesRow}>
          {[
            {
              label: 'Lẻ ≥159k: -10k (Khách mới)',
              reached: !promoCtx.hasPriorOrders && retailSub >= 159000,
            },
            {
              label: 'Tổng ≥299k: Freeship 0₫',
              reached: subtotal >= 299000,
            },
            {
              label: 'Lẻ ≥399k: -20k',
              reached: retailSub >= 399000,
            },
          ].map((m) => (
            <View key={m.label} style={styles.milestoneStep}>
              <View
                style={[
                  styles.milestoneDot,
                  m.reached && styles.milestoneDotReached,
                ]}>
                {m.reached && <Check size={9} color="#FFFDF9" strokeWidth={3} />}
              </View>
              <Text
                style={[
                  styles.milestoneStepText,
                  m.reached && styles.milestoneStepTextReached,
                ]}>
                {m.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Combo Non-Stacking Fair Notice */}
      {hasComboItems && (
        <View style={styles.comboGuardNotice}>
          <Text style={styles.comboGuardText}>
            {isComboOnlyCart
              ? '💝 Các gói Combo trong giỏ đã được giảm giá ưu đãi trực tiếp (Mã giảm giá chỉ áp dụng cho sản phẩm mua lẻ nguyên giá, không trừ chồng lên Combo).'
              : `ℹ️ Mã giảm giá chỉ tính trên phần sản phẩm mua lẻ (${formatVND(
                  retailSub
                )}), không cộng dồn lên gói Combo đã giảm sẵn.`}
          </Text>
        </View>
      )}

      {/* Voucher Chips + Manual Input */}
      <View style={styles.pickerSection}>
        <View style={styles.pickerHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Tag size={13} color="#6E4F37" />
            <Text style={styles.pickerLabel}>
              Mã Giảm Giá (Tối đa 1 mã / đơn):
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

        {vouchers.length > 0 && !isComboOnlyCart && (
          <View style={styles.chipsWrap}>
            {vouchers.map((v) => {
              const eligible = retailSub >= v.minOrderSubtotal;
              const active = evalResult.valid && evalResult.code === v.code;
              const shortfall = Math.max(0, v.minOrderSubtotal - retailSub);

              return (
                <TouchableOpacity
                  key={v.code}
                  style={[
                    styles.voucherChip,
                    active && styles.voucherChipActive,
                    !eligible && styles.voucherChipLocked,
                  ]}
                  onPress={() => void handleSelectChip(v)}
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
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: '700',
                          color: active ? '#E5D5C5' : '#7A6555',
                        }}>
                        • {v.badge}
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
                          ? `✓ Đủ điều kiện (Đơn lẻ ≥${Math.round(
                              v.minOrderSubtotal / 1000
                            )}k • Dùng 1 lần)`
                          : `Mua thêm ${formatVND(
                              shortfall
                            )} SP lẻ (Đơn lẻ ≥${Math.round(
                              v.minOrderSubtotal / 1000
                            )}k)`}
                    </Text>
                  </View>
                  {active && (
                    <Check size={14} color="#FDE68A" strokeWidth={2.8} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Manual Code Input (for Personal 1-to-1 Mission Codes VD25-... / FB15-...) */}
        <View style={styles.manualRow}>
          <TextInput
            style={styles.manualInput}
            placeholder="Nhập mã riêng Tiệm tặng qua Chat (VD: VD25-XXXX, FB15-XXXX)..."
            placeholderTextColor="#A1887F"
            value={manualInput}
            onChangeText={(txt) => {
              setManualInput(txt);
              if (manualError) setManualError(null);
            }}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={() => void handleApplyManual()}
          />
          <TouchableOpacity
            style={styles.applyBtn}
            onPress={() => void handleApplyManual()}
            disabled={checkingServer}
            activeOpacity={0.85}>
            {checkingServer ? (
              <ActivityIndicator size="small" color="#FFFDF9" />
            ) : (
              <Text style={styles.applyBtnText}>Áp dụng</Text>
            )}
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
              Đã áp mã{' '}
              <Text style={{ fontWeight: '900' }}>{evalResult.code}</Text> — Giảm
              trực tiếp{' '}
              <Text style={{ fontWeight: '900' }}>
                -{formatVND(evalResult.discountAmount)}
              </Text>
              {isVd25GiftActive
                ? ' + Mở khóa chọn 01 sản phẩm 35.000₫ của Tiệm miễn phí (0₫) bên dưới!'
                : ' trên sản phẩm lẻ!'}
            </Text>
          </View>
        ) : null}

        {/* Interactive 0₫ Shop Product Gift Picker when VD25-XXXXXX is applied */}
        {isVd25GiftActive && bonusGiftChoices.length > 0 && (
          <View
            style={{
              backgroundColor: '#FDF2F8',
              borderWidth: 1.5,
              borderColor: '#F472B6',
              borderRadius: 12,
              padding: 10,
              gap: 8,
            }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 6,
              }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  color: '#9D174D',
                  flex: 1,
                }}>
                🎀 Chọn 01 sản phẩm giá 35.000₫ của Tiệm làm quà tặng kèm (Giá 0₫):
              </Text>
              <View
                style={{
                  backgroundColor: '#9D174D',
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                }}>
                <Text
                  style={{
                    fontSize: 10,
                    fontWeight: '900',
                    color: '#FFFFFF',
                  }}>
                  MIỄN PHÍ 0₫
                </Text>
              </View>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
              {bonusGiftChoices.map((gift) => {
                const isPicked = activeBonusGift?.id === gift.id;
                return (
                  <TouchableOpacity
                    key={gift.id}
                    onPress={() => {
                      setSelectedBonusGiftId(gift.id);
                      setSelectedGiftIdState(gift.id);
                    }}
                    activeOpacity={0.85}
                    style={{
                      width: 118,
                      backgroundColor: isPicked ? '#FCE7F3' : '#FFFFFF',
                      borderWidth: 1.5,
                      borderColor: isPicked ? '#BE185D' : '#FBCFE8',
                      borderRadius: 11,
                      padding: 6,
                      gap: 4,
                    }}>
                    <View
                      style={{
                        width: '100%',
                        height: 76,
                        borderRadius: 8,
                        overflow: 'hidden',
                        backgroundColor: '#FAF5EF',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                      {gift.image ? (
                        Platform.OS === 'web' ? (
                          React.createElement('img', {
                            src: gift.image,
                            alt: gift.displayLabel,
                            style: {
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              display: 'block',
                            },
                          })
                        ) : (
                          <Image
                            source={{ uri: gift.image }}
                            style={{ width: '100%', height: '100%' }}
                            resizeMode="cover"
                          />
                        )
                      ) : (
                        <Text style={{ fontSize: 24 }}>🎁</Text>
                      )}
                    </View>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: isPicked ? '900' : '700',
                        color: '#3B281E',
                      }}
                      numberOfLines={2}>
                      {gift.displayLabel}
                    </Text>
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                      }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '900',
                          color: '#15803D',
                        }}>
                        0₫
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          color: '#9CA3AF',
                          textDecorationLine: 'line-through',
                        }}>
                        {formatVND(gift.originalPrice)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {activeBonusGift && (
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  color: '#831843',
                }}>
                ✓ Đã chọn quà tặng kèm:{' '}
                <Text style={{ color: '#065F46' }}>
                  {activeBonusGift.displayLabel} (0₫)
                </Text>
              </Text>
            )}
          </View>
        )}
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
  comboGuardNotice: {
    backgroundColor: '#FAF4EC',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  comboGuardText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6E5239',
    lineHeight: 15.5,
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
    fontSize: 16,
    color: '#3B281E',
  },
  applyBtn: {
    backgroundColor: '#6E4F37',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9,
    minWidth: 72,
    alignItems: 'center',
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
