/**
 * Claude Code Hook 設定工具
 *
 * Claude Code 透過 ~/.claude/settings.json 中的 hooks 設定，
 * 在工具使用後呼叫 clawflow REST API 回報事件。
 *
 * 設定範例：
 * ```json
 * {
 *   "hooks": {
 *     "PreToolUse": [{
 *       "matcher": "Agent|Skill",
 *       "command": "curl -s -X POST http://localhost:3700/api/v1/events ..."
 *     }],
 *     "PostToolUse": [{
 *       "matcher": ".*",
 *       "command": "curl -s -X POST http://localhost:3700/api/v1/events ..."
 *     }],
 *     "Stop": [{
 *       "matcher": "",
 *       "command": "curl -s -X POST http://localhost:3700/api/v1/events ..."
 *     }]
 *   }
 * }
 * ```
 */

import type { ClaudeCodeRawEvent } from './event-mapper.js';

// ── Hook 設定生成 ──────────────────────────────────────────────

/** Hook 設定項目 */
interface HookEntry {
  readonly matcher: string;
  readonly command: string;
}

/** hooks 設定結構 */
interface HookConfig {
  readonly PreToolUse: readonly HookEntry[];
  readonly PostToolUse: readonly HookEntry[];
  readonly Stop: readonly HookEntry[];
}

/** 完整的 claude settings.json 中 hooks 區塊 */
export interface ClaudeHooksConfig {
  readonly hooks: HookConfig;
}

/**
 * 生成建議的 Claude Code hook 設定
 *
 * @param baseUrl clawflow server 的 base URL
 * @param authToken 可選的驗證 token
 * @returns 可直接合併至 ~/.claude/settings.json 的 hooks 設定
 */
export function generateHookConfig(
  baseUrl: string = 'http://localhost:3700',
  authToken?: string,
): ClaudeHooksConfig {
  const headers = authToken
    ? `-H 'Content-Type: application/json' -H 'Authorization: Bearer ${authToken}'`
    : `-H 'Content-Type: application/json'`;

  const endpoint = `${baseUrl}/api/v1/events`;

  // PostToolUse hook — 回報所有工具使用
  const postToolUseCommand = [
    `curl -s -X POST ${endpoint}`,
    headers,
    `-d '{"event":"agent.progress","source":"claude-code","payload":{"hookType":"PostToolUse","tool":"$CLAUDE_TOOL_NAME","result":"$CLAUDE_TOOL_RESULT","sessionId":"$CLAUDE_SESSION_ID"}}'`,
  ].join(' ');

  // PreToolUse hook — 僅追蹤 Agent/Skill 啟動
  const preToolUseCommand = [
    `curl -s -X POST ${endpoint}`,
    headers,
    `-d '{"event":"agent.started","source":"claude-code","payload":{"hookType":"PreToolUse","tool":"$CLAUDE_TOOL_NAME","sessionId":"$CLAUDE_SESSION_ID"}}'`,
  ].join(' ');

  // Stop hook — session 結束
  const stopCommand = [
    `curl -s -X POST ${endpoint}`,
    headers,
    `-d '{"event":"workflow.completed","source":"claude-code","payload":{"hookType":"Stop","tool":"stop","sessionId":"$CLAUDE_SESSION_ID"}}'`,
  ].join(' ');

  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Agent|Skill',
          command: preToolUseCommand,
        },
      ],
      PostToolUse: [
        {
          matcher: '.*',
          command: postToolUseCommand,
        },
      ],
      Stop: [
        {
          matcher: '',
          command: stopCommand,
        },
      ],
    },
  };
}

// ── Payload 解析 ───────────────────────────────────────────────

/**
 * 解析從 Claude Code hook 傳來的 payload
 *
 * Hook 透過 curl 送來的 JSON body 會被 Express 解析，
 * 此函式負責將 payload 欄位提取為 ClaudeCodeRawEvent。
 *
 * @param body Express request body（已由 JSON middleware 解析）
 * @returns 解析後的 ClaudeCodeRawEvent，格式不符回傳 null
 */
export function parseHookPayload(
  body: unknown,
): ClaudeCodeRawEvent | null {
  if (body === null || typeof body !== 'object') {
    return null;
  }

  const obj = body as Record<string, unknown>;
  const payload = obj['payload'] as Record<string, unknown> | undefined;

  if (payload === undefined || typeof payload !== 'object') {
    return null;
  }

  const hookType = payload['hookType'];
  const tool = payload['tool'];
  const sessionId = payload['sessionId'];

  // 必填欄位驗證
  if (typeof hookType !== 'string' || typeof tool !== 'string' || typeof sessionId !== 'string') {
    return null;
  }

  if (hookType !== 'PreToolUse' && hookType !== 'PostToolUse' && hookType !== 'Stop') {
    return null;
  }

  const result = typeof payload['result'] === 'string' ? payload['result'] : undefined;
  const toolInput = typeof payload['toolInput'] === 'object' && payload['toolInput'] !== null
    ? payload['toolInput'] as Record<string, unknown>
    : undefined;
  const timestamp = typeof obj['timestamp'] === 'string' ? obj['timestamp'] : undefined;

  return {
    hookType,
    tool,
    sessionId,
    ...(result !== undefined ? { result } : {}),
    ...(toolInput !== undefined ? { toolInput } : {}),
    ...(timestamp !== undefined ? { timestamp } : {}),
  };
}
