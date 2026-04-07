/**
 * API 整合測試
 *
 * 啟動完整的 Express server 在隨機 port，
 * 使用 Node 22 內建 fetch 測試所有 REST API 端點。
 * 每個 describe 區塊使用獨立的 server 實例和臨時資料庫。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type ClawflowServer } from '../../src/server/index.js';
import { resetDb } from '../../src/core/db/connection.js';
import { eventBus } from '../../src/core/services/event-bus.js';

// ── 輔助函式 ──────────────────────────────────────────────────

let server: ClawflowServer;
let baseUrl: string;
let tmpDir: string;

/** 發送 API 請求的輔助函式 */
async function api(
  path: string,
  options?: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

// ── 生命週期 ──────────────────────────────────────────────────

beforeAll(async () => {
  // 重設全域 DB 連線，確保使用新的 temp DB
  resetDb();
  eventBus.clear();

  // 建立臨時目錄放置測試用 SQLite
  tmpDir = mkdtempSync(join(tmpdir(), 'clawflow-test-'));
  const dbPath = join(tmpDir, 'test.db');

  server = await createServer({
    port: 0, // 隨機 port
    dbPath,
  });

  const addr = server.server.address();
  if (typeof addr === 'object' && addr !== null) {
    baseUrl = `http://127.0.0.1:${addr.port}/api/v1`;
  }
});

afterAll(async () => {
  eventBus.clear();
  if (server) {
    await server.close();
  }
  resetDb();
  // 清理臨時目錄
  if (tmpDir) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ── Health ───────────────────────────────────────────────────

describe('GET /api/v1/health', () => {
  it('應返回 healthy 狀態', async () => {
    const { status, body } = await api('/health');

    expect(status).toBe(200);
    expect(body['success']).toBe(true);

    const data = body['data'] as Record<string, unknown>;
    expect(data['status']).toBe('healthy');
    expect(data['timestamp']).toBeTruthy();
    expect(data['uptime']).toBeTypeOf('number');
  });
});

// ── Tasks CRUD ──────────────────────────────────────────────

describe('Tasks API', () => {
  let createdTaskId: string;

  describe('POST /api/v1/tasks', () => {
    it('應建立新任務', async () => {
      const { status, body } = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: 'API 測試任務' }),
      });

      expect(status).toBe(201);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['title']).toBe('API 測試任務');
      expect(data['status']).toBe('backlog');
      expect(data['priority']).toBe('medium');
      expect(data['id']).toBeTruthy();

      createdTaskId = data['id'] as string;
    });

    it('應支援所有可選欄位', async () => {
      const { status, body } = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: '完整任務',
          description: '帶描述',
          status: 'todo',
          priority: 'high',
          tags: ['frontend', 'urgent'],
        }),
      });

      expect(status).toBe(201);
      const data = body['data'] as Record<string, unknown>;
      expect(data['description']).toBe('帶描述');
      expect(data['status']).toBe('todo');
      expect(data['priority']).toBe('high');
      expect(data['tags']).toEqual(['frontend', 'urgent']);
    });

    it('缺少 title 應返回 400', async () => {
      const { status, body } = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);

      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('VALIDATION_ERROR');
    });

    it('空字串 title 應返回 400', async () => {
      const { status, body } = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: '' }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('應返回任務列表', async () => {
      const { status, body } = await api('/tasks');

      expect(status).toBe(200);
      expect(body['success']).toBe(true);
      expect(Array.isArray(body['data'])).toBe(true);
      expect(body['meta']).toBeDefined();

      const meta = body['meta'] as Record<string, unknown>;
      expect(meta['total']).toBeTypeOf('number');
    });

    it('應支援 status 篩選', async () => {
      const { status, body } = await api('/tasks?status=todo');

      expect(status).toBe(200);
      const data = body['data'] as Record<string, unknown>[];
      for (const task of data) {
        expect(task['status']).toBe('todo');
      }
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('應返回指定任務', async () => {
      const { status, body } = await api(`/tasks/${createdTaskId}`);

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(createdTaskId);
      expect(data['title']).toBe('API 測試任務');
    });

    it('不存在的任務應返回 404', async () => {
      const { status, body } = await api('/tasks/nonexistent-id-12345');

      expect(status).toBe(404);
      expect(body['success']).toBe(false);

      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/tasks/:id', () => {
    it('應更新任務', async () => {
      const { status, body } = await api(`/tasks/${createdTaskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: '更新後的標題', priority: 'high' }),
      });

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['title']).toBe('更新後的標題');
      expect(data['priority']).toBe('high');
    });

    it('更新狀態為 done 應自動設定 completed_at', async () => {
      // 先建立一個任務
      const createRes = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: '即將完成' }),
      });
      const taskId = (createRes.body['data'] as Record<string, unknown>)['id'] as string;

      const { status, body } = await api(`/tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      });

      expect(status).toBe(200);
      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('done');
      expect(data['progress']).toBe(100);
      expect(data['completed_at']).toBeTruthy();
    });

    it('更新不存在的任務應返回 404', async () => {
      const { status } = await api('/tasks/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ title: '不存在' }),
      });

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('應刪除任務', async () => {
      // 建立一個用於刪除的任務
      const createRes = await api('/tasks', {
        method: 'POST',
        body: JSON.stringify({ title: '要刪除的' }),
      });
      const taskId = (createRes.body['data'] as Record<string, unknown>)['id'] as string;

      const { status, body } = await api(`/tasks/${taskId}`, {
        method: 'DELETE',
      });

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      // 確認已被刪除
      const getRes = await api(`/tasks/${taskId}`);
      expect(getRes.status).toBe(404);
    });

    it('刪除不存在的任務應返回 404', async () => {
      const { status } = await api('/tasks/nonexistent', {
        method: 'DELETE',
      });

      expect(status).toBe(404);
    });
  });
});

// ── Agents API ──────────────────────────────────────────────

describe('Agents API', () => {
  let createdAgentId: string;

  describe('POST /api/v1/agents/register', () => {
    it('應註冊新 agent', async () => {
      const { status, body } = await api('/agents/register', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Agent',
          type: 'claude-opus',
          capabilities: ['coding', 'research'],
        }),
      });

      expect(status).toBe(201);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['name']).toBe('Test Agent');
      expect(data['type']).toBe('claude-opus');
      expect(data['capabilities']).toEqual(['coding', 'research']);
      expect(data['status']).toBe('idle');

      createdAgentId = data['id'] as string;
    });

    it('缺少 name 應返回 400', async () => {
      const { status, body } = await api('/agents/register', {
        method: 'POST',
        body: JSON.stringify({ type: 'test' }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });

    it('缺少 type 應返回 400', async () => {
      const { status, body } = await api('/agents/register', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });
  });

  describe('GET /api/v1/agents', () => {
    it('應返回 agents 列表', async () => {
      const { status, body } = await api('/agents');

      expect(status).toBe(200);
      expect(body['success']).toBe(true);
      expect(Array.isArray(body['data'])).toBe(true);

      const meta = body['meta'] as Record<string, unknown>;
      expect(meta['total']).toBeTypeOf('number');
    });
  });

  describe('GET /api/v1/agents/:id', () => {
    it('應返回指定 agent', async () => {
      const { status, body } = await api(`/agents/${createdAgentId}`);

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(createdAgentId);
      expect(data['name']).toBe('Test Agent');
    });

    it('不存在的 agent 應返回 404', async () => {
      const { status } = await api('/agents/nonexistent-id');

      expect(status).toBe(404);
    });
  });

  describe('PATCH /api/v1/agents/:id', () => {
    it('應更新 agent', async () => {
      const { status, body } = await api(`/agents/${createdAgentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'working' }),
      });

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['status']).toBe('working');
    });
  });

  describe('POST /api/v1/agents/:id/heartbeat', () => {
    it('應更新心跳', async () => {
      const { status, body } = await api(`/agents/${createdAgentId}/heartbeat`, {
        method: 'POST',
      });

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(createdAgentId);
    });

    it('不存在的 agent 心跳應返回 404', async () => {
      const { status } = await api('/agents/nonexistent/heartbeat', {
        method: 'POST',
      });

      expect(status).toBe(404);
    });
  });

  describe('DELETE /api/v1/agents/:id', () => {
    it('應刪除 agent', async () => {
      // 建立一個用於刪除的 agent
      const createRes = await api('/agents/register', {
        method: 'POST',
        body: JSON.stringify({ name: '要刪除', type: 'temp' }),
      });
      const agentId = (createRes.body['data'] as Record<string, unknown>)['id'] as string;

      const { status, body } = await api(`/agents/${agentId}`, {
        method: 'DELETE',
      });

      expect(status).toBe(200);
      expect(body['success']).toBe(true);

      // 確認已被刪除
      const getRes = await api(`/agents/${agentId}`);
      expect(getRes.status).toBe(404);
    });
  });
});

// ── Events API ──────────────────────────────────────────────

describe('Events API', () => {
  describe('POST /api/v1/events', () => {
    it('應提交事件', async () => {
      const { status, body } = await api('/events', {
        method: 'POST',
        body: JSON.stringify({
          event: 'task.created',
          source: 'test-adapter',
          payload: { taskId: 'task-1' },
        }),
      });

      expect(status).toBe(201);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>;
      expect(data['event_type']).toBe('task.created');
      expect(data['source']).toBe('test-adapter');
      expect(data['payload']).toEqual({ taskId: 'task-1' });
    });

    it('缺少 event 應返回 400', async () => {
      const { status, body } = await api('/events', {
        method: 'POST',
        body: JSON.stringify({ source: 'test', payload: {} }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });

    it('缺少 source 應返回 400', async () => {
      const { status, body } = await api('/events', {
        method: 'POST',
        body: JSON.stringify({ event: 'task.created', payload: {} }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });
  });

  describe('POST /api/v1/events/batch', () => {
    it('應批量提交事件', async () => {
      const { status, body } = await api('/events/batch', {
        method: 'POST',
        body: JSON.stringify({
          events: [
            { event: 'task.created', source: 'a', payload: { taskId: 'batch-1' } },
            { event: 'agent.registered', source: 'b', payload: { agentId: 'batch-a1' } },
          ],
        }),
      });

      expect(status).toBe(201);
      expect(body['success']).toBe(true);

      const data = body['data'] as Record<string, unknown>[];
      expect(data).toHaveLength(2);
    });

    it('空 events 陣列應返回 400', async () => {
      const { status, body } = await api('/events/batch', {
        method: 'POST',
        body: JSON.stringify({ events: [] }),
      });

      expect(status).toBe(400);
      expect(body['success']).toBe(false);
    });
  });

  describe('GET /api/v1/events', () => {
    it('應返回事件列表', async () => {
      const { status, body } = await api('/events');

      expect(status).toBe(200);
      expect(body['success']).toBe(true);
      expect(Array.isArray(body['data'])).toBe(true);

      const meta = body['meta'] as Record<string, unknown>;
      expect(meta['total']).toBeTypeOf('number');
    });

    it('應支援 source 篩選', async () => {
      // 先提交一個有特定 source 的事件
      await api('/events', {
        method: 'POST',
        body: JSON.stringify({
          event: 'task.created',
          source: 'unique-source-xyz',
          payload: {},
        }),
      });

      const { status, body } = await api('/events?source=unique-source-xyz');

      expect(status).toBe(200);
      const data = body['data'] as Record<string, unknown>[];
      expect(data.length).toBeGreaterThanOrEqual(1);
      for (const event of data) {
        expect(event['source']).toBe('unique-source-xyz');
      }
    });
  });
});

// ── 404 處理 ────────────────────────────────────────────────

describe('404 處理', () => {
  it('不存在的路由應返回 404 或相應錯誤', async () => {
    const res = await fetch(`${baseUrl}/nonexistent-route`);
    // Express 對未匹配路由預設返回 404
    expect(res.status).toBe(404);
  });
});
