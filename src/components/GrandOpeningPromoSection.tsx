import { useAuth } from '@/store/AuthContext';
import {
    getAllPromoVouchers,
    getSavedWalletCodes,
    saveAdminPromoVouchers,
    saveVoucherToWallet,
    subscribePromoChanges,
    type PromoVoucher,
} from '@/utils/promoEngine';
import { Check, Clock, Gift, ShieldCheck, Sparkles, Tag } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';

function getRemainingCountdown() {
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const diffSec = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / 1000));
  const hours = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  return { hours, mins, secs };
}

function getTicketAccent(code: string) {
  switch (code) {
    case 'CUONLEN35K':
      return {
        stubBg: '#9E3B46',
        border: '#E5B8BE',
        badgeBg: '#FDF0F2',
        badgeColor: '#9E3B46',
        btnBg: '#9E3B46',
      };
    case 'KHAITRUONG20K':
      return {
        stubBg: '#9A5435',
        border: '#E4C6B4',
        badgeBg: '#FDF3EC',
        badgeColor: '#9A5435',
        btnBg: '#6E4F37',
      };
    case 'VIP50K':
      return {
        stubBg: '#4A3427',
        border: '#D9C6B2',
        badgeBg: '#F7EFE4',
        badgeColor: '#4A3427',
        btnBg: '#4A3427',
      };
    default:
      return {
        stubBg: '#6E4F37',
        border: '#E4D3C0',
        badgeBg: '#FBF4EA',
        badgeColor: '#6E4F37',
        btnBg: '#5C4033',
      };
  }
}

