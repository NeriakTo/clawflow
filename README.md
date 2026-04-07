# ClawFlow

**通用 AI CLI 工作流觀察面板** -- 讓任何 AI coding CLI 的工作流程可視化、可追蹤、可複製部署。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22-green.svg)](https://nodejs.org/)

---

## 功能特色

- **跨 CLI 統一觀察** -- 透過標準化事件協議，統一呈現 Claude Code、Codex CLI、Gemini CLI、OpenClaw 等工具的工作流
- **即時任務追蹤** -- WebSocket 即時推送，任務狀態變更秒級更新
- **DAG 依賴視覺化** -- 以有向無環圖呈現任務間的依賴關係，一眼掌握瓶頸
- **五大觀察視圖** -- 看板、DAG、時間軸、Agent 面板、儀表板，全方位觀察工作流
- **Adapter 架構** -- 標準化介面設計，可自行擴充支援任何 CLI 工具
- **SQLite 內嵌儲存** -- 零外部依賴，單一執行檔即可運作
- **CLI + Web UI** -- 命令列操作與瀏覽器面板並用，各取所需
- **匯出/匯入** -- 完整資料備份與還原

<!-- 螢幕截圖 -->
<!-- ![ClawFlow Dashboard](docs/assets/screenshot-dashboard.png) -->
<!-- ![ClawFlow DAG View](docs/assets/screenshot-dag.png) -->

---

## Quick Start

### 方式一：npx 快速啟動

```bash
npx clawflow start
```

### 方式二：全域安裝

```bash
npm install -g clawflow
clawflow start
```

### 方式三：Docker

```bash
docker compose up
```

啟動後開啟瀏覽器前往 `http://localhost:3700` 即可看到 Web UI。

---

## CLI 使用指南

### 伺服器管理

```bash
# 啟動伺服器（預設 port 3700）
clawflow start
clawflow start --port 4000
clawflow start --db-path ./my-data.db
clawflow start --auth-token my-secret-token

# 健康檢查
clawflow health
clawflow health --port 4000
```

### 任務操作

```bash
# 新增任務
clawflow task add "實作 WebSocket 層"
clawflow task add "設計 API 端點" --priority high --tag backend --tag api
clawflow task add "撰寫測試" --description "Unit + Integration 測試" --priority medium

# 列出任務
clawflow task list
clawflow task list --status in_progress
clawflow task list --assignee agent-01 --limit 20

# 更新任務
clawflow task update <id> --status done --progress 100
clawflow task update <id> --priority critical
clawflow task update <id> --title "新標題" --description "更新描述"

# 刪除任務
clawflow task delete <id>
```

### Agent 操作

```bash
# 列出所有 Agent
clawflow agent list
clawflow agent list --status working

# 查看 Agent 狀態
clawflow agent status <id>
```

### 資料匯出/匯入

```bash
# 匯出全部資料
clawflow export
clawflow export --output my-backup.json

# 匯入資料
clawflow import backup.json
```

### 儀表板

```bash
# 以瀏覽器開啟 Web UI
clawflow dashboard
```

---

## Web UI

啟動伺服器後，瀏覽器前往 `http://localhost:3700` 即可使用 Web UI。提供五個主要視圖：

| 視圖 | 說明 |
|------|------|
| **看板 (Board)** | Kanban 風格，依任務狀態分欄，支援拖拉變更狀態 |
| **DAG 視圖** | 有向無環圖，視覺化任務依賴關係，即時狀態著色 |
| **時間軸 (Timeline)** | 甘特圖風格，顯示任務時間分布與並行狀況 |
| **Agent 面板** | 各 Agent 即時狀態、當前任務、進度與歷史記錄 |
| **儀表板 (Dashboard)** | 專案進度總覽、Agent 負載分配、最近事件時間線 |

---

## Adapter 架構

ClawFlow 透過 **Adapter 架構** 支援不同的 AI CLI 工具。每個 Adapter 負責將特定 CLI 的原始事件轉譯為 ClawFlow 標準事件格式。

### 目前支援

| Adapter | 整合方式 | 狀態 |
|---------|----------|------|
| **Claude Code** | Hooks (PreToolUse/PostToolUse/Stop) + REST API | 已實作 |
| OpenClaw | Gateway WebSocket 事件訂閱 | 規劃中 |
| Codex CLI | CLI output 解析 + REST callback | 規劃中 |
| Gemini CLI | CLI output 解析 + REST callback | 規劃中 |

### Claude Code 整合

Claude Code 透過 hooks 機制，在工具使用時自動呼叫 ClawFlow REST API 回報事件。設定方式：

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Agent|Skill",
      "command": "curl -s -X POST http://localhost:3700/api/v1/events -H 'Content-Type: application/json' -d '{\"event\":\"agent.started\",\"source\":\"claude-code\",\"payload\":{\"hookType\":\"PreToolUse\",\"tool\":\"$CLAUDE_TOOL_NAME\",\"sessionId\":\"$CLAUDE_SESSION_ID\"}}'"
    }],
    "PostToolUse": [{
      "matcher": ".*",
      "command": "curl -s -X POST http://localhost:3700/api/v1/events -H 'Content-Type: application/json' -d '{\"event\":\"agent.progress\",\"source\":\"claude-code\",\"payload\":{\"hookType\":\"PostToolUse\",\"tool\":\"$CLAUDE_TOOL_NAME\",\"result\":\"$CLAUDE_TOOL_RESULT\",\"sessionId\":\"$CLAUDE_SESSION_ID\"}}'"
    }],
    "Stop": [{
      "matcher": "",
      "command": "curl -s -X POST http://localhost:3700/api/v1/events -H 'Content-Type: application/json' -d '{\"event\":\"workflow.completed\",\"source\":\"claude-code\",\"payload\":{\"hookType\":\"Stop\",\"tool\":\"stop\",\"sessionId\":\"$CLAUDE_SESSION_ID\"}}'"
    }]
  }
}
```

### 自訂 Adapter

所有 Adapter 實作 `CLIAdapter` 介面。詳見 [Adapter 開發指南](docs/adapters.md)。

---

## API

ClawFlow 提供完整的 REST API 與 WebSocket 即時推送。

- 基礎路徑：`/api/v1`
- 預設埠號：`3700`
- 認證：可選的 Bearer Token

詳細 API 文件請參閱 [docs/api.md](docs/api.md)。

---

## 開發指南

### 環境需求

- Node.js >= 22
- pnpm（建議）或 npm

### 本地開發

```bash
# 取得原始碼
git clone https://github.com/NeriakTo/clawflow.git
cd clawflow

