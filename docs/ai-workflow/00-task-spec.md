# clawflow — Product Requirements Document (PRD)

## 版本資訊
- **版本**: v1.0.0-draft
- **日期**: 2026-04-07
- **作者**: CC (Claude Code) + Kevin
- **狀態**: Phase 0 — 規劃中

---

## 1. 產品概述

### 1.1 名稱
**clawflow** — 通用 AI CLI 工作流觀察面板

### 1.2 一句話定位
讓任何 AI coding CLI 的工作流程可視化、可追蹤、可複製部署的開源觀察面板。

### 1.3 問題陳述
當前 AI coding CLI（Claude Code、Codex CLI、Gemini CLI、OpenClaw）在執行多 agent 並行任務時：
- 缺乏統一的任務狀態觀察介面
- 進度追蹤依賴手動回報（如 Discord 訊息）
- 無法視覺化 agent 間的 DAG 依賴關係
- 不同 CLI 工具之間的工作流無法統一呈現

### 1.4 解決方案
提供一個輕量、可嵌入的工作流觀察面板，透過標準化事件協議，讓任何 AI CLI 都能接入，實現：
- 即時任務狀態追蹤
- Agent 生命週期可視化
- DAG 依賴圖渲染
- 跨 CLI 統一觀察

---

## 2. 目標使用者

### 2.1 主要使用者
- 使用 AI coding CLI 的**開發者**（個人或團隊）
- 管理多個 AI agent 的**技術主管**

### 2.2 使用場景
| 場景 | 描述 |
|------|------|
| 個人開發者 | 一人操控 Claude Code + Codex，需要同時觀察兩邊進度 |
| 團隊協作 | 多人各自使用不同 AI CLI，需統一看板追蹤專案進度 |
| 自動化流水線 | CI/CD 中 agent 自動分派任務，需即時監控執行狀態 |

---

## 3. 功能需求

### 3.1 Core（核心層）

#### 3.1.1 任務管理
- **CRUD**：建立、讀取、更新、刪除任務
- **狀態流**：`backlog` → `todo` → `in_progress` → `review` → `done` / `archived`
- **欄位**：title, description, status, priority, assignee (agent), tags, dependencies, progress (0-100), created_at, updated_at
- **DAG 依賴**：任務間可定義 `dependsOn` 關係，阻塞未完成依賴的任務

#### 3.1.2 Agent 追蹤
- **Agent 註冊**：每個 CLI adapter 註冊其 agent 資訊（id, name, type, capabilities）
- **狀態追蹤**：`idle` / `working` / `completed` / `error`
- **任務綁定**：agent ↔ task 雙向關聯
- **進度串流**：agent 可即時回報進度百分比與日誌

#### 3.1.3 事件系統
- **標準化事件協議**（JSON Schema）：
  ```json
  {
    "event": "task.updated",
    "source": "claude-code",
    "timestamp": "2026-04-07T14:00:00Z",
    "payload": { "taskId": "xxx", "status": "in_progress", "progress": 45 }
  }
  ```
- **事件類型**：
  - `task.created` / `task.updated` / `task.completed` / `task.failed`
  - `agent.registered` / `agent.started` / `agent.progress` / `agent.completed` / `agent.error`
  - `workflow.started` / `workflow.step` / `workflow.completed`

#### 3.1.4 儲存
- **SQLite**（內嵌，零外部依賴）
- 表結構：`tasks`, `agents`, `events`, `workflows`
- 支援匯出/匯入（JSON）

### 3.2 Web UI（前端）

#### 3.2.1 看板視圖
- Kanban 欄位（依 status 分組）
- 拖拉變更狀態
- 任務卡片顯示：標題、agent、進度條、優先級標籤
- DAG 依賴線條連接

#### 3.2.2 DAG 視圖
- 有向無環圖渲染（任務節點 + 依賴邊）
- 即時狀態著色（灰=待做、藍=進行中、綠=完成、紅=失敗）
- 點擊節點展開詳情

#### 3.2.3 時間軸視圖
- 甘特圖風格
- 顯示每個任務的開始/結束時間
- 並行任務橫向排列

