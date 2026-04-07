/**
 * Workflow DTO — Zod Schema 定義
 */

import { z } from 'zod';

/** 建立工作流 DTO */
export const CreateWorkflowDto = z.object({
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  steps: z.array(z.object({
    stepName: z.string().min(1).max(200),
    taskId: z.string().optional(),
  })).default([]),
  metadata: z.record(z.unknown()).optional(),
});

/** 更新工作流 DTO */
export const UpdateWorkflowDto = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowDto>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowDto>;
