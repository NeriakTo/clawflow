/**
 * 輕量級資料庫遷移器
 * 讀取 migrations 目錄，比對 schema_migrations 表，自動執行未套用的 migration
 */
import type Database from 'better-sqlite3';
import { getDb } from './connection.js';

/** Migration 介面 */
export interface Migration {
  /** 遞增版本號 */
  readonly version: number;
  /** 名稱（用於紀錄） */
  readonly name: string;
  /** 升級函數 */
  readonly up: (db: Database.Database) => void;
}

/**
 * 確保 schema_migrations 表存在
 */
function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

/**
 * 取得已套用的最高版本號
 */
function getAppliedVersion(db: Database.Database): number {
  const row = db
    .prepare('SELECT MAX(version) as max_version FROM schema_migrations')
    .get() as { max_version: number | null } | undefined;
  return row?.max_version ?? 0;
}

/**
 * 執行所有待套用的 migrations
 * 每個 migration 在獨立 transaction 中執行
 */
export function runMigrations(migrations: readonly Migration[]): void {
  const db = getDb();

  ensureMigrationsTable(db);

  const appliedVersion = getAppliedVersion(db);

  // 依版本號排序，只執行尚未套用的
  const pending = [...migrations]
    .sort((a, b) => a.version - b.version)
    .filter((m) => m.version > appliedVersion);

  if (pending.length === 0) {
    return;
  }

  const insertMigration = db.prepare(
    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)'
  );

  for (const migration of pending) {
    // 每個 migration 在 transaction 中執行
    const runInTransaction = db.transaction(() => {
      migration.up(db);
      insertMigration.run(
        migration.version,
        migration.name,
        new Date().toISOString()
      );
    });
    runInTransaction();
  }
}

/**
 * 取得已套用的 migration 清單
 */
export function getAppliedMigrations(): readonly {
  version: number;
  name: string;
  applied_at: string;
}[] {
  const db = getDb();
  ensureMigrationsTable(db);
  return db
    .prepare('SELECT version, name, applied_at FROM schema_migrations ORDER BY version')
    .all() as { version: number; name: string; applied_at: string }[];
}