#### 3.2.4 Agent 狀態面板
- 各 agent 的即時狀態
- 當前任務 + 進度
- 歷史任務列表
- 日誌串流

#### 3.2.5 儀表板
- 專案進度總覽（完成率、剩餘任務）
- Agent 負載分配
- 最近事件時間線

### 3.3 Adapter 層

#### 3.3.1 Adapter 介面規範
每個 adapter 必須實作：
```typescript
interface CLIAdapter {
  id: string;               // e.g. "claude-code"
  name: string;             // e.g. "Claude Code"
  version: string;
  
  // 生命週期
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  // 事件轉換
  translateEvent(rawEvent: unknown): StandardEvent;
  
  // 指令（可選，用於雙向控制）
  sendCommand?(command: AdapterCommand): Promise<void>;
}
```

#### 3.3.2 計畫支援的 Adapter
| Adapter | Phase | 整合方式 |
|---------|-------|----------|
| Claude Code | Phase 1 | Hooks (PostToolUse) + REST API |
| OpenClaw | Phase 3 | Gateway WebSocket 事件訂閱 |
| Codex CLI | Phase 3 | CLI output 解析 + REST callback |
| Gemini CLI | Phase 3 | CLI output 解析 + REST callback |
| 自訂 | Phase 4 | Adapter SDK + 文件 |

### 3.4 CLI 介面

```bash
# 啟動服務
clawflow start [--port 3700]

# 任務操作
clawflow task add "實作 WebSocket 層" --priority high --tag backend
clawflow task list [--status in_progress]
clawflow task update <id> --status done --progress 100

# Agent 操作
clawflow agent list
clawflow agent status <id>

# 匯出/匯入
clawflow export > backup.json
clawflow import < backup.json

# 儀表板（瀏覽器開啟）
clawflow dashboard
```

### 3.5 部署方式

| 方式 | 指令 | 適用場景 |
|------|------|----------|
| npx | `npx clawflow` | 快速試用 |
| npm global | `npm i -g clawflow && clawflow start` | 個人長期使用 |
| Docker | `docker compose up` | 團隊/伺服器部署 |

---

## 4. 非功能需求

### 4.1 效能
- WebSocket 延遲 < 100ms
- 支援同時 10+ agent 連線
- SQLite 單一實例即可處理 10,000+ 任務

### 4.2 安全
- 無硬編碼 secret
- 所有 API 輸入驗證（zod schema）
- 選配 API key 驗證（`--auth-token`）
- SQLite 檔案權限 600

### 4.3 可測試性
- 80%+ 測試覆蓋率
- Unit / Integration / E2E 三層測試
- CI 自動執行

### 4.4 可擴充性
- Adapter 介面標準化，社群可自行開發新 adapter
- 插件機制預留（未來可加 webhook、Slack 通知等）

---

## 5. 技術棧

| 層 | 技術 | 理由 |
|----|------|------|
| 前端 | React 19 + TypeScript + Vite | 現代、快速、生態系成熟 |
| 後端 | Express + TypeScript | 輕量、適合嵌入式服務 |
| 資料庫 | better-sqlite3 | 零依賴、嵌入式、同步 API 適合單機 |
| WebSocket | ws | 輕量、標準 |
| 驗證 | zod | TypeScript-first schema 驗證 |
| 樣式 | Tailwind CSS | 快速 UI 開發 |
| DAG 渲染 | @xyflow/react (React Flow) | 成熟的圖形節點編輯器 |
| 甘特圖 | 自製（基於 CSS Grid） | 避免重依賴 |
| 打包 | tsup (server) + Vite (client) | 快速打包、ESM 支援 |
| 測試 | Vitest + Playwright | 快速 unit/integration + E2E |
| Linter | ESLint + Prettier | 程式碼品質 |

---

## 6. 專案結構

