import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { ChatMessage, ChatConversation, PingedProduct } from '@/types/chat';
import { Product } from '@/types/product';
import { useAuth } from '@/store/AuthContext';
import { supabase } from '@/services/supabase';
import { MOCK_PRODUCTS } from '@/data/products';

const CHAT_STORAGE_KEY = 'tcl_chat_messages_v1';
const GUEST_ID_KEY = 'tcl_chat_guest_id_v1';
const BROADCAST_CHANNEL_NAME = 'tcl_live_chat_channel_v1';

function getOrCreateGuestId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(GUEST_ID_KEY);
      if (existing) return existing;
      const created = `guest_${Math.random().toString(36).slice(2, 9)}`;
      window.localStorage.setItem(GUEST_ID_KEY, created);
      return created;
    }
  } catch {
    // ignore
  }
  return 'guest_visitor';
}

function createInitialMessages(): ChatMessage[] {
  const sampleProduct = MOCK_PRODUCTS[0];
  return [
    {
      id: 'msg_seed_1',
      conversationId: 'demo_khach_minh_anh',
      customerName: 'Minh Anh',
      customerEmail: 'minhanh@gmail.com',
      senderRole: 'customer',
      senderName: 'Minh Anh',
      text: 'Shop ơi mẫu móc khoá cherry này còn sẵn hàng giao trong tuần không ạ? Mình muốn đặt 2 cặp làm quà tặng!',
      product: sampleProduct
        ? {
            id: sampleProduct.id,
            name: sampleProduct.name,
            price: sampleProduct.price,
            image: sampleProduct.image,
            category: sampleProduct.category,
          }
        : null,
      createdAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
      readByAdmin: false,
      readByCustomer: true,
    },
    {
      id: 'msg_seed_2',
      conversationId: 'demo_khach_minh_anh',
      customerName: 'Minh Anh',
      customerEmail: 'minhanh@gmail.com',
      senderRole: 'admin',
      senderName: 'Tiệm Cuộn Len',
      text: 'Dạ chào Minh Anh 🧶 Mẫu Móc Khoá Cherry bên tiệm đang sẵn hàng và tặng kèm hộp quà miễn phí ạ! Bạn có thể bấm đặt trực tiếp hoặc nhắn địa chỉ để tiệm lên đơn nhé.',
      product: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
      readByAdmin: true,
      readByCustomer: true,
    },
  ];
}

function loadMessages(): ChatMessage[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed as ChatMessage[];
        }
      }
    }
  } catch {
    // ignore
  }
  const seeded = createInitialMessages();
  saveMessages(seeded);
  return seeded;
}

function saveMessages(items: ChatMessage[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota errors
  }
}

