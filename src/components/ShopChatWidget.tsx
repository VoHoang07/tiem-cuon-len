import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  ChevronLeft,
  Sparkles,
  ExternalLink,
  Users,
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
  'Mẫu này còn sẵn hàng không shop?',
  'Mình muốn đặt mẫu này theo màu riêng',
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
  const [adminViewMode, setAdminViewMode] = useState<'list' | 'chat'>('chat');

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

  // Auto-scroll to bottom when messages change or chat opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, displayedMessages.length, pendingProduct, adminViewMode]);

  // Hide widget on login/register pages to keep auth screens clean
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
    const pinged: PingedProduct = {
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image,
      category: p.category,
    };
    setPendingProduct(pinged);
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

  return (
    <View
      style={[
        styles.rootOverlay,
        isMobile ? styles.rootOverlayMobile : styles.rootOverlayDesktop,
      ]}
      pointerEvents="box-none">
      {/* Chat Window Popup */}
      {isOpen && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.chatWindow,
            isMobile ? styles.chatWindowMobile : styles.chatWindowDesktop,
            isAdmin && !isMobile && styles.chatWindowAdminDesktop,
          ]}>
          {/* Top Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {isAdmin && adminViewMode === 'chat' && (
                <TouchableOpacity
                  style={styles.backToListBtn}
                  onPress={() => setAdminViewMode('list')}
                  activeOpacity={0.75}>
                  <ChevronLeft size={18} color="#3D2B1F" />
                  {conversations.length > 1 && (
                    <Text style={styles.backToListCount}>{conversations.length}</Text>
                  )}
                </TouchableOpacity>
              )}

              <View style={styles.avatarCircle}>
                <Text style={styles.avatarEmoji}>{isAdmin ? '👩‍🎨' : '🧶'}</Text>
                <View style={styles.onlineDot} />
              </View>

              <View style={styles.headerTitleWrap}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {isAdmin
                    ? adminViewMode === 'list'
                      ? `Hộp thư khách hàng (${conversations.length})`
                      : activeAdminConversation?.customerName || 'Khách hàng'
                    : 'Chat với Tiệm Cuộn Len'}
                </Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  {isAdmin
                    ? adminViewMode === 'list'
                      ? 'Chọn cuộc trò chuyện để trả lời & tư vấn'
                      : activeAdminConversation?.customerEmail || 'Khách đang xem sản phẩm'
                    : 'Tư vấn mẫu len • Ping sản phẩm • Đặt hàng'}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              {isAdmin && (
                <TouchableOpacity
                  style={[
                    styles.headerModeBtn,
                    adminViewMode === 'list' && styles.headerModeBtnActive,
                  ]}
                  onPress={() =>
                    setAdminViewMode((m) => (m === 'list' ? 'chat' : 'list'))
                  }
                  activeOpacity={0.75}>
                  <Users size={15} color="#3D2B1F" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setIsOpen(false)}
                activeOpacity={0.75}>
                <X size={18} color="#3D2B1F" />
              </TouchableOpacity>
            </View>
          </View>

          {/* ADMIN CONVERSATION LIST MODE */}
          {isAdmin && adminViewMode === 'list' ? (
            <ScrollView
              style={styles.convListScroll}
              contentContainerStyle={styles.convListContent}
              showsVerticalScrollIndicator={false}>
              {conversations.map((conv) => {
                const isSelected =
                  conv.conversationId === activeAdminConversation?.conversationId;
                return (
                  <TouchableOpacity
                    key={conv.conversationId}
                    style={[
                      styles.convItem,
                      isSelected && styles.convItemSelected,
                    ]}
                    onPress={() => {
                      setActiveConversationId(conv.conversationId);
                      markConversationRead(conv.conversationId);
                      setAdminViewMode('chat');
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.convAvatar}>
                      <Text style={styles.convAvatarText}>
                        {conv.customerName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.convInfo}>
                      <View style={styles.convTopRow}>
                        <Text style={styles.convName} numberOfLines={1}>
                          {conv.customerName}
                        </Text>
                        <Text style={styles.convTime}>
                          {formatTime(conv.lastMessage.createdAt)}
                        </Text>
                      </View>
                      {conv.lastMessage.product && (
                        <View style={styles.convPingTag}>
                          <Tag size={11} color="#5C4332" />
                          <Text style={styles.convPingTagText} numberOfLines={1}>
                            Đã ping: {conv.lastMessage.product.name}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.convLastMsg} numberOfLines={1}>
                        {conv.lastMessage.senderRole === 'admin' ? 'Bạn: ' : ''}
                        {conv.lastMessage.text}
                      </Text>
                    </View>
                    {conv.unreadForAdmin > 0 && (
                      <View style={styles.convUnreadBadge}>
                        <Text style={styles.convUnreadText}>
                          {conv.unreadForAdmin}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            /* ACTIVE CHAT THREAD (Both Client & Admin) */
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.messagesScroll}
                contentContainerStyle={styles.messagesContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                {/* Intro helper banner */}
                <View style={styles.helperBanner}>
                  <Sparkles size={13} color="#5C4332" />
                  <Text style={styles.helperBannerText}>
                    {isAdmin
                      ? 'Bạn đang trả lời với tư cách Admin. Có thể bấm "Ping SP" để gửi gợi ý sản phẩm cho khách.'
                      : 'Bấm "Ping SP" bên dưới để đính kèm mẫu len bạn muốn hỏi hoặc đặt mua nhé!'}
                  </Text>
                </View>

                {displayedMessages.map((msg) => {
                  const isMine = isAdmin
                    ? msg.senderRole === 'admin'
                    : msg.senderRole === 'customer';

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
                          isMine
                            ? styles.messageBubbleMine
                            : styles.messageBubbleOther,
                        ]}>
                        <View style={styles.msgMetaTop}>
                          <Text
                            style={[
                              styles.msgSenderName,
                              isMine && styles.msgSenderNameMine,
                            ]}>
                            {msg.senderRole === 'admin'
                              ? '🧶 Tiệm Cuộn Len (Admin)'
                              : msg.senderName}
                          </Text>
                          <Text
                            style={[
                              styles.msgTime,
                              isMine && styles.msgTimeMine,
                            ]}>
                            {formatTime(msg.createdAt)}
                          </Text>
                        </View>

                        {/* Pinged Product Card inside Message Bubble */}
                        {msg.product && (
                          <TouchableOpacity
                            style={[
                              styles.pingedCardInBubble,
                              isMine && styles.pingedCardInBubbleMine,
                            ]}
                            onPress={() => handleNavigateToProduct(msg.product!.id)}
                            activeOpacity={0.85}>
                            <View style={styles.pingedThumbWrap}>
                              {msg.product.image ? (
                                <Image
                                  source={
                                    typeof msg.product.image === 'string'
                                      ? { uri: msg.product.image }
                                      : (msg.product.image as any)
                                  }
                                  style={styles.pingedThumb}
                                  resizeMode="cover"
                                />
                              ) : (
                                <Text style={{ fontSize: 20 }}>
                                  {getCategoryEmoji(msg.product.category as any)}
                                </Text>
                              )}
                            </View>
                            <View style={styles.pingedCardInfo}>
                              <View style={styles.pingedTagRow}>
                                <Tag size={10} color="#5C4332" />
                                <Text style={styles.pingedTagLabel}>
                                  SẢN PHẨM ĐƯỢC PING
                                </Text>
                              </View>
                              <Text style={styles.pingedProductName} numberOfLines={1}>
                                {msg.product.name}
                              </Text>
                              <Text style={styles.pingedProductPrice}>
                                {formatVND(msg.product.price)}
                              </Text>
                            </View>
                            <View style={styles.pingedViewBtn}>
                              <ExternalLink size={14} color="#3D2B1F" />
                            </View>
                          </TouchableOpacity>
                        )}

                        <Text
                          style={[
                            styles.messageText,
                            isMine ? styles.messageTextMine : styles.messageTextOther,
                          ]}>
                          {msg.text}
                        </Text>

                        {isMine && (
                          <View style={styles.readReceiptRow}>
                            <CheckCheck size={12} color="rgba(61,43,31,0.6)" />
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Collapsible Product Ping Picker */}
              {showProductPicker && (
                <View style={styles.pickerDrawer}>
                  <View style={styles.pickerHeader}>
                    <Text style={styles.pickerTitle}>
                      🏷️ Chọn sản phẩm để Ping vào cuộc trò chuyện
                    </Text>
                    <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                      <X size={16} color={COLORS.mediumText} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.pickerSearchBox}>
                    <Search size={14} color={COLORS.mediumText} />
                    <TextInput
                      style={styles.pickerSearchInput}
                      placeholder="Tìm tên sản phẩm..."
                      placeholderTextColor={COLORS.lightText}
                      value={pickerSearch}
                      onChangeText={setPickerSearch}
                    />
                    {pickerSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setPickerSearch('')}>
                        <X size={14} color={COLORS.mediumText} />
                      </TouchableOpacity>
                    )}
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.pickerHorizontalList}
                    keyboardShouldPersistTaps="handled">
                    {filteredPickerProducts.map((p) => {
                      const isSelected = pendingProduct?.id === p.id;
                      return (
                        <TouchableOpacity
                          key={p.id}
                          style={[
                            styles.pickerProductCard,
                            isSelected && styles.pickerProductCardSelected,
                          ]}
                          onPress={() => handleSelectProductToPing(p)}
                          activeOpacity={0.8}>
                          <View style={styles.pickerProductImgWrap}>
                            {p.image ? (
                              <Image
                                source={
                                  typeof p.image === 'string'
                                    ? { uri: p.image }
                                    : (p.image as any)
                                }
                                style={styles.pickerProductImg}
                                resizeMode="cover"
                              />
                            ) : (
                              <Text style={{ fontSize: 22 }}>
                                {getCategoryEmoji(p.category)}
                              </Text>
                            )}
                          </View>
                          <Text style={styles.pickerProductName} numberOfLines={1}>
                            {p.name}
                          </Text>
                          <Text style={styles.pickerProductPrice}>
                            {formatVND(p.price)}
                          </Text>
                          <View style={styles.pickerPingBadge}>
                            <Text style={styles.pickerPingBadgeText}>
                              {isSelected ? '✓ Đã chọn' : '+ Ping mẫu này'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Currently Attached / Pinged Product Preview above Input */}
              {pendingProduct && (
                <View style={styles.pendingPingBar}>
                  <View style={styles.pendingPingThumbWrap}>
                    {pendingProduct.image ? (
                      <Image
                        source={
                          typeof pendingProduct.image === 'string'
                            ? { uri: pendingProduct.image }
                            : (pendingProduct.image as any)
                        }
                        style={styles.pendingPingThumb}
                        resizeMode="cover"
                      />
                    ) : (
                      <Text style={{ fontSize: 18 }}>
                        {getCategoryEmoji(pendingProduct.category as any)}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pendingPingInfo}>
                    <Text style={styles.pendingPingLabel}>
                      📌 Đang ping sản phẩm:
                    </Text>
                    <Text style={styles.pendingPingName} numberOfLines={1}>
                      {pendingProduct.name} • {formatVND(pendingProduct.price)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.pendingPingRemove}
                    onPress={() => setPendingProduct(null)}>
                    <X size={15} color="#3D2B1F" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Quick Prompts / Replies Strip */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.quickPromptsRow}
                keyboardShouldPersistTaps="handled">
                {(isAdmin ? ADMIN_QUICK_REPLIES : CLIENT_QUICK_PROMPTS).map(
                  (prompt) => (
                    <TouchableOpacity
                      key={prompt}
                      style={styles.quickPromptChip}
                      onPress={() => handleQuickPrompt(prompt)}
                      activeOpacity={0.75}>
                      <Text style={styles.quickPromptText}>{prompt}</Text>
                    </TouchableOpacity>
                  )
                )}
              </ScrollView>

              {/* Input Row */}
              <View style={styles.inputRow}>
                <TouchableOpacity
                  style={[
                    styles.pingToggleBtn,
                    (showProductPicker || pendingProduct) &&
                      styles.pingToggleBtnActive,
                  ]}
                  onPress={() => setShowProductPicker((v) => !v)}
                  activeOpacity={0.8}>
                  <Tag size={15} color="#3D2B1F" />
                  <Text style={styles.pingToggleText}>Ping SP</Text>
                </TouchableOpacity>

                <TextInput
                  style={styles.chatInput}
                  placeholder={
                    isAdmin
                      ? 'Nhập phản hồi cho khách...'
                      : 'Nhắn hỏi thông tin hoặc đặt hàng...'
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
                  <Send size={16} color="#FAF5EE" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </KeyboardAvoidingView>
      )}

      {/* Floating Bottom-Right Launcher Button */}
      <TouchableOpacity
        style={[
          styles.launcherBtn,
          isMobile && styles.launcherBtnMobile,
          isOpen && styles.launcherBtnOpen,
        ]}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.85}>
        <View style={styles.launcherIconWrap}>
          {isOpen ? (
            <X size={22} color="#FAF5EE" />
          ) : (
            <MessageCircle size={22} color="#FAF5EE" fill="rgba(250,245,238,0.18)" />
          )}
          {!isOpen && unreadCount > 0 && (
            <View style={styles.launcherBadge}>
              <Text style={styles.launcherBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </View>

        {!isOpen && (
          <View style={styles.launcherTextWrap}>
            <Text style={styles.launcherTitle}>
              {isAdmin ? 'Tin nhắn khách' : isMobile ? 'Chat Shop' : 'Chat với Tiệm'}
            </Text>
            {!isMobile && (
              <Text style={styles.launcherSub}>
                {isAdmin
                  ? unreadCount > 0
                    ? `${unreadCount} tin nhắn mới`
                    : 'Hỗ trợ & nhận đơn'
                  : 'Hỏi mẫu & đặt hàng'}
              </Text>
            )}
          </View>
        )}
      </TouchableOpacity>
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
    right: 22,
    bottom: 22,
  },
  rootOverlayMobile: {
    right: 12,
    bottom: 76,
    left: 12,
  },
  launcherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#3D2B1F',
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    ...SHADOWS.large,
  },
  launcherBtnMobile: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 26,
  },
  launcherBtnOpen: {
    paddingHorizontal: 13,
    paddingVertical: 13,
    borderRadius: 26,
  },
  launcherIconWrap: {
    position: 'relative',
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  launcherBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 19,
    height: 19,
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
    fontSize: 13.5,
    fontWeight: '800',
  },
  launcherSub: {
    color: '#D8C3AD',
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 1,
  },

  chatWindow: {
    backgroundColor: '#FAF5EE',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D8C3AD',
    overflow: 'hidden',
    marginBottom: 12,
    ...SHADOWS.large,
  },
  chatWindowDesktop: {
    width: 390,
    height: 550,
  },
  chatWindowAdminDesktop: {
    width: 420,
    height: 570,
  },
  chatWindowMobile: {
    width: '100%',
    height: 490,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#D8C3AD',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#C4AA90',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
    minWidth: 0,
  },
  backToListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  backToListCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  avatarCircle: {
    position: 'relative',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FAF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  avatarEmoji: {
    fontSize: 19,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
    borderWidth: 1.5,
    borderColor: '#FAF5EE',
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C4332',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerModeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(250, 245, 238, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  headerModeBtnActive: {
    backgroundColor: '#FAF5EE',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(250, 245, 238, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  convListScroll: {
    flex: 1,
  },
  convListContent: {
    padding: 12,
    gap: 8,
  },
  convItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFDF9',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  convItemSelected: {
    backgroundColor: '#F3ECE2',
    borderColor: '#C4AA90',
  },
  convAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#D8C3AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  convAvatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#3D2B1F',
  },
  convInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  convTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  convTime: {
    fontSize: 11,
    color: COLORS.lightText,
  },
  convPingTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  convPingTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#5C4332',
  },
  convLastMsg: {
    fontSize: 12.5,
    color: COLORS.mediumText,
  },
  convUnreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  convUnreadText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '800',
  },

  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
    gap: 10,
  },
  helperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    marginBottom: 2,
  },
  helperBannerText: {
    flex: 1,
    fontSize: 11.5,
    color: '#5C4332',
    lineHeight: 16,
    fontWeight: '600',
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
    maxWidth: '84%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 5,
  },
  messageBubbleMine: {
    backgroundColor: '#D8C3AD',
    borderBottomRightRadius: 5,
    borderWidth: 1,
    borderColor: '#C4AA90',
  },
  messageBubbleOther: {
    backgroundColor: '#FFFDF9',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: '#E5D6C5',
  },
  msgMetaTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  msgSenderName: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#765341',
  },
  msgSenderNameMine: {
    color: '#3D2B1F',
  },
  msgTime: {
    fontSize: 10,
    color: COLORS.lightText,
  },
  msgTimeMine: {
    color: '#5C4332',
  },

  pingedCardInBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: '#FAF5EE',
    padding: 8,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#DFCBB5',
    marginVertical: 2,
  },
  pingedCardInBubbleMine: {
    backgroundColor: '#FFFDF9',
  },
  pingedThumbWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pingedThumb: {
    width: '100%',
    height: '100%',
  },
  pingedCardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  pingedTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pingedTagLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#765341',
    letterSpacing: 0.4,
  },
  pingedProductName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  pingedProductPrice: {
    fontSize: 12,
    fontWeight: '900',
    color: COLORS.primary,
  },
  pingedViewBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  messageTextMine: {
    color: '#2A1D15',
    fontWeight: '600',
  },
  messageTextOther: {
    color: COLORS.darkText,
  },
  readReceiptRow: {
    alignItems: 'flex-end',
    marginTop: -2,
  },

  pickerDrawer: {
    backgroundColor: '#F3ECE2',
    borderTopWidth: 1,
    borderTopColor: '#DFCBB5',
    paddingVertical: 9,
    gap: 7,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  pickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFDF9',
    marginHorizontal: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12.5,
    color: COLORS.darkText,
    paddingVertical: 2,
  },
  pickerHorizontalList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  pickerProductCard: {
    width: 118,
    backgroundColor: '#FFFDF9',
    borderRadius: 14,
    padding: 7,
    borderWidth: 1,
    borderColor: '#E2D2C0',
    gap: 3,
  },
  pickerProductCardSelected: {
    borderColor: '#3D2B1F',
    borderWidth: 1.5,
    backgroundColor: '#FAF5EE',
  },
  pickerProductImgWrap: {
    width: '100%',
    height: 68,
    borderRadius: 10,
    backgroundColor: '#F3ECE2',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickerProductImg: {
    width: '100%',
    height: '100%',
  },
  pickerProductName: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3D2B1F',
  },
  pickerProductPrice: {
    fontSize: 11.5,
    fontWeight: '900',
    color: COLORS.primary,
  },
  pickerPingBadge: {
    backgroundColor: '#D8C3AD',
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: 'center',
    marginTop: 2,
  },
  pickerPingBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#3D2B1F',
  },

  pendingPingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: '#E2D2C0',
  },
  pendingPingThumbWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FFFDF9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pendingPingThumb: {
    width: '100%',
    height: '100%',
  },
  pendingPingInfo: {
    flex: 1,
    minWidth: 0,
  },
  pendingPingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#765341',
  },
  pendingPingName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  pendingPingRemove: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5D6C5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  quickPromptsRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: '#FAF5EE',
    borderTopWidth: 1,
    borderTopColor: '#EFE4D6',
  },
  quickPromptChip: {
    backgroundColor: '#FFFDF9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2D2C0',
  },
  quickPromptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5C4332',
  },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#FFFDF9',
    borderTopWidth: 1,
    borderTopColor: '#E5D6C5',
  },
  pingToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3ECE2',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DFCBB5',
  },
  pingToggleBtnActive: {
    backgroundColor: '#D8C3AD',
    borderColor: '#B89B7D',
  },
  pingToggleText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#3D2B1F',
  },
  chatInput: {
    flex: 1,
    fontSize: 13.5,
    color: COLORS.darkText,
    backgroundColor: '#FAF5EE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5D6C5',
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
