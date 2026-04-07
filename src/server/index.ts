/**
 * ClawFlow Server 入口
 *
 * 建立 Express app，掛載 middleware + routes，
 * 啟動 HTTP + WebSocket server（同 port）。
 */

import express from 'express';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import { resolveConfig, type ClawflowConfig } from '../core/config.js';
import { getDb } from '../core/db/connection.js';
import { runMigrations } from '../core/db/migrator.js';
import migration001 from '../core/db/migrations/001-initial.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { tasksRouter } from './routes/tasks.js';
import { agentsRouter } from './routes/agents.js';
import { eventsRouter } from './routes/events.js';
import { workflowsRouter } from './routes/workflows.js';
import { systemRouter } from './routes/system.js';
import { createWsServer } from './ws/handler.js';
import { AdapterRegistry, loadBuiltinAdapters } from '../adapters/index.js';

/** 伺服器啟動選項 */
interface ServerOptions {
  readonly port?: number | undefined;
  readonly dbPath?: string | undefined;
  readonly authToken?: string | undefined;
}

/** 伺服器實例 */
export interface ClawflowServer {
  readonly app: express.Application;
  readonly server: HttpServer;
  readonly config: ClawflowConfig;
  readonly adapterRegistry: AdapterRegistry;
  close(): Promise<void>;
}

/**
 * 建立並啟動 ClawFlow 伺服器
 */
export async function createServer(
  options?: ServerOptions,
): Promise<ClawflowServer> {
  const config = resolveConfig({
    port: options?.port,
    dbPath: options?.dbPath,
    authToken: options?.authToken,
  });

  // 初始化資料庫
  getDb({ dbPath: config.dbPath });
  runMigrations([migration001]);

  // ── 載入內建 Adapter ──────────────────────────────────────────
  const adapterRegistry = new AdapterRegistry();
  loadBuiltinAdapters(adapterRegistry);

  const app = express();

  // ── 安全 Headers ──────────────────────────────────────────
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // ── 基礎 middleware ────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }));

  // 可選 token 驗證
  app.use(authMiddleware);

  // ── API v1 Routes ─────────────────────────────────────────
  const apiV1Router = express.Router();
  apiV1Router.use('/tasks', tasksRouter);
  apiV1Router.use('/agents', agentsRouter);
  apiV1Router.use('/events', eventsRouter);
  apiV1Router.use('/workflows', workflowsRouter);
  apiV1Router.use('/', systemRouter);

  app.use('/api/v1', apiV1Router);

  // ── 向後相容的 /api 路由（CLI 使用） ──────────────────────
  app.use('/api', apiV1Router);

  // ── 靜態檔案 Serving（production 前端） ────────────────────
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const webRoot = join(currentDir, '..', 'dist', 'web');
  // tsup 輸出到 dist/index.js，所以 webRoot = dist/../dist/web = dist/web ✓
  // 但打包後結構是 dist/index.js + dist/web/，修正為同層
  const webRootAlt = join(currentDir, 'web');

  const resolvedWebRoot = existsSync(webRootAlt) ? webRootAlt : webRoot;

  if (existsSync(resolvedWebRoot)) {
    app.use(express.static(resolvedWebRoot));

    // SPA fallback：非 API 路由一律回傳 index.html（Express 5 用 middleware）
    app.use((_req, res, next) => {
      if (
        _req.method !== 'GET' ||
        _req.path.startsWith('/api') ||
        _req.path.startsWith('/ws') ||
        _req.path.includes('.')
      ) {
        return next();
      }
      const indexPath = join(resolvedWebRoot, 'index.html');
      if (existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        next();
      }
    });
  }

  // ── 全域 Error Handler ────────────────────────────────────
  app.use(errorHandler);

  // ── HTTP + WebSocket Server ───────────────────────────────
  return new Promise<ClawflowServer>((resolve) => {
    const httpServer = createHttpServer(app);
    createWsServer(httpServer);

    httpServer.listen(config.port, () => {
      resolve({
        app,
        server: httpServer,
        config,
        adapterRegistry,
        close: async () => {
          await adapterRegistry.disconnectAll();
          return new Promise<void>((res, rej) => {
            httpServer.close((err) => {
              if (err) rej(err);
              else res();
            });
          });
        },
      });
    });
  });
}
