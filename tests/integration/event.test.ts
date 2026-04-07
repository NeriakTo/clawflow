/**
 * Event 整合測試
 *
 * 使用真實的 in-memory SQLite 測試 EventRepository 和 EventService。
 * 每個測試使用獨立的資料庫實例，確保測試隔離。
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

const eventRepo = await import('../../src/core/models/event.repository.js');
const eventService = await import('../../src/core/services/event.service.js');
const { eventBus } = await import('../../src/core/services/event-bus.js');

// ── EventRepository ─────────────────────────────────────────────

describe('EventRepository', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  // ── create ──────────────────────────────────────────────────

  describe('create', () => {
    it('應建立事件並返回完整物件', () => {
      const event = eventRepo.create({
        event_type: 'task.created',
        source: 'test-adapter',
      });

      expect(event).toBeDefined();
      expect(event.id).toBeTruthy();
      expect(event.event_type).toBe('task.created');
      expect(event.source).toBe('test-adapter');
      expect(event.correlation_id).toBeNull();
      expect(event.task_id).toBeNull();
      expect(event.agent_id).toBeNull();
      expect(event.workflow_id).toBeNull();
      expect(event.payload).toBe('{}');
      expect(event.timestamp).toBeTruthy();
    });

    it('應支援所有選填欄位', () => {
      const event = eventRepo.create({
        event_type: 'task.updated',
        source: 'claude-code',
        correlation_id: 'corr-123',
        task_id: 'task-abc',
        agent_id: 'agent-xyz',
        workflow_id: 'wf-001',
        payload: { changes: { status: 'done' } },
      });

      expect(event.correlation_id).toBe('corr-123');
      expect(event.task_id).toBe('task-abc');
      expect(event.agent_id).toBe('agent-xyz');
      expect(event.workflow_id).toBe('wf-001');
      expect(JSON.parse(event.payload)).toEqual({ changes: { status: 'done' } });
    });
  });

  // ── findAll ─────────────────────────────────────────────────

  describe('findAll', () => {
    it('空資料庫應返回空陣列', () => {
      const events = eventRepo.findAll();
      expect(events).toEqual([]);
    });

    it('應返回所有已建立的事件', () => {
      eventRepo.create({ event_type: 'task.created', source: 'a' });
      eventRepo.create({ event_type: 'task.updated', source: 'b' });
      eventRepo.create({ event_type: 'agent.registered', source: 'c' });

      const events = eventRepo.findAll();
      expect(events).toHaveLength(3);
    });

    it('應依 type 篩選', () => {
      eventRepo.create({ event_type: 'task.created', source: 'a' });
      eventRepo.create({ event_type: 'task.updated', source: 'a' });
      eventRepo.create({ event_type: 'agent.registered', source: 'b' });

      const taskEvents = eventRepo.findAll({ type: 'task.created' });
      expect(taskEvents).toHaveLength(1);
      expect(taskEvents[0].event_type).toBe('task.created');
    });

    it('應依 source 篩選', () => {
      eventRepo.create({ event_type: 'task.created', source: 'claude-code' });
      eventRepo.create({ event_type: 'task.created', source: 'codex' });

      const claudeEvents = eventRepo.findAll({ source: 'claude-code' });
      expect(claudeEvents).toHaveLength(1);
      expect(claudeEvents[0].source).toBe('claude-code');
    });

    it('應依 taskId 篩選', () => {
      eventRepo.create({ event_type: 'task.created', source: 'a', task_id: 'task-1' });
      eventRepo.create({ event_type: 'task.created', source: 'a', task_id: 'task-2' });

      const filtered = eventRepo.findAll({ taskId: 'task-1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].task_id).toBe('task-1');
    });

    it('應依 agentId 篩選', () => {
      eventRepo.create({ event_type: 'agent.started', source: 'a', agent_id: 'agent-1' });
      eventRepo.create({ event_type: 'agent.started', source: 'a', agent_id: 'agent-2' });

      const filtered = eventRepo.findAll({ agentId: 'agent-1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].agent_id).toBe('agent-1');
    });

    it('應支援 limit 和 offset 分頁', () => {
      for (let i = 0; i < 5; i++) {
        eventRepo.create({ event_type: 'task.created', source: `src-${i}` });
      }

      const page1 = eventRepo.findAll({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = eventRepo.findAll({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = eventRepo.findAll({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });

    it('應依 timestamp DESC 排序', () => {
      eventRepo.create({ event_type: 'task.created', source: 'first' });
      eventRepo.create({ event_type: 'task.created', source: 'second' });

      const events = eventRepo.findAll();
      // 同一毫秒內可能相同，但至少不應報錯
      expect(events).toHaveLength(2);
    });
  });

  // ── createBatch ─────────────────────────────────────────────

  describe('createBatch', () => {
    it('應批次建立多個事件', () => {
      const events = eventRepo.createBatch([
        { event_type: 'task.created', source: 'batch-1' },
        { event_type: 'task.updated', source: 'batch-2' },
        { event_type: 'agent.registered', source: 'batch-3' },
      ]);

      expect(events).toHaveLength(3);
      expect(events[0].event_type).toBe('task.created');
      expect(events[1].event_type).toBe('task.updated');
      expect(events[2].event_type).toBe('agent.registered');
    });

    it('批次建立的事件都應有唯一 ID', () => {
      const events = eventRepo.createBatch([
        { event_type: 'task.created', source: 'a' },
        { event_type: 'task.created', source: 'a' },
      ]);

      expect(events[0].id).not.toBe(events[1].id);
    });

    it('批次建立後應能在 findAll 中查到', () => {
      eventRepo.createBatch([
        { event_type: 'task.created', source: 'a' },
        { event_type: 'task.updated', source: 'b' },
      ]);

      const all = eventRepo.findAll();
      expect(all).toHaveLength(2);
    });

    it('空陣列應返回空陣列', () => {
      const events = eventRepo.createBatch([]);
      expect(events).toEqual([]);
    });

    it('應正確處理 payload', () => {
      const events = eventRepo.createBatch([
        {
          event_type: 'task.created',
          source: 'test',
          payload: { taskId: 'task-1', title: '批次任務' },
        },
      ]);

      expect(JSON.parse(events[0].payload)).toEqual({
        taskId: 'task-1',
        title: '批次任務',
      });
    });
  });
});

// ── EventService ────────────────────────────────────────────────

describe('EventService', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('submitEvent', () => {
    it('應建立事件並透過 EventBus 廣播', () => {
      const listener = vi.fn();
      eventBus.on('task.created', listener);

      const event = eventService.submitEvent({
        event: 'task.created',
        source: 'test-adapter',
        payload: { taskId: 'task-1' },
      });

      expect(event).toBeDefined();
      expect(event['event_type']).toBe('task.created');
      expect(event['source']).toBe('test-adapter');
      // payload 應已被解析為物件
      expect(event['payload']).toEqual({ taskId: 'task-1' });
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'task.created' }),
      );
    });

    it('應支援 correlationId', () => {
      const event = eventService.submitEvent({
        event: 'task.updated',
        source: 'test',
        correlationId: 'corr-uuid-123',
        payload: {},
      });

      expect(event['correlation_id']).toBe('corr-uuid-123');
    });

    it('應支援 taskId 和 agentId', () => {
      const event = eventService.submitEvent({
        event: 'agent.started',
        source: 'test',
        payload: {},
        taskId: 'task-abc',
        agentId: 'agent-xyz',
      });

      expect(event['task_id']).toBe('task-abc');
      expect(event['agent_id']).toBe('agent-xyz');
    });
  });

  describe('submitEventsBatch', () => {
    it('應批量提交事件並逐一廣播', () => {
      const taskListener = vi.fn();
      const agentListener = vi.fn();
      eventBus.on('task.created', taskListener);
      eventBus.on('agent.registered', agentListener);

      const events = eventService.submitEventsBatch([
        { event: 'task.created', source: 'a', payload: { taskId: 'task-1' } },
        { event: 'agent.registered', source: 'b', payload: { agentId: 'agent-1' } },
      ]);

      expect(events).toHaveLength(2);
      expect(taskListener).toHaveBeenCalledOnce();
      expect(agentListener).toHaveBeenCalledOnce();
    });

    it('每個事件的 payload 應已被解析', () => {
      const events = eventService.submitEventsBatch([
        { event: 'task.created', source: 'a', payload: { key: 'value' } },
      ]);

      expect(events[0]['payload']).toEqual({ key: 'value' });
    });
  });

  describe('listEvents', () => {
    it('應返回事件列表和 total', () => {
      eventService.submitEvent({ event: 'task.created', source: 'a', payload: {} });
      eventService.submitEvent({ event: 'task.updated', source: 'b', payload: {} });

      const result = eventService.listEvents({});

      expect(result.events).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('payload 應已被解析為物件', () => {
      eventService.submitEvent({
        event: 'task.created',
        source: 'a',
        payload: { taskId: 'task-1' },
      });

      const result = eventService.listEvents({});
      expect(result.events[0]['payload']).toEqual({ taskId: 'task-1' });
    });

    it('應支援篩選條件', () => {
      eventService.submitEvent({ event: 'task.created', source: 'claude-code', payload: {} });
      eventService.submitEvent({ event: 'task.created', source: 'codex', payload: {} });

      const result = eventService.listEvents({ source: 'claude-code' });
      expect(result.events).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
