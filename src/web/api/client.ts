/**
 * API Client — 封裝 fetch 呼叫
 */
import type { ApiResponse } from '../types';

const BASE_URL = '/api/v1';

class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body: ApiResponse<T> = await response.json();

  if (!response.ok || !body.success) {
    throw new ApiError(
      body.error?.code ?? 'UNKNOWN_ERROR',
      body.error?.message ?? `要求失敗（${response.status}）`,
      body.error?.details,
    );
  }

  return body.data as T;
}

// === Task API ===

export async function fetchTasks(params?: Record<string, string>): Promise<unknown> {
  const query = params ? `?${new URLSearchParams(params).toString()}` : '';
  return request(`/tasks${query}`);
}

export async function fetchTask(id: string): Promise<unknown> {
  return request(`/tasks/${id}`);
}

export async function createTask(data: Record<string, unknown>): Promise<unknown> {
  return request('/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: Record<string, unknown>): Promise<unknown> {
  return request(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/tasks/${id}`, { method: 'DELETE' });
}

// === Agent API ===

export async function fetchAgents(): Promise<unknown> {
  return request('/agents');
}

// === Dashboard API ===

export async function fetchStats(): Promise<unknown> {
  return request('/stats');
}

export async function fetchEvents(limit: number = 20): Promise<unknown> {
  return request(`/events?limit=${limit}`);
}

export { ApiError };
