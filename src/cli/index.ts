#!/usr/bin/env node
/**
 * ClawFlow CLI
 * 使用 Commander.js 建立命令列介面
 */
import { Command } from 'commander';
import { createServer } from '../server/index.js';
import { resolveConfig, getDefaults } from '../core/config.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { exec } from 'node:child_process';
import { platform } from 'node:os';

// ============================================================
// 工具函式
// ============================================================

/** 取得 API base URL */
function getBaseUrl(portOption?: string): string {
  const config = resolveConfig({
    port: portOption !== undefined ? Number(portOption) : undefined,
  });
  return `http://localhost:${String(config.port)}`;
}

/** 發送 API 請求 */
async function apiRequest(
  method: string,
  path: string,
  portOption?: string,
  body?: unknown
): Promise<unknown> {
  const url = `${getBaseUrl(portOption)}${path}`;
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(url, init);
    const data: unknown = await res.json();
    return data;
  } catch (err: unknown) {
    if (
      err instanceof TypeError &&
      (err.message.includes('fetch failed') ||
        err.message.includes('ECONNREFUSED'))
    ) {
      console.error(
        `錯誤：無法連線到 ClawFlow 伺服器（${url}）\n請先執行 "clawflow start" 啟動伺服器`
      );
      process.exit(1);
    }
    throw err;
  }
}

/** 格式化表格輸出 */
function printTable(
  rows: readonly Record<string, unknown>[],
  columns: readonly string[]
): void {
  if (rows.length === 0) {
    console.log('（無資料）');
    return;
  }

  // 計算欄寬
  const widths = new Map<string, number>();
  for (const col of columns) {
    widths.set(col, col.length);
  }
  for (const row of rows) {
    for (const col of columns) {
      const val = String(row[col] ?? '');
      const current = widths.get(col) ?? 0;
      if (val.length > current) {
        widths.set(col, val.length);
      }
    }
  }

  // 表頭
  const header = columns
    .map((col) => col.padEnd(widths.get(col) ?? 0))
    .join('  ');
  const separator = columns
    .map((col) => '-'.repeat(widths.get(col) ?? 0))
    .join('  ');

  console.log(header);
  console.log(separator);

  // 資料列
  for (const row of rows) {
    const line = columns
      .map((col) => String(row[col] ?? '').padEnd(widths.get(col) ?? 0))
      .join('  ');
    console.log(line);
  }
}

/** 輸出 API 回應 */
function printResponse(data: unknown): void {
  const resp = data as Record<string, unknown>;
  if (resp['success'] === false) {
    console.error(`錯誤：${String(resp['error'] ?? '未知錯誤')}`);
    process.exit(1);
  }
  console.log(JSON.stringify(resp['data'], null, 2));
}

// ============================================================
// CLI 程式
// ============================================================

const program = new Command();
const defaults = getDefaults();

program
  .name('clawflow')
  .description('ClawFlow — AI 驅動的工作流觀察面板')
  .version('0.1.0');

// --- start ---
program
  .command('start')
  .description('啟動 ClawFlow 伺服器')
  .option('--port <port>', '伺服器埠號', String(defaults.port))
  .option('--db-path <path>', '資料庫路徑', defaults.dbPath)
  .option('--auth-token <token>', '認證 token')
  .action(async (opts: Record<string, string | undefined>) => {
    const port =
      opts['port'] !== undefined ? Number(opts['port']) : undefined;
    const dbPath = opts['dbPath'];
    const authToken = opts['authToken'];

    console.log('正在啟動 ClawFlow 伺服器...');
    const server = await createServer({ port, dbPath, authToken });
    console.log(
      `ClawFlow 伺服器已啟動：http://localhost:${String(server.config.port)}`
    );
    console.log(`資料庫路徑：${server.config.dbPath}`);
    console.log('按 Ctrl+C 停止伺服器');
  });

// --- task ---
const task = program.command('task').description('任務操作');

