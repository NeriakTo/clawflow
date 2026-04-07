/**
 * Adapter 介面定義
 * 定義 CLIAdapter 的標準協議，所有 CLI adapter 必須實作此介面
 */

/** 標準化事件（Adapter 層簡化版） */
export interface StandardEvent {
  /** 事件類型 */
  readonly event: string;
  /** 事件來源 adapter ID */
  readonly source: string;
  /** ISO 8601 時間戳 */
  readonly timestamp: string;
  /** 事件 payload */
  readonly payload: Record<string, unknown>;
}

/** Adapter 指令（從伺服器送往 CLI） */
export interface AdapterCommand {
  /** 指令類型 */
  readonly type: string;
  /** 目標 agent/task ID */
  readonly target: string;
  /** 指令參數 */
  readonly params: Record<string, unknown>;
}

/** Adapter 配置 */
export interface AdapterConfig {
  /** 是否啟用 */
  readonly enabled: boolean;
  /** 額外選項 */
  readonly options: Record<string, unknown>;
}

/** Adapter 健康狀態 */
export interface AdapterHealthStatus {
  /** 是否健康 */
  readonly healthy: boolean;
  /** 狀態訊息 */
  readonly message?: string;
  /** 最後一次收到事件的時間 */
  readonly lastEventAt?: string;
}

/** 事件接收回呼 */
export type EventSink = (event: StandardEvent) => void;

/**
 * CLI Adapter 介面
 * 每個支援的 CLI 工具（Claude Code、Codex CLI、Gemini CLI、OpenClaw）
 * 都需要實作此介面
 */
export interface CLIAdapter {
  /** Adapter 唯一識別碼 */
  readonly id: string;
  /** Adapter 顯示名稱 */
  readonly name: string;
  /** Adapter 版本號 */
  readonly version: string;

  /**
   * 連線到 CLI 工具
   * @param config Adapter 配置
   * @param eventSink 事件接收回呼
   */
  connect(config: AdapterConfig, eventSink: EventSink): Promise<void>;

  /**
   * 斷開連線
   */
  disconnect(): Promise<void>;

  /**
   * 將原始事件轉換為標準格式
   * @param rawEvent 原始事件資料
   * @returns 標準化事件，無法解析時回傳 null
   */
  translateEvent(rawEvent: unknown): StandardEvent | null;

  /**
   * 發送指令到 CLI 工具（選填，部分 adapter 可能不支援）
   * @param command 指令
   */
  sendCommand?(command: AdapterCommand): Promise<void>;

  /**
   * 健康檢查
   * @returns 健康狀態
   */
  healthCheck(): Promise<AdapterHealthStatus>;
}
