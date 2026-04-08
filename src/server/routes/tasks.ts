/**
 * Task REST Routes
 * 基礎路徑：/api/v1/tasks
 */

import { Router } from 'express';
import { validate } from '../middleware/validate.js';
import { CreateTaskDto, UpdateTaskDto, AddDependencyDto } from '../dto/task.dto.js';
import { notFound } from '../middleware/error-handler.js';
import * as taskService from '../../core/services/task.service.js';
import { parseIntParam } from '../utils/parse-params.js';

/** 從 query 取得 string 值（排除陣列） */
function queryStr(val: unknown): string | undefined {
  return typeof val === 'string' && val.length > 0 ? val : undefined;
}

/** 從 params 取得 string（Express 5 params 可能是 string | string[]） */
function paramStr(val: string | string[]): string {
  return Array.isArray(val) ? val[0] : val;
}

export const tasksRouter: ReturnType<typeof Router> = Router();

/** GET /tasks — 列出任務 */
tasksRouter.get('/', (req, res) => {
  const filters: Record<string, unknown> = {
    limit: parseIntParam(req.query['limit'], 50, 0, 1000),
    offset: parseIntParam(req.query['offset'], 0, 0, Number.MAX_SAFE_INTEGER),
  };
  const status = queryStr(req.query['status']);
  if (status) filters['status'] = status;
  const priority = queryStr(req.query['priority']);
  if (priority) filters['priority'] = priority;
  const assignee = queryStr(req.query['assignee']);
  if (assignee) filters['assignee'] = assignee;
  const workflowId = queryStr(req.query['workflowId']);
  if (workflowId) filters['workflowId'] = workflowId;
  const tag = queryStr(req.query['tag']);
  if (tag) filters['tag'] = tag;
  const sort = queryStr(req.query['sort']);
  if (sort) filters['sort'] = sort;
  const order = queryStr(req.query['order']);
  if (order === 'asc' || order === 'desc') filters['order'] = order;

  const { tasks, total } = taskService.listTasks(
    filters as taskService.TaskFilters,
  );

  res.json({
    success: true,
    data: tasks,
    meta: {
      total,
      limit: filters['limit'],
      offset: filters['offset'],
    },
  });
});

/** GET /tasks/:id — 取得單一任務 */
tasksRouter.get('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const task = taskService.getTask(id);
  if (!task) throw notFound('任務不存在');

  res.json({ success: true, data: task });
});

/** POST /tasks — 建立任務 */
tasksRouter.post('/', validate(CreateTaskDto), (req, res) => {
  const task = taskService.createTask(req.body);
  res.status(201).json({ success: true, data: task });
});

/** PATCH /tasks/:id — 更新任務 */
tasksRouter.patch('/:id', validate(UpdateTaskDto), (req, res) => {
  const id = paramStr(req.params['id']);
  const task = taskService.updateTask(id, req.body);
  if (!task) throw notFound('任務不存在');

  res.json({ success: true, data: task });
});

/** DELETE /tasks/:id — 刪除任務 */
tasksRouter.delete('/:id', (req, res) => {
  const id = paramStr(req.params['id']);
  const result = taskService.deleteTask(id);
  if (!result) throw notFound('任務不存在');

  res.json({ success: true, data: { deleted: true } });
});

/** GET /tasks/:id/dependencies — 取得依賴 */
tasksRouter.get('/:id/dependencies', (req, res) => {
  const id = paramStr(req.params['id']);
  const task = taskService.getTask(id);
  if (!task) throw notFound('任務不存在');

  const deps = taskService.getTaskDependencies(id);

  res.json({ success: true, data: deps });
});

/** POST /tasks/:id/dependencies — 新增依賴 */
tasksRouter.post(
  '/:id/dependencies',
  validate(AddDependencyDto),
  (req, res) => {
    const id = paramStr(req.params['id']);
    const task = taskService.getTask(id);
    if (!task) throw notFound('任務不存在');

    taskService.addTaskDependency(id, req.body.dependsOnTaskId);

    res.status(201).json({
      success: true,
      data: {
        task_id: id,
        depends_on_task_id: req.body.dependsOnTaskId,
      },
    });
  },
);

/** DELETE /tasks/:id/dependencies/:depId — 移除依賴 */
tasksRouter.delete('/:id/dependencies/:depId', (req, res) => {
  const id = paramStr(req.params['id']);
  const depId = paramStr(req.params['depId']);
  const result = taskService.removeTaskDependency(id, depId);
  if (!result) throw notFound('依賴關係不存在');

  res.json({ success: true, data: { deleted: true } });
});
