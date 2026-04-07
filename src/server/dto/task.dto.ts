/**
 * Task DTO — Zod Schema 定義
 */

import { z } from 'zod';

/** 建立任務 DTO */
export const CreateTaskDto = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'archived']).default('backlog'),
  priority: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  assigneeAgentId: z.string().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  dependencies: z.array(z.string()).default([]),
  workflowId: z.string().optional(),
});

/** 更新任務 DTO */
export const UpdateTaskDto = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'archived']).optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  assigneeAgentId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  progress: z.number().int().min(0).max(100).optional(),
});

/** 新增依賴 DTO */
export const AddDependencyDto = z.object({
  dependsOnTaskId: z.string().min(1),
});

export type CreateTaskInput = z.infer<typeof CreateTaskDto>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskDto>;
export type AddDependencyInput = z.infer<typeof AddDependencyDto>;
