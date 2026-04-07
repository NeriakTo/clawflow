/**
 * clawflow Web UI 型別定義
 */

// ============================================================
// 任務（Task）
// ============================================================

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'archived';

export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly assigneeAgentId: string | undefined;
  readonly tags: readonly string[];
  readonly progress: number;
  readonly dependencies: readonly string[];
  readonly workflowId: string | undefined;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | undefined;
}

export interface CreateTaskDto {
  readonly title: string;
  readonly description: string | undefined;
  readonly priority: TaskPriority | undefined;
  readonly tags: readonly string[] | undefined;
  readonly assigneeAgentId: string | undefined;
}

export interface UpdateTaskDto {
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly status: TaskStatus | undefined;
  readonly priority: TaskPriority | undefined;
  readonly assigneeAgentId: string | null | undefined;
  readonly tags: readonly string[] | undefined;
  readonly progress: number | undefined;
  readonly completedAt: string | null | undefined;
}

export interface TaskFilters {
  readonly search: string | undefined;
  readonly priority: TaskPriority | undefined;
  readonly assignee: string | undefined;
  readonly tag: string | undefined;
}

// ============================================================
// Agent
// ============================================================

export type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

export interface Agent {
  readonly id: string;
  readonly adapterId: string;
  readonly name: string;
  readonly type: string;
  readonly status: AgentStatus;
  readonly capabilities: readonly string[];
  readonly currentTaskId: string | undefined;
  readonly metadata: Record<string, unknown>;
  readonly registeredAt: string;
  readonly lastHeartbeatAt: string;
}

// ============================================================
// API Response
// ============================================================

export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiMeta {
  readonly total?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: ApiError;
  readonly meta?: ApiMeta;
}

// ============================================================
// WebSocket 事件
// ============================================================

export interface WsEvent {
  readonly event: string;
  readonly payload: Record<string, unknown>;
  readonly timestamp: string;
  readonly source: string;
}

// ============================================================
// 路由
// ============================================================

export type ViewRoute = 'board' | 'dag' | 'timeline' | 'agent' | 'dashboard';
