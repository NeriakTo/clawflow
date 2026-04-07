/**
 * Agent REST Routes
 * 基礎路徑：/api/v1/agents
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { RegisterAgentDto, UpdateAgentDto } from '../dto/agent.dto.js';
import { notFound } from '../middleware/error-handler.js';
import * as agentService from '../../core/services/agent.service.js';

/** 從 query 取得 string 值 */
function queryStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

/** 從 params 取得 string */
function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

export const agentsRouter = Router();

/** GET /agents — 列出 agents */
agentsRouter.get('/', (req, res) => {
  const filters: Record<string, unknown> = {
    limit: req.query['limit'] ? Number(req.query['limit']) : 50,
    offset: req.query['offset'] ? Number(req.query['offset']) : 0,
  };
  const status = queryStr(req.query['status']);
  if (status) filters['status'] = status;
  const type = queryStr(req.query['type']);
  if (type) filters['type'] = type;

  const { agents, total } = agentService.listAgents(
    filters as agentService.AgentFilters,
  );

  res.json({
    success: true,
    data: agents,
    meta: {
      total,
      limit: filters['limit'],
      offset: filters['offset'],
    },
  });
});

/** GET /agents/:id — 取得單一 agent */
agentsRouter.get('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const agent = agentService.getAgent(id);
  if (!agent) throw notFound('Agent 不存在');

  res.json({ success: true, data: agent });
});

/** POST /agents/register — 註冊 agent */
agentsRouter.post('/register', validate(RegisterAgentDto), (req, res) => {
  const agent = agentService.registerAgent(req.body);
  res.status(201).json({ success: true, data: agent });
});

/** PATCH /agents/:id — 更新 agent */
agentsRouter.patch('/:id', validate(UpdateAgentDto), (req, res) => {
  const id = paramStr(req.params['id']);
  const agent = agentService.updateAgent(id, req.body);
  if (!agent) throw notFound('Agent 不存在');

  res.json({ success: true, data: agent });
});

/** DELETE /agents/:id — 刪除 agent */
agentsRouter.delete('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const result = agentService.deleteAgent(id);
  if (!result) throw notFound('Agent 不存在');

  res.json({ success: true, data: { deleted: true } });
});

/** POST /agents/:id/heartbeat — 心跳 */
agentsRouter.post('/:id/heartbeat', (req, res) => {
  const id = paramStr(req.params['id']);
  const agent = agentService.heartbeatAgent(id);
  if (!agent) throw notFound('Agent 不存在');

  res.json({ success: true, data: agent });
});
