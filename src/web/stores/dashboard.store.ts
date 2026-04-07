/**
 * Dashboard Store -- 儀表板統計數據 + 最近事件
 */
import { create } from 'zustand';
import * as api from '../api/client';

export interface DashboardStats {
  readonly total: number;
  readonly inProgress: number;
  readonly done: number;
  readonly failed: number;
  readonly byAgent: readonly { readonly agentId: string; readonly agentName: string; readonly count: number }[];
}

export interface DashboardEvent {
  readonly id: string;
  readonly event: string;
  readonly message: string;
  readonly timestamp: string;
  readonly source: string;
}

interface DashboardStore {
  readonly stats: DashboardStats | null;
  readonly events: readonly DashboardEvent[];
  readonly loading: boolean;
  readonly error: string | null;
  fetchStats(): Promise<void>;
  fetchEvents(): Promise<void>;
}

function parseStats(raw: Record<string, unknown>): DashboardStats {
  const byAgent = Array.isArray(raw['byAgent'] ?? raw['by_agent'])
    ? (raw['byAgent'] ?? raw['by_agent']) as { agentId: string; agentName: string; count: number }[]
    : [];
  return {
    total: (raw['total'] as number) ?? 0,
    inProgress: (raw['inProgress'] ?? raw['in_progress'] ?? 0) as number,
    done: (raw['done'] as number) ?? 0,
    failed: (raw['failed'] as number) ?? 0,
    byAgent,
  };
}

function parseEvent(raw: Record<string, unknown>): DashboardEvent {
  const event = (raw['event'] ?? raw['event_type'] ?? '') as string;
  const message = (raw['message'] ?? event) as string;
  return {
    id: raw['id'] as string,
    event,
    message,
    timestamp: raw['timestamp'] as string,
    source: (raw['source'] ?? '') as string,
  };
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stats: null,
  events: [],
  loading: false,
  error: null,

  async fetchStats() {
    set({ loading: true, error: null });
    try {
      const rawData = await api.fetchStats();
      const stats = parseStats(rawData as Record<string, unknown>);
      set({ stats, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '載入統計資料失敗';
      set({ error: message, loading: false });
    }
  },

  async fetchEvents() {
    try {
      const rawData = await api.fetchEvents(20);
      const items = Array.isArray(rawData) ? rawData : [];
      const events = items.map((item) => parseEvent(item as Record<string, unknown>));
      set({ events });
    } catch (error) {
      // 事件列表非關鍵路徑，但仍記錄錯誤以利除錯
      console.error('[Dashboard] fetchEvents error:', error);
    }
  },
}));
