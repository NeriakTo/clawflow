/**
 * Workflow Repository — 工作流資料存取層
 * 使用參數化查詢，所有寫入操作返回新物件
 */
import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

// === 型別定義 ===

/** 工作流狀態 */
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 步驟狀態 */
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/** 工作流完整資料 */
export interface Workflow {
  readonly id: string;
  readonly name: string;
  readonly status: WorkflowStatus;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

/** 工作流步驟 */
export interface WorkflowStep {
  readonly id: string;
  readonly workflow_id: string;
  readonly task_id: string | null;
  readonly step_order: number;
  readonly status: StepStatus;
  readonly config: string;
}

/** 工作流含步驟 */
export interface WorkflowWithSteps extends Workflow {
  readonly steps: readonly WorkflowStep[];
}

/** 建立工作流 DTO */
export interface CreateWorkflowDto {
  readonly name: string;
  readonly status?: WorkflowStatus;
  readonly steps?: readonly CreateStepDto[];
}

/** 建立步驟 DTO */
export interface CreateStepDto {
  readonly task_id?: string;
  readonly step_order: number;
  readonly status?: StepStatus;
  readonly config?: Record<string, unknown>;
}

/** 更新工作流 DTO */
export interface UpdateWorkflowDto {
  readonly name?: string;
  readonly status?: WorkflowStatus;
  readonly completed_at?: string | null;
}

// === Repository 函數 ===

/**
 * 查詢所有工作流
 */
export function findAll(): readonly Workflow[] {
  const db = getDb();
  return db
    .prepare('SELECT * FROM workflows ORDER BY created_at DESC')
    .all() as Workflow[];
}

/**
 * 依 ID 查詢工作流（含步驟）
 */
export function findById(id: string): WorkflowWithSteps | undefined {
  const db = getDb();
  const workflow = db
    .prepare('SELECT * FROM workflows WHERE id = ?')
    .get(id) as Workflow | undefined;

  if (workflow === undefined) {
    return undefined;
  }

  const steps = db
    .prepare('SELECT * FROM workflow_steps WHERE workflow_id = ? ORDER BY step_order ASC')
    .all(id) as WorkflowStep[];

  return { ...workflow, steps };
}

/**
 * 建立新工作流（含步驟，在同一 transaction 中執行）
 */
export function create(dto: CreateWorkflowDto): WorkflowWithSteps {
  const db = getDb();
  const now = new Date().toISOString();
  const id = ulid();

  const workflow: Workflow = {
    id,
    name: dto.name,
    status: dto.status ?? 'pending',
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  const steps: WorkflowStep[] = (dto.steps ?? []).map((stepDto) => ({
    id: ulid(),
    workflow_id: id,
    task_id: stepDto.task_id ?? null,
    step_order: stepDto.step_order,
    status: stepDto.status ?? 'pending',
    config: JSON.stringify(stepDto.config ?? {}),
  }));

  const insertWorkflow = db.prepare(`
    INSERT INTO workflows (id, name, status, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insertStep = db.prepare(`
    INSERT INTO workflow_steps (id, workflow_id, task_id, step_order, status, config)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const runInTransaction = db.transaction(() => {
    insertWorkflow.run(
      workflow.id, workflow.name, workflow.status,
      workflow.created_at, workflow.updated_at, workflow.completed_at
    );

    for (const step of steps) {
      insertStep.run(
        step.id, step.workflow_id, step.task_id,
        step.step_order, step.status, step.config
      );
    }
  });
  runInTransaction();

  return { ...workflow, steps };
}

/**
 * 更新工作流（返回更新後的完整物件含步驟）
 */
export function update(id: string, dto: UpdateWorkflowDto): WorkflowWithSteps | undefined {
  const db = getDb();
  const existing = findById(id);
  if (existing === undefined) {
    return undefined;
  }

  const now = new Date().toISOString();
  const updated: Workflow = {
    ...existing,
    name: dto.name ?? existing.name,
    status: dto.status ?? existing.status,
    completed_at: dto.completed_at !== undefined ? dto.completed_at : existing.completed_at,
    updated_at: now,
  };

  db.prepare(`
    UPDATE workflows SET name = ?, status = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.name, updated.status, updated.completed_at, updated.updated_at, updated.id
  );

  // 重新查詢以取得完整步驟
  return findById(id);
}

/**
 * 刪除工作流（CASCADE 會自動刪除步驟）
 */
export function deleteWorkflow(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  return result.changes > 0;
}
