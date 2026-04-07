/**
 * Adapter 統一匯出
 *
 * 匯出所有 adapter 型別、註冊表、以及內建 adapter 載入函式。
 */

// ── 核心型別與註冊表 ────────────────────────────────────────────
export type {
  CLIAdapter,
  AdapterConfig,
  AdapterCommand,
  AdapterHealthStatus,
  EventSink,
  StandardEvent,
} from './types.js';

export { AdapterRegistry } from './registry.js';

// ── 內建 Adapter ────────────────────────────────────────────────
export {
  ClaudeCodeAdapter,
  createClaudeCodeAdapter,
  generateHookConfig,
  parseHookPayload,
  mapClaudeCodeEvent,
  createWorkflowStartedEvent,
} from './claude-code/index.js';

export type { ClaudeCodeRawEvent } from './claude-code/index.js';

// ── 內建 Adapter 載入 ──────────────────────────────────────────

import { AdapterRegistry } from './registry.js';
import { createClaudeCodeAdapter } from './claude-code/index.js';
import type { AdapterConfig } from './types.js';

/** 預設 adapter 配置 */
const DEFAULT_ADAPTER_CONFIG: AdapterConfig = {
  enabled: true,
  options: {},
};

/**
 * 載入所有內建 adapter 至註冊表
 *
 * @param registry AdapterRegistry 實例
 * @param overrides 各 adapter 的配置覆蓋（key 為 adapter ID）
 */
export function loadBuiltinAdapters(
  registry: AdapterRegistry,
  overrides?: Readonly<Record<string, Partial<AdapterConfig>>>,
): void {
  // Claude Code adapter
  const claudeCodeConfig: AdapterConfig = {
    ...DEFAULT_ADAPTER_CONFIG,
    ...overrides?.['claude-code'],
    options: {
      ...DEFAULT_ADAPTER_CONFIG.options,
      ...overrides?.['claude-code']?.options,
    },
  };

  registry.register(createClaudeCodeAdapter(), claudeCodeConfig);

  // 未來可在此處新增其他內建 adapter：
  // registry.register(createCodexAdapter(), codexConfig);
  // registry.register(createGeminiAdapter(), geminiConfig);
  // registry.register(createOpenClawAdapter(), openclawConfig);
}
