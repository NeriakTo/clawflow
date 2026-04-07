/**
 * Claude Code Adapter
 *
 * 透過 Claude Code Hooks 整合 clawflow 事件系統。
 * PostToolUse hook 呼叫 clawflow REST API 回報事件，
 * 此 adapter 負責：
 * 1. 將 Claude Code hook 送來的 raw event 轉譯為 StandardEvent
 * 2. 管理 Claude Code agent 的生命週期
 * 3. 追蹤已知的 session 狀態
 */

import type {
  CLIAdapter,
  AdapterConfig,
  AdapterHealthStatus,
  EventSink,
  StandardEvent,
} from '../types.js';
import { parseHookPayload, generateHookConfig } from './hooks.js';
import {
  mapClaudeCodeEvent,
  createWorkflowStartedEvent,
  type ClaudeCodeRawEvent,
} from './event-mapper.js';

/** Adapter 常數 */
const ADAPTER_ID = 'claude-code';
const ADAPTER_NAME = 'Claude Code';
const ADAPTER_VERSION = '0.1.0';

/** 已知 session 追蹤狀態 */
interface SessionState {
  readonly sessionId: string;
  readonly startedAt: string;
  lastEventAt: string;
  eventCount: number;
}

/**
 * Claude Code CLIAdapter 實作
 *
 * 此 adapter 為被動模式 — 不主動連線 Claude Code，
 * 而是透過 hooks 被動接收 POST 到 /api/v1/events 的事件。
 * connect() 主要用於初始化內部狀態。
 */
export class ClaudeCodeAdapter implements CLIAdapter {
  readonly id = ADAPTER_ID;
  readonly name = ADAPTER_NAME;
  readonly version = ADAPTER_VERSION;

  private eventSink: EventSink | null = null;
  private _config: AdapterConfig | null = null;
  private connected = false;
  private readonly sessions: Map<string, SessionState> = new Map();
  private lastEventAt: string | undefined;

  /**
   * 連線（初始化 adapter）
   * 被動模式，僅儲存 eventSink 以便後續轉發事件
   */
  async connect(config: AdapterConfig, eventSink: EventSink): Promise<void> {
    this._config = config;
    this.eventSink = eventSink;
    this.connected = true;
  }

  /**
   * 斷開連線，清理所有狀態
   */
  async disconnect(): Promise<void> {
    this.eventSink = null;
    this._config = null;
    this.connected = false;
    this.sessions.clear();
    this.lastEventAt = undefined;
  }

  /**
   * 將原始事件轉換為 StandardEvent
   *
   * @param rawEvent Express request body 或 ClaudeCodeRawEvent
   * @returns 標準化事件，無法解析時回傳 null
   */
  translateEvent(rawEvent: unknown): StandardEvent | null {
    // 嘗試解析為 ClaudeCodeRawEvent
    const parsed = isClaudeCodeRawEvent(rawEvent)
      ? rawEvent
      : parseHookPayload(rawEvent);

    if (parsed === null) {
      return null;
    }

    // 追蹤 session 狀態
    this.trackSession(parsed);

    // 映射為 StandardEvent
    const event = mapClaudeCodeEvent(parsed, ADAPTER_ID);
    if (event === null) {
      return null;
    }

    // 更新最後事件時間
    this.lastEventAt = event.timestamp;

    // 轉發至 eventSink
    if (this.eventSink !== null) {
      this.eventSink(event);
    }

    return event;
  }

  /**
   * 健康檢查
   * 被動模式下，只要 adapter 已初始化即視為健康
   */
  async healthCheck(): Promise<AdapterHealthStatus> {
    if (!this.connected) {
      return {
        healthy: false,
        message: 'Adapter 尚未連線',
      };
    }

    return {
      healthy: true,
      message: `已追蹤 ${this.sessions.size} 個 session`,
      ...(this.lastEventAt !== undefined ? { lastEventAt: this.lastEventAt } : {}),
    };
  }

  // ── 公開輔助方法 ────────────────────────────────────────────

  /**
   * 取得 adapter 配置
   */
  getConfig(): AdapterConfig | null {
    return this._config;
  }

  /**
   * 取得 hook 設定建議
   */
  getHookConfig(baseUrl?: string, authToken?: string): ReturnType<typeof generateHookConfig> {
    return generateHookConfig(baseUrl, authToken);
  }

  /**
   * 取得所有已知 session
   */
  getSessions(): ReadonlyMap<string, Readonly<SessionState>> {
    return this.sessions;
  }

  /**
   * 檢查 adapter 是否已連線
   */
  isConnected(): boolean {
    return this.connected;
  }

  // ── 私有方法 ────────────────────────────────────────────────

  /**
   * 追蹤 session 狀態
   * 首次出現的 sessionId 自動發送 workflow.started
   */
  private trackSession(raw: ClaudeCodeRawEvent): void {
    const { sessionId } = raw;
    const now = new Date().toISOString();

    const existing = this.sessions.get(sessionId);
    if (existing !== undefined) {
      existing.lastEventAt = now;
      existing.eventCount += 1;
      return;
    }

    // 新 session — 發送 workflow.started
    this.sessions.set(sessionId, {
      sessionId,
      startedAt: now,
      lastEventAt: now,
      eventCount: 1,
    });

    const startEvent = createWorkflowStartedEvent(sessionId, ADAPTER_ID);
    if (this.eventSink !== null) {
      this.eventSink(startEvent);
    }
  }
}

// ── 型別守衛 ──────────────────────────────────────────────────

/** 檢查是否為 ClaudeCodeRawEvent */
function isClaudeCodeRawEvent(value: unknown): value is ClaudeCodeRawEvent {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['hookType'] === 'string' &&
    typeof obj['tool'] === 'string' &&
    typeof obj['sessionId'] === 'string'
  );
}

/**
 * 建立 Claude Code adapter 實例（工廠函式）
 */
export function createClaudeCodeAdapter(): ClaudeCodeAdapter {
  return new ClaudeCodeAdapter();
}

// 重新匯出子模組
export { generateHookConfig, parseHookPayload } from './hooks.js';
export { mapClaudeCodeEvent, createWorkflowStartedEvent } from './event-mapper.js';
export type { ClaudeCodeRawEvent } from './event-mapper.js';
