/**
 * Task 整合測試
 *
 * 使用真實的 in-memory SQLite 測試 TaskRepository 和 TaskService。
 * 每個測試使用獨立的資料庫實例，確保測試隔離。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { createTestDb } from '../setup.js';

// 在 import repository / service 前，先 mock connection 模組
let testDb: Database.Database;

vi.mock('../../src/core/db/connection.js', () => ({
  getDb: () => testDb,
  closeDb: () => { /* noop */ },
  resetDb: () => { /* noop */ },
}));

// mock 完成後再 import（動態 import 仍然會用到 mock）
const taskRepo = await import('../../src/core/models/task.repository.js');
const taskService = await import('../../src/core/services/task.service.js');
const { eventBus } = await import('../../src/core/services/event-bus.js');

describe('TaskRepository', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  // ── CRUD 基本操作 ────────────────────────────────────────────

  describe('create', () => {
    it('應建立任務並返回完整物件', () => {
      const task = taskRepo.create({ title: '測試任務' });

      expect(task).toBeDefined();
      expect(task.id).toBeTruthy();
      expect(task.title).toBe('測試任務');
      expect(task.status).toBe('backlog');
      expect(task.priority).toBe('medium');
      expect(task.progress).toBe(0);
      expect(task.description).toBeNull();
      expect(task.completed_at).toBeNull();
      expect(task.created_at).toBeTruthy();
      expect(task.updated_at).toBeTruthy();
    });

    it('應支援自訂所有欄位', () => {
      const task = taskRepo.create({
        title: '高優先任務',
        description: '詳細描述',
        status: 'todo',
        priority: 'critical',
        tags: ['urgent', 'frontend'],
        progress: 10,
      });

      expect(task.title).toBe('高優先任務');
      expect(task.description).toBe('詳細描述');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('critical');
      expect(JSON.parse(task.tags)).toEqual(['urgent', 'frontend']);
      expect(task.progress).toBe(10);
    });
  });

  describe('findById', () => {
    it('應找到已存在的任務', () => {
      const created = taskRepo.create({ title: '找我' });
      const found = taskRepo.findById(created.id);

      expect(found).toBeDefined();
      expect(found!.id).toBe(created.id);
      expect(found!.title).toBe('找我');
    });

    it('不存在的 ID 應返回 undefined', () => {
      const found = taskRepo.findById('nonexistent-id');
      expect(found).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('空資料庫應返回空陣列', () => {
      const tasks = taskRepo.findAll();
      expect(tasks).toEqual([]);
    });

    it('應返回所有已建立的任務', () => {
      taskRepo.create({ title: '任務一' });
      taskRepo.create({ title: '任務二' });
      taskRepo.create({ title: '任務三' });

      const tasks = taskRepo.findAll();
      expect(tasks).toHaveLength(3);
    });

    it('應依 status 篩選', () => {
      taskRepo.create({ title: '待辦', status: 'todo' });
      taskRepo.create({ title: '進行中', status: 'in_progress' });
      taskRepo.create({ title: '另一個待辦', status: 'todo' });

      const todoTasks = taskRepo.findAll({ status: 'todo' });
      expect(todoTasks).toHaveLength(2);
      for (const t of todoTasks) {
        expect(t.status).toBe('todo');
      }
    });

    it('應依 priority 篩選', () => {
      taskRepo.create({ title: '緊急', priority: 'critical' });
      taskRepo.create({ title: '普通', priority: 'medium' });

      const critical = taskRepo.findAll({ priority: 'critical' });
      expect(critical).toHaveLength(1);
      expect(critical[0].priority).toBe('critical');
    });

    it('應依 tag 篩選', () => {
      taskRepo.create({ title: '前端任務', tags: ['frontend', 'react'] });
      taskRepo.create({ title: '後端任務', tags: ['backend'] });

      const frontendTasks = taskRepo.findAll({ tag: 'frontend' });
      expect(frontendTasks).toHaveLength(1);
      expect(frontendTasks[0].title).toBe('前端任務');
    });

    it('應支援 limit 和 offset 分頁', () => {
      for (let i = 0; i < 5; i++) {
        taskRepo.create({ title: `任務 ${i}` });
      }

      const page1 = taskRepo.findAll({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);

      const page2 = taskRepo.findAll({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);

      const page3 = taskRepo.findAll({ limit: 2, offset: 4 });
      expect(page3).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('應更新指定欄位', () => {
      const task = taskRepo.create({ title: '原始標題' });
      const updated = taskRepo.update(task.id, { title: '更新標題' });

      expect(updated).toBeDefined();
      expect(updated!.title).toBe('更新標題');
      // updated_at 應存在且為有效 ISO 字串（同毫秒內可能相同，不比較嚴格不等式）
      expect(updated!.updated_at).toBeTruthy();
    });

    it('未指定的欄位應保持不變', () => {
      const task = taskRepo.create({
        title: '任務',
        description: '原始描述',
        priority: 'high',
      });

      const updated = taskRepo.update(task.id, { title: '新標題' });

      expect(updated!.description).toBe('原始描述');
      expect(updated!.priority).toBe('high');
    });

    it('應能將 description 設為 null', () => {
      const task = taskRepo.create({ title: '任務', description: '有描述' });
      const updated = taskRepo.update(task.id, { description: null });

      expect(updated!.description).toBeNull();
    });

    it('更新不存在的 ID 應返回 undefined', () => {
      const result = taskRepo.update('nonexistent', { title: '新標題' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteTask', () => {
    it('應成功刪除存在的任務', () => {
      const task = taskRepo.create({ title: '要刪除的任務' });
      const result = taskRepo.deleteTask(task.id);

      expect(result).toBe(true);
      expect(taskRepo.findById(task.id)).toBeUndefined();
    });

    it('刪除不存在的任務應返回 false', () => {
      const result = taskRepo.deleteTask('nonexistent');
      expect(result).toBe(false);
    });
  });

  // ── DAG 依賴 ────────────────────────────────────────────────

  describe('DAG 依賴', () => {
    it('應成功新增依賴關係', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });

      taskRepo.addDependency(taskA.id, taskB.id);

      const deps = taskRepo.getDependencies(taskA.id);
      expect(deps).toHaveLength(1);
      expect(deps[0].task_id).toBe(taskA.id);
      expect(deps[0].depends_on_task_id).toBe(taskB.id);
    });

    it('應成功移除依賴關係', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });

      taskRepo.addDependency(taskA.id, taskB.id);
      const removed = taskRepo.removeDependency(taskA.id, taskB.id);

      expect(removed).toBe(true);
      expect(taskRepo.getDependencies(taskA.id)).toHaveLength(0);
    });

    it('移除不存在的依賴應返回 false', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });

      const removed = taskRepo.removeDependency(taskA.id, taskB.id);
      expect(removed).toBe(false);
    });

    it('取得無依賴任務的依賴列表應為空', () => {
      const task = taskRepo.create({ title: '獨立任務' });
      const deps = taskRepo.getDependencies(task.id);
      expect(deps).toHaveLength(0);
    });

    it('應支援多個依賴', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });
      const taskC = taskRepo.create({ title: '任務 C' });

      taskRepo.addDependency(taskA.id, taskB.id);
      taskRepo.addDependency(taskA.id, taskC.id);

      const deps = taskRepo.getDependencies(taskA.id);
      expect(deps).toHaveLength(2);
    });
  });

  // ── 循環依賴檢測 ────────────────────────────────────────────

  describe('循環依賴檢測', () => {
    it('自我依賴應拋出錯誤', () => {
      const task = taskRepo.create({ title: '自我依賴' });

      expect(() => {
        taskRepo.addDependency(task.id, task.id);
      }).toThrow('任務不能依賴自己');
    });

    it('直接循環（A→B, B→A）應拋出錯誤', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });

      taskRepo.addDependency(taskA.id, taskB.id);

      expect(() => {
        taskRepo.addDependency(taskB.id, taskA.id);
      }).toThrow(/循環/);
    });

    it('間接循環（A→B→C→A）應拋出錯誤', () => {
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });
      const taskC = taskRepo.create({ title: '任務 C' });

      taskRepo.addDependency(taskA.id, taskB.id); // A 依賴 B
      taskRepo.addDependency(taskB.id, taskC.id); // B 依賴 C

      // C 依賴 A 會形成循環
      expect(() => {
        taskRepo.addDependency(taskC.id, taskA.id);
      }).toThrow(/循環/);
    });

    it('非循環的菱形依賴應允許', () => {
      // A → B, A → C, B → D, C → D
      const taskA = taskRepo.create({ title: '任務 A' });
      const taskB = taskRepo.create({ title: '任務 B' });
      const taskC = taskRepo.create({ title: '任務 C' });
      const taskD = taskRepo.create({ title: '任務 D' });

      taskRepo.addDependency(taskA.id, taskB.id);
      taskRepo.addDependency(taskA.id, taskC.id);
      taskRepo.addDependency(taskB.id, taskD.id);

      // C → D 不應形成循環
      expect(() => {
        taskRepo.addDependency(taskC.id, taskD.id);
      }).not.toThrow();
    });
  });
});

