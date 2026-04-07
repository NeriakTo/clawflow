/**
 * clawflow 標準化事件協議 — Zod Schema 定義
 *
 * 所有 CLI adapter（Claude Code、Codex CLI、Gemini CLI、OpenClaw）
 * 透過此協議統一事件格式，實現跨工具工作流觀察。
 */

import { z } from 'zod';

// ============================================================
// 共用欄位
// ============================================================

/** 事件來源（CLI adapter 識別碼） */
export const EventSourceSchema = z.string().min(1).describe('事件來源 CLI adapter 識別碼，例如 "claude-code"');

/** ISO 8601 時間戳 */
export const TimestampSchema = z.string().datetime().describe('ISO 8601 格式時間戳');

/** 關聯追蹤 ID，用於串聯同一工作流中的相關事件 */
export const CorrelationIdSchema = z.string().uuid().describe('關聯追蹤 ID（UUID v4），串聯同一工作流的相關事件');

// ============================================================
// 任務（Task）相關 Schema
// ============================================================

/** 任務狀態 */
export const TaskStatusSchema = z.enum([
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'archived',
]).describe('任務狀態');

/** 任務優先級 */
export const TaskPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]).describe('任務優先級');

/** task.created 事件 payload */
export const TaskCreatedPayloadSchema = z.object({
  taskId: z.string().min(1).describe('任務唯一識別碼'),
  title: z.string().min(1).describe('任務標題'),
  description: z.string().optional().describe('任務描述'),
  status: TaskStatusSchema.default('backlog'),
  priority: TaskPrioritySchema.default('medium'),
  assignee: z.string().optional().describe('指派的 agent ID'),
  tags: z.array(z.string()).default([]).describe('分類標籤'),
  dependsOn: z.array(z.string()).default([]).describe('前置依賴任務 ID 列表（DAG）'),
}).describe('task.created 事件 payload');

/** task.updated 事件 payload */
export const TaskUpdatedPayloadSchema = z.object({
  taskId: z.string().min(1).describe('任務唯一識別碼'),
  /** 僅包含變更的欄位 */
  changes: z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    status: TaskStatusSchema.optional(),
    priority: TaskPrioritySchema.optional(),
    assignee: z.string().nullable().optional().describe('指派的 agent ID，null 表示取消指派'),
    tags: z.array(z.string()).optional(),
    dependsOn: z.array(z.string()).optional(),
    progress: z.number().int().min(0).max(100).optional().describe('進度百分比（0-100）'),
  }).describe('變更的欄位集合'),
}).describe('task.updated 事件 payload');

/** task.completed 事件 payload */
export const TaskCompletedPayloadSchema = z.object({
  taskId: z.string().min(1).describe('任務唯一識別碼'),
  result: z.string().optional().describe('完成摘要或結果說明'),
  duration: z.number().nonnegative().optional().describe('任務耗時（毫秒）'),
}).describe('task.completed 事件 payload');

/** task.failed 事件 payload */
export const TaskFailedPayloadSchema = z.object({
  taskId: z.string().min(1).describe('任務唯一識別碼'),
  error: z.string().min(1).describe('錯誤訊息'),
  errorCode: z.string().optional().describe('錯誤代碼（供程式處理）'),
  recoverable: z.boolean().default(false).describe('是否可復原'),
}).describe('task.failed 事件 payload');

// ============================================================
// Agent 相關 Schema
// ============================================================

/** Agent 狀態 */
export const AgentStatusSchema = z.enum([
  'idle',
  'working',
  'completed',
  'error',
]).describe('Agent 狀態');

/** Agent 能力標籤 */
export const AgentCapabilitySchema = z.string().min(1).describe('Agent 能力標籤，例如 "coding"、"research"');

/** agent.registered 事件 payload */
export const AgentRegisteredPayloadSchema = z.object({
  agentId: z.string().min(1).describe('Agent 唯一識別碼'),
  name: z.string().min(1).describe('Agent 顯示名稱'),
  type: z.string().min(1).describe('Agent 類型，例如 "claude-opus"、"codex"'),
  capabilities: z.array(AgentCapabilitySchema).default([]).describe('Agent 能力列表'),
  metadata: z.record(z.unknown()).optional().describe('額外自定義資訊'),
}).describe('agent.registered 事件 payload');