task
  .command('add <title>')
  .description('新增任務')
  .option('--priority <priority>', '優先級 (critical/high/medium/low)', 'medium')
  .option('--tag <tag...>', '分類標籤')
  .option('--description <desc>', '任務描述')
  .option('--port <port>', '伺服器埠號')
  .action(
    async (
      title: string,
      opts: Record<string, string | string[] | undefined>
    ) => {
      const body: Record<string, unknown> = {
        title,
        priority: opts['priority'] ?? 'medium',
        tags: opts['tag'] ?? [],
        description: opts['description'],
      };
      const data = await apiRequest('POST', '/api/tasks', opts['port'] as string | undefined, body);
      const resp = data as Record<string, unknown>;
      if (resp['success'] === true) {
        const task = resp['data'] as Record<string, unknown>;
        console.log(`已新增任務：${String(task['id'])}`);
        console.log(`  標題：${String(task['title'])}`);
        console.log(`  優先級：${String(task['priority'])}`);
        console.log(`  狀態：${String(task['status'])}`);
      } else {
        printResponse(data);
      }
    }
  );

task
  .command('list')
  .description('列出任務')
  .option('--status <status>', '依狀態篩選')
  .option('--assignee <id>', '依指派者篩選')
  .option('--limit <n>', '回傳數量上限', '50')
  .option('--port <port>', '伺服器埠號')
  .action(async (opts: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (opts['status'] !== undefined) params.set('status', opts['status']);
    if (opts['assignee'] !== undefined)
      params.set('assignee', opts['assignee']);
    if (opts['limit'] !== undefined) params.set('limit', opts['limit']);

    const qs = params.toString();
    const path = `/api/tasks${qs.length > 0 ? `?${qs}` : ''}`;
    const data = await apiRequest('GET', path, opts['port']);
    const resp = data as Record<string, unknown>;

    if (resp['success'] === true) {
      const tasks = resp['data'] as Record<string, unknown>[];
      printTable(tasks, [
        'id',
        'title',
        'status',
        'priority',
        'progress',
        'assignee_agent_id',
      ]);
      console.log(`\n共 ${String(tasks.length)} 筆任務`);
    } else {
      printResponse(data);
    }
  });

task
  .command('update <id>')
  .description('更新任務')
  .option('--status <status>', '狀態')
  .option('--priority <priority>', '優先級')
  .option('--progress <n>', '進度 (0-100)')
  .option('--title <title>', '標題')
  .option('--description <desc>', '描述')
  .option('--port <port>', '伺服器埠號')
  .action(async (id: string, opts: Record<string, string | undefined>) => {
    const body: Record<string, unknown> = {};
    if (opts['status'] !== undefined) body['status'] = opts['status'];
    if (opts['priority'] !== undefined) body['priority'] = opts['priority'];
    if (opts['progress'] !== undefined)
      body['progress'] = Number(opts['progress']);
    if (opts['title'] !== undefined) body['title'] = opts['title'];
    if (opts['description'] !== undefined)
      body['description'] = opts['description'];

    const data = await apiRequest('PATCH', `/api/tasks/${id}`, opts['port'], body);
    const resp = data as Record<string, unknown>;
    if (resp['success'] === true) {
      console.log(`已更新任務 ${id}`);
      console.log(JSON.stringify(resp['data'], null, 2));
    } else {
      printResponse(data);
    }
  });

task
  .command('delete <id>')
  .description('刪除任務')
  .option('--port <port>', '伺服器埠號')
  .action(async (id: string, opts: Record<string, string | undefined>) => {
    const data = await apiRequest('DELETE', `/api/tasks/${id}`, opts['port']);
    const resp = data as Record<string, unknown>;
    if (resp['success'] === true) {
      console.log(`已刪除任務 ${id}`);
    } else {
      printResponse(data);
    }
  });

// --- agent ---
const agent = program.command('agent').description('Agent 操作');

