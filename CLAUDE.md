# ClawFlow -- 專案指引

## 專案概述

ClawFlow 是通用 AI CLI 工作流觀察面板。透過標準化事件協議，統一呈現 Claude Code、Codex CLI、Gemini CLI、OpenClaw 等 AI coding CLI 的工作流，提供即時任務追蹤、DAG 依賴視覺化、Agent 生命週期觀察。

## 技術棧

- **前端**: React 19 + TypeScript + Vite 6 + Tailwind CSS 4 + Zustand 5
- **DAG**: @xyflow/react (React Flow) + @dagrejs/dagre
- **後端**: Express 5 + TypeScript + better-sqlite3
- **WebSocket**: ws
- **驗證**: Zod
- **CLI**: Commander.js
- **建置**: tsup (server) + Vite (client)
- **測試**: Vitest
- **Lint**: ESLint 9 + Prettier 3

## 開發指令

```bash
# 安裝依賴
pnpm install

# 啟動開發伺服器（Vite dev server，含 HMR）
pnpm dev

# 完整建置（tsc 型別檢查 + tsup 後端打包 + vite 前端打包）
pnpm build

# 執行測試
pnpm test

# 啟動 production 伺服器
pnpm start

# 程式碼檢查
pnpm lint
```

## 專案結構

```
src/
├── index.ts                    # 程式進入點
├── core/                       # 核心邏輯（無 Express/React 依賴）
│   ├── config.ts               # 統一配置（env + CLI 參數合併）
│   ├── db/                     # SQLite 連線 + migration
│   ├── models/                 # Repository 層（task, agent, event, workflow）
│   ├── services/               # 業務邏輯 + EventBus
│   └── events/                 # 事件系統 Zod schema + TypeScript 型別
├── server/                     # Express HTTP + WebSocket
│   ├── routes/                 # REST API 路由（tasks, agents, events, workflows, system）
│   ├── ws/                     # WebSocket handler（subscribe/unsubscribe/ping）
│   ├── dto/                    # 請求驗證 DTO（Zod schema）
│   └── middleware/             # auth, validate, error-handler
├── adapters/                   # CLI Adapter 抽象層
│   ├── types.ts                # CLIAdapter 介面定義
│   ├── registry.ts             # Adapter 註冊表
│   └── claude-code/            # Claude Code adapter（hooks + event-mapper）
├── cli/                        # Commander.js CLI
│   └── index.ts
└── web/                        # React 前端 SPA
    ├── App.tsx / main.tsx
    ├── api/                    # fetch-based API client
    ├── components/             # TaskCard, Navbar, StatusBadge 等
    ├── views/                  # BoardView, DagView, TimelineView, AgentView, DashboardView
    ├── stores/                 # Zustand stores（task, agent, ws, dashboard）
    └── styles/                 # Tailwind CSS

tests/
├── unit/
├── integration/
└── e2e/
```

## 程式碼風格

- **語言**: TypeScript（strict mode）
- **不可變性**: 所有資料結構使用 `readonly`，更新時建立新物件而非修改原物件
- **型別安全**: 不使用 `any`，外部輸入用 `unknown` + Zod 驗證
- **Schema 驅動**: 事件型別由 `src/core/events/schema.ts` 的 Zod schema 推導，single source of truth
- **檔案大小**: 單一檔案不超過 800 行，函式不超過 50 行
- **錯誤處理**: 不靜默吞掉錯誤，每層都需明確處理
- **命名**: 變數/函式用英文，註解/UI 文案/commit message 用繁體中文
- **匯入**: 使用 `.js` 副檔名（ESM 規範）
- **API 回應**: 統一信封格式 `{ success, data, meta?, error? }`

## 測試規則

- 測試框架：Vitest
- 覆蓋率目標：80%+
- 測試分層：unit / integration / e2e
- 測試檔案放在 `tests/` 目錄下，對應 `src/` 結構
- TDD 流程：先寫測試（RED）、實作通過（GREEN）、重構（IMPROVE）
- 不可刪除既有測試（只可新增或修正）

## 重要路徑

- 事件 Schema: `src/core/events/schema.ts`
- Adapter 介面: `src/adapters/types.ts`
- API 路由: `src/server/routes/`
- WebSocket: `src/server/ws/handler.ts`
- 配置: `src/core/config.ts`（預設 port 3700, DB 路徑 ~/.clawflow/clawflow.db）

## 環境變數

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `CLAWFLOW_PORT` | 伺服器埠號 | `3700` |
| `CLAWFLOW_DB_PATH` | SQLite 資料庫路徑 | `~/.clawflow/clawflow.db` |
| `CLAWFLOW_AUTH_TOKEN` | API 認證 token（選填） | 無（不啟用認證） |
| `CLAWFLOW_LOG_LEVEL` | 日誌等級 | `info` |
