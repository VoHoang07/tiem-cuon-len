import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  StyleSheet,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  MessageCircle,
  X,
  Send,
  Tag,
  ExternalLink,
  CheckCheck,
  Search,
} from 'lucide-react-native';
import { useChat } from '@/store/ChatContext';
import { useShop } from '@/store/ShopContext';
import { useAuth } from '@/store/AuthContext';
import { COLORS, SHADOWS } from '@/constants/theme';
import { formatVND } from '@/utils/formatCurrency';
import { getCategoryEmoji } from '@/utils/getCategoryEmoji';
import { PingedProduct, ChatMessage } from '@/types/chat';

const CLIENT_QUICK_PROMPTS = [
  'Mẫu này còn sẵn không shop?',
  'Đặt làm theo màu riêng được không?',
  'Cho mình đặt mua mẫu này nhé!',
];

const ADMIN_QUICK_REPLIES = [
  'Dạ mẫu này tiệm đang sẵn hàng ạ 🧶',
  'Tiệm nhận đan theo màu bạn chọn nhé!',
  'Bạn nhắn SĐT & địa chỉ để tiệm lên đơn nha!',
];

export function ShopChatWidget() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    isOpen,
    setIsOpen,
    pendingProduct,
    setPendingProduct,
    sendMessage,
    conversations,
    myMessages,
    activeConversationId,
    setActiveConversationId,
    markConversationRead,
    unreadCount,
  } = useChat();
  const { products } = useShop();
  const { role } = useAuth();
  const isAdmin = role === 'admin';

  const { width: rawWindowWidth } = useWindowDimensions();
  const windowWidth =
    rawWindowWidth > 0
      ? rawWindowWidth
      : typeof window !== 'undefined' && window.innerWidth > 0
      ? window.innerWidth
      : 1024;
  const isMobile = windowWidth < 640;

  const [inputText, setInputText] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const scrollRef = useRef<ScrollView | null>(null);

  // Deduplicate products for picker
  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return products.filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [products]);

  const filteredPickerProducts = useMemo(() => {
    if (!pickerSearch.trim()) return uniqueProducts;
    const q = pickerSearch.toLowerCase();
    return uniqueProducts.filter((p) => p.name.toLowerCase().includes(q));
  }, [uniqueProducts, pickerSearch]);

  // Resolve product thumbnail dynamically from loaded products so chat payload stays tiny
  const resolveProductImage = useCallback(
    (pinged?: PingedProduct | null) => {
      if (!pinged) return null;
      if (pinged.image && (typeof pinged.image !== 'string' || pinged.image.length > 0)) {
        return pinged.image;
      }
      const match = products.find(
        (p) =>
          p.id === pinged.id ||
          p.name.trim().toLowerCase() === pinged.name.trim().toLowerCase()
      );
      return match?.image ?? null;
    },
    [products]
  );

  const activeAdminConversation = useMemo(() => {
    if (!isAdmin) return null;
    return (
      conversations.find((c) => c.conversationId === activeConversationId) ??
      conversations[0] ??
      null
    );
  }, [isAdmin, conversations, activeConversationId]);

  const displayedMessages: ChatMessage[] = useMemo(() => {
    if (isAdmin) {
      return activeAdminConversation ? activeAdminConversation.messages : [];
    }
    return myMessages;
  }, [isAdmin, activeAdminConversation, myMessages]);

  // Show quick suggestion chips only when starting out or when a product is pinged
  const showQuickChips = useMemo(() => {
    if (showProductPicker) return false;
    if (pendingProduct) return true;
    return displayedMessages.length <= 2;
  }, [showProductPicker, pendingProduct, displayedMessages.length]);

  // Auto-scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen, displayedMessages.length, pendingProduct, activeAdminConversation?.conversationId]);

  // Hide widget on login/register pages
  const normalizedRoute = pathname.replace(/^\//, '');
  if (normalizedRoute === 'login' || normalizedRoute === 'register') {
    return null;
  }

  const handleSend = () => {
    if (!inputText.trim() && !pendingProduct) return;
    sendMessage(
      inputText,
      pendingProduct,
      isAdmin ? activeAdminConversation?.conversationId : undefined
    );
    setInputText('');
    setShowProductPicker(false);
  };

  const handleQuickPrompt = (promptText: string) => {
    sendMessage(
      promptText,
      pendingProduct,
      isAdmin ? activeAdminConversation?.conversationId : undefined
    );
    setShowProductPicker(false);
  };

  const handleSelectProductToPing = (p: (typeof products)[number]) => {
    setPendingProduct({
      id: p.id,
      name: p.name,
      price: p.price,
      image: typeof p.image === 'string' && p.image.length < 500 ? p.image : null,
      category: p.category,
    });
    setShowProductPicker(false);
  };

  const handleNavigateToProduct = (productId: string) => {
    setIsOpen(false);
    router.push(`/product/${productId}`);
  };

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const pendingThumb = resolveProductImage(pendingProduct);

  return (
    <View
      style={[
        styles.rootOverlay,
        isMobile ? styles.rootOverlayMobile : styles.rootOverlayDesktop,
      ]}
      pointerEvents="box-none">
      {isOpen ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.chatWindow,
            isMobile ? styles.chatWindowMobile : styles.chatWindowDesktop,
          ]}>
          {/* Clean Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{isAdmin ? '💬' : '🧶'}</Text>
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {isAdmin
                    ? activeAdminConversation
                      ? `Khách: ${activeAdminConversation.customerName}`
                      : 'Hộp thư khách hàng'
                    : 'Tiệm Cuộn Len'}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {isAdmin
                    ? conversations.length > 0
                      ? `${conversations.length} cuộc trò chuyện đang hoạt động`
                      : 'Đang chờ tin nhắn từ khách hàng'
                    : 'Đang trực tuyến • Tư vấn & đặt mẫu'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setIsOpen(false)}
              activeOpacity={0.75}>
              <X size={18} color="#3D2B1F" />
            </TouchableOpacity>
          </View>

          {/* Admin Customer Switcher Bar (Fixed 42px height, never stretches) */}
          {isAdmin && conversations.length > 0 && (
            <View style={styles.adminTabsBar}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.adminTabsScroll}>
                {conversations.map((conv) => {
                  const isSelected =
                    conv.conversationId === activeAdminConversation?.conversationId;
                  return (
                    <TouchableOpacity
                      key={conv.conversationId}
                      style={[
                        styles.adminTabPill,
                        isSelected && styles.adminTabPillActive,
                      ]}
                      onPress={() => {
                        setActiveConversationId(conv.conversationId);
                        markConversationRead(conv.conversationId);
                      }}
                      activeOpacity={0.8}>
                      <Text
                        style={[
                          styles.adminTabText,
                          isSelected && styles.adminTabTextActive,
                        ]}
                        numberOfLines={1}>
                        {conv.customerName}
                      </Text>
                      {conv.unreadForAdmin > 0 && (
                        <View style={styles.adminTabBadge}>
                          <Text style={styles.adminTabBadgeText}>
                            {conv.unreadForAdmin}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Main Messages Area (flex: 1) */}
          <ScrollView
            ref={scrollRef}
            style={styles.messagesScroll}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {isAdmin && displayedMessages.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateEmoji}>🧶</Text>
                <Text style={styles.emptyStateTitle}>Chưa có tin nhắn nào</Text>
                <Text style={styles.emptyStateSub}>
                  Khi khách hàng nhắn tin hoặc ping sản phẩm, cuộc trò chuyện sẽ hiện ngay tại đây theo thời gian thực.
                </Text>
              </View>
            ) : (
              displayedMessages.map((msg) => {
                const isMine = isAdmin
                  ? msg.senderRole === 'admin'
                  : msg.senderRole === 'customer';
                const productImg = resolveProductImage(msg.product);

                return (
                  <View
                    key={msg.id}
                    style={[
                      styles.messageRow,
                      isMine ? styles.messageRowMine : styles.messageRowOther,
                    ]}>
                    <View
                      style={[
                        styles.messageBubble,
                        isMine ? styles.messageBubbleMine : styles.messageBubbleOther,
                      ]}>
                      {!isMine && (
                        <Text style={styles.senderLabel}>
                          {msg.senderRole === 'admin'
                            ? '🧶 Tiệm Cuộn Len'
                            : msg.senderName}
                        </Text>
                      )}

                      {/* Pinged Product Card inside Bubble */}
                      {msg.product && (
                        <TouchableOpacity
                          style={[
                            styles.pingedCard,
                            isMine ? styles.pingedCardMine : styles.pingedCardOther,
                          ]}
                          onPress={() => handleNavigateToProduct(msg.product!.id)}
                          activeOpacity={0.85}>
                          <View style={styles.pingedThumbBox}>
                            {productImg ? (
                              <Image
                                source={
                                  typeof productImg === 'string'
                                    ? { uri: productImg }
                                    : (productImg as any)
                                }
                                style={styles.pingedThumb}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={{ fontSize: 18 }}>
                                {getCategoryEmoji(msg.product.category as any)}
                              </Text>
                            )}
                          </View>
                          <View style={styles.pingedMeta}>
                            <Text
                              style={[
                                styles.pingedName,
                                isMine && styles.pingedNameMine,
                              ]}
                              numberOfLines={1}>
                              {msg.product.name}
                            </Text>
                            <Text
                              style={[
                                styles.pingedPrice,
                                isMine && styles.pingedPriceMine,
                              ]}>
                              {formatVND(msg.product.price)}
                            </Text>
                          </View>
                          <ExternalLink
                            size={13}
                            color={isMine ? '#FAF5EE' : '#5C4332'}
                          />
                        </TouchableOpacity>
                      )}

                      <Text
                        style={[
                          styles.messageText,
                          isMine ? styles.messageTextMine : styles.messageTextOther,
                        ]}>
                        {msg.text}
                      </Text>

                      <View style={styles.msgFooter}>
                        <Text
                          style={[
                            styles.msgTime,
                            isMine ? styles.msgTimeMine : styles.msgTimeOther,
                          ]}>
                          {formatTime(msg.createdAt)}
                        </Text>
                        {isMine && (
                          <CheckCheck size={12} color="rgba(250,245,238,0.75)" />
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Collapsible Product Picker (Fixed height, never stretches) */}
          {showProductPicker && (
            <View style={styles.pickerDrawer}>
              <View style={styles.pickerSearchRow}>
                <View style={styles.pickerSearchBox}>
                  <Search size={13} color={COLORS.mediumText} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Tìm sản phẩm để đính kèm..."
                    placeholderTextColor={COLORS.lightText}
                    value={pickerSearch}
                    onChangeText={setPickerSearch}
                  />
                </View>
                <TouchableOpacity
                  style={styles.pickerCloseBtn}
                  onPress={() => setShowProductPicker(false)}>
                  <X size={15} color="#3D2B1F" />
                </TouchableOpacity>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pickerList}
                keyboardShouldPersistTaps="handled">
                {filteredPickerProducts.map((p) => {
                  const isSelected = pendingProduct?.id === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[
                        styles.pickerCard,
                        isSelected && styles.pickerCardSelected,
                      ]}
                      onPress={() => handleSelectProductToPing(p)}
                      activeOpacity={0.8}>
                      <View style={styles.pickerImgBox}>
                        {p.image ? (
                          <Image
                            source={
                              typeof p.image === 'string'
                                ? { uri: p.image }
                                : (p.image as any)
                            }
                            style={styles.pickerImg}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={{ fontSize: 16 }}>
                            {getCategoryEmoji(p.category)}
                          </Text>
                        )}
                      </View>
                      <View style={styles.pickerCardInfo}>
                        <Text style={styles.pickerCardName} numberOfLines={1}>
                          {p.name}
                        </Text>
                        <Text style={styles.pickerCardPrice}>
                          {formatVND(p.price)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Attached Product Preview Bar (Fixed height) */}
          {pendingProduct && (
            <View style={styles.pendingBar}>
              <View style={styles.pendingThumbBox}>
                {pendingThumb ? (
                  <Image
                    source={
                      typeof pendingThumb === 'string'
                        ? { uri: pendingThumb }
                        : (pendingThumb as any)
                    }
                    style={styles.pendingThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={{ fontSize: 15 }}>
                    {getCategoryEmoji(pendingProduct.category as any)}
                  </Text>
                )}
              </View>
              <View style={styles.pendingInfo}>
                <Text style={styles.pendingName} numberOfLines={1}>
                  📌 {pendingProduct.name}
                </Text>
                <Text style={styles.pendingPrice}>
                  {formatVND(pendingProduct.price)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.pendingSendNowBtn}
                onPress={handleSend}
                activeOpacity={0.8}>
                <Text style={styles.pendingSendNowText}>Gửi SP</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pendingClearBtn}
                onPress={() => setPendingProduct(null)}>
                <X size={14} color="#3D2B1F" />
              </TouchableOpacity>
            </View>
          )}

          {/* Compact Single-Line Quick Prompts (Fixed 36px wrapper so it NEVER expands) */}
          {showQuickChips && (
            <View style={styles.quickBarWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickBarContent}
                keyboardShouldPersistTaps="handled">
                {(isAdmin ? ADMIN_QUICK_REPLIES : CLIENT_QUICK_PROMPTS).map(
                  (prompt) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.quickChip}
                      onPress={() => handleQuickPrompt(prompt)}
                      activeOpacity={0.75}>
                      <Text style={styles.quickChipText}>{prompt}</Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>
            </View>
          )}

          {/* Bottom Input Bar */}
          <View style={styles.inputBar}>
            <TouchableOpacity
              style={[
                styles.pingBtn,
                (showProductPicker || pendingProduct) && styles.pingBtnActive,
              ]}
              onPress={() => setShowProductPicker((v) => !v)}
              activeOpacity={0.8}>
              <Tag size={14} color="#3D2B1F" />
              <Text style={styles.pingBtnText}>+ SP</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder={
                isAdmin ? 'Trả lời khách hàng...' : 'Nhắn tin cho tiệm...'
              }
              placeholderTextColor={COLORS.lightText}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                !inputText.trim() && !pendingProduct && styles.sendBtnDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim() && !pendingProduct}
              activeOpacity={0.8}>
              <Send size={15} color="#FAF5EE" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        /* Floating Launcher Button when closed */
        <TouchableOpacity
          style={[styles.launcherBtn, isMobile && styles.launcherBtnMobile]}
          onPress={() => setIsOpen(true)}
          activeOpacity={0.85}>
          <View style={styles.launcherIconWrap}>
            <MessageCircle
              size={20}
              color="#FAF5EE"
              fill="rgba(250,245,238,0.18)"
            />
            {unreadCount > 0 && (
              <View style={styles.launcherBadge}>
                <Text style={styles.launcherBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.launcherTextWrap}>
            <Text style={styles.launcherTitle}>
              {isAdmin
                ? 'Hộp thư khách'
                : isMobile
                ? 'Chat Shop'
                : 'Chat với Tiệm'}
            </Text>
            {!isMobile && (
              <Text style={styles.launcherSub}>
                {isAdmin
                  ? unreadCount > 0
                    ? `${unreadCount} tin nhắn mới`
                    : `${conversations.length} cuộc trò chuyện`
                  : 'Hỏi mẫu & đặt hàng'}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rootOverlay: {
    position: 'absolute',
    zIndex: 250,
    alignItems: 'flex-end',
  },
  rootOverlayDesktop: {
    right: 20,
    bottom: 20,
  },
  rootOverlayMobile: {
    right: 12,
    left: 12,
    bottom: 78,
  },

  /* Launcher Button */
  launcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    ...SHADOWS.large,
  },
  launcherBtnMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
  },
  launcherIconWrap: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FAF5EE',
  },
  launcherBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '900',
  },
  launcherTextWrap: {
    paddingRight: 2,
  },
  launcherTitle: {
    color: '#FAF5EE',
    fontSize: 13,
    fontWeight: '800',
  },
  launcherSub: {
    color: '#D8C3AD',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },

  /* Chat Window */
  chatWindow: {
    backgroundColor: '#FAF5EE',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    overflow: 'hidden',
    flexDirection: 'column',
    ...SHADOWS.large,
  },
  chatWindowDesktop: {
    width: 375,
    height: 500,
  },
  chatWindowMobile: {
    width: '100%',
    height: 450,
  },

  /* Header */
  header: {
    height: 58,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#C9B29B',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatarCircle: {
    position: 'relative',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  avatarEmoji: {
    fontSize: 17,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#2E7D32',
    borderWidth: 1.5,
    borderColor: '#FAF5EE',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C1E14',
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#5C4332',
    marginTop: 1,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(250,245,238,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Admin Customer Switcher Bar */
  adminTabsBar: {
    height: 42,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#F2E8DC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2D2C0',
    justifyContent: 'center',
  },
  adminTabsScroll: {
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  adminTabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    backgroundColor: '#FAF5EE',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  adminTabPillActive: {
    backgroundColor: '#3D2B1F',
    borderColor: '#3D2B1F',
  },
  adminTabText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
    maxWidth: 110,
  },
  adminTabTextActive: {
    color: '#FAF5EE',
  },
  adminTabBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTabBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: COLORS.white,
  },

  /* Messages Stream */
  messagesScroll: {
    flex: 1,
    backgroundColor: '#FAF5EE',
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  emptyStateBox: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3D2B1F',
    marginBottom: 4,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#7A6252',
    textAlign: 'center',
    lineHeight: 17,
  },
  messageRow: {
    flexDirection: 'row',
    width: '100%',
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageRowOther: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 16,
  },
  messageBubbleMine: {
    backgroundColor: '#3D2B1F',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5D5C3',
  },
  senderLabel: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#7A5C44',
    marginBottom: 3,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageTextMine: {
    color: '#FAF5EE',
  },
  messageTextOther: {
    color: '#2C1E14',
  },
  msgFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 3,
  },
  msgTime: {
    fontSize: 9.5,
  },
  msgTimeMine: {
    color: 'rgba(250,245,238,0.68)',
  },
  msgTimeOther: {
    color: '#9A8270',
  },

  /* Pinged Product Card inside Bubble */
  pingedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 7,
    borderRadius: 11,
    marginBottom: 6,
    borderWidth: 1,
  },
  pingedCardMine: {
    backgroundColor: 'rgba(250,245,238,0.12)',
    borderColor: 'rgba(216,195,173,0.35)',
  },
  pingedCardOther: {
    backgroundColor: '#FAF5EE',
    borderColor: '#DFCBB5',
  },
  pingedThumbBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#EFE6DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingedThumb: {
    width: '100%',
    height: '100%',
  },
  pingedMeta: {
    flex: 1,
    minWidth: 0,
  },
  pingedName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2C1E14',
  },
  pingedNameMine: {
    color: '#FAF5EE',
  },
  pingedPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6D4C3D',
    marginTop: 1,
  },
  pingedPriceMine: {
    color: '#D8C3AD',
  },

  /* Product Picker Drawer */
  pickerDrawer: {
    height: 122,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#F3ECE2',
    borderTopWidth: 1,
    borderTopColor: '#DFCBB5',
    paddingVertical: 7,
  },
  pickerSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 6,
    gap: 6,
  },
  pickerSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 28,
    gap: 5,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 11.5,
    color: '#2C1E14',
    paddingVertical: 0,
  },
  pickerCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E7D8C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerList: {
    paddingHorizontal: 10,
    gap: 7,
    alignItems: 'center',
  },
  pickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 175,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 11,
    padding: 6,
    gap: 7,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  pickerCardSelected: {
    borderColor: '#3D2B1F',
    backgroundColor: '#FAF5EE',
  },
  pickerImgBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerImg: {
    width: '100%',
    height: '100%',
  },
  pickerCardInfo: {
    flex: 1,
    minWidth: 0,
  },
  pickerCardName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2C1E14',
  },
  pickerCardPrice: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6D4C3D',
    marginTop: 2,
  },

  /* Pending Attached Product Bar */
  pendingBar: {
    height: 50,
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    backgroundColor: '#EFE5D8',
    borderTopWidth: 1,
    borderTopColor: '#D8C3AD',
  },
  pendingThumbBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingThumb: {
    width: '100%',
    height: '100%',
  },
  pendingInfo: {
    flex: 1,
    minWidth: 0,
  },
  pendingName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2C1E14',
  },
  pendingPrice: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#6D4C3D',
  },
  pendingSendNowBtn: {
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  pendingSendNowText: {
    color: '#FAF5EE',
    fontSize: 11,
    fontWeight: '700',
  },
  pendingClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Compact Quick Prompts Wrapper (Fixed 36px height!) */
  quickBarWrapper: {
    height: 36,
    flexShrink: 0,
    flexGrow: 0,
    backgroundColor: '#FAF5EE',
    borderTopWidth: 1,
    borderTopColor: '#EFE5D8',
    justifyContent: 'center',
  },
  quickBarContent: {
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  quickChip: {
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#DFCBB5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4A3525',
  },

  /* Bottom Input Bar */
  inputBar: {
    height: 54,
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5D5C3',
  },
  pingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: '#F3ECE2',
    borderWidth: 1,
    borderColor: '#D8C3AD',
  },
  pingBtnActive: {
    backgroundColor: '#D8C3AD',
    borderColor: '#B59A7E',
  },
  pingBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  textInput: {
    flex: 1,
    height: 36,
    backgroundColor: '#FAF5EE',
    borderRadius: 18,
    paddingHorizontal: 13,
    fontSize: 12.5,
    color: '#2C1E14',
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3D2B1F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
});