/** agent.started 事件 payload */
export const AgentStartedPayloadSchema = z.object({
  agentId: z.string().min(1).describe('Agent 唯一識別碼'),
  taskId: z.string().min(1).describe('正在處理的任務 ID'),
}).describe('agent.started 事件 payload');

/** agent.progress 事件 payload */
export const AgentProgressPayloadSchema = z.object({
  agentId: z.string().min(1).describe('Agent 唯一識別碼'),
  taskId: z.string().min(1).describe('正在處理的任務 ID'),
  progress: z.number().int().min(0).max(100).describe('進度百分比（0-100）'),
  message: z.string().optional().describe('進度說明文字'),
}).describe('agent.progress 事件 payload');

/** agent.completed 事件 payload */
export const AgentCompletedPayloadSchema = z.object({
  agentId: z.string().min(1).describe('Agent 唯一識別碼'),
  taskId: z.string().min(1).describe('完成的任務 ID'),
  result: z.string().optional().describe('完成結果摘要'),
  duration: z.number().nonnegative().optional().describe('任務耗時（毫秒）'),
}).describe('agent.completed 事件 payload');

/** agent.error 事件 payload */
export const AgentErrorPayloadSchema = z.object({
  agentId: z.string().min(1).describe('Agent 唯一識別碼'),
  taskId: z.string().optional().describe('相關任務 ID（若有）'),
  error: z.string().min(1).describe('錯誤訊息'),
  errorCode: z.string().optional().describe('錯誤代碼'),
  fatal: z.boolean().default(false).describe('是否為致命錯誤（agent 需要重啟）'),
}).describe('agent.error 事件 payload');

// ============================================================
// 工作流（Workflow）相關 Schema
// ============================================================

/** workflow.started 事件 payload */
export const WorkflowStartedPayloadSchema = z.object({
  workflowId: z.string().min(1).describe('工作流唯一識別碼'),
  name: z.string().min(1).describe('工作流名稱'),
  taskIds: z.array(z.string().min(1)).min(1).describe('包含的任務 ID 列表'),
  totalSteps: z.number().int().positive().describe('總步驟數'),
}).describe('workflow.started 事件 payload');

/** workflow.step 事件 payload */
export const WorkflowStepPayloadSchema = z.object({
  workflowId: z.string().min(1).describe('工作流唯一識別碼'),
  stepIndex: z.number().int().nonnegative().describe('當前步驟索引（從 0 開始）'),
  stepName: z.string().min(1).describe('步驟名稱'),
  taskId: z.string().optional().describe('此步驟對應的任務 ID（若有）'),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']).describe('步驟狀態'),
  message: z.string().optional().describe('步驟說明或結果'),
}).describe('workflow.step 事件 payload');

/** workflow.completed 事件 payload */
export const WorkflowCompletedPayloadSchema = z.object({
  workflowId: z.string().min(1).describe('工作流唯一識別碼'),
  success: z.boolean().describe('工作流是否成功完成'),
  completedTasks: z.number().int().nonnegative().describe('已完成任務數'),
  failedTasks: z.number().int().nonnegative().describe('失敗任務數'),
  duration: z.number().nonnegative().optional().describe('工作流總耗時（毫秒）'),
  summary: z.string().optional().describe('工作流完成摘要'),
}).describe('workflow.completed 事件 payload');

// ============================================================
// 事件類型列舉
// ============================================================

/** 所有支援的事件類型 */
export const EventTypeSchema = z.enum([
  // 任務事件
  'task.created',
  'task.updated',
  'task.completed',
  'task.failed',
  // Agent 事件
  'agent.registered',
  'agent.started',
  'agent.progress',
  'agent.completed',
  'agent.error',
  // 工作流事件
  'workflow.started',
  'workflow.step',
  'workflow.completed',
]).describe('事件類型');

// ============================================================
// 事件 payload 對應表（discriminated union）
// ============================================================

