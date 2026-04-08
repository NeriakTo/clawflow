/**
 * Task Repository — 任務資料存取層
 * 使用參數化查詢，所有寫入操作返回新物件
 */
import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

// === 型別定義 ===

/** 任務狀態 */
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';

/** 任務優先級 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/** 任務排序欄位 */
export type TaskSortField = 'created_at' | 'updated_at' | 'priority' | 'status' | 'title';

/** 任務完整資料 */
export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly assignee_agent_id: string | null;
  readonly tags: string;
  readonly progress: number;
  readonly workflow_id: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly completed_at: string | null;
}

/** 建立任務 DTO */
export interface CreateTaskDto {
  readonly title: string;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly assignee_agent_id?: string;
  readonly tags?: readonly string[];
  readonly progress?: number;
  readonly workflow_id?: string;
}

/** 更新任務 DTO */
export interface UpdateTaskDto {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly assignee_agent_id?: string | null;
  readonly tags?: readonly string[];
  readonly progress?: number;
  readonly workflow_id?: string | null;
  readonly completed_at?: string | null;
}

/** 查詢篩選條件 */
export interface TaskFilters {
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly assignee?: string;
  readonly workflowId?: string;
  readonly tag?: string;
  readonly sort?: TaskSortField;
  readonly order?: 'asc' | 'desc';
  readonly limit?: number;
  readonly offset?: number;
}

/** 任務依賴關係 */
export interface TaskDependency {
  readonly task_id: string;
  readonly depends_on_task_id: string;
}

// === Repository 函數 ===

/**
 * 查詢所有任務（支援篩選、排序、分頁）
 */
export function findAll(filters: TaskFilters = {}): readonly Task[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority !== undefined) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.assignee !== undefined) {
    conditions.push('assignee_agent_id = ?');
    params.push(filters.assignee);
  }
  if (filters.workflowId !== undefined) {
    conditions.push('workflow_id = ?');
    params.push(filters.workflowId);
  }
  if (filters.tag !== undefined) {
    // 在 JSON 陣列中搜尋 tag（跳脫 LIKE 萬用字元避免注入）
    const escapedTag = filters.tag.replace(/[%_]/g, '\\$&');
    conditions.push("tags LIKE ? ESCAPE '\\'");
    params.push(`%"${escapedTag}"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // 白名單驗證排序欄位，防止 SQL injection
  const VALID_SORT_FIELDS = new Set<string>(['created_at', 'updated_at', 'priority', 'status', 'title']);
  const safeSortField = VALID_SORT_FIELDS.has(filters.sort ?? '') ? filters.sort! : 'created_at';
  const safeOrder = filters.order === 'asc' ? 'ASC' : 'DESC';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  // limit=0 表示只需計數，跳過資料查詢
  if (limit === 0) {
    return [];
  }

  const sql = `SELECT * FROM tasks ${where} ORDER BY ${safeSortField} ${safeOrder} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params) as Task[];
}

/**
 * 計算符合篩選條件的任務總數（使用 SELECT COUNT(*)）
 */
export function count(filters: TaskFilters = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.priority !== undefined) {
    conditions.push('priority = ?');
    params.push(filters.priority);
  }
  if (filters.assignee !== undefined) {
    conditions.push('assignee_agent_id = ?');
    params.push(filters.assignee);
  }
  if (filters.workflowId !== undefined) {
    conditions.push('workflow_id = ?');
    params.push(filters.workflowId);
  }
  if (filters.tag !== undefined) {
    const escapedTag = filters.tag.replace(/[%_]/g, '\\$&');
    conditions.push("tags LIKE ? ESCAPE '\\'");
    params.push(`%"${escapedTag}"%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) AS cnt FROM tasks ${where}`;

  const row = db.prepare(sql).get(...params) as { cnt: number };
  return row.cnt;
}

/**
 * 依 ID 查詢單一任務
 */
export function findById(id: string): Task | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Task | undefined;
}

/**
 * 建立新任務
 */
