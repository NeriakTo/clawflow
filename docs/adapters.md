# Adapter 開發指南

本文件說明 ClawFlow Adapter 架構的設計原理、CLIAdapter 介面規範，以及如何建立自訂 Adapter。

---

## 架構概述

ClawFlow 透過 Adapter 層抽象不同 AI CLI 工具的事件格式差異。每個 Adapter 負責：

1. **連線管理** -- 建立與 CLI 工具的通訊通道
2. **事件轉譯** -- 將 CLI 工具的原始事件轉換為 ClawFlow 標準事件格式（`StandardEvent`）
3. **指令發送** -- 將 ClawFlow 指令轉發給 CLI 工具（選填，部分 adapter 不支援）
4. **健康檢查** -- 回報 adapter 的連線狀態

```
CLI 工具 (Claude Code, Codex, ...)
        |
        v  (原始事件)
   +-----------+
   |  Adapter  |  <-- 實作 CLIAdapter 介面
   +-----------+
        |
        v  (StandardEvent)
   +-----------+
   | EventBus  |  --> WebSocket 推送
   +-----------+       REST API 查詢
        |              SQLite 儲存
        v
   +-----------+
   |  Web UI   |
   +-----------+
```

---

## CLIAdapter 介面

所有 Adapter 必須實作 `CLIAdapter` 介面。介面定義位於 `src/adapters/types.ts`。

```typescript
interface CLIAdapter {
  /** Adapter 唯一識別碼，例如 "claude-code" */
  readonly id: string;

  /** Adapter 顯示名稱，例如 "Claude Code" */
  readonly name: string;

  /** Adapter 版本號 */
  readonly version: string;

  /**
   * 連線到 CLI 工具
   * @param config Adapter 配置
   * @param eventSink 事件接收回呼，adapter 轉譯完的事件透過此回呼送入 ClawFlow
   */
  connect(config: AdapterConfig, eventSink: EventSink): Promise<void>;

  /**
   * 斷開連線，清理所有資源
   */
  disconnect(): Promise<void>;

  /**
   * 將原始事件轉換為標準格式
   * @param rawEvent 原始事件資料（格式由各 CLI 工具決定）
   * @returns StandardEvent，無法解析時回傳 null
   */
  translateEvent(rawEvent: unknown): StandardEvent | null;

  /**
   * 發送指令到 CLI 工具（選填）
   * 部分 adapter 僅為被動接收模式，不實作此方法
   */
  sendCommand?(command: AdapterCommand): Promise<void>;

  /**
   * 健康檢查
   * @returns 健康狀態
   */
  healthCheck(): Promise<AdapterHealthStatus>;
}
```

### 相關型別

```typescript
/** 標準化事件 */
interface StandardEvent {
  readonly event: string;      // 事件類型（如 "task.updated"）
  readonly source: string;     // 來源 adapter ID
  readonly timestamp: string;  // ISO 8601 時間戳
  readonly payload: Record<string, unknown>;  // 事件 payload
}

/** Adapter 配置 */
interface AdapterConfig {
  readonly enabled: boolean;
  readonly options: Record<string, unknown>;
}

/** Adapter 指令 */
interface AdapterCommand {
  readonly type: string;
  readonly target: string;
  readonly params: Record<string, unknown>;
}

/** 健康狀態 */
interface AdapterHealthStatus {
  readonly healthy: boolean;
  readonly message?: string;
  readonly lastEventAt?: string;
}

/** 事件接收回呼 */
type EventSink = (event: StandardEvent) => void;
```

---

## 建立自訂 Adapter

以下以一個假想的 "my-cli" 工具為例，說明建立自訂 Adapter 的完整流程。

### 步驟一：建立目錄結構

```
src/adapters/my-cli/
├── index.ts         # Adapter 主體實作
└── event-mapper.ts  # 事件映射邏輯（選填，可內嵌於 index.ts）
```

### 步驟二：實作 CLIAdapter

