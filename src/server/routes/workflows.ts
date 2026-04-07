/**
 * Workflow REST Routes
 * 基礎路徑：/api/v1/workflows
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { CreateWorkflowDto, UpdateWorkflowDto } from '../dto/workflow.dto.js';
import { notFound } from '../middleware/error-handler.js';
import * as workflowService from '../../core/services/workflow.service.js';

/** 從 query 取得 string 值 */
function queryStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

/** 從 params 取得 string */
function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

export const workflowsRouter = Router();

/** GET /workflows — 列出工作流 */
workflowsRouter.get('/', (req, res) => {
  const filters: Record<string, unknown> = {
    limit: req.query['limit'] ? Number(req.query['limit']) : 50,
    offset: req.query['offset'] ? Number(req.query['offset']) : 0,
  };
  const status = queryStr(req.query['status']);
  if (status) filters['status'] = status;

  const { workflows, total } = workflowService.listWorkflows(
    filters as workflowService.WorkflowFilters,
  );

  res.json({
    success: true,
    data: workflows,
    meta: {
      total,
      limit: filters['limit'],
      offset: filters['offset'],
    },
  });
});

/** GET /workflows/:id — 取得工作流（含 steps） */
workflowsRouter.get('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const result = workflowService.getWorkflow(id);
  if (!result) throw notFound('工作流不存在');

  res.json({ success: true, data: result });
});

/** POST /workflows — 建立工作流 */
workflowsRouter.post('/', validate(CreateWorkflowDto), (req, res) => {
  const result = workflowService.createWorkflow(req.body);
  res.status(201).json({ success: true, data: result });
});

/** PATCH /workflows/:id — 更新工作流 */
workflowsRouter.patch('/:id', validate(UpdateWorkflowDto), (req, res) => {
  const id = paramStr(req.params['id']);
  const workflow = workflowService.updateWorkflow(id, req.body);
  if (!workflow) throw notFound('工作流不存在');

  res.json({ success: true, data: workflow });
});

/** DELETE /workflows/:id — 刪除工作流 */
workflowsRouter.delete('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const result = workflowService.deleteWorkflow(id);
  if (!result) throw notFound('工作流不存在');

  res.json({ success: true, data: { deleted: true } });
});
