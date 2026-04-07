/**
 * clawflow 事件系統 — TypeScript 型別定義
 *
 * 所有型別由 zod schema 推導（single source of truth），
 * 確保 runtime 驗證與 compile-time 型別完全一致。
 */

import { z } from 'zod';
import {
  // 共用欄位
  EventSourceSchema,
  TimestampSchema,
  CorrelationIdSchema,

  // 任務相關
  TaskStatusSchema,
  TaskPrioritySchema,
  TaskCreatedPayloadSchema,
  TaskUpdatedPayloadSchema,
  TaskCompletedPayloadSchema,
  TaskFailedPayloadSchema,

  // Agent 相關
  AgentStatusSchema,
  AgentCapabilitySchema,
  AgentRegisteredPayloadSchema,
  AgentStartedPayloadSchema,
  AgentProgressPayloadSchema,
  AgentCompletedPayloadSchema,
  AgentErrorPayloadSchema,

  // 工作流相關
  WorkflowStartedPayloadSchema,
  WorkflowStepPayloadSchema,
  WorkflowCompletedPayloadSchema,

  // 事件核心
  EventTypeSchema,
  EventPayloadSchema,
  StandardEventSchema,
  TypedStandardEventSchema,
} from './schema';

// ============================================================
// 共用型別
// ============================================================

/** 事件來源識別碼 */
export type EventSource = z.infer<typeof EventSourceSchema>;

/** ISO 8601 時間戳 */
export type Timestamp = z.infer<typeof TimestampSchema>;

/** 關聯追蹤 ID（UUID v4） */
export type CorrelationId = z.infer<typeof CorrelationIdSchema>;

// ============================================================
// 任務（Task）型別
// ============================================================

/** 任務狀態 */
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** 任務優先級 */
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

/** task.created payload */
export type TaskCreatedPayload = z.infer<typeof TaskCreatedPayloadSchema>;

/** task.updated payload */
export type TaskUpdatedPayload = z.infer<typeof TaskUpdatedPayloadSchema>;

/** task.completed payload */
export type TaskCompletedPayload = z.infer<typeof TaskCompletedPayloadSchema>;

/** task.failed payload */
export type TaskFailedPayload = z.infer<typeof TaskFailedPayloadSchema>;

// ============================================================
// Agent 型別
// ============================================================

/** Agent 狀態 */
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

/** Agent 能力標籤 */
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

/** agent.registered payload */
export type AgentRegisteredPayload = z.infer<typeof AgentRegisteredPayloadSchema>;

/** agent.started payload */
export type AgentStartedPayload = z.infer<typeof AgentStartedPayloadSchema>;

/** agent.progress payload */
export type AgentProgressPayload = z.infer<typeof AgentProgressPayloadSchema>;

/** agent.completed payload */
export type AgentCompletedPayload = z.infer<typeof AgentCompletedPayloadSchema>;

/** agent.error payload */
export type AgentErrorPayload = z.infer<typeof AgentErrorPayloadSchema>;

// ============================================================
// 工作流（Workflow）型別
// ============================================================

/** workflow.started payload */
export type WorkflowStartedPayload = z.infer<typeof WorkflowStartedPayloadSchema>;

/** workflow.step payload */
export type WorkflowStepPayload = z.infer<typeof WorkflowStepPayloadSchema>;

/** workflow.completed payload */
export type WorkflowCompletedPayload = z.infer<typeof WorkflowCompletedPayloadSchema>;

// ============================================================
// 事件核心型別
// ============================================================

/** 所有支援的事件類型字串 */
export type EventType = z.infer<typeof EventTypeSchema>;

/** 事件 payload（discriminated union） */
export type EventPayload = z.infer<typeof EventPayloadSchema>;

/** 標準化事件格式（寬鬆 payload，適合接收端初步解析） */
export type StandardEvent = z.infer<typeof StandardEventSchema>;

/** 帶完整型別安全的標準化事件（payload 與 event type 嚴格對應） */
export type TypedStandardEvent = z.infer<typeof TypedStandardEventSchema>;

// ============================================================
// 便捷型別：依事件類型取得對應的 TypedStandardEvent
// ============================================================

/** 依事件類型過濾出對應的 TypedStandardEvent 子型別 */
export type StandardEventOf<T extends EventType> = Extract<
  TypedStandardEvent,
  { readonly event: T }
>;

// ============================================================
// 事件類型 → Payload 對應表（utility type）
// ============================================================

/** 事件類型到 payload 型別的映射 */
export interface EventPayloadMap {
  readonly 'task.created': TaskCreatedPayload;
  readonly 'task.updated': TaskUpdatedPayload;
  readonly 'task.completed': TaskCompletedPayload;
  readonly 'task.failed': TaskFailedPayload;
  readonly 'agent.registered': AgentRegisteredPayload;
  readonly 'agent.started': AgentStartedPayload;
  readonly 'agent.progress': AgentProgressPayload;
  readonly 'agent.completed': AgentCompletedPayload;
  readonly 'agent.error': AgentErrorPayload;
  readonly 'workflow.started': WorkflowStartedPayload;
  readonly 'workflow.step': WorkflowStepPayload;
  readonly 'workflow.completed': WorkflowCompletedPayload;
}

/** 從事件類型查找 payload 型別 */
export type PayloadOf<T extends EventType> = EventPayloadMap[T];

// ============================================================
// 事件分類常數（方便過濾）
// ============================================================

/** 任務事件類型集合 */
export const TASK_EVENT_TYPES = [
  'task.created',
  'task.updated',
  'task.completed',
  'task.failed',
] as const satisfies readonly EventType[];

/** Agent 事件類型集合 */
export const AGENT_EVENT_TYPES = [
  'agent.registered',
  'agent.started',
  'agent.progress',
  'agent.completed',
  'agent.error',
] as const satisfies readonly EventType[];

/** 工作流事件類型集合 */
export const WORKFLOW_EVENT_TYPES = [
  'workflow.started',
  'workflow.step',
  'workflow.completed',
] as const satisfies readonly EventType[];

/** 任務事件類型 */
export type TaskEventType = (typeof TASK_EVENT_TYPES)[number];

/** Agent 事件類型 */
export type AgentEventType = (typeof AGENT_EVENT_TYPES)[number];

/** 工作流事件類型 */
export type WorkflowEventType = (typeof WORKFLOW_EVENT_TYPES)[number];
