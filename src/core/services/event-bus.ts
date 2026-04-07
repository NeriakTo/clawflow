/**
 * EventBus — 簡易 pub/sub 事件匯流排
 *
 * 支援 glob pattern 訂閱（`task.*`、`agent.*`、`*`）。
 * 單例模式，整個 clawflow 共用一個實例。
 */

/** 事件 payload（最小契約） */
export interface BusEvent {
  readonly event: string;
  readonly [key: string]: unknown;
}

/** 事件 listener 型別 */
export type BusListener = (event: BusEvent) => void;

/** 將 glob pattern 轉換為 RegExp */
function globToRegex(pattern: string): RegExp {
  // 跳脫正則特殊字元，保留 `*`
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  // `**` → 匹配任意字元（含 `.`）
  // `*`  → 匹配不含 `.` 的任意字元
  const regexStr = escaped
    .replace(/\*\*/g, '##DOUBLESTAR##')
    .replace(/\*/g, '[^.]*')
    .replace(/##DOUBLESTAR##/g, '.*');
  return new RegExp(`^${regexStr}$`);
}

/** 訂閱紀錄 */
interface Subscription {
  readonly pattern: string;
  readonly regex: RegExp;
  readonly listener: BusListener;
}

class EventBusImpl {
  private readonly subscriptions: Subscription[] = [];

  /**
   * 訂閱事件
   * @param pattern - glob pattern，例如 `task.*`、`agent.registered`、`*`
   * @param listener - 回呼函式
   */
  on(pattern: string, listener: BusListener): void {
    this.subscriptions.push({
      pattern,
      regex: globToRegex(pattern),
      listener,
    });
  }

  /**
   * 取消訂閱
   * @param pattern - 必須與 `on()` 時完全相同
   * @param listener - 必須為同一個 function reference
   */
  off(pattern: string, listener: BusListener): void {
    const idx = this.subscriptions.findIndex(
      (s) => s.pattern === pattern && s.listener === listener,
    );
    if (idx !== -1) {
      this.subscriptions.splice(idx, 1);
    }
  }

  /**
   * 廣播事件給所有匹配的 listener
   * @param event - 必須包含 `event` 欄位（事件名稱）
   */
  emit(event: BusEvent): void {
    for (const sub of this.subscriptions) {
      if (sub.regex.test(event.event)) {
        try {
          sub.listener(event);
        } catch (error) {
          // listener 內部錯誤不應影響其他 listener，但需記錄
          console.error('[EventBus] Listener error:', error);
        }
      }
    }
  }

  /** 移除所有訂閱（主要用於測試） */
  clear(): void {
    this.subscriptions.length = 0;
  }
}

/** 單例 EventBus 實例 */
export const eventBus = new EventBusImpl();

export type EventBus = EventBusImpl;
