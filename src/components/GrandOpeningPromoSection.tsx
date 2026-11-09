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
  const isMobile = windowWidth < 640;

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
    const isHot = v.code === 'CUONLEN35K' || v.code === 'KHAITRUONG20K';

    return (
      <View
        key={v.code}
        style={[
          styles.ticketCard,
          isMobile ? styles.ticketCardMobile : styles.ticketCardDesktop,
          isHot && styles.ticketCardHot,
          !v.active && { opacity: 0.55 },
        ]}>
        {/* Left Stub */}
        <View
          style={[
            styles.ticketStub,
            isHot ? styles.ticketStubHot : styles.ticketStubWarm,
          ]}>
          <Tag size={16} color="#FFFDF9" />
          <Text style={styles.ticketStubAmount}>
            -{Math.round(v.discountAmount / 1000)}K
          </Text>
          <Text style={styles.ticketStubMin}>
            Đơn ≥{Math.round(v.minOrderSubtotal / 1000)}k
          </Text>
        </View>

        {/* Right Body */}
        <View style={styles.ticketBody}>
          <View style={styles.ticketTopRow}>
            <View
              style={[
                styles.badgePill,
                isHot ? styles.badgePillHot : styles.badgePillStandard,
              ]}>
              <Text
                style={[
                  styles.badgePillText,
                  isHot ? { color: '#9D174D' } : { color: '#78350F' },
                ]}>
                {v.badge}
              </Text>
            </View>
            <Text style={styles.codeMono}>{v.code}</Text>
          </View>

          <Text style={styles.ticketTitle} numberOfLines={1}>
            {v.title}
          </Text>
          <Text style={styles.ticketDesc} numberOfLines={2}>
            {v.description}
          </Text>

          {isAdmin && (
            <View style={styles.adminProfitBox}>
              <ShieldCheck size={12} color="#065F46" />
              <Text style={styles.adminProfitText} numberOfLines={2}>
                {v.profitSafeNote}
              </Text>
            </View>
          )}

          <View style={styles.ticketFooterRow}>
            <TouchableOpacity
              style={[
                styles.claimBtn,
                isSaved ? styles.claimBtnSaved : styles.claimBtnDefault,
              ]}
              onPress={() => handleClaimVoucher(v.code)}
              activeOpacity={0.85}>
              {isSaved ? (
                <>
                  <Check size={13} color="#065F46" strokeWidth={2.6} />
                  <Text style={styles.claimBtnTextSaved}>
                    {justClaimedCode === v.code
                      ? 'Đã lưu! Tự áp ở Giỏ hàng'
                      : 'Đã lưu vào Ví'}
                  </Text>
                </>
              ) : (
                <>
                  <Gift size={13} color="#FFFDF9" />
                  <Text style={styles.claimBtnTextDefault}>Lưu mã ngay</Text>
                </>
              )}
            </TouchableOpacity>

            {isAdmin && (
              <TouchableOpacity
                style={[
                  styles.adminToggleBtn,
                  v.active ? styles.adminToggleOn : styles.adminToggleOff,
                ]}
                onPress={() => handleToggleAdminActive(v.code)}
                activeOpacity={0.8}>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: '800',
                    color: v.active ? '#065F46' : '#991B1B',
                  }}>
                  {v.active ? 'Đang BẬT' : 'Đang TẮT'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, isMobile && styles.containerMobile]}>
      {/* Header Banner */}
      <View style={[styles.headerRow, isMobile && styles.headerRowMobile]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.campaignTagRow}>
            <Sparkles size={13} color="#B45309" />
            <Text style={styles.campaignTagText}>
              CHIẾN DỊCH MỪNG KHAI TRƯƠNG • TIẾT KIỆM TỐI ĐA
            </Text>
          </View>
          <Text style={[styles.sectionTitle, isMobile && styles.sectionTitleMobile]}>
            🎟️ Kho Voucher Khai Trương — Lưu Mã Giảm Ngay Tới 50.000₫
          </Text>
          <Text style={styles.sectionSub}>
            Lưu mã bên dưới để hệ thống tự động trừ tiền trực tiếp tại Giỏ hàng & Thanh toán (Kết hợp được với Combo & Freeship 299k!)
          </Text>
        </View>

        {/* Live Flash Countdown */}
        <View style={styles.countdownBox}>
          <Clock size={14} color="#92400E" />
          <Text style={styles.countdownLabel}>Kết thúc trong:</Text>
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

      {/* Voucher Tickets Strip / Grid */}
      {isMobile ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.mobileScrollContent}>
          {visibleVouchers.map(renderTicketCard)}
        </ScrollView>
      ) : (
        <View style={styles.desktopGrid}>
          {visibleVouchers.map(renderTicketCard)}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: '#FFF9F0',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#F3DEC2',
    padding: 16,
    gap: 12,
  },
  containerMobile: {
    marginHorizontal: 12,
    padding: 12,
    borderRadius: 15,
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
    alignItems: 'flex-start',
  },
  campaignTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  campaignTagText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#B45309',
    letterSpacing: 0.6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#3B281E',
  },
  sectionTitleMobile: {
    fontSize: 15,
  },
  sectionSub: {
    fontSize: 12,
    color: '#6E5643',
    marginTop: 2,
    lineHeight: 17,
  },
  countdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  countdownLabel: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#92400E',
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
    fontSize: 11.5,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  timeSep: {
    fontSize: 12,
    fontWeight: '900',
    color: '#78350F',
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  mobileScrollContent: {
    gap: 10,
    paddingRight: 6,
  },
  ticketCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#EBD7BF',
    overflow: 'hidden',
  },
  ticketCardDesktop: {
    flex: 1,
    minWidth: 265,
  },
  ticketCardMobile: {
    width: 286,
  },
  ticketCardHot: {
    borderColor: '#F472B6',
    backgroundColor: '#FFFDFB',
  },
  ticketStub: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    gap: 3,
  },
  ticketStubWarm: {
    backgroundColor: '#6E4F37',
  },
  ticketStubHot: {
    backgroundColor: '#BE185D',
  },
  ticketStubAmount: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFDF9',
  },
  ticketStubMin: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FDE68A',
    textAlign: 'center',
  },
  ticketBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    gap: 5,
  },
  ticketTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgePillStandard: {
    backgroundColor: '#FEF3C7',
  },
  badgePillHot: {
    backgroundColor: '#FCE7F3',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  codeMono: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#6E4F37',
    backgroundColor: '#F6EFE6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  ticketTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#3B281E',
  },
  ticketDesc: {
    fontSize: 11,
    color: '#6E5643',
    lineHeight: 15,
  },
  adminProfitBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  adminProfitText: {
    flex: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#065F46',
    lineHeight: 13.5,
  },
  ticketFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 2,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    flex: 1,
  },
  claimBtnDefault: {
    backgroundColor: '#4A3427',
  },
  claimBtnSaved: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  claimBtnTextDefault: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFDF9',
  },
  claimBtnTextSaved: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  adminToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
  },
  adminToggleOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  adminToggleOff: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
});
