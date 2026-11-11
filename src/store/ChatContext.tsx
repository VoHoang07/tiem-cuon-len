import { supabase, supabaseAnonKey, supabaseUrl } from '@/services/supabase';
import { useAuth } from '@/store/AuthContext';
import { ChatConversation, ChatMessage, PingedProduct } from '@/types/chat';
import { Product } from '@/types/product';
import {
    playChatNotificationChime,
    queueServerChatPushToOwner,
    queueServerReplyPushToCustomer,
    registerChatServiceWorker,
    requestChatNotificationPermission,
    showSystemChatNotification,
    updateTabTitleForUnreadChat,
} from '@/utils/chatNotifier';
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';

const CHAT_STORAGE_KEY = 'tcl_chat_messages_v2';
const DELETED_MSG_IDS_KEY = 'tcl_deleted_chat_msg_ids_v1';
const GUEST_ID_KEY = 'tcl_chat_guest_id_v2';
const GUEST_EMAIL_KEY = 'tcl_guest_notify_email_v1';
const LAST_CLIENT_CONV_KEY = 'tcl_last_client_conv_v2';
const BROADCAST_CHANNEL_NAME = 'tcl_live_chat_channel_v2';

function loadDeletedMsgIds(): Set<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DELETED_MSG_IDS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return new Set(parsed.map(String));
      }
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveDeletedMsgIds(ids: Set<string>) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const arr = Array.from(ids).slice(-800);
      window.localStorage.setItem(DELETED_MSG_IDS_KEY, JSON.stringify(arr));
    }
  } catch {
    // ignore
  }
}

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
      const deletedSet = loadDeletedMsgIds();
      const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return (parsed as ChatMessage[]).filter(
            (m) => m && m.id && !deletedSet.has(m.id)
          );
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
  deleteMessage: (messageId: string) => Promise<void>;
  unreadCount: number;
  customerNotifyEmail: string;
  saveCustomerNotifyEmail: (email: string) => void;
  }

