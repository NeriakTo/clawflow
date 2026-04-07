/**
 * WorkflowService — 工作流業務邏輯層
 *
 * 封裝 WorkflowRepository，於 create/update/delete 後透過 EventBus 發送事件。
 */

import { eventBus } from './event-bus.js';
import * as workflowRepo from '../models/workflow.repository.js';
import type {
  Workflow,
  WorkflowWithSteps,
} from '../models/workflow.repository.js';

// ── 重新匯出 repository 型別供外部使用 ─────────────────────────
export type { Workflow, WorkflowWithSteps };

// ── 工具函式 ────────────────────────────────────────────────────

/** 從物件中移除值為 undefined 的屬性 */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// ── Service 層輸入型別 ──────────────────────────────────────────

/** 查詢篩選 */
export interface WorkflowFilters {
  readonly status?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/** 建立工作流輸入 */
export interface CreateWorkflowInput {
  readonly name: string;
  readonly description?: string;
  readonly steps?: readonly {
    readonly stepName?: string;
    readonly taskId?: string;
    readonly stepOrder?: number;
    readonly config?: Record<string, unknown>;
  }[];
  readonly metadata?: Record<string, unknown>;
}

/** 更新工作流輸入 */
export interface UpdateWorkflowInput {
  readonly name?: string;
  readonly description?: string;
  readonly status?: string;
  readonly metadata?: Record<string, unknown>;
}

// ── Service 公開方法 ────────────────────────────────────────────

/** 列出工作流 */
export function listWorkflows(
  filters: WorkflowFilters,
): { workflows: readonly Workflow[]; total: number } {
  const all = workflowRepo.findAll();

  // 在 service 層做篩選（repository 目前不支援 filter 參數）
  let filtered: readonly Workflow[] = all;
  if (filters.status !== undefined) {
    filtered = all.filter((w) => w.status === filters.status);
  }

  const total = filtered.length;

  // 分頁
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;
  const paged = filtered.slice(offset, offset + limit);

  return { workflows: paged, total };
}

/** 取得工作流（含 steps） */
export function getWorkflow(
  id: string,
): WorkflowWithSteps | undefined {
  return workflowRepo.findById(id);
}

/** 建立工作流 */
export function createWorkflow(
  input: CreateWorkflowInput,
): WorkflowWithSteps {
  const steps = (input.steps ?? []).map((s, i) =>
    stripUndefined({
      task_id: s.taskId,
      step_order: s.stepOrder ?? i,
      config: s.config,
    }),
  );

  const dto = stripUndefined({
    name: input.name,
    steps: steps.length > 0 ? steps : undefined,
  });

  const result = workflowRepo.create(
    dto as unknown as Parameters<typeof workflowRepo.create>[0],
  );

  eventBus.emit({
    event: 'workflow.started',
    workflowId: result.id,
    name: result.name,
    totalSteps: result.steps.length,
  });

  return result;
}

/** 更新工作流 */
export function updateWorkflow(
  id: string,
  input: UpdateWorkflowInput,
): WorkflowWithSteps | undefined {
  const existing = workflowRepo.findById(id);
  if (!existing) return undefined;

  const raw: Record<string, unknown> = {};
  if (input.name !== undefined) raw['name'] = input.name;
  if (input.status !== undefined) {
    raw['status'] = input.status;
    if (input.status === 'completed' || input.status === 'failed') {
      raw['completed_at'] = new Date().toISOString();
    }
  }

  const updated = workflowRepo.update(
    id,
    raw as Parameters<typeof workflowRepo.update>[1],
  );
  if (!updated) return undefined;

  if (input.status === 'completed' || input.status === 'failed') {
    eventBus.emit({
      event: 'workflow.completed',
      workflowId: id,
      success: input.status === 'completed',
    });
  } else {
    eventBus.emit({
      event: 'workflow.step',
      workflowId: id,
      action: 'updated',
    });
  }

  return updated;
}

/** 刪除工作流 */
export function deleteWorkflow(id: string): boolean {
  const existing = workflowRepo.findById(id);
  if (!existing) return false;

  return workflowRepo.deleteWorkflow(id);
}
