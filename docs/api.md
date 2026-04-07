# ClawFlow API 文件

## 概要

- **基礎路徑**: `/api/v1`（路由內實際為 `/api`，對外統一為 v1 語義）
- **預設埠號**: `3700`
- **資料格式**: JSON
- **認證**: 可選的 Bearer Token

---

## 認證

ClawFlow 預設不啟用認證。若需要保護 API，透過以下方式設定 token：

### 設定方式

```bash
# 方式一：環境變數
export CLAWFLOW_AUTH_TOKEN=my-secret-token
clawflow start

# 方式二：CLI 參數
clawflow start --auth-token my-secret-token
```

### 請求方式

設定 token 後，所有 API 請求須附帶 `Authorization` header：

```
Authorization: Bearer my-secret-token
```

### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "缺少 Authorization header"
  }
}
```

---

## 回應格式

所有 API 回應遵循統一的信封格式：

### 成功回應

```json
{
  "success": true,
  "data": { ... }
}
```

### 帶分頁的成功回應

```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "total": 42,
    "limit": 50,
    "offset": 0
  }
}
```

### 錯誤回應

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "任務不存在"
  }
}
```

---

## REST Endpoints

### 系統

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/health` | 健康檢查 |
| GET | `/api/stats` | 統計資訊 |
| POST | `/api/export` | 匯出全部資料 |
| POST | `/api/import` | 匯入資料 |

### 任務 (Tasks)

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/tasks` | 列出任務 |
| GET | `/api/tasks/:id` | 取得單一任務 |
| POST | `/api/tasks` | 建立任務 |
| PATCH | `/api/tasks/:id` | 更新任務 |
| DELETE | `/api/tasks/:id` | 刪除任務 |
| GET | `/api/tasks/:id/dependencies` | 取得任務依賴 |
| POST | `/api/tasks/:id/dependencies` | 新增任務依賴 |
| DELETE | `/api/tasks/:id/dependencies/:depId` | 移除任務依賴 |

### Agent

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/agents` | 列出 Agent |
| GET | `/api/agents/:id` | 取得單一 Agent |
| POST | `/api/agents/register` | 註冊 Agent |
| PATCH | `/api/agents/:id` | 更新 Agent |
| DELETE | `/api/agents/:id` | 刪除 Agent |
| POST | `/api/agents/:id/heartbeat` | Agent 心跳 |

### 事件 (Events)

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/events` | 列出事件 |
| POST | `/api/events` | 提交事件 |
| POST | `/api/events/batch` | 批量提交事件 |

### 工作流 (Workflows)

| Method | Path | 說明 |
|--------|------|------|
| GET | `/api/workflows` | 列出工作流 |
| GET | `/api/workflows/:id` | 取得工作流（含 steps） |
| POST | `/api/workflows` | 建立工作流 |
| PATCH | `/api/workflows/:id` | 更新工作流 |
| DELETE | `/api/workflows/:id` | 刪除工作流 |

---

## 詳細端點說明

### GET /api/health

健康檢查。