```typescript
// src/adapters/my-cli/index.ts

import type {
  CLIAdapter,
  AdapterConfig,
  AdapterHealthStatus,
  EventSink,
  StandardEvent,
} from '../types.js';

export class MyCLIAdapter implements CLIAdapter {
  readonly id = 'my-cli';
  readonly name = 'My CLI Tool';
  readonly version = '0.1.0';

  private eventSink: EventSink | null = null;
  private connected = false;

  async connect(config: AdapterConfig, eventSink: EventSink): Promise<void> {
    this.eventSink = eventSink;
    this.connected = true;

    // 在此建立與 CLI 工具的通訊通道
    // 例如：監聽 log 檔案、建立 WebSocket 連線、啟動 polling 等
  }

  async disconnect(): Promise<void> {
    this.eventSink = null;
    this.connected = false;
    // 清理資源
  }

  translateEvent(rawEvent: unknown): StandardEvent | null {
    // 將 CLI 工具的原始事件格式轉換為 StandardEvent
    if (!isValidRawEvent(rawEvent)) {
      return null;
    }

    const event: StandardEvent = {
      event: mapEventType(rawEvent),    // 映射為 ClawFlow 事件類型
      source: this.id,
      timestamp: new Date().toISOString(),
      payload: extractPayload(rawEvent), // 擷取 payload
    };

    // 轉發至 eventSink
    if (this.eventSink !== null) {
      this.eventSink(event);
    }

    return event;
  }

  async healthCheck(): Promise<AdapterHealthStatus> {
    return {
      healthy: this.connected,
      message: this.connected ? 'Adapter 運作正常' : 'Adapter 尚未連線',
    };
  }
}
```

### 步驟三：註冊 Adapter

在 `AdapterRegistry` 中註冊你的 adapter：

```typescript
import { AdapterRegistry } from './registry.js';
import { MyCLIAdapter } from './my-cli/index.js';

const registry = new AdapterRegistry();

// 註冊 adapter
registry.register(new MyCLIAdapter(), {
  enabled: true,
  options: { /* 自訂選項 */ },
});

// 連線所有已啟用的 adapter
await registry.connectAll((event) => {
  // 處理接收到的事件
  eventBus.emit(event);
});
```

### 步驟四：匯出並整合

在 `src/adapters/index.ts` 中匯出你的 adapter：

```typescript
export { MyCLIAdapter } from './my-cli/index.js';
```

---

## Claude Code Adapter 範例

Claude Code Adapter 是 ClawFlow 內建的參考實作，採用**被動模式**運作。以下說明其設計要點。

### 整合方式

