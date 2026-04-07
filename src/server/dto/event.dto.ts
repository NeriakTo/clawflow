/**
 * Event DTO — Zod Schema 定義
 */

import { z } from 'zod';

/** 提交事件 DTO */
export const SubmitEventDto = z.object({
  event: z.string().min(1),
  source: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  correlationId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
  version: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  taskId: z.string().optional(),
  agentId: z.string().optional(),
});

/** 批量提交事件 DTO */
export const BatchSubmitEventDto = z.object({
  events: z.array(SubmitEventDto).min(1).max(100),
});

export type SubmitEventInput = z.infer<typeof SubmitEventDto>;
export type BatchSubmitEventInput = z.infer<typeof BatchSubmitEventDto>;
