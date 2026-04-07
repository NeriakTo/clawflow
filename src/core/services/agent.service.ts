/**
 * AgentService — Agent 業務邏輯層
 *
 * 封裝 AgentRepository，於 register/update/heartbeat/delete 後透過 EventBus 發送事件。
 */

import { eventBus } from './event-bus.js';
import * as agentRepo from '../models/agent.repository.js';
import type { Agent, AgentFilters } from '../models/agent.repository.js';

// ── 重新匯出 repository 型別供外部使用 ─────────────────────────
export type { Agent, AgentFilters };

// ── 工具函式 ────────────────────────────────────────────────────

/** 序列化 agent（解析 JSON 欄位） */
function serializeAgent(row: Agent): Record<string, unknown> {
  return {
    ...row,
    capabilities: JSON.parse(row.capabilities || '[]') as string[],
    metadata: JSON.parse(row.metadata || '{}') as Record<string, unknown>,
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
function countAgents(filters: AgentFilters): number {
  const countFilters = stripUndefined({
    status: filters.status,
    type: filters.type,
  }) as AgentFilters;
  return agentRepo.count(countFilters);
}

// ── Service 層輸入型別 ──────────────────────────────────────────

/** 註冊 Agent 輸入 */
export interface RegisterAgentInput {
  readonly name: string;
  readonly type: string;
  readonly capabilities?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

/** 更新 Agent 輸入 */
export interface UpdateAgentInput {
  readonly name?: string;
  readonly type?: string;
  readonly status?: string;
  readonly capabilities?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

// ── Service 公開方法 ────────────────────────────────────────────

/** 列出 agents */
export function listAgents(
  filters: AgentFilters,
): { agents: readonly Record<string, unknown>[]; total: number } {
  const rows = agentRepo.findAll(filters);
  const total = countAgents(filters);
  return {
    agents: rows.map(serializeAgent),
    total,
  };
}

/** 取得單一 agent */
export function getAgent(
  id: string,
): Record<string, unknown> | undefined {
  const row = agentRepo.findById(id);
  return row ? serializeAgent(row) : undefined;
}

/** 註冊新 agent */
export function registerAgent(
  input: RegisterAgentInput,
): Record<string, unknown> {
  const dto = stripUndefined({
    adapter_id: 'api',
    name: input.name,
    type: input.type,
    capabilities: input.capabilities,
    metadata: input.metadata,
  });

  const row = agentRepo.register(dto as unknown as Parameters<typeof agentRepo.register>[0]);
  const agent = serializeAgent(row);

  eventBus.emit({
    event: 'agent.registered',
    agentId: row.id,
    agent,
  });

  return agent;
}

/** 更新 agent */
export function updateAgent(
  id: string,
  input: UpdateAgentInput,
): Record<string, unknown> | undefined {
  const existing = agentRepo.findById(id);
  if (!existing) return undefined;

  const raw: Record<string, unknown> = {};
  if (input.name !== undefined) raw['name'] = input.name;
  if (input.type !== undefined) raw['type'] = input.type;
  if (input.status !== undefined) raw['status'] = input.status;
  if (input.capabilities !== undefined) raw['capabilities'] = input.capabilities;
  if (input.metadata !== undefined) raw['metadata'] = input.metadata;

  const updated = agentRepo.update(id, raw as Parameters<typeof agentRepo.update>[1]);
  if (!updated) return undefined;

  const agent = serializeAgent(updated);

  eventBus.emit({
    event: 'agent.started',
    agentId: id,
    agent,
    action: 'updated',
  });

  return agent;
}

/** 刪除 agent */
export function deleteAgent(id: string): boolean {
  const existing = agentRepo.findById(id);
  if (!existing) return false;

  const result = agentRepo.deleteAgent(id);

  if (result) {
    eventBus.emit({
      event: 'agent.completed',
      agentId: id,
      action: 'deleted',
    });
  }

  return result;
}

/** Agent 心跳更新 */
export function heartbeatAgent(
  id: string,
): Record<string, unknown> | undefined {
  const updated = agentRepo.heartbeat(id);
  if (!updated) return undefined;

  const agent = serializeAgent(updated);

  eventBus.emit({
    event: 'agent.progress',
    agentId: id,
    action: 'heartbeat',
    timestamp: new Date().toISOString(),
  });

  return agent;
}