interface ChatContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  openChat: () => void;
  openChatWithProduct: (product: Product) => void;
  pendingProduct: PingedProduct | null;
  setPendingProduct: (product: PingedProduct | null) => void;
  sendMessage: (
    text: string,
    product?: PingedProduct | null,
    targetConversationId?: string
  ) => void;
  conversations: ChatConversation[];
  myConversationId: string;
  myMessages: ChatMessage[];
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  markConversationRead: (conversationId: string) => void;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages());
  const [isOpen, setIsOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PingedProduct | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [guestId] = useState<string>(() => getOrCreateGuestId());

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const myConversationId = useMemo(() => {
    if (user && role !== 'admin') return `user_${user.id}`;
    return guestId;
  }, [user, role, guestId]);

  // Listen to cross-tab storage & BroadcastChannel + Supabase Realtime Broadcast
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleStorage = (e: StorageEvent) => {
        if (e.key === CHAT_STORAGE_KEY && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (Array.isArray(parsed)) setMessages(parsed);
          } catch {
            // ignore
          }
        }
      };
      window.addEventListener('storage', handleStorage);

      if (typeof BroadcastChannel !== 'undefined') {
        try {
          const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
          bc.onmessage = (ev) => {
            if (ev.data?.type === 'SYNC_MESSAGES' && Array.isArray(ev.data.messages)) {
              setMessages(ev.data.messages);
            }
          };
          broadcastRef.current = bc;
        } catch {
          // ignore
        }
      }

      return () => {
        window.removeEventListener('storage', handleStorage);
        if (broadcastRef.current) {
          broadcastRef.current.close();
          broadcastRef.current = null;
        }
      };
    }
  }, []);

  // Supabase Realtime Broadcast for cross-device live chat
  useEffect(() => {
    try {
      const ch = supabase.channel('tcl-live-chat-v1', {
        config: { broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'new_chat_message' }, (payload) => {
        const incoming = payload?.payload as ChatMessage | undefined;
        if (!incoming || !incoming.id) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          const next = [...prev, incoming];
          saveMessages(next);
          return next;
        });
      }).subscribe();
      supabaseChannelRef.current = ch;

      return () => {
        supabase.removeChannel(ch);
        supabaseChannelRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, []);

  const syncAllMessages = useCallback((next: ChatMessage[], latestMsg?: ChatMessage) => {
    saveMessages(next);
    if (broadcastRef.current) {
      try {
        broadcastRef.current.postMessage({ type: 'SYNC_MESSAGES', messages: next });
      } catch {
        // ignore
      }
    }
    if (latestMsg && supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'new_chat_message',
          payload: latestMsg,
        });
      } catch {
        // ignore
      }
    }
  }, []);

  // Group messages into conversations for Admin & Client
  const conversations = useMemo<ChatConversation[]>(() => {
    const map = new Map<string, ChatMessage[]>();
    for (const msg of messages) {
      const list = map.get(msg.conversationId) ?? [];
      list.push(msg);
      map.set(msg.conversationId, list);
    }

    const result: ChatConversation[] = [];
    map.forEach((list, convId) => {
      const sorted = [...list].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const lastMessage = sorted[sorted.length - 1];
      const customerMsg = sorted.find((m) => m.senderRole === 'customer') ?? sorted[0];
      const unreadForAdmin = sorted.filter(
        (m) => m.senderRole === 'customer' && !m.readByAdmin
      ).length;
      const unreadForCustomer = sorted.filter(
        (m) => m.senderRole === 'admin' && !m.readByCustomer
      ).length;

      result.push({
        conversationId: convId,
        customerName: customerMsg?.customerName || 'Khách hàng',
        customerEmail: customerMsg?.customerEmail,
        lastMessage,
        unreadForAdmin,
        unreadForCustomer,
        messages: sorted,
      });
    });

    return result.sort(
      (a, b) =>
        new Date(b.lastMessage.createdAt).getTime() -
        new Date(a.lastMessage.createdAt).getTime()
    );
  }, [messages]);

  // Select default active conversation for Admin when opening
  useEffect(() => {
    if (isAdmin && !activeConversationId && conversations.length > 0) {
      setActiveConversationId(conversations[0].conversationId);
    }
  }, [isAdmin, activeConversationId, conversations]);

  const myMessages = useMemo<ChatMessage[]>(() => {
    const conv = conversations.find((c) => c.conversationId === myConversationId);
    if (conv && conv.messages.length > 0) {
      return conv.messages;
    }
    // Default welcome message from shop for a new customer conversation
    return [
      {
        id: 'welcome_msg',
        conversationId: myConversationId,
        customerName: user?.name || 'Khách hàng',
        customerEmail: user?.email,
        senderRole: 'admin',
        senderName: 'Tiệm Cuộn Len',
        text: 'Xin chào! 🧶 Bạn muốn hỏi thông tin hay đặt đan mẫu sản phẩm nào? Bạn có thể bấm nút "Ping sản phẩm" bên dưới để đính kèm mẫu len cần tư vấn cho Admin nhé!',
        product: null,
        createdAt: new Date().toISOString(),
        readByAdmin: true,
        readByCustomer: true,
      },
    ];
  }, [conversations, myConversationId, user]);

  const markConversationRead = useCallback(
    (conversationId: string) => {
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.conversationId !== conversationId) return m;
          if (isAdmin && m.senderRole === 'customer' && !m.readByAdmin) {
            changed = true;
            return { ...m, readByAdmin: true };
          }
          if (!isAdmin && m.senderRole === 'admin' && !m.readByCustomer) {
            changed = true;
            return { ...m, readByCustomer: true };
          }
          return m;
        });
        if (changed) {
          syncAllMessages(next);
        }
        return changed ? next : prev;
      });
    },
    [isAdmin, syncAllMessages]
  );

  // Mark read automatically when widget is open
  useEffect(() => {
    if (!isOpen) return;
    if (isAdmin && activeConversationId) {
      markConversationRead(activeConversationId);
    } else if (!isAdmin) {
      markConversationRead(myConversationId);
    }
  }, [isOpen, isAdmin, activeConversationId, myConversationId, markConversationRead]);

  const sendMessage = useCallback(
    (
      text: string,
      product?: PingedProduct | null,
      targetConversationId?: string
    ) => {
      const trimmed = text.trim();
      const attachedProduct = product !== undefined ? product : pendingProduct;
      if (!trimmed && !attachedProduct) return;

      const convId = isAdmin
        ? targetConversationId || activeConversationId || 'demo_khach_minh_anh'
        : myConversationId;

      const existingConv = conversations.find((c) => c.conversationId === convId);
      const customerName = isAdmin
        ? existingConv?.customerName || 'Khách hàng'
        : user?.name || 'Khách hàng';
      const customerEmail = isAdmin ? existingConv?.customerEmail : user?.email;

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversationId: convId,
        customerName,
        customerEmail,
        senderRole: isAdmin ? 'admin' : 'customer',
        senderName: isAdmin ? user?.name || 'Admin Tiệm Cuộn Len' : customerName,
        text:
          trimmed ||
          (isAdmin
            ? `Tiệm gửi bạn thông tin sản phẩm "${attachedProduct?.name}" nhé!`
            : `Mình quan tâm đến sản phẩm "${attachedProduct?.name}", tư vấn giúp mình nhé!`),
        product: attachedProduct || null,
        createdAt: new Date().toISOString(),
        readByAdmin: isAdmin,
        readByCustomer: !isAdmin,
      };

      setMessages((prev) => {
        const next = [...prev, newMsg];
        syncAllMessages(next, newMsg);
        return next;
      });

      setPendingProduct(null);
    },
    [
      isAdmin,
      pendingProduct,
      activeConversationId,
      myConversationId,
      conversations,
      user,
      syncAllMessages,
    ]
  );

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const openChatWithProduct = useCallback(
    (product: Product) => {
      const pinged: PingedProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      };
      setPendingProduct(pinged);
      setIsOpen(true);
    },
    []
  );

  const unreadCount = useMemo(() => {
    if (isAdmin) {
      return conversations.reduce((sum, c) => sum + c.unreadForAdmin, 0);
    }
    const myConv = conversations.find((c) => c.conversationId === myConversationId);
    return myConv ? myConv.unreadForCustomer : 0;
  }, [isAdmin, conversations, myConversationId]);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      openChat,
      openChatWithProduct,
      pendingProduct,
      setPendingProduct,
      sendMessage,
      conversations,
      myConversationId,
      myMessages,
      activeConversationId,
      setActiveConversationId,
      markConversationRead,
      unreadCount,
    }),
    [
      isOpen,
      openChat,
      openChatWithProduct,
      pendingProduct,
      sendMessage,
      conversations,
      myConversationId,
      myMessages,
      activeConversationId,
      markConversationRead,
      unreadCount,
    ]
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}
