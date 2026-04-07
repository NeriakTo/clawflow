/**
 * WebSocket Store — 連線管理與事件分發
 */
import { create } from 'zustand';
import type { WsEvent } from '../types';

interface WsStore {
  readonly connected: boolean;
  readonly reconnectAttempts: number;
  connect(): void;
  disconnect(): void;
  /** 註冊事件監聽器，回傳 unsubscribe 函式 */
  subscribe(handler: (event: WsEvent) => void): () => void;
}

/** 監聽器集合（模組層級，避免 Zustand 重新渲染） */
const listeners = new Set<(event: WsEvent) => void>();

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;

function getWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export const useWsStore = create<WsStore>((set, get) => ({
  connected: false,
  reconnectAttempts: 0,

  connect() {
    if (ws !== null && ws.readyState === WebSocket.OPEN) {
      return;
    }

    const url = getWsUrl();
    ws = new WebSocket(url);

    ws.onopen = () => {
      set({ connected: true, reconnectAttempts: 0 });
    };

    ws.onmessage = (event) => {
      try {
        const parsed: WsEvent = JSON.parse(event.data as string);
        for (const handler of listeners) {
          handler(parsed);
        }
      } catch {
        // 忽略無法解析的訊息
      }
    };

    ws.onclose = () => {
      set({ connected: false });
      ws = null;

      const { reconnectAttempts } = get();
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = BASE_DELAY_MS * Math.pow(2, reconnectAttempts);
        reconnectTimer = setTimeout(() => {
          set({ reconnectAttempts: reconnectAttempts + 1 });
          get().connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      // onclose 會接著觸發，在那裡處理重連
    };
  },

  disconnect() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws !== null) {
      ws.close();
      ws = null;
    }
    set({ connected: false, reconnectAttempts: 0 });
  },

  subscribe(handler: (event: WsEvent) => void) {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  },
}));