export function GrandOpeningPromoSection() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const { width: rawWidth } = useWindowDimensions();
  const windowWidth =
    rawWidth > 0
      ? rawWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isMobile = windowWidth < 680;
  const isWideDesktop = windowWidth >= 980;

  const [vouchers, setVouchers] = useState<PromoVoucher[]>(() =>
    getAllPromoVouchers()
  );
  const [savedCodes, setSavedCodes] = useState<string[]>(() =>
    getSavedWalletCodes()
  );
  const [justClaimedCode, setJustClaimedCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(() => getRemainingCountdown());

  useEffect(() => {
    const unsub = subscribePromoChanges(() => {
      setVouchers(getAllPromoVouchers());
      setSavedCodes(getSavedWalletCodes());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getRemainingCountdown());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const visibleVouchers = isAdmin
    ? vouchers
    : vouchers.filter((v) => v.active);

  if (visibleVouchers.length === 0) return null;

  const handleClaimVoucher = (code: string) => {
    const next = saveVoucherToWallet(code);
    setSavedCodes(next);
    setJustClaimedCode(code);
    setTimeout(() => {
      setJustClaimedCode((prev) => (prev === code ? null : prev));
    }, 2600);
  };

  const handleToggleAdminActive = (code: string) => {
    const next = vouchers.map((v) =>
      v.code === code ? { ...v, active: !v.active } : v
    );
    setVouchers(next);
    saveAdminPromoVouchers(next);
  };

  const renderTicketCard = (v: PromoVoucher) => {
    const isSaved = savedCodes.includes(v.code);
    const accent = getTicketAccent(v.code);

    return (
      <View
        key={v.code}
        style={[
          styles.ticketCard,
          isMobile
            ? styles.ticketCardMobile
            : isWideDesktop
            ? styles.ticketCardFourCol
            : styles.ticketCardTwoCol,
          { borderColor: accent.border },
          !v.active && { opacity: 0.5 },
        ]}>
        {/* Left Perforated Stub */}
        <View style={[styles.ticketStub, { backgroundColor: accent.stubBg }]}>
          <View style={styles.notchTop} />
          <View style={styles.notchBottom} />
          <Tag size={14} color="#FAF3EA" />
          <Text style={styles.ticketStubAmount}>
            -{Math.round(v.discountAmount / 1000)}K
          </Text>
          <View style={styles.stubMinPill}>
            <Text style={styles.ticketStubMin}>
              Đơn ≥{Math.round(v.minOrderSubtotal / 1000)}k
            </Text>
          </View>
        </View>

        {/* Right Compact Content */}
        <View style={styles.ticketBody}>
          <View>
            <View style={styles.ticketTopRow}>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: accent.badgeBg },
                ]}>
                <Text
                  style={[styles.badgePillText, { color: accent.badgeColor }]}
                  numberOfLines={1}>
                  {v.badge}
                </Text>
              </View>
              {isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.adminDotPill,
                    v.active ? styles.adminDotOn : styles.adminDotOff,
                  ]}
                  onPress={() => handleToggleAdminActive(v.code)}
                  activeOpacity={0.8}>
                  <Text
                    style={{
                      fontSize: 9.5,
                      fontWeight: '800',
                      color: v.active ? '#065F46' : '#991B1B',
                    }}>
                    {v.active ? '● Bật' : '○ Tắt'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.ticketTitle} numberOfLines={1}>
              {v.title}
            </Text>
            <Text style={styles.ticketDesc} numberOfLines={2}>
              {v.description}
            </Text>
          </View>

          <View style={styles.ticketFooterRow}>
            <View style={styles.codeTagBox}>
              <Text style={styles.codeMono} numberOfLines={1}>
                {v.code}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.claimBtn,
                isSaved
                  ? styles.claimBtnSaved
                  : { backgroundColor: accent.btnBg },
              ]}
              onPress={() => handleClaimVoucher(v.code)}
              activeOpacity={0.85}>
              {isSaved ? (
                <>
                  <Check size={12} color="#15803D" strokeWidth={2.8} />
                  <Text style={styles.claimBtnTextSaved}>
                    {justClaimedCode === v.code ? 'Đã lưu!' : 'Đã lưu'}
                  </Text>
                </>
              ) : (
                <>
                  <Gift size={12} color="#FFFDF9" />
                  <Text style={styles.claimBtnTextDefault}>Lưu mã</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Compact Header Row */}
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleLineRow}>
            <View style={styles.iconCircle}>
              <Sparkles size={14} color="#784B2A" />
            </View>
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
                    styles.sectionTitle,
                    isMobile && styles.sectionTitleMobile,
                  ]}>
                  Ưu Đãi Mừng Khai Trương — Lưu Voucher Giảm Tới 50.000₫
                </Text>
                {isAdmin && (
                  <View style={styles.adminSafePill}>
                    <ShieldCheck size={11} color="#065F46" />
                    <Text style={styles.adminSafePillText}>
                      Đã khóa mức tối thiểu chống lỗ
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.sectionSub} numberOfLines={1}>
                Bấm “Lưu mã” để hệ thống tự động chọn mức giảm cao nhất tại Giỏ hàng & Thanh toán
              </Text>
            </View>
          </View>
        </View>

        {/* Sleek Countdown Pill */}
        <View style={styles.countdownBox}>
          <Clock size={13} color="#784B2A" />
          <Text style={styles.countdownLabel}>Còn lại:</Text>
          <View style={styles.timePills}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeDigits}>{countdown.hours}</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeBlock}>
              <Text style={styles.timeDigits}>{countdown.mins}</Text>
            </View>
            <Text style={styles.timeSep}>:</Text>
            <View style={styles.timeBlock}>
              <Text style={styles.timeDigits}>{countdown.secs}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Balanced 4-Column Row on Desktop, 2x2 on Tablet, Swipe on Mobile */}
      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileScrollContent}>
          {visibleVouchers.map(renderTicketCard)}
        </ScrollView>
      ) : (
        <View
          style={
            isWideDesktop ? styles.desktopFourColRow : styles.tabletTwoColGrid
          }>
          {visibleVouchers.map(renderTicketCard)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 6,
    backgroundColor: '#F5EDE2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5D5C3',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 11,
  },
  containerMobile: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EADBC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#3B281E',
  },
  sectionTitleMobile: {
    fontSize: 14,
  },
  sectionSub: {
    fontSize: 11.5,
    color: '#6E5643',
    marginTop: 1,
  },
  adminSafePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  adminSafePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#E2D0BC',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countdownLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6E4F37',
  },
  timePills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeBlock: {
    backgroundColor: '#4A3427',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  timeDigits: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  timeSep: {
    fontSize: 11,
    fontWeight: '900',
    color: '#6E4F37',
  },
  desktopFourColRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  tabletTwoColGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  mobileScrollContent: {
    gap: 10,
    paddingRight: 4,
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  ticketCardFourCol: {
    flex: 1,
    minWidth: 0,
  },
  ticketCardTwoCol: {
    width: '48.8%' as any,
  },
  ticketCardMobile: {
    width: 248,
  },
  ticketStub: {
    width: 68,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 3,
    position: 'relative',
  },
  notchTop: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F5EDE2',
  },
  notchBottom: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#F5EDE2',
  },
  ticketStubAmount: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFDF9',
    letterSpacing: -0.3,
  },
  stubMinPill: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  ticketStubMin: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#FAF3EA',
  },
  ticketBody: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'space-between',
    gap: 7,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 3,
  },
  badgePill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    flexShrink: 1,
  },
  badgePillText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  adminDotPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  adminDotOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  adminDotOff: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  ticketTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#3B281E',
  },
  ticketDesc: {
    fontSize: 10.5,
    color: '#7A6552',
    lineHeight: 14,
    marginTop: 2,
  },
  ticketFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: '#F2E8DC',
  },
  codeTagBox: {
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 1,
  },
  codeMono: {
    fontSize: 10,
    fontWeight: '900',
    color: '#5C4033',
    letterSpacing: 0.2,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
  },
  claimBtnSaved: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  claimBtnTextDefault: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  claimBtnTextSaved: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#15803D',
  },
});
