/**
 * EventBus 單元測試
 *
 * 測試 pub/sub 機制、glob pattern 匹配、取消訂閱等功能。
 * 純記憶體操作，不需要資料庫。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '../../src/core/services/event-bus.js';

describe('EventBus', () => {
  beforeEach(() => {
    // 每個測試前清空所有訂閱
    eventBus.clear();
  });

  // ── emit + on 基本訂閱 ──────────────────────────────────────

  describe('基本 emit / on', () => {
    it('應該觸發完全匹配的 listener', () => {
      const listener = vi.fn();
      eventBus.on('task.created', listener);

      const event = { event: 'task.created', taskId: '123' };
      eventBus.emit(event);

      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(event);
    });

    it('同一事件可以有多個 listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('task.created', listener1);
      eventBus.on('task.created', listener2);

      eventBus.emit({ event: 'task.created' });

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('listener 拋出錯誤不應影響其他 listener', () => {
      const errorListener = vi.fn(() => {
        throw new Error('故意拋出的錯誤');
      });
      const normalListener = vi.fn();

      eventBus.on('task.created', errorListener);
      eventBus.on('task.created', normalListener);

      eventBus.emit({ event: 'task.created' });

      expect(errorListener).toHaveBeenCalledOnce();
      expect(normalListener).toHaveBeenCalledOnce();
    });
  });

  // ── glob pattern 匹配 ──────────────────────────────────────

  describe('glob pattern 匹配', () => {
    it('task.* 應匹配 task.created', () => {
      const listener = vi.fn();
      eventBus.on('task.*', listener);

      eventBus.emit({ event: 'task.created' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('task.* 應匹配 task.updated', () => {
      const listener = vi.fn();
      eventBus.on('task.*', listener);

      eventBus.emit({ event: 'task.updated' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('task.* 應匹配 task.completed', () => {
      const listener = vi.fn();
      eventBus.on('task.*', listener);

      eventBus.emit({ event: 'task.completed' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('agent.* 應匹配 agent.registered', () => {
      const listener = vi.fn();
      eventBus.on('agent.*', listener);

      eventBus.emit({ event: 'agent.registered' });

      expect(listener).toHaveBeenCalledOnce();
    });

    it('task.* 不應匹配 agent.registered', () => {
      const listener = vi.fn();
      eventBus.on('task.*', listener);

      eventBus.emit({ event: 'agent.registered' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── * 萬用匹配 ─────────────────────────────────────────────

  describe('* 萬用匹配', () => {
    it('** 應匹配所有事件', () => {
      const listener = vi.fn();
      eventBus.on('**', listener);

      eventBus.emit({ event: 'task.created' });
      eventBus.emit({ event: 'agent.registered' });
      eventBus.emit({ event: 'workflow.started' });

      expect(listener).toHaveBeenCalledTimes(3);
    });

    it('* 應匹配不含 dot 的事件名', () => {
      const listener = vi.fn();
      eventBus.on('*', listener);

      // 不含 dot 的事件
      eventBus.emit({ event: 'ping' });
      expect(listener).toHaveBeenCalledOnce();
    });

    it('* 不應匹配含 dot 的事件名', () => {
      const listener = vi.fn();
      eventBus.on('*', listener);

      // 含 dot 的事件
      eventBus.emit({ event: 'task.created' });
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── off 取消訂閱 ────────────────────────────────────────────

  describe('off 取消訂閱', () => {
    it('取消訂閱後不應再觸發 listener', () => {
      const listener = vi.fn();
      eventBus.on('task.created', listener);

      // 先觸發一次確認有效
      eventBus.emit({ event: 'task.created' });
      expect(listener).toHaveBeenCalledOnce();

      // 取消訂閱
      eventBus.off('task.created', listener);

      // 再次觸發不應收到
      eventBus.emit({ event: 'task.created' });
      expect(listener).toHaveBeenCalledOnce(); // 仍然只有 1 次
    });

    it('取消訂閱不影響其他 listener', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('task.created', listener1);
      eventBus.on('task.created', listener2);

      eventBus.off('task.created', listener1);

      eventBus.emit({ event: 'task.created' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('取消不存在的訂閱不應拋錯', () => {
      const listener = vi.fn();
      expect(() => eventBus.off('task.created', listener)).not.toThrow();
    });
  });

  // ── 不匹配的 pattern 不觸發 ────────────────────────────────

  describe('不匹配的 pattern 不觸發', () => {
    it('完全不同的 pattern 不應觸發', () => {
      const listener = vi.fn();
      eventBus.on('workflow.started', listener);

      eventBus.emit({ event: 'task.created' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('部分匹配不視為符合', () => {
      const listener = vi.fn();
      eventBus.on('task.create', listener);

      eventBus.emit({ event: 'task.created' });

      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ── clear 清空訂閱 ─────────────────────────────────────────

  describe('clear 清空訂閱', () => {
    it('clear 後所有 listener 都不應被觸發', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      eventBus.on('task.*', listener1);
      eventBus.on('agent.*', listener2);

      eventBus.clear();

      eventBus.emit({ event: 'task.created' });
      eventBus.emit({ event: 'agent.registered' });

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });
});
