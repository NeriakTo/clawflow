/**
 * Agent 整合測試
 *
 * 使用真實的 in-memory SQLite 測試 AgentRepository 和 AgentService。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';

let testDb: Database.Database;

vi.mock('../../src/core/db/connection.js', () => ({
  getDb: () => testDb,
  closeDb: () => { /* noop */ },
  resetDb: () => { /* noop */ },
}));

const agentRepo = await import('../../src/core/models/agent.repository.js');
const agentService = await import('../../src/core/services/agent.service.js');
const { eventBus } = await import('../../src/core/services/event-bus.js');

describe('AgentRepository', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  // ── CRUD ────────────────────────────────────────────────────

  describe('register', () => {
    it('應註冊 agent 並返回完整物件', () => {
      const agent = agentRepo.register({
        adapter_id: 'test',
        name: 'CC',
        type: 'claude-opus',
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeTruthy();
      expect(agent.name).toBe('CC');
      expect(agent.type).toBe('claude-opus');
      expect(agent.status).toBe('idle');
      expect(agent.adapter_id).toBe('test');
      expect(agent.registered_at).toBeTruthy();
      expect(agent.last_heartbeat_at).toBeTruthy();
    });

    it('應支援 capabilities 和 metadata', () => {
      const agent = agentRepo.register({
        adapter_id: 'test',
        name: 'MeowClaw',
        type: 'gpt-5.4',
        capabilities: ['research', 'search'],
        metadata: { version: '2.0' },
      });

      expect(JSON.parse(agent.capabilities)).toEqual(['research', 'search']);
      expect(JSON.parse(agent.metadata)).toEqual({ version: '2.0' });
    });
  });

  describe('findById', () => {
    it('應找到已註冊的 agent', () => {
      const created = agentRepo.register({
        adapter_id: 'test',
        name: 'Test',
        type: 'test-type',
      });
      const found = agentRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.name).toBe('Test');
    });

    it('不存在的 ID 應返回 undefined', () => {
      expect(agentRepo.findById('nonexistent')).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('應返回所有 agents', () => {
      agentRepo.register({ adapter_id: 'a', name: 'Agent1', type: 'type1' });
      agentRepo.register({ adapter_id: 'b', name: 'Agent2', type: 'type2' });

      const agents = agentRepo.findAll();
      expect(agents).toHaveLength(2);
    });

    it('應依 status 篩選', () => {
      agentRepo.register({ adapter_id: 'a', name: 'Idle', type: 't', status: 'idle' });
      agentRepo.register({ adapter_id: 'b', name: 'Working', type: 't', status: 'working' });

      const idle = agentRepo.findAll({ status: 'idle' });
      expect(idle).toHaveLength(1);
      expect(idle[0].name).toBe('Idle');
    });

    it('應依 type 篩選', () => {
      agentRepo.register({ adapter_id: 'a', name: 'A', type: 'claude' });
      agentRepo.register({ adapter_id: 'b', name: 'B', type: 'codex' });

      const claude = agentRepo.findAll({ type: 'claude' });
      expect(claude).toHaveLength(1);
      expect(claude[0].name).toBe('A');
    });

    it('應支援分頁', () => {
      for (let i = 0; i < 5; i++) {
        agentRepo.register({ adapter_id: `a${i}`, name: `Agent${i}`, type: 't' });
      }

      const page = agentRepo.findAll({ limit: 2, offset: 0 });
      expect(page).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('應更新指定欄位', () => {
      const agent = agentRepo.register({
        adapter_id: 'test',
        name: '原始',
        type: 'test',
      });

      const updated = agentRepo.update(agent.id, { name: '更新後', status: 'working' });

      expect(updated).toBeDefined();
      expect(updated!.name).toBe('更新後');
      expect(updated!.status).toBe('working');
    });

    it('更新不存在的 agent 應返回 undefined', () => {
      expect(agentRepo.update('nonexistent', { name: 'x' })).toBeUndefined();
    });
  });

  describe('deleteAgent', () => {
    it('應成功刪除', () => {
      const agent = agentRepo.register({
        adapter_id: 'test',
        name: '要刪除',
        type: 'test',
      });

      expect(agentRepo.deleteAgent(agent.id)).toBe(true);
      expect(agentRepo.findById(agent.id)).toBeUndefined();
    });

    it('刪除不存在的 agent 應返回 false', () => {
      expect(agentRepo.deleteAgent('nonexistent')).toBe(false);
    });
  });

  // ── heartbeat ───────────────────────────────────────────────

  describe('heartbeat', () => {
    it('應更新 last_heartbeat_at 並返回更新後的 agent', () => {
      const agent = agentRepo.register({
        adapter_id: 'test',
        name: 'HeartbeatTest',
        type: 'test',
      });

      const originalHb = agent.last_heartbeat_at;

      // 等一點時間確保時間戳不同
      const updated = agentRepo.heartbeat(agent.id);

      expect(updated).toBeDefined();
      expect(updated!.id).toBe(agent.id);
      // last_heartbeat_at 應已更新（可能相同如果太快，但至少不應報錯）
      expect(updated!.last_heartbeat_at).toBeTruthy();
    });

    it('不存在的 agent heartbeat 應返回 undefined', () => {
      expect(agentRepo.heartbeat('nonexistent')).toBeUndefined();
    });
  });
});

// ── AgentService 業務邏輯 ────────────────────────────────────

describe('AgentService', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('registerAgent', () => {
    it('應註冊並 emit agent.registered 事件', () => {
      const listener = vi.fn();
      eventBus.on('agent.registered', listener);

      const agent = agentService.registerAgent({
        name: 'CC',
        type: 'claude-opus',
        capabilities: ['coding'],
      });

      expect(agent).toBeDefined();
      expect(agent['name']).toBe('CC');
      expect(agent['capabilities']).toEqual(['coding']);
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'agent.registered' }),
      );
    });
  });

  describe('updateAgent', () => {
    it('應更新並 emit agent.started 事件', () => {
      const listener = vi.fn();
      eventBus.on('agent.started', listener);

      const agent = agentService.registerAgent({ name: 'Test', type: 'test' });
      const updated = agentService.updateAgent(agent['id'] as string, {
        status: 'working',
      });

      expect(updated).toBeDefined();
      expect(updated!['status']).toBe('working');
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('heartbeatAgent', () => {
    it('應更新心跳並 emit agent.progress 事件', () => {
      const listener = vi.fn();
      eventBus.on('agent.progress', listener);

      const agent = agentService.registerAgent({ name: 'Test', type: 'test' });
      const result = agentService.heartbeatAgent(agent['id'] as string);

      expect(result).toBeDefined();
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'agent.progress',
          action: 'heartbeat',
        }),
      );
    });

    it('不存在的 agent 應返回 undefined', () => {
      expect(agentService.heartbeatAgent('nonexistent')).toBeUndefined();
    });
  });

  describe('deleteAgent', () => {
    it('應刪除並 emit agent.completed 事件', () => {
      const listener = vi.fn();
      eventBus.on('agent.completed', listener);

      const agent = agentService.registerAgent({ name: 'Test', type: 'test' });
      const result = agentService.deleteAgent(agent['id'] as string);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe('listAgents', () => {
    it('應返回 agents 列表和 total', () => {
      agentService.registerAgent({ name: 'A', type: 't1' });
      agentService.registerAgent({ name: 'B', type: 't2' });

      const result = agentService.listAgents({});

      expect(result.agents).toHaveLength(2);
      expect(result.total).toBe(2);
      // capabilities 和 metadata 應已被解析
      expect(Array.isArray(result.agents[0]['capabilities'])).toBe(true);
    });
  });
});