agent
  .command('list')
  .description('列出 Agent')
  .option('--status <status>', '依狀態篩選')
  .option('--port <port>', '伺服器埠號')
  .action(async (opts: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (opts['status'] !== undefined) params.set('status', opts['status']);

    const qs = params.toString();
    const path = `/api/agents${qs.length > 0 ? `?${qs}` : ''}`;
    const data = await apiRequest('GET', path, opts['port']);
    const resp = data as Record<string, unknown>;

    if (resp['success'] === true) {
      const agents = resp['data'] as Record<string, unknown>[];
      printTable(agents, ['id', 'name', 'type', 'status', 'adapter_id']);
      console.log(`\n共 ${String(agents.length)} 個 Agent`);
    } else {
      printResponse(data);
    }
  });

agent
  .command('status <id>')
  .description('查看 Agent 狀態')
  .option('--port <port>', '伺服器埠號')
  .action(async (id: string, opts: Record<string, string | undefined>) => {
    const data = await apiRequest('GET', `/api/agents/${id}`, opts['port']);
    printResponse(data);
  });

// --- export ---
program
  .command('export')
  .description('匯出資料')
  .option('--output <file>', '輸出檔案路徑', 'backup.json')
  .option('--port <port>', '伺服器埠號')
  .action(async (opts: Record<string, string | undefined>) => {
    const data = await apiRequest('GET', '/api/export', opts['port']);
    const resp = data as Record<string, unknown>;

    if (resp['success'] === true) {
      const output = opts['output'] ?? 'backup.json';
      const { writeFileSync } = await import('node:fs');
      writeFileSync(
        resolve(output),
        JSON.stringify(resp['data'], null, 2),
        'utf-8'
      );
      console.log(`已匯出至 ${output}`);
    } else {
      printResponse(data);
    }
  });

// --- import ---
program
  .command('import <file>')
  .description('匯入資料')
  .option('--port <port>', '伺服器埠號')
  .action(async (file: string, opts: Record<string, string | undefined>) => {
    const content = readFileSync(resolve(file), 'utf-8');
    const body: unknown = JSON.parse(content);
    const data = await apiRequest('POST', '/api/import', opts['port'], body);
    const resp = data as Record<string, unknown>;

    if (resp['success'] === true) {
      const result = resp['data'] as Record<string, unknown>;
      console.log(`已匯入 ${String(result['importedCount'])} 筆資料`);
    } else {
      printResponse(data);
    }
  });

// --- dashboard ---
program
  .command('dashboard')
  .description('開啟儀表板（瀏覽器）')
  .option('--port <port>', '伺服器埠號')
  .action((opts: Record<string, string | undefined>) => {
    const url = getBaseUrl(opts['port']);
    const os = platform();
    const cmd = os === 'darwin' ? 'open' : 'xdg-open';
    console.log(`正在開啟儀表板：${url}`);
    exec(`${cmd} ${url}`, (err) => {
      if (err) {
        console.error(`無法開啟瀏覽器，請手動前往：${url}`);
      }
    });
  });

// --- health ---
program
  .command('health')
  .description('健康檢查')
  .option('--port <port>', '伺服器埠號')
  .action(async (opts: Record<string, string | undefined>) => {
    const data = await apiRequest('GET', '/api/health', opts['port']);
    const resp = data as Record<string, unknown>;

    if (resp['success'] === true) {
      const health = resp['data'] as Record<string, unknown>;
      console.log(`狀態：${String(health['status'])}`);
      console.log(`版本：${String(health['version'])}`);
      console.log(`運行時間：${String(Math.round(Number(health['uptime'])))} 秒`);
      console.log(`時間戳：${String(health['timestamp'])}`);
    } else {
      printResponse(data);
    }
  });

// 解析並執行
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(
    `錯誤：${err instanceof Error ? err.message : '未知錯誤'}`
  );
  process.exit(1);
});