export function create(dto: CreateTaskDto): Task {
  const db = getDb();
  const now = new Date().toISOString();
  const id = ulid();

  const task: Task = {
    id,
    title: dto.title,
    description: dto.description ?? null,
    status: dto.status ?? 'backlog',
    priority: dto.priority ?? 'medium',
    assignee_agent_id: dto.assignee_agent_id ?? null,
    tags: JSON.stringify(dto.tags ?? []),
    progress: dto.progress ?? 0,
    workflow_id: dto.workflow_id ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
  };

  db.prepare(`
    INSERT INTO tasks (id, title, description, status, priority, assignee_agent_id, tags, progress, workflow_id, created_at, updated_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    task.id, task.title, task.description, task.status, task.priority,
    task.assignee_agent_id, task.tags, task.progress, task.workflow_id,
    task.created_at, task.updated_at, task.completed_at
  );

  return task;
}

/**
 * 更新任務（返回更新後的完整物件）
 */
export function update(id: string, dto: UpdateTaskDto): Task | undefined {
  const db = getDb();
  const existing = findById(id);
  if (existing === undefined) {
    return undefined;
  }

  const now = new Date().toISOString();
  const updated: Task = {
    ...existing,
    title: dto.title ?? existing.title,
    description: dto.description !== undefined ? dto.description : existing.description,
    status: dto.status ?? existing.status,
    priority: dto.priority ?? existing.priority,
    assignee_agent_id: dto.assignee_agent_id !== undefined ? dto.assignee_agent_id : existing.assignee_agent_id,
    tags: dto.tags !== undefined ? JSON.stringify(dto.tags) : existing.tags,
    progress: dto.progress ?? existing.progress,
    workflow_id: dto.workflow_id !== undefined ? dto.workflow_id : existing.workflow_id,
    completed_at: dto.completed_at !== undefined ? dto.completed_at : existing.completed_at,
    updated_at: now,
  };

  db.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?,
      assignee_agent_id = ?, tags = ?, progress = ?, workflow_id = ?,
      completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(
    updated.title, updated.description, updated.status, updated.priority,
    updated.assignee_agent_id, updated.tags, updated.progress, updated.workflow_id,
    updated.completed_at, updated.updated_at, updated.id
  );

  return updated;
}

/**
 * 刪除任務
 */
export function deleteTask(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 新增任務依賴（含 DAG 循環檢測）
 */
export function addDependency(taskId: string, dependsOnTaskId: string): void {
  const db = getDb();

  // 自我依賴檢查
  if (taskId === dependsOnTaskId) {
    throw new Error('任務不能依賴自己');
  }

  // DAG 循環檢測：用 DFS 檢查 dependsOnTaskId 是否能走回 taskId
  if (wouldCreateCycle(taskId, dependsOnTaskId)) {
    throw new Error(`新增依賴會產生循環：${taskId} → ${dependsOnTaskId}`);
  }

  db.prepare(
    'INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)'
  ).run(taskId, dependsOnTaskId);
}

/**
 * DFS 循環檢測
 * 檢查：如果加入 taskId → dependsOnTaskId 的邊，是否會形成環
 * 方法：從 dependsOnTaskId 出發，沿著依賴方向走，看能否回到 taskId
 */
function wouldCreateCycle(taskId: string, dependsOnTaskId: string): boolean {
  const db = getDb();
  const visited = new Set<string>();
  const stack = [dependsOnTaskId];

  while (stack.length > 0) {
    const current = stack.pop()!;

    if (current === taskId) {
      return true;
    }

    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    // 取得 current 依賴的所有任務
    const deps = db
      .prepare('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?')
      .all(current) as { depends_on_task_id: string }[];

    for (const dep of deps) {
      if (!visited.has(dep.depends_on_task_id)) {
        stack.push(dep.depends_on_task_id);
      }
    }
  }

  return false;
}

/**
 * 移除任務依賴
 */
export function removeDependency(taskId: string, dependsOnTaskId: string): boolean {
  const db = getDb();
  const result = db
    .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?')
    .run(taskId, dependsOnTaskId);
  return result.changes > 0;
}

/**
 * 取得任務的所有依賴
 */
export function getDependencies(taskId: string): readonly TaskDependency[] {
  const db = getDb();
  return db
    .prepare('SELECT task_id, depends_on_task_id FROM task_dependencies WHERE task_id = ?')
    .all(taskId) as TaskDependency[];
}
