/**
 * 統一配置管理
 * 從環境變數 + CLI 參數合併配置，提供預設值
 */
import { join } from 'node:path';
import { homedir } from 'node:os';

/** 日誌等級 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** ClawFlow 配置介面 */
export interface ClawflowConfig {
  /** 伺服器埠號 */
  readonly port: number;
  /** SQLite 資料庫路徑 */
  readonly dbPath: string;
  /** 認證 token（選填） */
  readonly authToken?: string;
  /** 日誌等級 */
  readonly logLevel: LogLevel;
}

/** 預設配置 */
const DEFAULTS: Readonly<ClawflowConfig> = {
  port: 3700,
  dbPath: join(homedir(), '.clawflow', 'clawflow.db'),
  logLevel: 'info',
};

/** CLI 參數覆蓋選項（全部為選填） */
interface ConfigOverrides {
  readonly port?: number | undefined;
  readonly dbPath?: string | undefined;
  readonly authToken?: string | undefined;
  readonly logLevel?: LogLevel | undefined;
}

/** 有效的日誌等級 */
const VALID_LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * 驗證日誌等級字串
 */
function parseLogLevel(value: string | undefined): LogLevel | undefined {
  if (value === undefined) {
    return undefined;
  }
  const lower = value.toLowerCase();
  if (VALID_LOG_LEVELS.includes(lower as LogLevel)) {
    return lower as LogLevel;
  }
  return undefined;
}

/**
 * 驗證埠號
 */
function parsePort(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const num = Number(value);
  if (Number.isInteger(num) && num > 0 && num < 65536) {
    return num;
  }
  return undefined;
}

/**
 * 合併配置：預設值 < 環境變數 < CLI 參數
 * 優先級由低到高
 */
export function resolveConfig(overrides?: ConfigOverrides): ClawflowConfig {
  // 環境變數層
  const envPort = parsePort(process.env['CLAWFLOW_PORT']);
  const envDbPath = process.env['CLAWFLOW_DB_PATH'];
  const envAuthToken = process.env['CLAWFLOW_AUTH_TOKEN'];
  const envLogLevel = parseLogLevel(process.env['CLAWFLOW_LOG_LEVEL']);

  const authToken = overrides?.authToken ?? envAuthToken ?? DEFAULTS.authToken;

  return {
    port: overrides?.port ?? envPort ?? DEFAULTS.port,
    dbPath: overrides?.dbPath ?? envDbPath ?? DEFAULTS.dbPath,
    ...(authToken !== undefined ? { authToken } : {}),
    logLevel: overrides?.logLevel ?? envLogLevel ?? DEFAULTS.logLevel,
  };
}

/**
 * 取得預設配置（不含任何覆蓋）
 */
export function getDefaults(): Readonly<ClawflowConfig> {
  return DEFAULTS;
}
