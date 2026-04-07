/**
 * 測試環境設定
 *
 * 提供獨立的 in-memory SQLite 連線，
 * 每個測試檔案使用獨立資料庫，避免測試間汙染。
 */
import Database from 'better-sqlite3';

/** Migration SQL — 直接內嵌避免依賴 ESM import */
const MIGRATION_SQL = `
  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','running','completed','failed','cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog'
      CHECK (status IN ('backlog','todo','in_progress','review','done','archived')),
    priority TEXT NOT NULL DEFAULT 'medium'
      CHECK (priority IN ('critical','high','medium','low')),
    assignee_agent_id TEXT,
    tags TEXT DEFAULT '[]',
    progress INTEGER NOT NULL DEFAULT 0
      CHECK (progress >= 0 AND progress <= 100),
    workflow_id TEXT REFERENCES workflows(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_agent_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow_id);

  CREATE TABLE IF NOT EXISTS task_dependencies (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    depends_on_task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, depends_on_task_id),
    CHECK (task_id != depends_on_task_id)
  );
  CREATE INDEX IF NOT EXISTS idx_deps_task ON task_dependencies(task_id);
  CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON task_dependencies(depends_on_task_id);

  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    adapter_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'idle'
      CHECK (status IN ('idle','working','completed','error')),
    capabilities TEXT DEFAULT '[]',
    current_task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    metadata TEXT DEFAULT '{}',
    registered_at TEXT NOT NULL,
    last_heartbeat_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_agents_adapter ON agents(adapter_id);
  CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    source TEXT NOT NULL,
    correlation_id TEXT,
    task_id TEXT,
    agent_id TEXT,
    workflow_id TEXT,
    payload TEXT DEFAULT '{}',
    timestamp TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_source ON events(source);
  CREATE INDEX IF NOT EXISTS idx_events_task ON events(task_id);
  CREATE INDEX IF NOT EXISTS idx_events_agent ON events(agent_id);
  CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

  CREATE TABLE IF NOT EXISTS workflow_steps (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    step_order INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','running','completed','failed','skipped')),
    config TEXT DEFAULT '{}',
    UNIQUE(workflow_id, step_order)
  );
  CREATE INDEX IF NOT EXISTS idx_wf_steps_workflow ON workflow_steps(workflow_id);

  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  );
`;

/**
 * 建立測試用 in-memory 資料庫並執行 migration
 * 透過 monkey-patch getDb 讓所有 repository 使用此連線
 */
export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(MIGRATION_SQL);
  return db;
}

/**
 * 設定測試資料庫到 connection 模組
 * 透過動態 import 取得 connection 模組並覆寫內部狀態
 */
export async function setupTestDb(): Promise<{
  db: Database.Database;
  cleanup: () => void;
}> {
  const db = createTestDb();

  // 直接 patch connection 模組的內部變數
  // 使用 vi.mock 在各測試檔案中處理
  return {
    db,
    cleanup: () => {
      db.close();
    },
  };
}