// ── TaskService 業務邏輯 ────────────────────────────────────

describe('TaskService', () => {
  beforeEach(() => {
    testDb = createTestDb();
    eventBus.clear();
  });

  afterEach(() => {
    testDb.close();
  });

  describe('createTask', () => {
    it('應建立任務並 emit task.created 事件', () => {
      const listener = vi.fn();
      eventBus.on('task.created', listener);

      const task = taskService.createTask({ title: '新任務' });

      expect(task).toBeDefined();
      expect(task['title']).toBe('新任務');
      expect(listener).toHaveBeenCalledOnce();
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'task.created' }),
      );
    });

    it('tags 應被解析為陣列', () => {
      const task = taskService.createTask({
        title: '有標籤任務',
        tags: ['test', 'feature'],
      });

      expect(task['tags']).toEqual(['test', 'feature']);
    });
  });

  describe('updateTask', () => {
    it('應更新任務並 emit task.updated 事件', () => {
      const listener = vi.fn();
      eventBus.on('task.updated', listener);

      const task = taskService.createTask({ title: '原始' });
      const updated = taskService.updateTask(task['id'] as string, {
        title: '更新後',
      });

      expect(updated).toBeDefined();
      expect(updated!['title']).toBe('更新後');
      expect(listener).toHaveBeenCalledOnce();
    });

    it('狀態轉移到 done 應自動設定 completed_at 和 progress=100', () => {
      const completedListener = vi.fn();
      eventBus.on('task.completed', completedListener);

      const task = taskService.createTask({ title: '即將完成' });
      const updated = taskService.updateTask(task['id'] as string, {
        status: 'done',
      });

      expect(updated).toBeDefined();
      expect(updated!['progress']).toBe(100);
      expect(updated!['completed_at']).toBeTruthy();
      expect(updated!['status']).toBe('done');

      // 應發送 task.completed 而非 task.updated
      expect(completedListener).toHaveBeenCalledOnce();
    });

    it('更新不存在的任務應返回 undefined', () => {
      const result = taskService.updateTask('nonexistent', { title: '更新' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteTask', () => {
    it('應刪除任務並 emit task.deleted 事件', () => {
      const listener = vi.fn();
      eventBus.on('task.deleted', listener);

      const task = taskService.createTask({ title: '要刪除' });
      const result = taskService.deleteTask(task['id'] as string);

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalled();
    });

    it('刪除不存在的任務應返回 false', () => {
      const result = taskService.deleteTask('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('listTasks', () => {
    it('應返回任務列表和 total', () => {
      taskService.createTask({ title: '任務一' });
      taskService.createTask({ title: '任務二' });

      const result = taskService.listTasks({});

      expect(result.tasks).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('tags 應已被解析為陣列', () => {
      taskService.createTask({ title: '任務', tags: ['a', 'b'] });

      const result = taskService.listTasks({});
      expect(result.tasks[0]['tags']).toEqual(['a', 'b']);
    });
  });

  describe('getTask', () => {
    it('應返回序列化後的任務', () => {
      const created = taskService.createTask({ title: '找我' });
      const found = taskService.getTask(created['id'] as string);

      expect(found).toBeDefined();
      expect(found!['title']).toBe('找我');
    });

    it('不存在的 ID 應返回 undefined', () => {
      const result = taskService.getTask('nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('DAG 依賴操作', () => {
    it('addTaskDependency 應 emit task.updated 事件', () => {
      const listener = vi.fn();
      eventBus.on('task.updated', listener);

      const taskA = taskService.createTask({ title: '任務 A' });
      const taskB = taskService.createTask({ title: '任務 B' });

      taskService.addTaskDependency(
        taskA['id'] as string,
        taskB['id'] as string,
      );

      // 扣除 createTask 的事件，應還有 dependency_added 事件
      const depEvent = listener.mock.calls.find(
        (call) => (call[0] as Record<string, unknown>)['action'] === 'dependency_added',
      );
      expect(depEvent).toBeDefined();
    });

    it('removeTaskDependency 應 emit task.updated 事件', () => {
      const taskA = taskService.createTask({ title: '任務 A' });
      const taskB = taskService.createTask({ title: '任務 B' });

      taskService.addTaskDependency(
        taskA['id'] as string,
        taskB['id'] as string,
      );

      const listener = vi.fn();
      eventBus.on('task.updated', listener);

      const result = taskService.removeTaskDependency(
        taskA['id'] as string,
        taskB['id'] as string,
      );

      expect(result).toBe(true);
      expect(listener).toHaveBeenCalledOnce();
    });
  });
});
