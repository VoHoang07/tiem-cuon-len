import type { ChatMessage } from '@/types/chat';
import { Platform } from 'react-native';

let swRegistration: ServiceWorkerRegistration | null = null;
let audioCtx: AudioContext | null = null;
let titleBlinkTimer: ReturnType<typeof setInterval> | null = null;
let baseDocumentTitle: string = 'Tiệm Cuộn Len — Quà Tặng Thủ Công';

// Batch consecutive customer messages within 3.5s into one rich Email/Phone push notification
let pendingOwnerPushLines: string[] = [];
let pendingOwnerPushMeta: {
  conversationId: string;
  customerName: string;
  customerEmail?: string;
  productName?: string;
} | null = null;
let pendingOwnerPushTimer: ReturnType<typeof setTimeout> | null = null;

export async function registerChatServiceWorker(
  onClickConversation?: (convId: string | null) => void
): Promise<void> {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {
    if (document?.title && !document.title.startsWith('💬')) {
      baseDocumentTitle = document.title;
    }
    const reg = await navigator.serviceWorker.register('/sw-chat-notify.js', {
      scope: '/',
    });
    swRegistration = reg;

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TCL_OPEN_CHAT_CONVERSATION') {
        onClickConversation?.(event.data.conversationId || null);
      }
    });
  } catch {
    // Ignore on unsupported environments
  }
}

export function getChatNotificationPermission():
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported' {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof Notification === 'undefined'
  ) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestChatNotificationPermission(): Promise<boolean> {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof Notification === 'undefined'
  ) {
    return false;
  }
  try {
    // Also warm up Web Audio context on user gesture
    playChatNotificationChime();
    if (Notification.permission === 'granted') {
      return true;
    }
    const res = await Notification.requestPermission();
    return res === 'granted';
  } catch {
    return false;
  }
}

/**
 * Plays a crisp, pleasant 2-note bell chime using Web Audio API (zero external audio file needed).
 */
export function playChatNotificationChime(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }

    const now = audioCtx.currentTime;
    const playTone = (freq: number, startOffset: number, duration: number) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.0001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.18, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + startOffset + duration
      );
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    // Two-note pleasant chime: A5 (880Hz) -> D6 (1174.66Hz)
    playTone(880, 0, 0.16);
    playTone(1174.66, 0.14, 0.28);
  } catch {
    // Ignore if browser blocks autoplay audio before user interaction
  }
}

/**
 * Displays an OS-level desktop/mobile system notification banner (works when tab is minimized or in another app).
 */
export async function showSystemChatNotification(params: {
  title: string;
  body: string;
  conversationId: string;
  onClick?: () => void;
}): Promise<void> {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof Notification === 'undefined'
  ) {
    return;
  }
  if (Notification.permission !== 'granted') return;

  try {
    const options: NotificationOptions = {
      body: params.body,
      icon: '/favicon-192x192.png',
      badge: '/favicon-96x96.png',
      tag: `tcl_chat_${params.conversationId}`,
      renotify: true,
      data: { conversationId: params.conversationId },
    } as any;

    if (swRegistration && typeof swRegistration.showNotification === 'function') {
      await swRegistration.showNotification(params.title, options);
      return;
    }

    const notif = new Notification(params.title, options);
    notif.onclick = () => {
      try {
        window.focus();
        notif.close();
        params.onClick?.();
      } catch {
        // ignore
      }
    };
  } catch {
    // ignore
  }
}

/**
 * Flashes the browser tab title when there are unread messages so the Admin sees it in the tab bar / taskbar.
 */
export function updateTabTitleForUnreadChat(
  unreadCount: number,
  latestSenderName?: string
): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;

  if (unreadCount <= 0) {
    if (titleBlinkTimer) {
      clearInterval(titleBlinkTimer);
      titleBlinkTimer = null;
    }
    if (document.title.startsWith('💬') || document.title.startsWith('🔔')) {
      document.title = baseDocumentTitle;
    }
    return;
  }

  if (!document.title.startsWith('💬') && !document.title.startsWith('🔔')) {
    baseDocumentTitle = document.title || baseDocumentTitle;
  }

  if (titleBlinkTimer) return;
  let toggle = false;
  const senderLabel = latestSenderName || 'Khách hàng';
  titleBlinkTimer = setInterval(() => {
    toggle = !toggle;
    document.title = toggle
      ? `💬 (${unreadCount}) Tin nhắn mới từ ${senderLabel}!`
      : `🔔 (${unreadCount}) Hộp thư Tiệm Cuộn Len`;
  }, 1400);
}

/**
 * Queues a Server-side EmailJS + Telegram push notification to the Shop Owner (`vohoang1327@gmail.com`)
 * so the owner's phone receives an alert even when `tiemcuonlen.shop` is completely closed!
 */
export function queueServerChatPushToOwner(msg: ChatMessage): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!msg || msg.senderRole !== 'customer') return;

  pendingOwnerPushLines.push(msg.text);
  pendingOwnerPushMeta = {
    conversationId: msg.conversationId,
    customerName: msg.customerName || 'Khách hàng',
    customerEmail: msg.customerEmail,
    productName: msg.product?.name || pendingOwnerPushMeta?.productName,
  };

  if (pendingOwnerPushTimer) {
    clearTimeout(pendingOwnerPushTimer);
  }

  // Wait 3.5 seconds in case customer types 2 quick sentences ("hi" + "Mẫu này còn không shop?")
  pendingOwnerPushTimer = setTimeout(async () => {
    const combinedText = pendingOwnerPushLines.join('\n');
    const meta = pendingOwnerPushMeta;
    pendingOwnerPushLines = [];
    pendingOwnerPushMeta = null;
    pendingOwnerPushTimer = null;

    if (!meta || !combinedText.trim()) return;

    try {
      await fetch('/api/security-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'notify_chat',
          conversationId: meta.conversationId,
          customerName: meta.customerName,
          customerEmail: meta.customerEmail || '',
          text: combinedText.slice(0, 580),
          productName: meta.productName || '',
        }),
      });
    } catch {
      // Ignore network error
    }
  }, 3500);
}
