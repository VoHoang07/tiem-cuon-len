import { useRouter } from 'expo-router';
import { ShoppingBag, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';

interface SocialProofEvent {
  buyer: string;
  city: string;
  action: string;
  itemName: string;
  productId: string;
  timeAgo: string;
}

const SOCIAL_PROOF_EVENTS: SocialProofEvent[] = [
  {
    buyer: 'Bạn Minh Anh',
    city: 'Q.7, TP.HCM',
    action: 'vừa đặt mua',
    itemName: 'Combo Đôi Bạn Thân Cute (2 Móc Khóa Tự Chọn)',
    productId: 'combo_bestie_cute_02',
    timeAgo: '3 phút trước',
  },
  {
    buyer: 'Bạn Khánh Linh',
    city: 'Cầu Giấy, Hà Nội',
    action: 'vừa đặt mua',
    itemName: 'Combo Cặp Đôi Cung Hoàng Đạo',
    productId: 'combo_couple_zodiac_01',
    timeAgo: '6 phút trước',
  },
  {
    buyer: 'Bạn Thảo Vy',
    city: 'TP. Thủ Đức',
    action: 'vừa đặt kèm Set Quà Tặng',
    itemName: 'Combo Góc Nhỏ Hoa & Thú Bông',
    productId: 'combo_muse_flower_plush_04',
    timeAgo: '11 phút trước',
  },
  {
    buyer: 'Bạn Hoàng Nam',
    city: 'Đà Nẵng',
    action: 'vừa được Freeship 0₫ & đặt',
    itemName: 'Combo Ấm Áp Đà Lạt (Chùm Tai & Thú Bông)',
    productId: 'combo_winter_dalat_06',
    timeAgo: '15 phút trước',
  },
];

export function LiveSocialProofToast() {
  const router = useRouter();
  const { width: rawWidth } = useWindowDimensions();
  const isMobile = (rawWidth || 1024) < 640;

  const [visible, setVisible] = useState(false);
  const [dismissedSession, setDismissedSession] = useState(false);
  const [eventIdx, setEventIdx] = useState(0);

  useEffect(() => {
    if (dismissedSession) return;

    let shownCount = 0;
    let hideTimeout: ReturnType<typeof setTimeout> | null = null;

    const firstTimer = setTimeout(() => {
      setVisible(true);
      shownCount += 1;
      hideTimeout = setTimeout(() => setVisible(false), 6500);
    }, 9000);

    const cycleInterval = setInterval(() => {
      if (shownCount >= 3) {
        clearInterval(cycleInterval);
        return;
      }
      setEventIdx((prev) => (prev + 1) % SOCIAL_PROOF_EVENTS.length);
      setVisible(true);
      shownCount += 1;
      if (hideTimeout) clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setVisible(false), 6500);
    }, 28000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(cycleInterval);
      if (hideTimeout) clearTimeout(hideTimeout);
    };
  }, [dismissedSession]);

  if (!visible || dismissedSession) return null;

  const ev = SOCIAL_PROOF_EVENTS[eventIdx];

  return (
    <View
      style={[
        styles.toastWrap,
        isMobile ? styles.toastWrapMobile : styles.toastWrapDesktop,
      ]}>
      <TouchableOpacity
        style={styles.toastMain}
        activeOpacity={0.85}
        onPress={() => {
          setVisible(false);
          router.push(`/product/${ev.productId}` as any);
        }}>
        <View style={styles.iconCircle}>
          <ShoppingBag size={16} color="#FFFDF9" />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.buyerLine} numberOfLines={1}>
            🧶 <Text style={{ fontWeight: '800' }}>{ev.buyer}</Text> ({ev.city}){' '}
            {ev.action}
          </Text>
          <Text style={styles.itemLine} numberOfLines={1}>
            {ev.itemName}
          </Text>
          <Text style={styles.timeLine}>
            ✅ Đã xác nhận • {ev.timeAgo} • Bấm xem mẫu
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => {
          setVisible(false);
          setDismissedSession(true);
        }}>
        <X size={14} color="#7A6555" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  toastWrap: {
    position: 'absolute',
    zIndex: 45,
    backgroundColor: '#FFFDF9',
    borderWidth: 1.5,
    borderColor: '#E5D3BE',
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#3B281E',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  toastWrapDesktop: {
    left: 20,
    bottom: 24,
    maxWidth: 355,
  },
  toastWrapMobile: {
    left: 12,
    right: 84,
    bottom: 78,
  },
  toastMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    minWidth: 0,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#4A3427',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyerLine: {
    fontSize: 11.5,
    color: '#4A3427',
  },
  itemLine: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9D174D',
    marginTop: 1,
  },
  timeLine: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
});