const ChatContext = createContext<ChatContextType | null>(null);
const ChatTriggerContext = createContext<((product: Product) => void) | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const isAdmin = role === 'admin';

  const [messages, setMessages] = useState<ChatMessage[]>(() => loadLocalMessages());
  const [isOpen, setIsOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PingedProduct | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [guestId] = useState<string>(() => getOrCreateGuestId());
  const [guestEmail, setGuestEmail] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(GUEST_EMAIL_KEY) || '';
      }
    } catch {
      // ignore
    }
    return '';
  });

  const customerNotifyEmail = useMemo(
    () => (user?.email || guestEmail || '').trim(),
    [user?.email, guestEmail]
  );

  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isChannelSubscribedRef = useRef(false);
  const lastNewestCustomerMsgIdRef = useRef<string | null>(null);
  const deletedConvIdsRef = useRef<Set<string>>(new Set());
  const deletedMsgIdsRef = useRef<Set<string>>(loadDeletedMsgIds());
  const lastSentAtRef = useRef<number>(0);
  const knownMessageIdsRef = useRef<Set<string>>(
    new Set(loadLocalMessages().map((m) => m.id))
  );
  const initialRemoteSyncDoneRef = useRef<boolean>(false);

  // Register Service Worker so clicking an OS notification focuses tab & opens that conversation
  useEffect(() => {
    void registerChatServiceWorker((clickedConvId) => {
      setIsOpen(true);
      if (clickedConvId) {
        setActiveConversationId(clickedConvId);
      }
    });
  }, []);

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
  // Note: Keep polling even when tab is minimized (`visibilityState === 'hidden'`) for Admin & active Customers so OS push & chime fire in background!
  const fetchRemoteMessages = useCallback(async () => {
    if (!supabaseUrl || !supabaseAnonKey) return;
    // Skip unnecessary database polling for anonymous visitors who haven't opened chat or sent a message yet
    if (
      !isAdmin &&
      !isOpen &&
      !user &&
      lastSentAtRef.current === 0 &&
      knownMessageIdsRef.current.size === 0
    ) {
      return;
    }
    try {
      const convFilter =
        !isAdmin && myConversationId
          ? `&city=eq.${encodeURIComponent(myConversationId)}`
          : '';
      const res = await fetch(
        `${supabaseUrl}/rest/v1/addresses?fullName=eq.${CHAT_PARTITION_KEY}${convFilter}&select=id,fullName,city,phone,district,ward,detailAddress`,
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
        if (
          parsed &&
          !deletedConvIdsRef.current.has(parsed.conversationId) &&
          !deletedMsgIdsRef.current.has(parsed.id)
        ) {
          remoteList.push(parsed);
        }
      }

      setMessages((prev) => {
        const remoteIds = new Set(remoteList.map((m) => m.id));
        const now = Date.now();
        // Keep only brand-new local messages (< 10s old) that haven't finished POSTing yet;
        // any older message missing from remoteList was deleted on the server
        const localInFlight = prev.filter(
          (m) =>
            !deletedConvIdsRef.current.has(m.conversationId) &&
            !deletedMsgIdsRef.current.has(m.id) &&
            !remoteIds.has(m.id) &&
            now - new Date(m.createdAt).getTime() < 10000
        );
        const merged = mergeMessageLists(localInFlight, remoteList);
        if (!initialRemoteSyncDoneRef.current) {
          initialRemoteSyncDoneRef.current = true;
          for (const m of merged) {
            knownMessageIdsRef.current.add(m.id);
          }
        }
        if (messagesSignature(merged) === messagesSignature(prev)) {
          return prev;
        }
        saveLocalMessages(merged);
        return merged;
        });
        } catch {
        // ignore network errors
        }
        }, [isAdmin, isOpen, myConversationId, user]);

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
              const incomingList = ev.data.messages as ChatMessage[];
              if (messagesSignature(incomingList) === messagesSignature(prev)) return prev;
              saveLocalMessages(incomingList);
              return incomingList;
            });
          } else if (ev.data?.type === 'DELETE_CONVERSATION' && ev.data.conversationId) {
            const targetConvId = String(ev.data.conversationId);
            setMessages((prev) => {
              const next = prev.filter((m) => m.conversationId !== targetConvId);
              saveLocalMessages(next);
              return next;
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
      })
        .on('broadcast', { event: 'delete_conversation' }, (payload) => {
          const targetConvId = payload?.payload?.conversationId as string | undefined;
          if (!targetConvId) return;
          setMessages((prev) => {
            const next = prev.filter((m) => m.conversationId !== targetConvId);
            saveLocalMessages(next);
            return next;
          });
        })
        .subscribe((status) => {
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

  // Layer 4: Initial fetch + adaptive polling + window focus sync (WebSocket handles live push)
  useEffect(() => {
    let lastFetchTs = Date.now();
    fetchRemoteMessages();
    const intervalMs = isAdmin ? 12000 : isOpen ? 12000 : 22000;
    const timer = setInterval(() => {
      lastFetchTs = Date.now();
      fetchRemoteMessages();
    }, intervalMs);

    const handleFocus = () => {
      if (Date.now() - lastFetchTs < 15000) return;
      lastFetchTs = Date.now();
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

    // Fire Sound Chime + OS System Banner Notification when a new incoming message arrives
    useEffect(() => {
    if (!initialRemoteSyncDoneRef.current) return;
    const brandNewIncoming: ChatMessage[] = [];
    for (const m of messages) {
      if (!knownMessageIdsRef.current.has(m.id)) {
        knownMessageIdsRef.current.add(m.id);
        if (isAdmin && m.senderRole === 'customer') {
          brandNewIncoming.push(m);
        } else if (
          !isAdmin &&
          m.senderRole === 'admin' &&
          m.conversationId === myConversationId
        ) {
          brandNewIncoming.push(m);
        }
      }
    }

    if (brandNewIncoming.length > 0) {
      const latest = brandNewIncoming[brandNewIncoming.length - 1];
      playChatNotificationChime();
      void showSystemChatNotification({
        title: isAdmin
          ? `💬 Tin nhắn mới từ ${latest.customerName}`
          : '🧶 Tiệm Cuộn Len vừa trả lời bạn',
        body: latest.product
          ? `[${latest.product.name}] ${latest.text}`
          : latest.text,
        conversationId: latest.conversationId,
        onClick: () => {
          setIsOpen(true);
          if (isAdmin) {
            setActiveConversationId(latest.conversationId);
          }
        },
      });
    }
    }, [messages, isAdmin, myConversationId]);

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

  // Delete an entire conversation (admin only) — removes from local state, localStorage, and Supabase (with Admin JWT + Server API)
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      if (!isAdmin) return;
      deletedConvIdsRef.current.add(conversationId);
      setTimeout(() => {
        deletedConvIdsRef.current.delete(conversationId);
      }, 20000);

      setMessages((prev) => {
        for (const m of prev) {
          if (m.conversationId === conversationId) {
            deletedMsgIdsRef.current.add(m.id);
          }
        }
        saveDeletedMsgIds(deletedMsgIdsRef.current);
        const next = prev.filter((m) => m.conversationId !== conversationId);
        saveLocalMessages(next);
        return next;
      });

      // If we were viewing this conversation, switch to another
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }

      // Broadcast deletion immediately to other tabs and Supabase Realtime
      if (broadcastRef.current) {
        try {
          broadcastRef.current.postMessage({
            type: 'DELETE_CONVERSATION',
            conversationId,
          });
        } catch {
          // ignore
        }
      }
      if (supabaseChannelRef.current && isChannelSubscribedRef.current) {
        try {
          supabaseChannelRef.current.send({
            type: 'broadcast',
            event: 'delete_conversation',
            payload: { conversationId },
          });
        } catch {
          // ignore
        }
      }

      // Authenticate with Admin JWT token so Supabase RLS (`is_shop_admin()`) permits DELETE
      let adminToken = supabaseAnonKey || '';
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            adminToken = data.session.access_token;
          }
        }
      } catch {
        // ignore
      }

      if (supabaseUrl && supabaseAnonKey) {
        try {
          await fetch(
            `${supabaseUrl}/rest/v1/addresses?fullName=eq.${CHAT_PARTITION_KEY}&city=eq.${encodeURIComponent(
              conversationId
            )}`,
            {
              method: 'DELETE',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${adminToken}`,
              },
            }
          );
        } catch {
          // ignore network errors
        }
      }

      if (typeof window !== 'undefined') {
        try {
          await fetch('/api/security-audit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
            },
            body: JSON.stringify({
              action: 'delete_chat',
              conversationId,
            }),
          });
        } catch {
          // ignore
        }
      }
    },
    [activeConversationId, isAdmin]
  );

  // Delete a single message (admin only)
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!isAdmin || !messageId) return;
      deletedMsgIdsRef.current.add(messageId);
      saveDeletedMsgIds(deletedMsgIdsRef.current);

      setMessages((prev) => {
        const next = prev.filter((m) => m.id !== messageId);
        saveLocalMessages(next);
        return next;
      });

      let adminToken = supabaseAnonKey || '';
      try {
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (data?.session?.access_token) {
            adminToken = data.session.access_token;
          }
        }
      } catch {
        // ignore
      }

      if (supabaseUrl && supabaseAnonKey) {
        try {
          await fetch(
            `${supabaseUrl}/rest/v1/addresses?fullName=eq.${CHAT_PARTITION_KEY}&id=eq.${encodeURIComponent(
              messageId
            )}`,
            {
              method: 'DELETE',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${adminToken}`,
              },
            }
          );
        } catch {
          // ignore
        }
      }

      if (typeof window !== 'undefined') {
        try {
          await fetch('/api/security-audit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
            },
            body: JSON.stringify({
              action: 'delete_chat',
              messageId,
            }),
          });
        } catch {
          // ignore
        }
      }
    },
    [isAdmin]
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
      const now = Date.now();
      if (!isAdmin && now - lastSentAtRef.current < 1000) return;
      const trimmed = text.replace(/[<>]/g, '').trim().slice(0, 500);
      const attachedProduct = sanitizeProduct(
        product !== undefined ? product : pendingProduct
      );
      if (!trimmed && !attachedProduct) return;
      lastSentAtRef.current = now;

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
        : user?.email || customerNotifyEmail || existingConv?.customerEmail;

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
      knownMessageIdsRef.current.add(newMsg.id);
      pushMessageToSupabase(newMsg);

      // 5. Offline Push Notifications:
      // - If Customer sent a message -> Push to BOTH Shop Owner Gmails (`vohoang1327@gmail.com` & `khanhly30072007@gmail.com`)
      //   and automatically request Browser OS Notification permission for the Customer so they hear Admin's reply!
      // - If Admin sent a reply -> Push Email notification directly to the Customer's Gmail so the Customer knows even if they left the web!
      if (!isAdmin) {
        queueServerChatPushToOwner(newMsg);
        void requestChatNotificationPermission();
      } else if (newMsg.customerEmail) {
        queueServerReplyPushToCustomer(newMsg);
      }

      setPendingProduct(null);
      },
      [
      isAdmin,
      pendingProduct,
      activeConversationId,
      conversations,
      myConversationId,
      user,
      customerNotifyEmail,
      pushMessageToSupabase,
      ]
      );

      const saveCustomerNotifyEmail = useCallback(
      (rawEmail: string) => {
      const cleaned = rawEmail.trim().toLowerCase();
      setGuestEmail(cleaned);
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(GUEST_EMAIL_KEY, cleaned);
        }
      } catch {
        // ignore
      }
      if (!cleaned) return;
      void requestChatNotificationPermission();

      // Attach email to existing messages of this customer's conversation and sync latest row to Supabase
      setMessages((prev) => {
        let latestTargetMsg: ChatMessage | null = null;
        const next = prev.map((m) => {
          if (m.conversationId === myConversationId) {
            const updated = { ...m, customerEmail: cleaned };
            latestTargetMsg = updated;
            return updated;
          }
          return m;
        });
        saveLocalMessages(next);
        if (latestTargetMsg) {
          void pushMessageToSupabase(latestTargetMsg);
          if (supabaseChannelRef.current && isChannelSubscribedRef.current) {
            try {
              supabaseChannelRef.current.send({
                type: 'broadcast',
                event: 'new_chat_message',
                payload: latestTargetMsg,
              });
            } catch {
              // ignore
            }
          }
        }
        return next;
      });
      },
      [myConversationId, pushMessageToSupabase]
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

  // Blink browser tab title when there are unread messages
  useEffect(() => {
    const latestSender = isAdmin
      ? conversations.find((c) => c.unreadForAdmin > 0)?.customerName
      : 'Tiệm Cuộn Len';
    updateTabTitleForUnreadChat(unreadCount, latestSender);
  }, [unreadCount, isAdmin, conversations]);

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
      deleteMessage,
      unreadCount,
      customerNotifyEmail,
      saveCustomerNotifyEmail,
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
      deleteMessage,
      unreadCount,
      customerNotifyEmail,
      saveCustomerNotifyEmail,
      ]
      );

  return (
    <ChatTriggerContext.Provider value={openChatWithProduct}>
      <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
    </ChatTriggerContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return ctx;
}

export function useChatTrigger() {
  const trigger = useContext(ChatTriggerContext);
  if (!trigger) {
    throw new Error('useChatTrigger must be used within ChatProvider');
  }
  return trigger;
}
