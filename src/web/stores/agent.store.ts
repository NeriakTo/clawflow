/**
 * Agent Store — Agent 狀態管理
 */
import { create } from 'zustand';
import type { Agent, WsEvent } from '../types';
import * as api from '../api/client';

interface AgentStore {
  readonly agents: readonly Agent[];
  fetchAgents(): Promise<void>;
  handleAgentEvent(event: WsEvent): void;
}

function parseAgent(raw: Record<string, unknown>): Agent {
  return {
    id: raw['id'] as string,
    adapterId: (raw['adapter_id'] ?? raw['adapterId']) as string,
    name: raw['name'] as string,
    type: raw['type'] as string,
    status: raw['status'] as Agent['status'],
    capabilities: (raw['capabilities'] as string[]) ?? [],
    currentTaskId: (raw['current_task_id'] ?? raw['currentTaskId']) as string | undefined,
    metadata: (raw['metadata'] as Record<string, unknown>) ?? {},
    registeredAt: (raw['registered_at'] ?? raw['registeredAt']) as string,
    lastHeartbeatAt: (raw['last_heartbeat_at'] ?? raw['lastHeartbeatAt']) as string,
  };
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],

  async fetchAgents() {
    try {
      const rawData = await api.fetchAgents();
      const items = Array.isArray(rawData) ? rawData : [];
      const agents = items.map((item) => parseAgent(item as Record<string, unknown>));
      set({ agents });
    } catch {
      // 靜默處理，Agent 列表非關鍵路徑
    }
  },

  handleAgentEvent(event: WsEvent) {
    const payload = event.payload;

    switch (event.event) {
      case 'agent.registered': {
        const agent = parseAgent(payload);
        set((state) => ({ agents: [...state.agents, agent] }));
        break;
      }
      case 'agent.started': {
        const agentId = payload['agentId'] as string;
        const taskId = payload['taskId'] as string;
        set((state) => ({
          agents: state.agents.map((a): Agent =>
            a.id === agentId ? { ...a, status: 'working' as const, currentTaskId: taskId } : a,
          ),
        }));
        break;
      }
      case 'agent.completed': {
        const agentId = payload['agentId'] as string;
        set((state) => ({
          agents: state.agents.map((a): Agent =>
            a.id === agentId
              ? { ...a, status: 'completed' as const, currentTaskId: undefined }
              : a,
          ),
        }));
        break;
      }
      case 'agent.error': {
        const agentId = payload['agentId'] as string;
        set((state) => ({
          agents: state.agents.map((a): Agent =>
            a.id === agentId ? { ...a, status: 'error' as const } : a,
          ),
        }));
        break;
      }
    }
  },
}));
