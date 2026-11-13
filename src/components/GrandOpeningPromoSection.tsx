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
import { useEffect, useState } from 'react';
import {
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
    case 'VIP20K':
      return {
        stubBg: '#9E3B46',
        border: '#E5B8BE',
        badgeBg: '#FDF0F2',
        badgeColor: '#9E3B46',
        btnBg: '#9E3B46',
      };
    case 'TIEMLEN10K':
      return {
        stubBg: '#6E4F37',
        border: '#E4C6B4',
        badgeBg: '#FDF3EC',
        badgeColor: '#9A5435',
        btnBg: '#6E4F37',
      };
    default:
      return {
        stubBg: '#5C4033',
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
          !v.active && { opacity: 0.55 },
        ]}>
        {/* Top Colored Header Strip — Full card width so text never gets squeezed or truncated */}
        <View style={[styles.ticketTopStrip, { backgroundColor: accent.stubBg }]}>
          <View style={styles.ticketTopLeft}>
            <Tag size={13} color="#FAF3EA" />
            <Text style={styles.ticketStubAmount}>{v.title}</Text>
          </View>
          <View style={styles.stubMinPill}>
            <Text style={styles.ticketStubMin}>
              Đơn từ {Math.round(v.minOrderSubtotal / 1000)}k
            </Text>
          </View>
        </View>

        {/* Middle Content — Full width, zero truncation */}
        <View style={styles.ticketBody}>
          <View style={{ gap: 5 }}>
            <View style={styles.badgeLineRow}>
              <View
                style={[
                  styles.badgePill,
                  { backgroundColor: accent.badgeBg },
                ]}>
                <Text
                  style={[styles.badgePillText, { color: accent.badgeColor }]}>
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
                      fontSize: 10,
                      fontWeight: '800',
                      color: v.active ? '#065F46' : '#991B1B',
                    }}>
                    {v.active ? '● Đang bật' : '○ Đã tắt'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.ticketDesc}>{v.description}</Text>
          </View>

          {/* Bottom Perforated Footer — Code + Save Button */}
          <View style={styles.ticketFooterRow}>
            <View style={styles.codeTagBox}>
              <Text style={styles.codeMono}>{v.code}</Text>
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
      {/* Header Row */}
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.titleLineRow}>
            <View style={styles.iconCircle}>
              <Sparkles size={15} color="#784B2A" />
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
                  Ưu Đãi Đặc Biệt — Quà Khách Mới, Freeship 299k & Thưởng Khui Quà
                </Text>
                {isAdmin && (
                  <View style={styles.adminSafePill}>
                    <ShieldCheck size={11} color="#065F46" />
                    <Text style={styles.adminSafePillText}>
                      Khóa 1 lần • Không cộng dồn Combo
                    </Text>
                  </View>
                )}
                </View>
                <Text style={styles.sectionSub}>
                  Áp dụng cho sản phẩm mua lẻ • Sau khi nhận hàng, quay video/story khui hàng gắn link web nhận Gói Quà 60.000₫ (Voucher -25k + Tặng 1 SP 35k tự chọn)!
                </Text>
            </View>
          </View>
        </View>

        {/* Sleek Countdown Pill */}
        <View style={styles.countdownBox}>
          <Clock size={13} color="#784B2A" />
          <Text style={styles.countdownLabel}>Kết thúc sau:</Text>
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

      {/* Responsive Grid: 4 Equal Columns on Wide Desktop, 2x2 on Tablet, Full-Width Stack on Mobile (Zero Overflow) */}
      <View
        style={
          isMobile
            ? styles.mobileStackGrid
            : isWideDesktop
            ? styles.desktopFourColRow
            : styles.tabletTwoColGrid
        }>
        {visibleVouchers.map(renderTicketCard)}
      </View>
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
    paddingVertical: 14,
    gap: 12,
  },
  containerMobile: {
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  headerRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 8,
  },
  titleLineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EADBC8',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#3B281E',
    lineHeight: 21,
  },
  sectionTitleMobile: {
    fontSize: 14,
    lineHeight: 19,
  },
  sectionSub: {
    fontSize: 11.5,
    color: '#6E5643',
    marginTop: 2,
    lineHeight: 16,
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
    alignSelf: 'flex-start',
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
    justifyContent: 'space-between',
    gap: 10,
  },
  mobileStackGrid: {
    flexDirection: 'column',
    gap: 8,
  },
  ticketCard: {
    flexDirection: 'column',
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
    width: '48.6%' as any,
  },
  ticketCardMobile: {
    width: '100%',
  },
  ticketTopStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 11,
    paddingVertical: 7,
    gap: 6,
  },
  ticketTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  ticketStubAmount: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  stubMinPill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ticketStubMin: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FAF3EA',
  },
  ticketBody: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 4,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  adminDotPill: {
    paddingHorizontal: 7,
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
  ticketDesc: {
    fontSize: 11,
    color: '#6E5643',
    lineHeight: 15.5,
  },
  ticketFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: '#F0E4D4',
  },
  codeTagBox: {
    backgroundColor: '#F6EFE6',
    borderWidth: 1,
    borderColor: '#E5D5C3',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 6,
  },
  codeMono: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#5C4033',
    letterSpacing: 0.3,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5.5,
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
    fontSize: 11,
    fontWeight: '800',
    color: '#15803D',
  },
});