/** 事件 payload — 根據事件類型對應不同 schema */
export const EventPayloadSchema = z.discriminatedUnion('_type', [
  TaskCreatedPayloadSchema.extend({ _type: z.literal('task.created') }),
  TaskUpdatedPayloadSchema.extend({ _type: z.literal('task.updated') }),
  TaskCompletedPayloadSchema.extend({ _type: z.literal('task.completed') }),
  TaskFailedPayloadSchema.extend({ _type: z.literal('task.failed') }),
  AgentRegisteredPayloadSchema.extend({ _type: z.literal('agent.registered') }),
  AgentStartedPayloadSchema.extend({ _type: z.literal('agent.started') }),
  AgentProgressPayloadSchema.extend({ _type: z.literal('agent.progress') }),
  AgentCompletedPayloadSchema.extend({ _type: z.literal('agent.completed') }),
  AgentErrorPayloadSchema.extend({ _type: z.literal('agent.error') }),
  WorkflowStartedPayloadSchema.extend({ _type: z.literal('workflow.started') }),
  WorkflowStepPayloadSchema.extend({ _type: z.literal('workflow.step') }),
  WorkflowCompletedPayloadSchema.extend({ _type: z.literal('workflow.completed') }),
]).describe('事件 payload（依 _type 辨別）');

// ============================================================
// StandardEvent — 標準化事件格式
// ============================================================

/**
 * StandardEvent — clawflow 標準化事件格式
 *
 * 所有 CLI adapter 發送的事件必須符合此格式。
 * 透過 correlationId 串聯同一工作流中的相關事件，
 * 實現跨 CLI 的完整追蹤。
 */
export const StandardEventSchema = z.object({
  /** 事件唯一識別碼（UUID v4） */
  id: z.string().uuid().describe('事件唯一識別碼（UUID v4）'),

  /** 事件類型 */
  event: EventTypeSchema,

  /** 事件來源 CLI adapter */
  source: EventSourceSchema,

  /** ISO 8601 時間戳 */
  timestamp: TimestampSchema,

  /** 關聯追蹤 ID，串聯同一工作流的相關事件 */
  correlationId: CorrelationIdSchema,

  /** 事件 payload — 結構依事件類型而定 */
  payload: z.record(z.unknown()).describe('事件 payload'),

  /** 選填：事件版本號（協議演進用） */
  version: z.string().default('1.0.0').describe('事件協議版本號'),

  /** 選填：額外 metadata */
  metadata: z.record(z.unknown()).optional().describe('額外 metadata（不影響事件語義）'),
}).describe('clawflow 標準化事件格式');

// ============================================================
// 帶型別安全的事件建構輔助 Schema
// ============================================================

/**
 * 帶 discriminated union payload 的完整事件 Schema
 * 用於需要嚴格型別檢查 payload 與 event type 對應關係的場景
 */
export const TypedStandardEventSchema = z.object({
  id: z.string().uuid(),
  source: EventSourceSchema,
  timestamp: TimestampSchema,
  correlationId: CorrelationIdSchema,
  version: z.string().default('1.0.0'),
  metadata: z.record(z.unknown()).optional(),
}).and(
  z.discriminatedUnion('event', [
    z.object({ event: z.literal('task.created'), payload: TaskCreatedPayloadSchema }),
    z.object({ event: z.literal('task.updated'), payload: TaskUpdatedPayloadSchema }),
    z.object({ event: z.literal('task.completed'), payload: TaskCompletedPayloadSchema }),
    z.object({ event: z.literal('task.failed'), payload: TaskFailedPayloadSchema }),
    z.object({ event: z.literal('agent.registered'), payload: AgentRegisteredPayloadSchema }),
    z.object({ event: z.literal('agent.started'), payload: AgentStartedPayloadSchema }),
    z.object({ event: z.literal('agent.progress'), payload: AgentProgressPayloadSchema }),
    z.object({ event: z.literal('agent.completed'), payload: AgentCompletedPayloadSchema }),
    z.object({ event: z.literal('agent.error'), payload: AgentErrorPayloadSchema }),
    z.object({ event: z.literal('workflow.started'), payload: WorkflowStartedPayloadSchema }),
    z.object({ event: z.literal('workflow.step'), payload: WorkflowStepPayloadSchema }),
    z.object({ event: z.literal('workflow.completed'), payload: WorkflowCompletedPayloadSchema }),
  ]),
);
