/**
 * SQLite 連線管理
 * 使用 better-sqlite3，預設路徑 ~/.clawflow/clawflow.db
 */
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

/** 預設資料庫路徑 */
const DEFAULT_DB_PATH = join(homedir(), '.clawflow', 'clawflow.db');

/** 單例連線實例 */
let db: Database.Database | null = null;

/** 連線選項 */
interface ConnectionOptions {
  /** 資料庫檔案路徑，預設 ~/.clawflow/clawflow.db */
  readonly dbPath?: string;
  /** 是否為唯讀模式 */
  readonly readonly?: boolean;
}

/**
 * 取得資料庫連線（單例）
 * 自動啟用 WAL mode 和 foreign keys
 */
export function getDb(options?: ConnectionOptions): Database.Database {
  if (db !== null) {
    return db;
  }

  const dbPath = options?.dbPath ?? DEFAULT_DB_PATH;

  // 確保目錄存在
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath, {
    readonly: options?.readonly ?? false,
  });

  // 啟用 WAL mode 提升並行效能
  db.pragma('journal_mode = WAL');
  // 啟用外鍵約束
  db.pragma('foreign_keys = ON');

  return db;
}

/**
 * 關閉資料庫連線
 */
export function closeDb(): void {
  if (db !== null) {
    db.close();
    db = null;
  }
}

/**
 * 重設連線（主要用於測試）
 */
export function resetDb(): void {
  closeDb();
}
