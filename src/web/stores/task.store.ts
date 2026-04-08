/**
 * Task Store — 任務狀態管理
 */
import { create } from 'zustand';
import type { Task, TaskFilters, CreateTaskDto, UpdateTaskDto, WsEvent } from '../types';
import * as api from '../api/client';

interface TaskStore {
  readonly tasks: readonly Task[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly filters: Readonly<TaskFilters>;
  fetchTasks(): Promise<void>;
  createTask(dto: CreateTaskDto): Promise<void>;
  updateTask(id: string, dto: UpdateTaskDto): Promise<void>;
  deleteTask(id: string): Promise<void>;
  setFilters(filters: TaskFilters): void;
  handleTaskEvent(event: WsEvent): void;
}

function parseTask(raw: Record<string, unknown>): Task {
  return {
    id: raw['id'] as string,
    title: raw['title'] as string,
    description: raw['description'] as string | undefined,
    status: raw['status'] as Task['status'],
    priority: raw['priority'] as Task['priority'],
    assigneeAgentId: (raw['assignee_agent_id'] ?? raw['assigneeAgentId']) as string | undefined,
    tags: Array.isArray(raw['tags'])
      ? raw['tags'] as string[]
      : typeof raw['tags'] === 'string'
        ? JSON.parse(raw['tags'] as string) as string[]
        : [],
    progress: (raw['progress'] as number) ?? 0,
    dependencies: (raw['dependencies'] as string[]) ?? [],
    workflowId: (raw['workflow_id'] ?? raw['workflowId']) as string | undefined,
    createdAt: (raw['created_at'] ?? raw['createdAt']) as string,
    updatedAt: (raw['updated_at'] ?? raw['updatedAt']) as string,
    completedAt: (raw['completed_at'] ?? raw['completedAt']) as string | undefined,
  };
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,
  filters: { search: undefined, priority: undefined, assignee: undefined, tag: undefined },

  async fetchTasks() {
    set({ loading: true, error: null });
    try {
      const { filters } = get();
      const params: Record<string, string> = {};
      if (filters.priority) params['priority'] = filters.priority;
      if (filters.assignee) params['assignee'] = filters.assignee;
      if (filters.tag) params['tag'] = filters.tag;

      const rawData = await api.fetchTasks(params);
      const items = Array.isArray(rawData) ? rawData : [];
      const tasks = items.map((item) => parseTask(item as Record<string, unknown>));
      set({ tasks, loading: false });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '載入任務失敗';
      set({ error: message, loading: false });
    }
  },

  async createTask(dto: CreateTaskDto) {
    try {
      const rawData = await api.createTask(dto as unknown as Record<string, unknown>);
      const task = parseTask(rawData as Record<string, unknown>);
      set((state) => ({ tasks: [...state.tasks, task] }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '建立任務失敗';
      set({ error: message });
    }
  },

  async updateTask(id: string, dto: UpdateTaskDto) {
    try {
      const rawData = await api.updateTask(id, dto as unknown as Record<string, unknown>);
      const updated = parseTask(rawData as Record<string, unknown>);
      set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '更新任務失敗';
      set({ error: message });
    }
  },

  async deleteTask(id: string) {
    try {
      await api.deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '刪除任務失敗';
      set({ error: message });
    }
  },

  setFilters(filters: TaskFilters) {
    set({ filters });
  },

  handleTaskEvent(event: WsEvent) {
    switch (event.event) {
      case 'task.created': {
        const task = parseTask(event as unknown as Record<string, unknown>);
        set((state) => ({ tasks: [...state.tasks, task] }));
        break;
      }
      case 'task.updated': {
        const taskId = event['taskId'] as string;
        const changes = (event['changes'] ?? {}) as Record<string, unknown>;
        set((state) => ({
          tasks: state.tasks.map((t): Task =>
            t.id === taskId ? { ...t, ...changes } as Task : t,
          ),
        }));
        break;
      }
      case 'task.completed': {
        const taskId = event['taskId'] as string;
        set((state) => ({
          tasks: state.tasks.map((t): Task =>
            t.id === taskId ? { ...t, status: 'done' as const, progress: 100 } : t,
          ),
        }));
        break;
      }
      case 'task.deleted': {
        const taskId = event['taskId'] as string;
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
        }));
        break;
      }
      case 'task.failed': {
        const taskId = event['taskId'] as string;
        set((state) => ({
          tasks: state.tasks.map((t): Task =>
            t.id === taskId ? { ...t, status: 'backlog' as const } : t,
          ),
        }));
        break;
      }
    }
  },
}));
