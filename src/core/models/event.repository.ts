/**
 * Event Repository — 事件資料存取層
 * 使用參數化查詢，所有寫入操作返回新物件
 */
import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

// === 型別定義 ===

/** 事件完整資料 */
export interface Event {
  readonly id: string;
  readonly event_type: string;
  readonly source: string;
  readonly correlation_id: string | null;
  readonly task_id: string | null;
  readonly agent_id: string | null;
  readonly workflow_id: string | null;
  readonly payload: string;
  readonly timestamp: string;
}

/** 建立事件 DTO */
export interface CreateEventDto {
  readonly event_type: string;
  readonly source: string;
  readonly correlation_id?: string;
  readonly task_id?: string;
  readonly agent_id?: string;
  readonly workflow_id?: string;
  readonly payload?: Record<string, unknown>;
}

/** 查詢篩選條件 */
export interface EventFilters {
  readonly type?: string;
  readonly source?: string;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly workflowId?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// === Repository 函數 ===

/**
 * 查詢所有事件（支援篩選、分頁）
 */
export function findAll(filters: EventFilters = {}): readonly Event[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.type !== undefined) {
    conditions.push('event_type = ?');
    params.push(filters.type);
  }
  if (filters.source !== undefined) {
    conditions.push('source = ?');
    params.push(filters.source);
  }
  if (filters.taskId !== undefined) {
    conditions.push('task_id = ?');
    params.push(filters.taskId);
  }
  if (filters.agentId !== undefined) {
    conditions.push('agent_id = ?');
    params.push(filters.agentId);
  }
  if (filters.workflowId !== undefined) {
    conditions.push('workflow_id = ?');
    params.push(filters.workflowId);
  }
  if (filters.since !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(filters.since);
  }
  if (filters.until !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(filters.until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  // limit=0 表示只需計數，跳過資料查詢
  if (limit === 0) {
    return [];
  }

  const sql = `SELECT * FROM events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params) as Event[];
}

/**
 * 計算符合篩選條件的事件總數（使用 SELECT COUNT(*)）
 */
export function count(filters: EventFilters = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.type !== undefined) {
    conditions.push('event_type = ?');
    params.push(filters.type);
  }
  if (filters.source !== undefined) {
    conditions.push('source = ?');
    params.push(filters.source);
  }
  if (filters.taskId !== undefined) {
    conditions.push('task_id = ?');
    params.push(filters.taskId);
  }
  if (filters.agentId !== undefined) {
    conditions.push('agent_id = ?');
    params.push(filters.agentId);
  }
  if (filters.workflowId !== undefined) {
    conditions.push('workflow_id = ?');
    params.push(filters.workflowId);
  }
  if (filters.since !== undefined) {
    conditions.push('timestamp >= ?');
    params.push(filters.since);
  }
  if (filters.until !== undefined) {
    conditions.push('timestamp <= ?');
    params.push(filters.until);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) AS cnt FROM events ${where}`;

  const row = db.prepare(sql).get(...params) as { cnt: number };
  return row.cnt;
}

/**
 * 建立單一事件
 */
export function create(dto: CreateEventDto): Event {
  const db = getDb();
  const now = new Date().toISOString();
  const id = ulid();

  const event: Event = {
    id,
    event_type: dto.event_type,
    source: dto.source,
    correlation_id: dto.correlation_id ?? null,
    task_id: dto.task_id ?? null,
    agent_id: dto.agent_id ?? null,
    workflow_id: dto.workflow_id ?? null,
    payload: JSON.stringify(dto.payload ?? {}),
    timestamp: now,
  };

  db.prepare(`
    INSERT INTO events (id, event_type, source, correlation_id, task_id, agent_id, workflow_id, payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.id, event.event_type, event.source, event.correlation_id,
    event.task_id, event.agent_id, event.workflow_id,
    event.payload, event.timestamp
  );

  return event;
}

/**
 * 批次建立事件（在同一 transaction 中執行）
 */
export function createBatch(dtos: readonly CreateEventDto[]): readonly Event[] {
  const db = getDb();
  const now = new Date().toISOString();

  const insert = db.prepare(`
    INSERT INTO events (id, event_type, source, correlation_id, task_id, agent_id, workflow_id, payload, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const events: Event[] = dtos.map((dto) => ({
    id: ulid(),
    event_type: dto.event_type,
    source: dto.source,
    correlation_id: dto.correlation_id ?? null,
    task_id: dto.task_id ?? null,
    agent_id: dto.agent_id ?? null,
    workflow_id: dto.workflow_id ?? null,
    payload: JSON.stringify(dto.payload ?? {}),
    timestamp: now,
  }));

  const runInTransaction = db.transaction(() => {
    for (const event of events) {
      insert.run(
        event.id, event.event_type, event.source, event.correlation_id,
        event.task_id, event.agent_id, event.workflow_id,
        event.payload, event.timestamp
      );
    }
  });
  runInTransaction();

  return events;
}
