/**
 * Schema 驗證單元測試
 *
 * 測試 Zod Schema 對各類事件 payload 的驗證行為。
 */
import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  StandardEventSchema,
  TaskCreatedPayloadSchema,
  TaskUpdatedPayloadSchema,
  TaskCompletedPayloadSchema,
  TaskFailedPayloadSchema,
  AgentRegisteredPayloadSchema,
  AgentStartedPayloadSchema,
  AgentProgressPayloadSchema,
  AgentCompletedPayloadSchema,
  AgentErrorPayloadSchema,
  WorkflowStartedPayloadSchema,
  WorkflowStepPayloadSchema,
  WorkflowCompletedPayloadSchema,
  EventTypeSchema,
} from '../../src/core/events/schema.js';

// ── 輔助函式 ──────────────────────────────────────────────────

/** 建立有效的 StandardEvent 基底 */
function makeValidEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    event: 'task.created',
    source: 'test-adapter',
    timestamp: new Date().toISOString(),
    correlationId: randomUUID(),
    payload: { taskId: 'task-1', title: '測試任務' },
    version: '1.0.0',
    ...overrides,
  };
}

// ── StandardEventSchema ───────────────────────────────────────

describe('StandardEventSchema', () => {
  it('應通過有效的完整事件', () => {
    const event = makeValidEvent();
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('應通過包含 metadata 的事件', () => {
    const event = makeValidEvent({ metadata: { source_version: '2.0' } });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(true);
  });

  it('version 應有預設值 1.0.0', () => {
    const event = makeValidEvent();
    delete (event as Record<string, unknown>)['version'];
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.version).toBe('1.0.0');
    }
  });

  it('缺少 id 應驗證失敗', () => {
    const event = makeValidEvent();
    delete (event as Record<string, unknown>)['id'];
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('id 非 UUID 格式應驗證失敗', () => {
    const event = makeValidEvent({ id: 'not-a-uuid' });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('缺少 event 應驗證失敗', () => {
    const event = makeValidEvent();
    delete (event as Record<string, unknown>)['event'];
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('無效的 event type 應驗證失敗', () => {
    const event = makeValidEvent({ event: 'invalid.type' });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('缺少 source 應驗證失敗', () => {
    const event = makeValidEvent();
    delete (event as Record<string, unknown>)['source'];
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('空字串 source 應驗證失敗', () => {
    const event = makeValidEvent({ source: '' });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('timestamp 非 ISO 格式應驗證失敗', () => {
    const event = makeValidEvent({ timestamp: '2024/01/01' });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });

  it('correlationId 非 UUID 應驗證失敗', () => {
    const event = makeValidEvent({ correlationId: 'not-uuid' });
    const result = StandardEventSchema.safeParse(event);
    expect(result.success).toBe(false);
  });
});

// ── EventTypeSchema ───────────────────────────────────────────

describe('EventTypeSchema', () => {
  const validTypes = [
    'task.created', 'task.updated', 'task.completed', 'task.failed',
    'agent.registered', 'agent.started', 'agent.progress', 'agent.completed', 'agent.error',
    'workflow.started', 'workflow.step', 'workflow.completed',
  ];

  for (const type of validTypes) {
    it(`應接受 ${type}`, () => {
      expect(EventTypeSchema.safeParse(type).success).toBe(true);
    });
  }

  it('應拒絕不存在的事件類型', () => {
    expect(EventTypeSchema.safeParse('task.cancelled').success).toBe(false);
  });
});

// ── Task Payload Schemas ──────────────────────────────────────

describe('TaskCreatedPayloadSchema', () => {
  it('應通過最小有效 payload', () => {
    const result = TaskCreatedPayloadSchema.safeParse({
      taskId: 'task-1',
      title: '建立新功能',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // 檢查預設值
      expect(result.data.status).toBe('backlog');
      expect(result.data.priority).toBe('medium');
      expect(result.data.tags).toEqual([]);
      expect(result.data.dependsOn).toEqual([]);
    }
  });

  it('應通過完整 payload', () => {
    const result = TaskCreatedPayloadSchema.safeParse({
      taskId: 'task-1',
      title: '建立新功能',
      description: '詳細描述',
      status: 'todo',
      priority: 'high',
      assignee: 'agent-1',
      tags: ['frontend', 'urgent'],
      dependsOn: ['task-0'],
    });
    expect(result.success).toBe(true);
  });

  it('缺少 taskId 應失敗', () => {
    const result = TaskCreatedPayloadSchema.safeParse({ title: '測試' });
    expect(result.success).toBe(false);
  });

  it('缺少 title 應失敗', () => {
    const result = TaskCreatedPayloadSchema.safeParse({ taskId: 'task-1' });
    expect(result.success).toBe(false);
  });

  it('空字串 taskId 應失敗', () => {
    const result = TaskCreatedPayloadSchema.safeParse({ taskId: '', title: '測試' });
    expect(result.success).toBe(false);
  });
});

describe('TaskUpdatedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = TaskUpdatedPayloadSchema.safeParse({
      taskId: 'task-1',
      changes: { status: 'in_progress', priority: 'high' },
    });
    expect(result.success).toBe(true);
  });

  it('空 changes 物件也應通過', () => {
    const result = TaskUpdatedPayloadSchema.safeParse({
      taskId: 'task-1',
      changes: {},
    });
    expect(result.success).toBe(true);
  });

  it('changes 中的 progress 超出範圍應失敗', () => {
    const result = TaskUpdatedPayloadSchema.safeParse({
      taskId: 'task-1',
      changes: { progress: 150 },
    });
    expect(result.success).toBe(false);
  });
});

describe('TaskCompletedPayloadSchema', () => {
  it('應通過最小有效 payload', () => {
    const result = TaskCompletedPayloadSchema.safeParse({ taskId: 'task-1' });
    expect(result.success).toBe(true);
  });

  it('應通過包含 result 和 duration 的 payload', () => {
    const result = TaskCompletedPayloadSchema.safeParse({
      taskId: 'task-1',
      result: '完成摘要',
      duration: 5000,
    });
    expect(result.success).toBe(true);
  });

  it('負數 duration 應失敗', () => {
    const result = TaskCompletedPayloadSchema.safeParse({
      taskId: 'task-1',
      duration: -100,
    });
    expect(result.success).toBe(false);
  });
});

describe('TaskFailedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = TaskFailedPayloadSchema.safeParse({
      taskId: 'task-1',
      error: '連線逾時',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recoverable).toBe(false); // 預設值
    }
  });

  it('缺少 error 應失敗', () => {
    const result = TaskFailedPayloadSchema.safeParse({ taskId: 'task-1' });
    expect(result.success).toBe(false);
  });
});

// ── Agent Payload Schemas ─────────────────────────────────────

describe('AgentRegisteredPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = AgentRegisteredPayloadSchema.safeParse({
      agentId: 'agent-1',
      name: 'CC',
      type: 'claude-opus',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capabilities).toEqual([]);
    }
  });

  it('應通過包含 capabilities 和 metadata 的 payload', () => {
    const result = AgentRegisteredPayloadSchema.safeParse({
      agentId: 'agent-1',
      name: 'CC',
      type: 'claude-opus',
      capabilities: ['coding', 'research'],
      metadata: { version: '4.5' },
    });
    expect(result.success).toBe(true);
  });

  it('缺少 name 應失敗', () => {
    const result = AgentRegisteredPayloadSchema.safeParse({
      agentId: 'agent-1',
      type: 'claude-opus',
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentStartedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = AgentStartedPayloadSchema.safeParse({
      agentId: 'agent-1',
      taskId: 'task-1',
    });
    expect(result.success).toBe(true);
  });

  it('缺少 taskId 應失敗', () => {
    const result = AgentStartedPayloadSchema.safeParse({ agentId: 'agent-1' });
    expect(result.success).toBe(false);
  });
});

