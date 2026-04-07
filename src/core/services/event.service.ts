/**
 * EventService — 事件業務邏輯層
 *
 * 接收外部事件（由 adapter 送來），存儲至 EventRepository 並透過 EventBus 廣播。
 */

import { eventBus } from './event-bus.js';
import * as eventRepo from '../models/event.repository.js';
import type {
  Event as EventRow,
  EventFilters,
} from '../models/event.repository.js';

// ── 重新匯出 repository 型別供外部使用 ─────────────────────────
export type { EventRow, EventFilters };

// ── 工具函式 ────────────────────────────────────────────────────

/** 序列化事件（解析 JSON payload） */
function serializeEvent(row: EventRow): Record<string, unknown> {
  return {
    ...row,
    payload: JSON.parse(row.payload || '{}') as Record<string, unknown>,
  };
}

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

/** 計算總數（使用 SELECT COUNT(*) 查詢） */
function countEvents(filters: EventFilters): number {
  const countFilters = stripUndefined({
    type: filters.type,
    source: filters.source,
    taskId: filters.taskId,
    agentId: filters.agentId,
    workflowId: filters.workflowId,
    since: filters.since,
    until: filters.until,
  }) as EventFilters;
  return eventRepo.count(countFilters);
}

// ── Service 層輸入型別 ──────────────────────────────────────────

/** 提交事件輸入 */
export interface SubmitEventInput {
  readonly event: string;
  readonly source: string;
  readonly correlationId?: string;
  readonly payload: Record<string, unknown>;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly workflowId?: string;
}

// ── Service 公開方法 ────────────────────────────────────────────

/** 列出事件（含分頁與篩選） */
export function listEvents(
  filters: EventFilters,
): { events: readonly Record<string, unknown>[]; total: number } {
  const rows = eventRepo.findAll(filters);
  const total = countEvents(filters);
  return {
    events: rows.map(serializeEvent),
    total,
  };
}

/** 提交單一事件（存儲 + 廣播） */
export function submitEvent(
  input: SubmitEventInput,
): Record<string, unknown> {
  const dto = stripUndefined({
    event_type: input.event,
    source: input.source,
    correlation_id: input.correlationId,
    task_id: input.taskId,
    agent_id: input.agentId,
    workflow_id: input.workflowId,
    payload: input.payload,
  });

  const row = eventRepo.create(dto as unknown as Parameters<typeof eventRepo.create>[0]);
  const event = serializeEvent(row);

  // 透過 EventBus 廣播
  eventBus.emit({
    event: input.event,
    ...event,
  });

  return event;
}

/** 批量提交事件 */
export function submitEventsBatch(
  inputs: readonly SubmitEventInput[],
): readonly Record<string, unknown>[] {
  const dtos = inputs.map((input) =>
    stripUndefined({
      event_type: input.event,
      source: input.source,
      correlation_id: input.correlationId,
      task_id: input.taskId,
      agent_id: input.agentId,
      workflow_id: input.workflowId,
      payload: input.payload,
    }),
  ) as unknown as Parameters<typeof eventRepo.createBatch>[0];

  const rows = eventRepo.createBatch(dtos);
  const events = rows.map(serializeEvent);

  // 廣播每個事件
  for (let i = 0; i < events.length; i++) {
    eventBus.emit({
      event: inputs[i].event,
      ...events[i],
    });
  }

  return events;
}
