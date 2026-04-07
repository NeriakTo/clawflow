/**
 * Agent DTO — Zod Schema 定義
 */

import { z } from 'zod';

/** 註冊 Agent DTO */
export const RegisterAgentDto = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  capabilities: z.array(z.string().min(1).max(100)).max(50).default([]),
  metadata: z.record(z.unknown()).optional(),
});

/** 更新 Agent DTO */
export const UpdateAgentDto = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().min(1).max(100).optional(),
  status: z.enum(['idle', 'working', 'completed', 'error']).optional(),
  capabilities: z.array(z.string().min(1).max(100)).max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type RegisterAgentInput = z.infer<typeof RegisterAgentDto>;
export type UpdateAgentInput = z.infer<typeof UpdateAgentDto>;
