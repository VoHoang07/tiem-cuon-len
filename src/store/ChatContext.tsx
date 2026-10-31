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
import { supabase, supabaseUrl, supabaseAnonKey } from '@/services/supabase';

const CHAT_STORAGE_KEY = 'tcl_chat_messages_v2';
const GUEST_ID_KEY = 'tcl_chat_guest_id_v2';
const LAST_CLIENT_CONV_KEY = 'tcl_last_client_conv_v2';
const BROADCAST_CHANNEL_NAME = 'tcl_live_chat_channel_v2';

// Dedicated partition in Supabase `addresses` table for cross-device / cross-browser live chat persistence
const CHAT_PARTITION_KEY = '__TCL_CHAT_V2__';
const CHAT_HOLDER_USER_ID = '57090d46-4e82-4fa0-93bb-1ff5e46c22c2';

function sanitizeProduct(product?: PingedProduct | Product | null): PingedProduct | null {
  if (!product) return null;
  return {
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    // Avoid storing multi-megabyte base64 strings in chat payloads; ShopChatWidget resolves product image by ID/name
    image:
      typeof product.image === 'string' && product.image.length < 500
        ? product.image
        : null,
  };
}

function getOrCreateGuestId(): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = window.localStorage.getItem(GUEST_ID_KEY);
      if (existing) return existing;
      const created = `guest_${Math.random().toString(36).slice(2, 8)}`;
      window.localStorage.setItem(GUEST_ID_KEY, created);
      return created;
    }
  } catch {
    // ignore
  }
  return 'guest_visitor';
}

function loadLocalMessages(): ChatMessage[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed as ChatMessage[];
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

function saveLocalMessages(items: ChatMessage[]) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(items));
    }
  } catch {
    // ignore quota errors
  }
}

function rowToChatMessage(row: any): ChatMessage | null {
  try {
    if (!row || row.fullName !== CHAT_PARTITION_KEY || !row.id) return null;
    const payload =
      typeof row.detailAddress === 'string'
        ? JSON.parse(row.detailAddress)
        : row.detailAddress || {};
    const [readAdminStr, readCustStr] = String(row.ward || '0|0').split('|');
    return {
      id: String(row.id),
      conversationId: String(row.city || 'default_conv'),
      senderRole: row.phone === 'admin' ? 'admin' : 'customer',
      customerName: String(payload.customerName || 'Khách hàng'),
      customerEmail: payload.customerEmail || undefined,
      senderName: String(payload.senderName || 'Khách hàng'),
      text: String(payload.text || ''),
      product: payload.product || null,
      createdAt: String(row.district || new Date().toISOString()),
      readByAdmin: readAdminStr === '1' || readAdminStr === 'true',
      readByCustomer: readCustStr === '1' || readCustStr === 'true',
    };
  } catch {
    return null;
  }
}

function chatMessageToRow(msg: ChatMessage) {
  return {
    id: msg.id,
    userId: CHAT_HOLDER_USER_ID,
    fullName: CHAT_PARTITION_KEY,
    city: msg.conversationId,
    phone: msg.senderRole,
    district: msg.createdAt,
    ward: `${msg.readByAdmin ? '1' : '0'}|${msg.readByCustomer ? '1' : '0'}`,
    detailAddress: JSON.stringify({
      customerName: msg.customerName,
      customerEmail: msg.customerEmail,
      senderName: msg.senderName,
      text: msg.text,
      product: sanitizeProduct(msg.product),
    }),
    isDefault: false,
  };
}

