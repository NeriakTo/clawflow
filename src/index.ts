/**
 * ClawFlow — AI 驅動的工作流觀察面板
 * 主入口：export 核心模組 + 直接執行時啟動 server
 */

// 伺服器
export { createServer, type ClawflowServer } from './server/index.js';

// 配置
export {
  resolveConfig,
  getDefaults,
  type ClawflowConfig,
  type LogLevel,
} from './core/config.js';

// 資料庫
export { getDb, closeDb, resetDb } from './core/db/connection.js';
export { runMigrations, getAppliedMigrations } from './core/db/migrator.js';

// 事件系統
export * from './core/events/types.js';
export * from './core/events/schema.js';

// Adapter
export type {
  CLIAdapter,
  StandardEvent as AdapterStandardEvent,
  AdapterCommand,
  AdapterConfig,
  AdapterHealthStatus,
  EventSink,
} from './adapters/types.js';
export { AdapterRegistry } from './adapters/registry.js';

// 當直接執行時啟動 server
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (process.argv[1].endsWith('/index.js') ||
    process.argv[1].endsWith('/dist/index.js'));

if (isDirectRun) {
  const { createServer: startServer } = await import('./server/index.js');
  const server = await startServer();
  console.log(
    `ClawFlow 伺服器已啟動：http://localhost:${String(server.config.port)}`
  );
}
