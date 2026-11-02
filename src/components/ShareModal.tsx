import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  Share,
  Linking,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
  X,
  Copy,
  Check,
  Share2,
  ExternalLink,
  FileText,
  Sparkles,
} from 'lucide-react-native';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SHADOWS, SPACING } from '@/constants/theme';

export const PUBLIC_SHOP_URL = 'https://www.tiemcuonlen.shop';

export interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  priceText?: string;
  url: string;
  shareText: string;
  image?: any;
  type?: 'product' | 'website';
}

interface PlatformOption {
  id: string;
  name: string;
  sublabel: string;
  badgeText: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  onPress: () => Promise<void> | void;
}

export function ShareModal({
  visible,
  onClose,
  title,
  subtitle,
  priceText,
  url,
  shareText,
  image,
  type = 'product',
}: ShareModalProps) {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const [copiedType, setCopiedType] = useState<'url' | 'caption' | string | null>(null);

  // Admin gets full marketing post; Client gets clean simple link for friends
  const fullAdminPostText = `${shareText}\n👉 Xem chi tiết & đặt mẫu tại: ${url}`;
  const simpleClientShareText = priceText
    ? `${title} (${priceText}) — ${url}`
    : `${title} — ${url}`;

  const copyToClipboard = async (text: string, tag: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text).catch(() => {});
      }
    }
    setCopiedType(tag);
    setTimeout(() => {
      setCopiedType((prev) => (prev === tag ? null : prev));
    }, 2200);
  };

  const openExternalUrl = async (targetUrl: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await Linking.openURL(targetUrl);
    } catch {}
  };

  const handleNativeShare = async () => {
    const payloadText = isAdmin ? fullAdminPostText : simpleClientShareText;
    await copyToClipboard(isAdmin ? fullAdminPostText : url, 'native');
    if (
      Platform.OS === 'web' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title,
          text: isAdmin ? shareText : title,
          url,
        });
        return;
      } catch {}
    }
    try {
      await Share.share({
        title,
        message: payloadText,
        url,
      });
    } catch {}
  };

  /* ------------------------------------------------------------------ */
  /* 1. CLIENT VIEW: Ultra-compact & minimal for sending to friends     */
  /* ------------------------------------------------------------------ */
  if (!isAdmin) {
    const clientQuickApps = [
      {
        id: 'zalo',
        label: 'Zalo',
        badge: 'Zalo',
        bg: '#E8F4FF',
        color: '#0068FF',
        border: '#B8DCFF',
        onPress: async () => {
          await copyToClipboard(url, 'zalo');
          await openExternalUrl('https://chat.zalo.me');
        },
      },
      {
        id: 'messenger',
        label: 'Messenger',
        badge: 'Msg',
        bg: '#F2EEFF',
        color: '#7C3AED',
        border: '#DDD2FF',
        onPress: async () => {
          await copyToClipboard(url, 'messenger');
          await openExternalUrl('https://www.messenger.com');
        },
      },
      {
        id: 'facebook',
        label: 'Facebook',
        badge: 'FB',
        bg: '#EBF3FF',
        color: '#1877F2',
        border: '#C2DCFF',
        onPress: async () => {
          const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
            url
          )}`;
          await openExternalUrl(fbUrl);
        },
      },
      {
        id: 'telegram',
        label: 'Telegram',
        badge: 'TG',
        bg: '#EAF6FD',
        color: '#0284C7',
        border: '#BAE0F9',
        onPress: async () => {
          const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
            url
          )}&text=${encodeURIComponent(title)}`;
          await openExternalUrl(tgUrl);
        },
      },
      {
        id: 'native',
        label: 'Khác',
        badge: '•••',
        bg: '#F3ECE2',
        color: '#4A3728',
        border: '#DFD2C3',
        onPress: handleNativeShare,
      },
    ];

    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onClose}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.clientSheet}
            onPress={(e) => e.stopPropagation()}>
            {/* Minimal Header */}
            <View style={styles.clientHeader}>
              <Text style={styles.clientHeaderTitle}>Gửi cho bạn bè</Text>
              <TouchableOpacity
                style={styles.closeBtnSmall}
                onPress={onClose}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={16} color="#4A3728" />
              </TouchableOpacity>
            </View>

            {/* Compact Product Row */}
            <View style={styles.clientPreviewRow}>
              {image ? (
                <Image
                  source={
                    typeof image === 'string' ? { uri: image } : (image as any)
                  }
                  style={styles.clientThumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.clientEmojiThumb}>
                  <Text style={{ fontSize: 20 }}>🧶</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.clientTitle} numberOfLines={1}>
                  {title}
                </Text>
                {priceText ? (
                  <Text style={styles.clientPrice}>{priceText}</Text>
                ) : null}
              </View>
            </View>

            {/* 1-Click Copy Link Bar */}
            <View style={styles.clientLinkBar}>
              <Text style={styles.clientLinkText} numberOfLines={1}>
                {url}
              </Text>
              <TouchableOpacity
                style={[
                  styles.clientCopyBtn,
                  copiedType === 'url' && styles.copyLinkBtnActive,
                ]}
                onPress={() => copyToClipboard(url, 'url')}
                activeOpacity={0.8}>
                {copiedType === 'url' ? (
                  <>
                    <Check size={13} color="#FFF" />
                    <Text style={styles.clientCopyBtnText}>Đã chép</Text>
                  </>
                ) : (
                  <>
                    <Copy size={13} color="#FFF" />
                    <Text style={styles.clientCopyBtnText}>Chép link</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Compact Row of Apps */}
            <View style={styles.clientAppsRow}>
              {clientQuickApps.map((app) => {
                const isCopied = copiedType === app.id;
                return (
                  <TouchableOpacity
                    key={app.id}
                    style={styles.clientAppItem}
                    onPress={app.onPress}
                    activeOpacity={0.78}>
                    <View
                      style={[
                        styles.clientAppCircle,
                        {
                          backgroundColor: app.bg,
                          borderColor: app.border,
                        },
                      ]}>
                      <Text
                        style={[
                          styles.clientAppBadgeText,
                          { color: app.color },
                        ]}>
                        {isCopied ? '✓' : app.badge}
                      </Text>
                    </View>
                    <Text style={styles.clientAppLabel} numberOfLines={1}>
                      {isCopied ? 'Đã chép' : app.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  }

  /* ------------------------------------------------------------------ */
  /* 2. ADMIN / SERVER VIEW: Full Marketing & Multi-Platform Toolkit    */
  /* ------------------------------------------------------------------ */
  const platforms: PlatformOption[] = [
    {
      id: 'facebook',
      name: 'Facebook',
      sublabel: 'Đăng bài kèm link',
      badgeText: 'FB',
      bgColor: '#EBF3FF',
      textColor: '#1877F2',
      borderColor: '#C2DCFF',
      onPress: async () => {
        await copyToClipboard(fullAdminPostText, 'facebook');
        const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
          url
        )}&quote=${encodeURIComponent(shareText)}`;
        await openExternalUrl(fbUrl);
      },
    },
    {
      id: 'zalo',
      name: 'Zalo',
      sublabel: 'Chép mẫu & mở Zalo',
      badgeText: 'Zalo',
      bgColor: '#E8F4FF',
      textColor: '#0068FF',
      borderColor: '#B8DCFF',
      onPress: async () => {
        await copyToClipboard(fullAdminPostText, 'zalo');
        await openExternalUrl('https://chat.zalo.me');
      },
    },
    {
      id: 'messenger',
      name: 'Messenger',
      sublabel: 'Chép link & gửi tin',
      badgeText: 'Msg',
      bgColor: '#F2EEFF',
      textColor: '#7C3AED',
      borderColor: '#DDD2FF',
      onPress: async () => {
        await copyToClipboard(fullAdminPostText, 'messenger');
        await openExternalUrl('https://www.messenger.com');
      },
    },
    {
      id: 'threads',
      name: 'Threads',
      sublabel: 'Tạo bài đăng ngay',
      badgeText: '@',
      bgColor: '#F3F1EE',
      textColor: '#1F1B18',
      borderColor: '#D8D1C7',
      onPress: async () => {
        const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(
          fullAdminPostText
        )}`;
        await openExternalUrl(threadsUrl);
      },
    },
    {
      id: 'telegram',
      name: 'Telegram',
      sublabel: 'Chuyển tiếp nhanh',
      badgeText: 'TG',
      bgColor: '#EAF6FD',
      textColor: '#0284C7',
      borderColor: '#BAE0F9',
      onPress: async () => {
        const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
          url
        )}&text=${encodeURIComponent(shareText)}`;
        await openExternalUrl(tgUrl);
      },
    },
    {
      id: 'tiktok_ig',
      name: 'TikTok / IG',
      sublabel: 'Chép caption + link',
      badgeText: '♪',
      bgColor: '#FFF0F5',
      textColor: '#DB2777',
      borderColor: '#FBCFE8',
      onPress: async () => {
        await copyToClipboard(fullAdminPostText, 'tiktok_ig');
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.sheet}
          onPress={(e) => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.headerIconBadge}>
                <Share2 size={16} color="#4A3728" />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {type === 'website'
                    ? 'Chia sẻ Tiệm Cuộn Len (Admin)'
                    : 'Chia sẻ mẫu sản phẩm (Admin)'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Công cụ đăng bài & gửi mẫu nhanh cho chủ tiệm
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#4A3728" />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}>
            {/* Preview Card */}
            <View style={styles.previewCard}>
              {image ? (
                <Image
                  source={
                    typeof image === 'string' ? { uri: image } : (image as any)
                  }
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.previewEmojiBox}>
                  <Text style={{ fontSize: 28 }}>🧶</Text>
                </View>
              )}
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {title}
                </Text>
                {priceText ? (
                  <Text style={styles.previewPrice}>{priceText}</Text>
                ) : null}
                {subtitle ? (
                  <Text style={styles.previewSubtitle} numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Quick Copy Link Row */}
            <View style={styles.linkBox}>
              <View style={styles.linkTextCol}>
                <Text style={styles.linkLabel}>ĐƯỜNG DẪN CHÍNH THỨC</Text>
                <Text style={styles.linkUrl} numberOfLines={1}>
                  {url}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.copyLinkBtn,
                  copiedType === 'url' && styles.copyLinkBtnActive,
                ]}
                onPress={() => copyToClipboard(url, 'url')}
                activeOpacity={0.8}>
                {copiedType === 'url' ? (
                  <>
                    <Check size={14} color="#FFF" />
                    <Text style={styles.copyLinkBtnText}>Đã chép!</Text>
                  </>
                ) : (
                  <>
                    <Copy size={14} color="#FFF" />
                    <Text style={styles.copyLinkBtnText}>Chép link</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Copy Ready-made Caption + Link */}
            <TouchableOpacity
              style={[
                styles.captionBox,
                copiedType === 'caption' && styles.captionBoxActive,
              ]}
              onPress={() => copyToClipboard(fullAdminPostText, 'caption')}
              activeOpacity={0.82}>
              <View style={styles.captionHeaderRow}>
                <View style={styles.captionBadgeRow}>
                  <Sparkles size={13} color="#7A5230" />
                  <Text style={styles.captionTitle}>
                    BÀI ĐĂNG MẪU KÈM LINK (DÙNG CHO ZALO / FB / TIKTOK)
                  </Text>
                </View>
                <View style={styles.captionActionPill}>
                  {copiedType === 'caption' ? (
                    <>
                      <Check size={12} color="#166534" />
                      <Text style={[styles.captionActionText, { color: '#166534' }]}>
                        Đã sao chép bài mẫu
                      </Text>
                    </>
                  ) : (
                    <>
                      <FileText size={12} color="#4A3728" />
                      <Text style={styles.captionActionText}>Chép cả bài</Text>
                    </>
                  )}
                </View>
              </View>
              <Text style={styles.captionPreviewText} numberOfLines={3}>
                {fullAdminPostText}
              </Text>
            </TouchableOpacity>

            {/* Platform Grid */}
            <Text style={styles.sectionLabel}>CHỌN NỀN TẢNG CHIA SẺ</Text>
            <View style={styles.platformGrid}>
              {platforms.map((item) => {
                const isCopied = copiedType === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.platformCard,
                      {
                        backgroundColor: item.bgColor,
                        borderColor: item.borderColor,
                      },
                    ]}
                    onPress={item.onPress}
                    activeOpacity={0.8}>
                    <View
                      style={[
                        styles.platformBadge,
                        { borderColor: item.borderColor },
                      ]}>
                      <Text
                        style={[
                          styles.platformBadgeText,
                          { color: item.textColor },
                        ]}>
                        {item.badgeText}
                      </Text>
                    </View>
                    <View style={styles.platformMeta}>
                      <Text
                        style={[styles.platformName, { color: item.textColor }]}
                        numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.platformSub} numberOfLines={1}>
                        {isCopied ? '✓ Đã chép nội dung!' : item.sublabel}
                      </Text>
                    </View>
                    <ExternalLink size={13} color={item.textColor} />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Native / System Share Sheet Button */}
            <TouchableOpacity
              style={styles.systemShareBtn}
              onPress={handleNativeShare}
              activeOpacity={0.85}>
              <Share2 size={16} color="#4A3728" />
              <Text style={styles.systemShareBtnText}>
                Chia sẻ qua ứng dụng khác trên thiết bị (AirDrop, Tin nhắn...)
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(38, 26, 18, 0.48)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },

  /* ---- Minimal Client Styles ---- */
  clientSheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FAF7F2',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5D8C8',
    padding: 15,
    gap: 12,
    ...SHADOWS.medium,
  },
  clientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clientHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  closeBtnSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F0E7DC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFDF9',
    padding: 9,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#EAE0D3',
  },
  clientThumb: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#F3ECE2',
  },
  clientEmojiThumb: {
    width: 42,
    height: 42,
    borderRadius: 9,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  clientPrice: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#7A5230',
    marginTop: 2,
  },
  clientLinkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFDF9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2D4C4',
    paddingLeft: 11,
    paddingRight: 5,
    paddingVertical: 5,
    gap: 8,
  },
  clientLinkText: {
    flex: 1,
    fontSize: 12,
    color: '#6E5A4B',
  },
  clientCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#4A3728',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 9,
  },
  clientCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFF',
  },
  clientAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  clientAppItem: {
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  clientAppCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clientAppBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  clientAppLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A3728',
  },

  /* ---- Full Admin Styles ---- */
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: '#FAF7F2',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5D8C8',
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 15,
    backgroundColor: '#FFFDF9',
    borderBottomWidth: 1,
    borderBottomColor: '#EDE3D5',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3EAE0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C1',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.mediumText,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    padding: 18,
    gap: 14,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFDF9',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8DACB',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
  },
  previewEmojiBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2D2C1',
  },
  previewInfo: {
    flex: 1,
    gap: 3,
  },
  previewTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  previewPrice: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#8B5E3C',
  },
  previewSubtitle: {
    fontSize: 12,
    color: COLORS.mediumText,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D4C4',
    gap: 10,
  },
  linkTextCol: {
    flex: 1,
  },
  linkLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.lightText,
    letterSpacing: 0.5,
  },
  linkUrl: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#3D2B1F',
    marginTop: 2,
  },
  copyLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#4A3728',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 11,
  },
  copyLinkBtnActive: {
    backgroundColor: '#15803D',
  },
  copyLinkBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFF',
  },
  captionBox: {
    backgroundColor: '#F7EFE4',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2CFB8',
    gap: 6,
  },
  captionBoxActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#86EFAC',
  },
  captionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  captionBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  captionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6E4726',
  },
  captionActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DFCBB4',
  },
  captionActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3728',
  },
  captionPreviewText: {
    fontSize: 12,
    color: '#4A3728',
    lineHeight: 17,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.mediumText,
    letterSpacing: 0.6,
    marginTop: 2,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  platformCard: {
    width: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  platformBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  platformBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
  },
  platformMeta: {
    flex: 1,
  },
  platformName: {
    fontSize: 13,
    fontWeight: '800',
  },
  platformSub: {
    fontSize: 10.5,
    color: '#5C4A3E',
    marginTop: 1,
  },
  systemShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFE6DA',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DBCAB8',
    marginTop: 2,
  },
  systemShareBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4A3728',
  },
});
