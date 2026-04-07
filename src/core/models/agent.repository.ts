/**
 * Agent Repository — 代理資料存取層
 * 使用參數化查詢，所有寫入操作返回新物件
 */
import { ulid } from 'ulid';
import { getDb } from '../db/connection.js';

// === 型別定義 ===

/** Agent 狀態 */
export type AgentStatus = 'idle' | 'working' | 'completed' | 'error';

/** Agent 完整資料 */
export interface Agent {
  readonly id: string;
  readonly adapter_id: string;
  readonly name: string;
  readonly type: string;
  readonly status: AgentStatus;
  readonly capabilities: string;
  readonly current_task_id: string | null;
  readonly metadata: string;
  readonly registered_at: string;
  readonly last_heartbeat_at: string;
}

/** 註冊 Agent DTO */
export interface RegisterAgentDto {
  readonly adapter_id: string;
  readonly name: string;
  readonly type: string;
  readonly status?: AgentStatus;
  readonly capabilities?: readonly string[];
  readonly current_task_id?: string;
  readonly metadata?: Record<string, unknown>;
}

/** 更新 Agent DTO */
export interface UpdateAgentDto {
  readonly name?: string;
  readonly type?: string;
  readonly status?: AgentStatus;
  readonly capabilities?: readonly string[];
  readonly current_task_id?: string | null;
  readonly metadata?: Record<string, unknown>;
}

/** 查詢篩選條件 */
export interface AgentFilters {
  readonly status?: AgentStatus;
  readonly adapterId?: string;
  readonly type?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// === Repository 函數 ===

/**
 * 查詢所有 agents（支援篩選）
 */
export function findAll(filters: AgentFilters = {}): readonly Agent[] {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.adapterId !== undefined) {
    conditions.push('adapter_id = ?');
    params.push(filters.adapterId);
  }
  if (filters.type !== undefined) {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit ?? 100;
  const offset = filters.offset ?? 0;

  const sql = `SELECT * FROM agents ${where} ORDER BY registered_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(sql).all(...params) as Agent[];
}

/**
 * 計算符合篩選條件的 agent 總數（使用 SELECT COUNT(*)）
 */
export function count(filters: AgentFilters = {}): number {
  const db = getDb();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status !== undefined) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.adapterId !== undefined) {
    conditions.push('adapter_id = ?');
    params.push(filters.adapterId);
  }
  if (filters.type !== undefined) {
    conditions.push('type = ?');
    params.push(filters.type);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT COUNT(*) AS cnt FROM agents ${where}`;

  const row = db.prepare(sql).get(...params) as { cnt: number };
  return row.cnt;
}

/**
 * 依 ID 查詢單一 agent
 */
export function findById(id: string): Agent | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Agent | undefined;
}

/**
 * 註冊新 agent
 */
export function register(dto: RegisterAgentDto): Agent {
  const db = getDb();
  const now = new Date().toISOString();
  const id = ulid();

  const agent: Agent = {
    id,
    adapter_id: dto.adapter_id,
    name: dto.name,
    type: dto.type,
    status: dto.status ?? 'idle',
    capabilities: JSON.stringify(dto.capabilities ?? []),
    current_task_id: dto.current_task_id ?? null,
    metadata: JSON.stringify(dto.metadata ?? {}),
    registered_at: now,
    last_heartbeat_at: now,
  };

  db.prepare(`
    INSERT INTO agents (id, adapter_id, name, type, status, capabilities, current_task_id, metadata, registered_at, last_heartbeat_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    agent.id, agent.adapter_id, agent.name, agent.type, agent.status,
    agent.capabilities, agent.current_task_id, agent.metadata,
    agent.registered_at, agent.last_heartbeat_at
  );

  return agent;
}

/**
 * 更新 agent（返回更新後的完整物件）
 */
export function update(id: string, dto: UpdateAgentDto): Agent | undefined {
  const db = getDb();
  const existing = findById(id);
  if (existing === undefined) {
    return undefined;
  }

  const now = new Date().toISOString();
  const updated: Agent = {
    ...existing,
    name: dto.name ?? existing.name,
    type: dto.type ?? existing.type,
    status: dto.status ?? existing.status,
    capabilities: dto.capabilities !== undefined ? JSON.stringify(dto.capabilities) : existing.capabilities,
    current_task_id: dto.current_task_id !== undefined ? dto.current_task_id : existing.current_task_id,
    metadata: dto.metadata !== undefined ? JSON.stringify(dto.metadata) : existing.metadata,
    last_heartbeat_at: now,
  };

  db.prepare(`
    UPDATE agents SET name = ?, type = ?, status = ?, capabilities = ?,
      current_task_id = ?, metadata = ?, last_heartbeat_at = ?
    WHERE id = ?
  `).run(
    updated.name, updated.type, updated.status, updated.capabilities,
    updated.current_task_id, updated.metadata, updated.last_heartbeat_at,
    updated.id
  );

  return updated;
}

/**
 * 刪除 agent
 */
export function deleteAgent(id: string): boolean {
  const db = getDb();
  const result = db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * 更新心跳時間
 */
export function heartbeat(id: string): Agent | undefined {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db
    .prepare('UPDATE agents SET last_heartbeat_at = ? WHERE id = ?')
    .run(now, id);

  if (result.changes === 0) {
    return undefined;
  }

  return findById(id);
}