# 安裝依賴
pnpm install

# 啟動開發伺服器（含 hot reload）
pnpm dev

# 建置
pnpm build

# 執行測試
pnpm test

# 程式碼檢查
pnpm lint
```

### 建置產物

```bash
pnpm build
# 產出：
#   dist/          -- 後端 + CLI（tsup 打包）
#   dist/client/   -- 前端靜態檔案（Vite 打包）
```

---

## 專案結構

```
clawflow/
├── package.json
├── tsconfig.json
├── vite.config.ts           # 前端建置配置
├── tsup.config.ts           # 後端建置配置
├── vitest.config.ts         # 測試配置
├── docker-compose.yml
├── Dockerfile
├── docs/
│   ├── api.md               # REST API 文件
│   ├── adapters.md          # Adapter 開發指南
│   └── ai-workflow/         # AI 開發流程文件
├── src/
│   ├── index.ts             # 程式進入點
│   ├── core/                # 核心邏輯
│   │   ├── config.ts        # 統一配置管理
│   │   ├── db/              # SQLite schema + migration
│   │   │   ├── connection.ts
│   │   │   ├── migrator.ts
│   │   │   └── migrations/
│   │   ├── models/          # Repository 層（Task, Agent, Event, Workflow）
│   │   ├── services/        # 業務邏輯 + EventBus
│   │   └── events/          # 事件系統（Zod schema + TypeScript 型別）
│   ├── server/              # Express + WebSocket
│   │   ├── index.ts         # Server 初始化
│   │   ├── routes/          # REST API 路由
│   │   │   ├── tasks.ts
│   │   │   ├── agents.ts
│   │   │   ├── events.ts
│   │   │   ├── workflows.ts
│   │   │   └── system.ts    # 健康檢查、統計、匯出/匯入
│   │   ├── ws/              # WebSocket handler
│   │   ├── dto/             # 請求驗證 DTO（Zod）
│   │   └── middleware/      # Auth, Validation, Error handling
│   ├── adapters/            # CLI Adapter 層
│   │   ├── types.ts         # CLIAdapter 介面定義
│   │   ├── registry.ts      # Adapter 註冊表
│   │   └── claude-code/     # Claude Code adapter
│   │       ├── index.ts     # Adapter 實作
│   │       ├── hooks.ts     # Hook 設定生成 + payload 解析
│   │       └── event-mapper.ts  # 事件映射邏輯
│   ├── cli/                 # CLI 介面（Commander.js）
│   │   └── index.ts
│   └── web/                 # React 前端
│       ├── App.tsx
│       ├── main.tsx
│       ├── api/             # API client
│       ├── components/      # UI 元件
│       ├── views/           # 頁面視圖
│       ├── stores/          # Zustand 狀態管理
│       ├── hooks/           # Custom hooks
│       └── styles/          # Tailwind CSS
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── .github/
    └── workflows/           # CI/CD
```

---

## 技術棧

| 層級 | 技術 | 說明 |
|------|------|------|
| 前端 | React 19 + TypeScript + Vite | 現代建置、快速 HMR |
| 狀態管理 | Zustand 5 | 輕量、不依賴 Provider |
| DAG 渲染 | @xyflow/react (React Flow) | 成熟的圖形節點渲染 |
| DAG 佈局 | @dagrejs/dagre | 自動佈局演算法 |
| 樣式 | Tailwind CSS 4 | Utility-first CSS |
| 後端 | Express 5 + TypeScript | 輕量 HTTP 框架 |
| WebSocket | ws | 輕量、標準 WebSocket |
| 資料庫 | better-sqlite3 | 嵌入式 SQLite，同步 API |
| 驗證 | Zod | TypeScript-first schema 驗證 |
| CLI | Commander.js | CLI 建構框架 |
| ID 生成 | ulid | 時間排序的唯一 ID |
| 建置 | tsup (server) + Vite (client) | ESM 支援、快速打包 |
| 測試 | Vitest | 與 Vite 原生整合 |
| Lint | ESLint + Prettier | 程式碼品質與格式化 |

---

## License

[MIT](LICENSE)