```
clawflow/
├── package.json
├── tsconfig.json
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── ai-workflow/        # AI 開發流程文件
│   │   ├── 00-task-spec.md      # 本文件（PRD）
│   │   ├── 01-system-design.md  # SDD
│   │   └── 02-process-log.md    # 流程紀錄
│   ├── api.md              # API 文件
│   └── adapters.md         # Adapter 開發指南
├── src/
│   ├── core/               # 核心邏輯
│   │   ├── db/             # SQLite schema + migration
│   │   ├── models/         # Task, Agent, Event, Workflow
│   │   ├── services/       # Business logic
│   │   └── events/         # 事件系統
│   ├── server/             # Express + WebSocket
│   │   ├── routes/         # REST API routes
│   │   ├── ws/             # WebSocket handlers
│   │   └── middleware/     # Auth, validation, error handling
│   ├── adapters/           # CLI adapters
│   │   ├── types.ts        # Adapter 介面定義
│   │   ├── claude-code/    # Claude Code adapter
│   │   ├── openclaw/       # OpenClaw adapter
│   │   ├── codex/          # Codex CLI adapter
│   │   └── gemini/         # Gemini CLI adapter
│   ├── cli/                # CLI 介面
│   │   └── index.ts        # Commander.js CLI
│   └── web/                # React 前端
│       ├── components/     # UI 元件
│       ├── views/          # 頁面（Board, DAG, Timeline, Dashboard）
│       ├── hooks/          # Custom hooks
│       ├── stores/         # 狀態管理（Zustand）
│       └── styles/         # Tailwind + 自訂樣式
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .github/
    └── workflows/          # CI/CD
```

---

## 7. Phase 計畫

### Phase 0：基礎建設 ← 當前
- [x] 建立 repo
- [x] 撰寫 PRD
- [ ] 撰寫 SDD（系統設計文件）
- [ ] 初始化專案（package.json, tsconfig, etc.）
- [ ] 定義事件協議 JSON Schema
- [ ] 定義 Adapter 介面

### Phase 1：Core + Claude Code Adapter
- [ ] SQLite schema + migration
- [ ] Task CRUD API
- [ ] Agent 註冊/狀態 API
- [ ] 事件收集 API
- [ ] WebSocket 即時推送
- [ ] 看板 WebUI（Kanban 視圖）
- [ ] Claude Code adapter（Hooks 整合）
- [ ] CLI 基本指令
- [ ] `npx clawflow` 可啟動

### Phase 2：觀察能力強化
- [ ] DAG 依賴視覺化（React Flow）
- [ ] 時間軸 / 甘特圖視圖
- [ ] Agent 狀態面板 + 日誌串流
- [ ] 儀表板總覽
- [ ] 進度即時更新優化

### Phase 3：多 CLI 擴充
- [ ] OpenClaw adapter
- [ ] Codex CLI adapter
- [ ] Gemini CLI adapter
- [ ] Adapter 開發 SDK + 文件

### Phase 4：發布 + 部署
- [ ] npm package 發布
- [ ] Docker image（Docker Hub）
- [ ] GitHub Actions CI/CD
- [ ] 完整文件 + 示範
- [ ] `docs/dev-process-spec.md` — 自動化開發流程規範（本次實驗總結）

---

## 8. 成功指標

| 指標 | 目標 |
|------|------|
| 部署便利性 | 單一指令啟動（npx / docker） |
| 測試覆蓋率 | 80%+ |
| CLI 支援數 | 4（Claude Code, OpenClaw, Codex, Gemini） |
| 人工介入次數 | Phase 1-2 實作過程中 ≤ 3 次 |
| 延遲 | WebSocket 事件 < 100ms |
| 文件完整度 | README + API doc + Adapter guide + 流程規範 |

---

## 9. 流程實驗紀錄欄位

每個 Phase 完成後記錄：
| 欄位 | 說明 |
|------|------|
| 耗時 | Token 消耗 + 實際時間 |
| 自動完成率 | 自動完成項目 / 總項目 |
| 人工介入點 | 需要 Kevin 介入的具體項目 |
| 瓶頸 | 流程中的阻塞點 |
| 品質指標 | Test coverage, review 通過率, bug 數 |
| CLI 協作 | CC / Codex / Gemini 各自負責項目 |
| 改善建議 | 下次可以做得更好的地方 |
