/**
 * Claude Code 事件映射器
 *
 * 將 Claude Code Hook 送來的 raw event 映射為 clawflow StandardEvent。
 * 映射規則：
 * - Agent tool       → agent.started / agent.completed
 * - Task/TodoWrite   → task.created / task.updated
 * - Write/Edit       → agent.progress（程式碼編寫）
 * - Bash             → agent.progress（指令執行）
 * - session 開始     → workflow.started
 * - session 結束     → workflow.completed
 */

import { randomUUID } from 'node:crypto';
import type { StandardEvent } from '../types.js';
import type { EventType } from '../../core/events/types.js';

// ── Claude Code Hook Raw Event 型別 ─────────────────────────────

/** Claude Code Hook 送來的原始事件格式 */
export interface ClaudeCodeRawEvent {
  /** Hook 類型 */
  readonly hookType: 'PreToolUse' | 'PostToolUse' | 'Stop';
  /** 使用的工具名稱 */
  readonly tool: string;
  /** 工具執行結果 */
  readonly result?: string;
  /** Claude Code session ID */
  readonly sessionId: string;
  /** 工具輸入參數 */
  readonly toolInput?: Record<string, unknown>;
  /** 時間戳（ISO 8601，選填，由 adapter 補上） */
  readonly timestamp?: string;
}

// ── 工具 → 事件映射表 ──────────────────────────────────────────

/** Agent 子任務相關工具（觸發 agent.started / agent.completed） */
const AGENT_LIFECYCLE_TOOLS = new Set(['Agent', 'Skill']);

/** 任務管理工具 */
const TASK_TOOLS: ReadonlyMap<string, EventType> = new Map([
  ['TodoWrite', 'task.created'],
  ['TaskCreate', 'task.created'],
  ['TaskUpdate', 'task.updated'],
]);

/** 進度回報工具（觸發 agent.progress） */
const PROGRESS_TOOLS = new Set([
  'Write',
  'Edit',
  'Bash',
  'Read',
  'Grep',
  'Glob',
  'NotebookEdit',
]);

// ── 映射函式 ────────────────────────────────────────────────────

/** 建立 StandardEvent 基礎結構 */
function createBaseEvent(
  eventType: EventType,
  source: string,
  payload: Record<string, unknown>,
  timestamp?: string,
): StandardEvent {
  return {
    event: eventType,
    source,
    timestamp: timestamp ?? new Date().toISOString(),
    payload,
  };
}

/** 從工具名稱推導進度描述 */
function describeProgress(tool: string, result?: string): string {
  const descriptions: Readonly<Record<string, string>> = {
    Write: '寫入檔案',
    Edit: '編輯檔案',
    Bash: '執行指令',
    Read: '讀取檔案',
    Grep: '搜尋內容',
    Glob: '搜尋檔案',
    NotebookEdit: '編輯 Notebook',
  };
  const desc = descriptions[tool] ?? `使用 ${tool}`;
  return result ? `${desc}: ${result.slice(0, 200)}` : desc;
}

/**
 * 將 Claude Code raw event 映射為 StandardEvent
 *
 * @param raw 原始事件
 * @param adapterSource adapter 來源識別碼
 * @returns StandardEvent，無法映射時回傳 null
 */
export function mapClaudeCodeEvent(
  raw: ClaudeCodeRawEvent,
  adapterSource: string,
): StandardEvent | null {
  const { hookType, tool, result, sessionId, toolInput, timestamp } = raw;

  // 僅處理 PostToolUse 和 Stop 類型的 hook
  if (hookType === 'PreToolUse') {
    // PreToolUse 可用於 agent.started（開始使用 Agent tool 時）
    if (AGENT_LIFECYCLE_TOOLS.has(tool)) {
      const agentId = extractAgentId(toolInput) ?? `sub-${randomUUID().slice(0, 8)}`;
      return createBaseEvent('agent.started', adapterSource, {
        agentId,
        taskId: sessionId,
      }, timestamp);
    }
    return null;
  }

  // Stop hook → workflow.completed
  if (hookType === 'Stop') {
    return createBaseEvent('workflow.completed', adapterSource, {
      workflowId: sessionId,
      success: true,
      completedTasks: 0,
      failedTasks: 0,
      summary: result ?? 'Claude Code session 結束',
    }, timestamp);
  }

  // PostToolUse 處理

  // Agent/Skill tool → agent.completed
  if (AGENT_LIFECYCLE_TOOLS.has(tool)) {
    const agentId = extractAgentId(toolInput) ?? `sub-${randomUUID().slice(0, 8)}`;
    return createBaseEvent('agent.completed', adapterSource, {
      agentId,
      taskId: sessionId,
      result: result?.slice(0, 500),
    }, timestamp);
  }

  // 任務管理工具
  const taskEvent = TASK_TOOLS.get(tool);
  if (taskEvent !== undefined) {
    return mapTaskEvent(taskEvent, sessionId, adapterSource, toolInput, timestamp);
  }

  // 進度回報工具
  if (PROGRESS_TOOLS.has(tool)) {
    return createBaseEvent('agent.progress', adapterSource, {
      agentId: sessionId,
      taskId: sessionId,
      progress: -1, // 無法精確計算進度，使用 -1 表示「進行中但不確定百分比」
      message: describeProgress(tool, result),
    }, timestamp);
  }

  // 其他工具 → 一律視為 agent.progress
  return createBaseEvent('agent.progress', adapterSource, {
    agentId: sessionId,
    taskId: sessionId,
    progress: -1,
    message: `${tool}: ${result?.slice(0, 200) ?? '（無結果）'}`,
  }, timestamp);
}

/**
 * 映射任務相關事件
 */
function mapTaskEvent(
  eventType: EventType,
  sessionId: string,
  source: string,
  toolInput?: Record<string, unknown>,
  timestamp?: string,
): StandardEvent {
  if (eventType === 'task.created') {
    return createBaseEvent(eventType, source, {
      taskId: (toolInput?.['id'] as string) ?? randomUUID(),
      title: (toolInput?.['title'] as string) ?? '未命名任務',
      description: toolInput?.['description'] as string | undefined,
      status: 'todo',
      priority: 'medium',
      tags: [],
      dependsOn: [],
    }, timestamp);
  }

  // task.updated
  return createBaseEvent(eventType, source, {
    taskId: (toolInput?.['id'] as string) ?? sessionId,
    changes: {
      status: toolInput?.['status'] as string | undefined,
      progress: toolInput?.['progress'] as number | undefined,
    },
  }, timestamp);
}

/**
 * 從 toolInput 中擷取 agent ID
 */
function extractAgentId(toolInput?: Record<string, unknown>): string | undefined {
  if (toolInput === undefined) return undefined;
  // Agent tool 通常帶有 skill 或 agent 參數
  return (toolInput['skill'] as string)
    ?? (toolInput['agent'] as string)
    ?? (toolInput['name'] as string)
    ?? undefined;
}

/**
 * 建立 workflow.started 事件（用於 session 啟動時呼叫）
 */
export function createWorkflowStartedEvent(
  sessionId: string,
  adapterSource: string,
): StandardEvent {
  return createBaseEvent('workflow.started', adapterSource, {
    workflowId: sessionId,
    name: `Claude Code Session ${sessionId.slice(0, 8)}`,
    taskIds: [sessionId],
    totalSteps: 1,
  });
}