**回應範例**:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-04-07T14:00:00.000Z",
    "version": "0.1.0",
    "uptime": 3600.5
  }
}
```

### GET /api/stats

系統統計資訊。

**回應範例**:

```json
{
  "success": true,
  "data": {
    "tasks": {
      "total": 25,
      "done": 18,
      "completionRate": 72
    },
    "agents": { "total": 3 },
    "events": { "total": 150 },
    "workflows": { "total": 2 },
    "timestamp": "2026-04-07T14:00:00.000Z"
  }
}
```

### POST /api/export

匯出全部資料。

**回應範例**:

```json
{
  "success": true,
  "data": {
    "exportedAt": "2026-04-07T14:00:00.000Z",
    "version": "1.0.0",
    "tasks": [ ... ],
    "agents": [ ... ],
    "events": [ ... ],
    "workflows": [ ... ]
  }
}
```

### POST /api/import

匯入資料。

**請求範例**:

```json
{
  "tasks": [
    { "title": "實作 API", "priority": "high", "tags": ["backend"] },
    { "title": "撰寫測試", "status": "todo" }
  ],
  "agents": [
    { "name": "Claude Opus", "type": "claude-opus", "capabilities": ["coding", "research"] }
  ]
}
```

**回應範例**:

```json
{
  "success": true,
  "data": {
    "imported": {
      "tasks": 2,
      "agents": 1,
      "errors": []
    },
    "timestamp": "2026-04-07T14:00:00.000Z"
  }
}
```

---

### GET /api/tasks

列出任務，支援篩選與排序。

**查詢參數**:

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `limit` | number | 50 | 回傳數量上限 |
| `offset` | number | 0 | 偏移量 |
| `status` | string | - | 依狀態篩選（backlog/todo/in_progress/review/done/archived） |
| `priority` | string | - | 依優先級篩選（critical/high/medium/low） |
| `assignee` | string | - | 依指派 Agent ID 篩選 |
| `workflowId` | string | - | 依工作流 ID 篩選 |
| `tag` | string | - | 依標籤篩選 |
| `sort` | string | - | 排序欄位 |
| `order` | string | - | 排序方向（asc/desc） |

**回應範例**:

```json
{
  "success": true,
  "data": [
    {
      "id": "01HX...",
      "title": "實作 WebSocket 層",
      "description": null,
      "status": "in_progress",
      "priority": "high",
      "progress": 60,
      "assignee_agent_id": "agent-01",
      "tags": ["backend", "websocket"],
      "created_at": "2026-04-07T10:00:00.000Z",
      "updated_at": "2026-04-07T14:00:00.000Z"
    }
  ],
  "meta": { "total": 1, "limit": 50, "offset": 0 }
}
```

### POST /api/tasks

建立任務。

**請求 Body**:

```json
{
  "title": "實作 WebSocket 層",
  "description": "建立 WebSocket handler，支援 subscribe/unsubscribe",
  "status": "backlog",
  "priority": "high",
  "assigneeAgentId": "agent-01",
  "tags": ["backend", "websocket"],
  "dependencies": ["task-id-1"],
  "workflowId": "workflow-01"
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `title` | string | 是 | 標題（1-500 字） |
| `description` | string | 否 | 描述（最多 5000 字） |
| `status` | string | 否 | 初始狀態，預設 `backlog` |
| `priority` | string | 否 | 優先級，預設 `medium` |
| `assigneeAgentId` | string | 否 | 指派 Agent ID |
| `tags` | string[] | 否 | 標籤，最多 20 個 |
| `dependencies` | string[] | 否 | 前置依賴任務 ID |
| `workflowId` | string | 否 | 所屬工作流 ID |

### PATCH /api/tasks/:id

更新任務。僅需傳入要更新的欄位。

**請求 Body**:

```json
{
  "status": "in_progress",
  "progress": 45,
  "priority": "critical"
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `title` | string | 標題 |
| `description` | string | 描述 |
| `status` | string | 狀態 |
| `priority` | string | 優先級 |
| `assigneeAgentId` | string/null | 指派 Agent（null 取消指派） |
| `tags` | string[] | 標籤 |
| `progress` | number | 進度（0-100） |

### POST /api/tasks/:id/dependencies

新增任務依賴。

**請求 Body**:

```json
{
  "dependsOnTaskId": "task-id-to-depend-on"
}
```

---

### POST /api/agents/register

註冊新的 Agent。

**請求 Body**:

```json
{
  "name": "Claude Opus",
  "type": "claude-opus",
  "capabilities": ["coding", "research", "analysis"],
  "metadata": { "version": "4.0" }
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `name` | string | 是 | 顯示名稱（1-200 字） |
| `type` | string | 是 | Agent 類型（1-100 字） |
| `capabilities` | string[] | 否 | 能力標籤，最多 50 個 |
| `metadata` | object | 否 | 額外自訂資訊 |

### PATCH /api/agents/:id

更新 Agent。

**請求 Body**:

```json
{
  "status": "working",
  "metadata": { "currentTask": "task-01" }
}
```

| 欄位 | 型別 | 說明 |
|------|------|------|
| `name` | string | 顯示名稱 |
| `type` | string | Agent 類型 |
| `status` | string | 狀態（idle/working/completed/error） |
| `capabilities` | string[] | 能力標籤 |
| `metadata` | object | 額外資訊 |

### POST /api/agents/:id/heartbeat

Agent 心跳回報，用於確認 Agent 仍在線上。

**回應**：回傳更新後的 Agent 資訊。

---

### POST /api/events

提交事件。

**請求 Body**:

```json
{
  "event": "agent.progress",
  "source": "claude-code",
  "timestamp": "2026-04-07T14:00:00.000Z",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "agentId": "agent-01",
    "taskId": "task-01",
    "progress": 60,
    "message": "編輯檔案: src/server/ws/handler.ts"
  },
  "taskId": "task-01",
  "agentId": "agent-01"
}
```

| 欄位 | 型別 | 必填 | 說明 |
|------|------|------|------|
| `event` | string | 是 | 事件類型 |
| `source` | string | 是 | 來源 adapter ID |
| `timestamp` | string | 否 | ISO 8601 時間戳，預設為伺服器時間 |
| `correlationId` | string | 否 | UUID v4 關聯追蹤 ID |
| `payload` | object | 否 | 事件 payload，結構依事件類型而定 |
| `version` | string | 否 | 事件協議版本 |
| `metadata` | object | 否 | 額外 metadata |
| `taskId` | string | 否 | 相關任務 ID |
| `agentId` | string | 否 | 相關 Agent ID |

### POST /api/events/batch

批量提交事件（一次最多 100 筆）。

**請求 Body**:

```json
{
  "events": [
    { "event": "task.created", "source": "claude-code", "payload": { ... } },
    { "event": "agent.started", "source": "claude-code", "payload": { ... } }
  ]
}
```

### GET /api/events

列出事件。

**查詢參數**:

| 參數 | 型別 | 預設值 | 說明 |
|------|------|--------|------|
| `limit` | number | 50 | 回傳數量上限 |
| `offset` | number | 0 | 偏移量 |
| `type` | string | - | 依事件類型篩選 |
| `source` | string | - | 依來源篩選 |
| `taskId` | string | - | 依任務 ID 篩選 |
| `agentId` | string | - | 依 Agent ID 篩選 |
| `since` | string | - | 起始時間（ISO 8601） |
| `until` | string | - | 結束時間（ISO 8601） |

---

## 事件類型

ClawFlow 定義了三類共 12 種標準事件類型：

### 任務事件

| 事件類型 | 說明 |
|----------|------|
| `task.created` | 任務建立 |
| `task.updated` | 任務更新（狀態、進度、欄位變更） |
| `task.completed` | 任務完成 |
| `task.failed` | 任務失敗 |

### Agent 事件

| 事件類型 | 說明 |
|----------|------|
| `agent.registered` | Agent 註冊 |
| `agent.started` | Agent 開始處理任務 |
| `agent.progress` | Agent 回報進度 |
| `agent.completed` | Agent 完成任務 |
| `agent.error` | Agent 發生錯誤 |

### 工作流事件

| 事件類型 | 說明 |
|----------|------|
| `workflow.started` | 工作流啟動 |
| `workflow.step` | 工作流步驟執行 |
| `workflow.completed` | 工作流完成 |

---

## WebSocket 協議

ClawFlow 提供 WebSocket 即時事件推送，與 HTTP 伺服器共用同一埠號。

### 連線

```
ws://localhost:3700
```

連線成功後伺服器回傳：

```json
{ "type": "connected", "sessionId": "uuid-v4" }
```

### 訂閱事件

發送 subscribe 訊息，使用 glob pattern 篩選事件類型：

```json
{ "type": "subscribe", "pattern": "task.*" }
```

支援批量訂閱：

```json
{ "type": "subscribe", "patterns": ["task.*", "agent.*", "workflow.**"] }
```

伺服器確認：

```json
{
  "type": "subscribed",
  "patterns": ["task.*", "agent.*"],
  "totalSubscriptions": 2
}
```

### 取消訂閱

```json
{ "type": "unsubscribe", "pattern": "task.*" }
```

### 接收事件

訂閱後，匹配的事件會即時推送：

```json
{
  "type": "event",
  "pattern": "task.*",
  "event": "task.updated",
  "source": "claude-code",
  "timestamp": "2026-04-07T14:00:00.000Z",
  "payload": {
    "taskId": "task-01",
    "changes": { "status": "in_progress", "progress": 45 }
  }
}
```

### Ping/Pong 保活

客戶端可發送 ping：

```json
{ "type": "ping" }
```

伺服器回應：

```json
{ "type": "pong", "timestamp": "2026-04-07T14:00:00.000Z" }
```

伺服器也會每 30 秒發送 WebSocket 層級的 ping frame 進行保活。

### Glob Pattern 語法

| Pattern | 匹配範圍 |
|---------|----------|
| `task.*` | 所有任務事件（task.created, task.updated, ...） |
| `agent.*` | 所有 Agent 事件 |
| `workflow.*` | 所有工作流事件 |
| `*.*` | 所有事件 |
| `**.completed` | 所有 completed 類型事件 |

### 錯誤處理

訊息格式錯誤時：

```json
{ "type": "error", "message": "無法解析的訊息格式" }
```
