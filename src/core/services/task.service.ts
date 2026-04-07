/**
 * TaskService — 任務業務邏輯層
 *
 * 封裝 TaskRepository，於 create/update/delete 後透過 EventBus 發送事件。
 * 支援 DAG 依賴檢查（repository 層已內建）。
 */

import { eventBus } from './event-bus.js';
import * as taskRepo from '../models/task.repository.js';
import type {
  Task,
  TaskFilters,
  TaskDependency,
} from '../models/task.repository.js';

// ── 重新匯出 repository 型別供外部使用 ─────────────────────────
export type { Task, TaskFilters, TaskDependency };

// ── 工具函式 ────────────────────────────────────────────────────

/** 序列化任務（將 tags JSON 字串解析為陣列） */
function serializeTask(row: Task): Record<string, unknown> {
  return {
    ...row,
    tags: JSON.parse(row.tags || '[]') as string[],
  };
}

/** 從物件中移除值為 undefined 的屬性（滿足 exactOptionalPropertyTypes） */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

/** 計算總數（使用 SELECT COUNT(*) 查詢） */
function countTasks(filters: TaskFilters): number {
  const countFilters = stripUndefined({
    status: filters.status,
    priority: filters.priority,
    assignee: filters.assignee,
    workflowId: filters.workflowId,
    tag: filters.tag,
  }) as TaskFilters;
  return taskRepo.count(countFilters);
}

// ── Service 公開方法 ────────────────────────────────────────────

/** 列出任務（含分頁與篩選） */
export function listTasks(
  filters: TaskFilters,
): { tasks: readonly Record<string, unknown>[]; total: number } {
  const rows = taskRepo.findAll(filters);
  const total = countTasks(filters);
  return {
    tasks: rows.map(serializeTask),
    total,
  };
}

/** 取得單一任務 */
export function getTask(
  id: string,
): Record<string, unknown> | undefined {
  const row = taskRepo.findById(id);
  return row ? serializeTask(row) : undefined;
}

/** Service 層建立任務輸入 */
export interface CreateTaskInput {
  readonly title: string;
  readonly description?: string;
  readonly status?: string;
  readonly priority?: string;
  readonly assigneeAgentId?: string;
  readonly tags?: readonly string[];
  readonly dependencies?: readonly string[];
  readonly workflowId?: string;
}

/** 建立任務 */
export function createTask(
  input: CreateTaskInput,
): Record<string, unknown> {
  const dto = stripUndefined({
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    assignee_agent_id: input.assigneeAgentId,
    tags: input.tags,
    workflow_id: input.workflowId,
  });

  const row = taskRepo.create(dto as unknown as Parameters<typeof taskRepo.create>[0]);

  // 新增依賴
  if (input.dependencies && input.dependencies.length > 0) {
    for (const depId of input.dependencies) {
      taskRepo.addDependency(row.id, depId);
    }
  }

  const task = serializeTask(row);

  eventBus.emit({
    event: 'task.created',
    taskId: row.id,
    task,
  });

  return task;
}

/** Service 層更新任務輸入 */
export interface UpdateTaskInput {
  readonly title?: string;
  readonly description?: string;
  readonly status?: string;
  readonly priority?: string;
  readonly assigneeAgentId?: string | null;
  readonly tags?: readonly string[];
  readonly progress?: number;
}

/** 更新任務 */
export function updateTask(
  id: string,
  input: UpdateTaskInput,
): Record<string, unknown> | undefined {
  const existing = taskRepo.findById(id);
  if (!existing) return undefined;

  // 狀態轉移到 done 時自動設定 completed_at 和 progress=100
  const raw: Record<string, unknown> = {};
  if (input.title !== undefined) raw['title'] = input.title;
  if (input.description !== undefined) raw['description'] = input.description;
  if (input.status !== undefined) raw['status'] = input.status;
  if (input.priority !== undefined) raw['priority'] = input.priority;
  if (input.assigneeAgentId !== undefined) raw['assignee_agent_id'] = input.assigneeAgentId;
  if (input.tags !== undefined) raw['tags'] = input.tags;
  if (input.progress !== undefined) raw['progress'] = input.progress;

  if (input.status === 'done') {
    raw['progress'] = 100;
    raw['completed_at'] = new Date().toISOString();
  }

  const updated = taskRepo.update(id, raw as Parameters<typeof taskRepo.update>[1]);
  if (!updated) return undefined;

  const task = serializeTask(updated);

  // 根據狀態發送不同事件
  if (input.status === 'done') {
    eventBus.emit({
      event: 'task.completed',
      taskId: id,
      task,
    });
  } else {
    eventBus.emit({
      event: 'task.updated',
      taskId: id,
      changes: input,
      task,
    });
  }

  return task;
}

/** 刪除任務 */
export function deleteTask(id: string): boolean {
  const existing = taskRepo.findById(id);
  if (!existing) return false;

  const result = taskRepo.deleteTask(id);

  if (result) {
    eventBus.emit({
      event: 'task.completed',
      taskId: id,
      action: 'deleted',
      deleted: true,
    });
  }

  return result;
}

/** 取得任務依賴列表 */
export function getTaskDependencies(
  taskId: string,
): readonly TaskDependency[] {
  return taskRepo.getDependencies(taskId);
}

/** 新增任務依賴（循環檢測由 repository 處理） */
export function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
): void {
  taskRepo.addDependency(taskId, dependsOnTaskId);

  eventBus.emit({
    event: 'task.updated',
    taskId,
    action: 'dependency_added',
    dependsOnTaskId,
  });
}

/** 移除任務依賴 */
export function removeTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
): boolean {
  const result = taskRepo.removeDependency(taskId, dependsOnTaskId);

  if (result) {
    eventBus.emit({
      event: 'task.updated',
      taskId,
      action: 'dependency_removed',
      dependsOnTaskId,
    });
  }

  return result;
}