describe('AgentProgressPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = AgentProgressPayloadSchema.safeParse({
      agentId: 'agent-1',
      taskId: 'task-1',
      progress: 50,
    });
    expect(result.success).toBe(true);
  });

  it('progress 超出 100 應失敗', () => {
    const result = AgentProgressPayloadSchema.safeParse({
      agentId: 'agent-1',
      taskId: 'task-1',
      progress: 101,
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentCompletedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = AgentCompletedPayloadSchema.safeParse({
      agentId: 'agent-1',
      taskId: 'task-1',
      result: '完成',
      duration: 3000,
    });
    expect(result.success).toBe(true);
  });
});

describe('AgentErrorPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = AgentErrorPayloadSchema.safeParse({
      agentId: 'agent-1',
      error: 'OOM',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fatal).toBe(false); // 預設值
    }
  });

  it('空字串 error 應失敗', () => {
    const result = AgentErrorPayloadSchema.safeParse({
      agentId: 'agent-1',
      error: '',
    });
    expect(result.success).toBe(false);
  });
});

// ── Workflow Payload Schemas ──────────────────────────────────

describe('WorkflowStartedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = WorkflowStartedPayloadSchema.safeParse({
      workflowId: 'wf-1',
      name: '部署流程',
      taskIds: ['task-1', 'task-2'],
      totalSteps: 3,
    });
    expect(result.success).toBe(true);
  });

  it('空 taskIds 陣列應失敗', () => {
    const result = WorkflowStartedPayloadSchema.safeParse({
      workflowId: 'wf-1',
      name: '部署流程',
      taskIds: [],
      totalSteps: 3,
    });
    expect(result.success).toBe(false);
  });

  it('totalSteps 為 0 應失敗', () => {
    const result = WorkflowStartedPayloadSchema.safeParse({
      workflowId: 'wf-1',
      name: '部署流程',
      taskIds: ['task-1'],
      totalSteps: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('WorkflowStepPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = WorkflowStepPayloadSchema.safeParse({
      workflowId: 'wf-1',
      stepIndex: 0,
      stepName: '初始化',
      status: 'running',
    });
    expect(result.success).toBe(true);
  });

  it('無效 status 應失敗', () => {
    const result = WorkflowStepPayloadSchema.safeParse({
      workflowId: 'wf-1',
      stepIndex: 0,
      stepName: '初始化',
      status: 'invalid',
    });
    expect(result.success).toBe(false);
  });
});

describe('WorkflowCompletedPayloadSchema', () => {
  it('應通過有效 payload', () => {
    const result = WorkflowCompletedPayloadSchema.safeParse({
      workflowId: 'wf-1',
      success: true,
      completedTasks: 5,
      failedTasks: 0,
      duration: 12000,
      summary: '所有步驟完成',
    });
    expect(result.success).toBe(true);
  });

  it('缺少必要欄位應失敗', () => {
    const result = WorkflowCompletedPayloadSchema.safeParse({
      workflowId: 'wf-1',
      success: true,
    });
    expect(result.success).toBe(false);
  });
});