function mergeMessageLists(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const m of current) {
    map.set(m.id, m);
  }
  for (const m of incoming) {
    const existing = map.get(m.id);
    if (existing) {
      map.set(m.id, {
        ...existing,
        ...m,
        readByAdmin: Boolean(existing.readByAdmin || m.readByAdmin),
        readByCustomer: Boolean(existing.readByCustomer || m.readByCustomer),
      });
    } else {
      map.set(m.id, m);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
}

function messagesSignature(list: ChatMessage[]): string {
  return list
    .map((m) => `${m.id}:${m.readByAdmin ? 1 : 0}:${m.readByCustomer ? 1 : 0}`)
    .join(',');
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
  deleteConversation: (conversationId: string) => Promise<void>;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadLocalMessages());
  const [isOpen, setIsOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PingedProduct | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [guestId] = useState<string>(() => getOrCreateGuestId());

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isChannelSubscribedRef = useRef(false);
  const lastNewestCustomerMsgIdRef = useRef<string | null>(null);

  // Determine active Client conversation ID and persist it for seamless testing
  const myConversationId = useMemo(() => {
    if (user && role !== 'admin') {
      const id = `user_${user.id}`;
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(LAST_CLIENT_CONV_KEY, id);
        }
      } catch {
        // ignore
      }
      return id;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const lastConv = window.localStorage.getItem(LAST_CLIENT_CONV_KEY);
        if (lastConv) return lastConv;
      }
    } catch {
      // ignore
    }
    return guestId;
  }, [user, role, guestId]);

  // Fetch all chat messages from Supabase REST table (`addresses` with `fullName = __TCL_CHAT_V2__`)
  const fetchRemoteMessages = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/addresses?fullName=eq.${CHAT_PARTITION_KEY}&select=*`,
        {
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
        }
      );
      if (!res.ok) return;
      const rows = await res.json();
      if (!Array.isArray(rows)) return;

      const remoteList: ChatMessage[] = [];
      for (const r of rows) {
        const parsed = rowToChatMessage(r);
        if (parsed) remoteList.push(parsed);
      }

      setMessages((prev) => {
        const merged = mergeMessageLists(prev, remoteList);
        if (messagesSignature(merged) === messagesSignature(prev)) {
          return prev;
        }
        saveLocalMessages(merged);
        return merged;
      });
    } catch {
      // ignore network errors
    }
  }, []);

  // Push a single message to Supabase REST table
  const pushMessageToSupabase = useCallback(async (msg: ChatMessage) => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    try {
      await fetch(`${supabaseUrl}/rest/v1/addresses`, {
        method: 'POST',
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(chatMessageToRow(msg)),
      });
    } catch {
      // ignore
    }
  }, []);

  // Update read status on Supabase REST table (per-message, preserving existing read state)
  const patchReadStatusOnSupabase = useCallback(
    async (msgs: { id: string; readByAdmin: boolean; readByCustomer: boolean }[]) => {
      if (!supabaseUrl || !supabaseAnonKey || msgs.length === 0) return;
      try {
        await Promise.all(
          msgs.map((m) =>
            fetch(`${supabaseUrl}/rest/v1/addresses?id=eq.${encodeURIComponent(m.id)}`, {
              method: 'PATCH',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${supabaseAnonKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ward: `${m.readByAdmin ? '1' : '0'}|${m.readByCustomer ? '1' : '0'}`,
              }),
            })
          )
        );
      } catch {
        // ignore
      }
    },
    []
  );

  // Layer 2: Cross-tab storage & BroadcastChannel
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === CHAT_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (Array.isArray(parsed)) {
            setMessages((prev) => {
              const merged = mergeMessageLists(prev, parsed);
              return messagesSignature(merged) === messagesSignature(prev) ? prev : merged;
            });
          }
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
          if (ev.data?.type === 'NEW_MESSAGE' && ev.data.message) {
            const incoming = ev.data.message as ChatMessage;
            setMessages((prev) => {
              const merged = mergeMessageLists(prev, [incoming]);
              if (messagesSignature(merged) === messagesSignature(prev)) return prev;
              saveLocalMessages(merged);
              return merged;
            });
          } else if (ev.data?.type === 'SYNC_MESSAGES' && Array.isArray(ev.data.messages)) {
            setMessages((prev) => {
              const merged = mergeMessageLists(prev, ev.data.messages);
              if (messagesSignature(merged) === messagesSignature(prev)) return prev;
              saveLocalMessages(merged);
              return merged;
            });
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
  }, []);

  // Layer 3: Supabase Realtime Broadcast WebSocket
  useEffect(() => {
    try {
      const ch = supabase.channel('tcl-live-chat-v2', {
        config: { broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'new_chat_message' }, (payload) => {
        const incoming = payload?.payload as ChatMessage | undefined;
        if (!incoming || !incoming.id) return;
        setMessages((prev) => {
          const merged = mergeMessageLists(prev, [incoming]);
          if (messagesSignature(merged) === messagesSignature(prev)) return prev;
          saveLocalMessages(merged);
          return merged;
        });
      }).subscribe((status) => {
        isChannelSubscribedRef.current = status === 'SUBSCRIBED';
      });
      supabaseChannelRef.current = ch;

      return () => {
        isChannelSubscribedRef.current = false;
        supabase.removeChannel(ch);
        supabaseChannelRef.current = null;
      };
    } catch {
      return undefined;
    }
  }, []);

  // Layer 4: Initial fetch + fast real-time polling + window focus sync
  useEffect(() => {
    fetchRemoteMessages();
    const intervalMs = isOpen ? 1500 : 3500;
    const timer = setInterval(fetchRemoteMessages, intervalMs);

    const handleFocus = () => {
      fetchRemoteMessages();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
    }
    return () => {
      clearInterval(timer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleFocus);
      }
    };
  }, [isOpen, role, user?.id, fetchRemoteMessages]);

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
      const customerMsg =
        [...sorted].reverse().find((m) => m.senderRole === 'customer') ?? sorted[0];
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

  // Auto-select latest customer conversation for Admin when new customer message arrives
  useEffect(() => {
    if (!isAdmin || conversations.length === 0) return;

    const latestConv = conversations[0];
    const newestCustomerMsg = [...messages]
      .filter((m) => m.senderRole === 'customer')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    if (!activeConversationId) {
      setActiveConversationId(latestConv.conversationId);
      if (newestCustomerMsg) {
        lastNewestCustomerMsgIdRef.current = newestCustomerMsg.id;
      }
      return;
    }

    // If a brand-new customer message just arrived, switch Admin to that conversation automatically
    if (
      newestCustomerMsg &&
      lastNewestCustomerMsgIdRef.current !== newestCustomerMsg.id
    ) {
      lastNewestCustomerMsgIdRef.current = newestCustomerMsg.id;
      setActiveConversationId(newestCustomerMsg.conversationId);
    }
  }, [isAdmin, conversations, messages, activeConversationId]);

  const myMessages = useMemo<ChatMessage[]>(() => {
    const conv =
      conversations.find((c) => c.conversationId === myConversationId) ??
      conversations.find((c) => c.conversationId === guestId);
    if (conv && conv.messages.length > 0) {
      return conv.messages;
    }
    return [
      {
        id: 'welcome_msg',
        conversationId: myConversationId,
        customerName: user?.name || 'Khách hàng',
        customerEmail: user?.email,
        senderRole: 'admin',
        senderName: 'Tiệm Cuộn Len',
        text: 'Xin chào! 🧶 Bạn cần hỏi thông tin hay đặt mẫu len nào? Bấm nút "+ SP" bên dưới để đính kèm sản phẩm cần tư vấn nhé!',
        product: null,
        createdAt: new Date().toISOString(),
        readByAdmin: true,
        readByCustomer: true,
      },
    ];
  }, [conversations, myConversationId, guestId, user]);

  const markConversationRead = useCallback(
    (conversationId: string) => {
      const updatedMsgs: { id: string; readByAdmin: boolean; readByCustomer: boolean }[] = [];
      setMessages((prev) => {
        let changed = false;
        const next = prev.map((m) => {
          if (m.conversationId !== conversationId) return m;
          if (isAdmin && m.senderRole === 'customer' && !m.readByAdmin) {
            changed = true;
            updatedMsgs.push({ id: m.id, readByAdmin: true, readByCustomer: m.readByCustomer });
            return { ...m, readByAdmin: true };
          }
          if (!isAdmin && m.senderRole === 'admin' && !m.readByCustomer) {
            changed = true;
            updatedMsgs.push({ id: m.id, readByAdmin: m.readByAdmin, readByCustomer: true });
            return { ...m, readByCustomer: true };
          }
          return m;
        });
        if (changed) {
          saveLocalMessages(next);
          if (broadcastRef.current) {
            try {
              broadcastRef.current.postMessage({ type: 'SYNC_MESSAGES', messages: next });
            } catch {
              // ignore
            }
          }
        }
        return changed ? next : prev;
      });

      if (updatedMsgs.length > 0) {
        patchReadStatusOnSupabase(updatedMsgs);
      }
    },
    [isAdmin, patchReadStatusOnSupabase]
  );

  // Delete an entire conversation (admin only) — removes from local state, localStorage, and Supabase
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      const deletedIds: string[] = [];
      setMessages((prev) => {
        const next = prev.filter((m) => {
          if (m.conversationId === conversationId) {
            deletedIds.push(m.id);
            return false;
          }
          return true;
        });
        saveLocalMessages(next);
        return next;
      });

      // If we were viewing this conversation, switch to another
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }

      // Delete from Supabase
      if (supabaseUrl && supabaseAnonKey && deletedIds.length > 0) {
        try {
          await Promise.all(
            deletedIds.map((id) =>
              fetch(
                `${supabaseUrl}/rest/v1/addresses?id=eq.${encodeURIComponent(id)}&fullName=eq.${CHAT_PARTITION_KEY}`,
                {
                  method: 'DELETE',
                  headers: {
                    apikey: supabaseAnonKey,
                    Authorization: `Bearer ${supabaseAnonKey}`,
                  },
                }
              )
            )
          );
        } catch {
          // ignore network errors
        }
      }

      // Broadcast deletion to other tabs
      if (broadcastRef.current) {
        try {
          const remaining = loadLocalMessages();
          broadcastRef.current.postMessage({ type: 'SYNC_MESSAGES', messages: remaining });
        } catch {
          // ignore
        }
      }
    },
    [activeConversationId]
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
      const attachedProduct = sanitizeProduct(
        product !== undefined ? product : pendingProduct
      );
      if (!trimmed && !attachedProduct) return;

      const convId = isAdmin
        ? targetConversationId ||
          activeConversationId ||
          conversations[0]?.conversationId ||
          myConversationId
        : myConversationId;

      if (!isAdmin) {
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(LAST_CLIENT_CONV_KEY, convId);
          }
        } catch {
          // ignore
        }
      }

      const existingConv = conversations.find((c) => c.conversationId === convId);
      const customerName = isAdmin
        ? existingConv?.customerName || 'Khách hàng'
        : user?.name || existingConv?.customerName || 'Khách hàng';
      const customerEmail = isAdmin
        ? existingConv?.customerEmail
        : user?.email || existingConv?.customerEmail;

      const newMsg: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        conversationId: convId,
        customerName,
        customerEmail,
        senderRole: isAdmin ? 'admin' : 'customer',
        senderName: isAdmin ? 'Tiệm Cuộn Len' : customerName,
        text:
          trimmed ||
          (isAdmin
            ? `Tiệm gửi bạn thông tin mẫu "${attachedProduct?.name}" nhé!`
            : `Mình quan tâm mẫu "${attachedProduct?.name}", tư vấn giúp mình nhé!`),
        product: attachedProduct,
        createdAt: new Date().toISOString(),
        readByAdmin: isAdmin,
        readByCustomer: !isAdmin,
      };

      // 1. Optimistic local state update
      setMessages((prev) => {
        const next = mergeMessageLists(prev, [newMsg]);
        saveLocalMessages(next);
        return next;
      });

      // 2. Cross-tab BroadcastChannel
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({ type: 'NEW_MESSAGE', message: newMsg });
        } catch {
          // ignore
        }
      }

      // 3. Cross-device Supabase Realtime Broadcast
      if (supabaseChannelRef.current && isChannelSubscribedRef.current) {
        try {
          supabaseChannelRef.current.send({
            type: 'broadcast',
            event: 'new_chat_message',
            payload: newMsg,
          });
        } catch {
          // ignore
        }
      }

      // 4. Persistent Supabase Postgres REST insert
      pushMessageToSupabase(newMsg);

      setPendingProduct(null);
    },
    [
      isAdmin,
      pendingProduct,
      activeConversationId,
      conversations,
      myConversationId,
      user,
      pushMessageToSupabase,
    ]
  );

  const openChat = useCallback(() => {
    setIsOpen(true);
  }, []);

  const openChatWithProduct = useCallback((product: Product) => {
    setPendingProduct(sanitizeProduct(product));
    setIsOpen(true);
  }, []);

  const unreadCount = useMemo(() => {
    if (isAdmin) {
      return conversations.reduce((sum, c) => sum + c.unreadForAdmin, 0);
    }
    const myConv =
      conversations.find((c) => c.conversationId === myConversationId) ??
      conversations.find((c) => c.conversationId === guestId);
    return myConv ? myConv.unreadForCustomer : 0;
  }, [isAdmin, conversations, myConversationId, guestId]);

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
      deleteConversation,
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
      deleteConversation,
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
