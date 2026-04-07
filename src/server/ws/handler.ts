/**
 * WebSocket Handler
 *
 * 與 HTTP server 共用 port。
 * - 連線時發送 `{ type: 'connected', sessionId }`
 * - 支援 subscribe/unsubscribe（glob pattern）
 * - 監聽 EventBus，將匹配事件推送給訂閱的 client
 * - ping/pong 保活
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { eventBus, type BusEvent, type BusListener } from '../../core/services/event-bus.js';

/** 客戶端 session 資訊 */
interface ClientSession {
  readonly sessionId: string;
  readonly ws: WebSocket;
  /** 已訂閱的 pattern → listener 映射 */
  readonly subscriptions: Map<string, BusListener>;
  /** 最後活動時間 */
  lastActivity: number;
}

/** 將 glob pattern 轉換為 RegExp（與 EventBus 邏輯一致） */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regexStr = escaped
    .replace(/\*\*/g, '##DOUBLESTAR##')
    .replace(/\*/g, '[^.]*')
    .replace(/##DOUBLESTAR##/g, '.*');
  return new RegExp(`^${regexStr}$`);
}

/** 安全地發送 JSON 給 client */
function sendJson(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/** WebSocket client 入站訊息格式 */
interface WsMessage {
  readonly type: 'subscribe' | 'unsubscribe' | 'ping';
  readonly pattern: string | null;
  readonly patterns: readonly string[] | null;
}

/** 解析入站訊息 */
function parseMessage(raw: string): WsMessage | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const type = parsed['type'] as string | undefined;
    if (type !== 'subscribe' && type !== 'unsubscribe' && type !== 'ping') {
      return null;
    }
    return {
      type,
      pattern: (parsed['pattern'] as string) ?? null,
      patterns: (parsed['patterns'] as readonly string[]) ?? null,
    };
  } catch {
    return null;
  }
}

/** 保活間隔（毫秒） */
const PING_INTERVAL = 30_000;

/** 最大連線數 */
const MAX_CLIENTS = 100;

/** 每個 client 最大訂閱數 */
const MAX_SUBSCRIPTIONS = 50;

/** 驗證 WebSocket 連線的 token */
function verifyWsToken(req: IncomingMessage): boolean {
  const configuredToken = process.env['CLAWFLOW_AUTH_TOKEN'];

  // 未設定 token 時允許所有連線
  if (!configuredToken) return true;

  // 從 query string 取得 token
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  let token = url.searchParams.get('token');

  // 從 Authorization header 取得 token
  if (!token) {
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      const [scheme, headerToken] = authHeader.split(' ');
      if (scheme === 'Bearer' && headerToken) {
        token = headerToken;
      }
    }
  }

  if (!token) return false;

  // 使用 timingSafeEqual 避免 timing attack
  const tokenBuf = Buffer.from(token, 'utf-8');
  const configBuf = Buffer.from(configuredToken, 'utf-8');
  if (tokenBuf.length !== configBuf.length) return false;
  return timingSafeEqual(tokenBuf, configBuf);
}

/** 建立 WebSocket server 並掛載到 HTTP server */
export function createWsServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    maxPayload: 64 * 1024, // 64KB 限制
  });
  const clients = new Map<string, ClientSession>();

  // 定時 ping 保活
  const pingTimer = setInterval(() => {
    for (const [sessionId, client] of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      } else {
        // 清理斷線的 client
        cleanupClient(sessionId);
      }
    }
  }, PING_INTERVAL);

  /** 清理 client 的所有訂閱 */
  function cleanupClient(sessionId: string): void {
    const client = clients.get(sessionId);
    if (!client) return;

    for (const [pattern, listener] of client.subscriptions) {
      eventBus.off(pattern, listener);
    }
    client.subscriptions.clear();
    clients.delete(sessionId);
  }

  /** 為 client 訂閱一個 pattern */
  function subscribePattern(client: ClientSession, pattern: string): void {
    // 避免重複訂閱
    if (client.subscriptions.has(pattern)) return;

    const regex = globToRegex(pattern);
    const listener: BusListener = (event: BusEvent) => {
      if (regex.test(event.event)) {
        sendJson(client.ws, {
          type: 'event',
          pattern,
          ...event,
        });
      }
    };

    eventBus.on(pattern, listener);
    client.subscriptions.set(pattern, listener);
  }

  /** 為 client 取消訂閱一個 pattern */
  function unsubscribePattern(client: ClientSession, pattern: string): void {
    const listener = client.subscriptions.get(pattern);
    if (!listener) return;

    eventBus.off(pattern, listener);
    client.subscriptions.delete(pattern);
  }

  wss.on('connection', (ws, req) => {
    // 連線認證
    if (!verifyWsToken(req)) {
      ws.close(1008, '認證失敗');
      return;
    }

    // 最大連線數限制
    if (clients.size >= MAX_CLIENTS) {
      ws.close(1013, '超過最大連線數');
      return;
    }

    const sessionId = crypto.randomUUID();

    const client: ClientSession = {
      sessionId,
      ws,
      subscriptions: new Map(),
      lastActivity: Date.now(),
    };

    clients.set(sessionId, client);

    // 送出連線確認
    sendJson(ws, { type: 'connected', sessionId });

    ws.on('message', (raw) => {
      client.lastActivity = Date.now();
      const msg = parseMessage(raw.toString());
      if (!msg) {
        sendJson(ws, { type: 'error', message: '無法解析的訊息格式' });
        return;
      }

      switch (msg.type) {
        case 'ping':
          sendJson(ws, { type: 'pong', timestamp: new Date().toISOString() });
          break;

        case 'subscribe': {
          const patterns = msg.patterns !== null
            ? [...msg.patterns]
            : msg.pattern !== null
              ? [msg.pattern]
              : [];

          for (const p of patterns) {
            // 訂閱數上限檢查
            if (client.subscriptions.size >= MAX_SUBSCRIPTIONS) {
              sendJson(ws, {
                type: 'error',
                message: `超過最大訂閱數限制（${MAX_SUBSCRIPTIONS}）`,
              });
              break;
            }
            subscribePattern(client, p);
          }

          sendJson(ws, {
            type: 'subscribed',
            patterns,
            totalSubscriptions: client.subscriptions.size,
          });
          break;
        }

        case 'unsubscribe': {
          const patterns = msg.patterns !== null
            ? [...msg.patterns]
            : msg.pattern !== null
              ? [msg.pattern]
              : [];

          for (const p of patterns) {
            unsubscribePattern(client, p);
          }

          sendJson(ws, {
            type: 'unsubscribed',
            patterns,
            totalSubscriptions: client.subscriptions.size,
          });
          break;
        }
      }
    });

    ws.on('close', () => {
      cleanupClient(sessionId);
    });

    ws.on('error', () => {
      cleanupClient(sessionId);
    });

    ws.on('pong', () => {
      client.lastActivity = Date.now();
    });
  });

  // 關閉時清理
  wss.on('close', () => {
    clearInterval(pingTimer);
    for (const sessionId of clients.keys()) {
      cleanupClient(sessionId);
    }
  });

  return wss;
}