Claude Code 透過 [hooks 機制](https://docs.anthropic.com/en/docs/claude-code) 在工具使用前後觸發外部指令。ClawFlow 的 Claude Code Adapter 利用此機制：

1. 在 `~/.claude/settings.json` 設定 hooks
2. Hook 在工具使用時透過 `curl` 呼叫 ClawFlow REST API (`POST /api/v1/events`)
3. ClawFlow 接收後由 Adapter 轉譯為 StandardEvent

### 被動模式

Claude Code Adapter 不主動連線 Claude Code，`connect()` 僅初始化內部狀態：

```typescript
async connect(config: AdapterConfig, eventSink: EventSink): Promise<void> {
  this._config = config;
  this.eventSink = eventSink;
  this.connected = true;
  // 不需要主動建立連線 — 事件由 hook 透過 REST API 推送進來
}
```

### 事件映射規則

| Claude Code Hook | 工具 | ClawFlow 事件 |
|------------------|------|---------------|
| PreToolUse | Agent, Skill | `agent.started` |
| PostToolUse | Agent, Skill | `agent.completed` |
| PostToolUse | TodoWrite, TaskCreate | `task.created` |
| PostToolUse | TaskUpdate | `task.updated` |
| PostToolUse | Write, Edit, Bash, Read, Grep, Glob | `agent.progress` |
| PostToolUse | 其他工具 | `agent.progress` |
| Stop | (任意) | `workflow.completed` |

### Session 追蹤

Adapter 自動追蹤 Claude Code session。首次出現新的 `sessionId` 時，自動發送 `workflow.started` 事件：

```typescript
private trackSession(raw: ClaudeCodeRawEvent): void {
  const { sessionId } = raw;
  if (this.sessions.has(sessionId)) {
    // 更新已知 session 的統計
    return;
  }
  // 新 session — 自動發送 workflow.started
  const startEvent = createWorkflowStartedEvent(sessionId, ADAPTER_ID);
  this.eventSink?.(startEvent);
}
```

### Hook 設定生成

Adapter 提供工具函式，自動生成建議的 hook 設定：

```typescript
import { generateHookConfig } from 'clawflow/adapters/claude-code';

const config = generateHookConfig('http://localhost:3700', 'my-auth-token');
// 回傳可直接合併至 ~/.claude/settings.json 的 hooks 設定
```

---

## 事件映射指南

建立新 Adapter 時，需要將 CLI 工具的原始事件映射為 ClawFlow 的 12 種標準事件類型。以下是映射的一般原則：

### 任務事件

| 場景 | 建議事件 |
|------|----------|
| CLI 工具建立新的待辦項目 | `task.created` |
| 任務狀態/進度變更 | `task.updated` |
| 任務成功完成 | `task.completed` |
| 任務執行失敗 | `task.failed` |

### Agent 事件

| 場景 | 建議事件 |
|------|----------|
| 新的 agent 實例加入 | `agent.registered` |
| Agent 開始處理任務 | `agent.started` |
| Agent 回報中間進度（檔案編輯、指令執行等） | `agent.progress` |
| Agent 完成分配的任務 | `agent.completed` |
| Agent 遇到錯誤 | `agent.error` |

### 工作流事件

| 場景 | 建議事件 |
|------|----------|
| 一個 session 或流程啟動 | `workflow.started` |
| 流程中的某個步驟執行 | `workflow.step` |
| 整個流程結束 | `workflow.completed` |

### Payload 結構

每種事件類型有對應的 payload 結構，定義於 `src/core/events/schema.ts`。建議參照 Zod schema 確保 payload 符合格式。範例：

```typescript
// agent.progress payload
{
  agentId: "agent-01",
  taskId: "task-01",
  progress: 60,          // 0-100，-1 表示不確定
  message: "編輯檔案"    // 選填
}
```

---

## Adapter 註冊表 (AdapterRegistry)

`AdapterRegistry` 是 Adapter 的集中管理元件，定義於 `src/adapters/registry.ts`。

### 主要方法

| 方法 | 說明 |
|------|------|
| `register(adapter, config)` | 註冊 adapter（ID 不可重複） |
| `unregister(id)` | 移除 adapter（若已連線會先斷線） |
| `get(id)` | 取得指定 adapter |
| `listIds()` | 取得所有已註冊的 adapter ID |
| `connect(id, eventSink)` | 連線指定 adapter |
| `connectAll(eventSink)` | 連線所有已啟用的 adapter |
| `disconnectAll()` | 斷開所有 adapter |
| `healthCheckAll()` | 對所有已連線 adapter 執行健康檢查 |

### 生命週期

```
register() --> connect() --> [正常運作] --> disconnect() --> unregister()
                                 |
                           healthCheck()
```

---

## 檔案索引

| 檔案路徑 | 說明 |
|----------|------|
| `src/adapters/types.ts` | CLIAdapter 介面 + 相關型別定義 |
| `src/adapters/registry.ts` | AdapterRegistry 實作 |
| `src/adapters/index.ts` | Adapter 模組匯出入口 |
| `src/adapters/claude-code/index.ts` | Claude Code Adapter 實作 |
| `src/adapters/claude-code/hooks.ts` | Hook 設定生成 + payload 解析 |
| `src/adapters/claude-code/event-mapper.ts` | 事件映射邏輯 |
| `src/core/events/schema.ts` | 事件型別 Zod Schema（single source of truth） |
| `src/core/events/types.ts` | 事件型別 TypeScript 定義 |
