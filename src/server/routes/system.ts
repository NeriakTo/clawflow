/**
 * System REST Routes
 * 基礎路徑：/api/v1
 *
 * 健康檢查、統計、匯出、匯入
 */

import { Router } from 'express';
import { z } from 'zod';
import * as taskService from '../../core/services/task.service.js';
import * as agentService from '../../core/services/agent.service.js';
import * as eventService from '../../core/services/event.service.js';
import * as workflowService from '../../core/services/workflow.service.js';

/** /import 端點的 Zod 驗證 schema */
const importSchema = z.object({
  tasks: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    status: z.string().optional(),
    priority: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })).optional(),
  agents: z.array(z.object({
    name: z.string().min(1),
    type: z.string().min(1),
    capabilities: z.array(z.string()).optional(),
  })).optional(),
  events: z.array(z.object({
    event: z.string().min(1),
    source: z.string().min(1),
    payload: z.record(z.unknown()).optional(),
  })).optional(),
  workflows: z.array(z.object({
    name: z.string().min(1),
  })).optional(),
});

export const systemRouter: ReturnType<typeof Router> = Router();

/** GET /health — 健康檢查 */
systemRouter.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] ?? '0.1.0',
      uptime: process.uptime(),
    },
  });
});

/** GET /stats — 統計資訊 */
systemRouter.get('/stats', (_req, res) => {
  const taskResult = taskService.listTasks({ limit: 0, offset: 0 });
  const agentResult = agentService.listAgents({ limit: 0, offset: 0 });
  const eventResult = eventService.listEvents({ limit: 0, offset: 0 });
  const workflowResult = workflowService.listWorkflows({ limit: 0, offset: 0 });

  // 取得已完成任務數
  const doneResult = taskService.listTasks({ status: 'done', limit: 0, offset: 0 });

  const totalTasks = taskResult.total;
  const doneTasks = doneResult.total;
  const completionRate = totalTasks > 0
    ? Math.round((doneTasks / totalTasks) * 10000) / 100
    : 0;

  res.json({
    success: true,
    data: {
      tasks: {
        total: totalTasks,
        done: doneTasks,
        completionRate,
      },
      agents: {
        total: agentResult.total,
      },
      events: {
        total: eventResult.total,
      },
      workflows: {
        total: workflowResult.total,
      },
      timestamp: new Date().toISOString(),
    },
  });
});

/** POST /export — 匯出全部資料 */
systemRouter.post('/export', (_req, res) => {
  const tasks = taskService.listTasks({ limit: 10000, offset: 0 });
  const agents = agentService.listAgents({ limit: 10000, offset: 0 });
  const events = eventService.listEvents({ limit: 10000, offset: 0 });
  const workflows = workflowService.listWorkflows({ limit: 10000, offset: 0 });

  res.json({
    success: true,
    data: {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      tasks: tasks.tasks,
      agents: agents.agents,
      events: events.events,
      workflows: workflows.workflows,
    },
  });
});

/** POST /import — 匯入資料（含 Zod 結構驗證） */
systemRouter.post('/import', (req, res) => {
  // 驗證請求 body 結構
  const parsed = importSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: '匯入資料格式錯誤',
        details: parsed.error.issues,
      },
    });
    return;
  }

  const body = parsed.data;
  const results = {
    tasks: 0,
    agents: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // 匯入任務
  if (body.tasks) {
    for (const task of body.tasks) {
      try {
        const input: Record<string, unknown> = {
          title: task.title,
        };
        if (task.description !== undefined) input['description'] = task.description;
        if (task.status !== undefined) input['status'] = task.status;
        if (task.priority !== undefined) input['priority'] = task.priority;
        if (task.tags !== undefined) input['tags'] = task.tags;

        taskService.createTask(input as unknown as taskService.CreateTaskInput);
        results.tasks++;
      } catch (err) {
        results.skipped++;
        results.errors.push(
          `匯入任務失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
        );
      }
    }
  }

  // 匯入 agents
  if (body.agents) {
    for (const agent of body.agents) {
      try {
        const input: Record<string, unknown> = {
          name: agent.name,
          type: agent.type,
        };
        if (agent.capabilities !== undefined) input['capabilities'] = agent.capabilities;

        agentService.registerAgent(input as unknown as agentService.RegisterAgentInput);
        results.agents++;
      } catch (err) {
        results.skipped++;
        results.errors.push(
          `匯入 Agent 失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
        );
      }
    }
  }

  res.json({
    success: true,
    data: {
      imported: results,
      timestamp: new Date().toISOString(),
    },
  });
});
