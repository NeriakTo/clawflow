/**
 * AgentView -- Agent 狀態面板
 */
import { useState, useEffect, useMemo } from 'react';
import type { Agent, AgentStatus, Task, TaskStatus } from '../types';
import { useAgentStore } from '../stores/agent.store';
import { useTaskStore } from '../stores/task.store';

/** Agent 狀態指示燈顏色 */
const AGENT_STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#64748b',
  working: '#3b82f6',
  completed: '#22c55e',
  error: '#ef4444',
};

/** 任務狀態顏色（歷史列表用） */
const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  backlog: '#64748b',
  todo: '#64748b',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#22c55e',
  archived: '#475569',
};

/** 狀態中文標籤 */
const STATUS_LABEL_MAP: Record<AgentStatus, string> = {
  idle: '閒置',
  working: '工作中',
  completed: '已完成',
  error: '錯誤',
};

function AgentView() {
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);

  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  useEffect(() => {
    void fetchAgents();
    void fetchTasks();
  }, [fetchAgents, fetchTasks]);

  /** 建立 Agent -> 歷史任務對照表 */
  const agentTaskMap = useMemo(() => {
    const map = new Map<string, readonly Task[]>();
    for (const agent of agents) {
      const agentTasks = tasks.filter((t) => t.assigneeAgentId === agent.id);
      map.set(agent.id, agentTasks);
    }
    return map;
  }, [agents, tasks]);

  /** 取得 Agent 當前任務 */
  function getCurrentTask(agent: Agent): Task | undefined {
    if (!agent.currentTaskId) return undefined;
    return tasks.find((t) => t.id === agent.currentTaskId);
  }

  function toggleExpand(agentId: string) {
    setExpandedAgentId((prev) => (prev === agentId ? null : agentId));
  }

  if (agents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full"
           style={{ color: 'var(--color-text-muted)' }}>
        <div className="text-center">
          <div className="text-lg font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            尚無 Agent
          </div>
          <p className="text-sm">等待 Agent 註冊後將自動顯示</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      {/* 頂部統計 */}
      <div className="flex items-center gap-4 mb-4">
        <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
          Agent 總數：{agents.length}
        </span>
        <div className="flex gap-3">
          {(['working', 'idle', 'completed', 'error'] as const).map((status) => {
            const count = agents.filter((a) => a.status === status).length;
            if (count === 0) return null;
            return (
              <span key={status} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{ backgroundColor: AGENT_STATUS_COLOR[status] }}
                />
                {STATUS_LABEL_MAP[status]} {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Agent 卡片 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => {
          const isExpanded = expandedAgentId === agent.id;
          const currentTask = getCurrentTask(agent);
          const agentTasks = agentTaskMap.get(agent.id) ?? [];

          return (
            <div
              key={agent.id}
              className="rounded-xl overflow-hidden transition-all cursor-pointer"
              style={{
                backgroundColor: 'var(--color-card)',
                border: `1px solid ${isExpanded ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
              onClick={() => toggleExpand(agent.id)}
            >
              {/* 卡片標頭 */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    {/* 狀態指示燈 */}
                    <span
                      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: AGENT_STATUS_COLOR[agent.status],
                        boxShadow: agent.status === 'working'
                          ? `0 0 8px ${AGENT_STATUS_COLOR[agent.status]}`
                          : 'none',
                        animation: agent.status === 'working' ? 'pulse 2s infinite' : 'none',
                      }}
                    />
                    <div>
                      <div className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {agent.name}
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                        {agent.type}
                      </div>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-medium"
                    style={{
                      backgroundColor: `${AGENT_STATUS_COLOR[agent.status]}20`,
                      color: AGENT_STATUS_COLOR[agent.status],
                    }}
                  >
                    {STATUS_LABEL_MAP[agent.status]}
                  </span>
                </div>

                {/* Adapter */}
                <div className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
                  Adapter: <span style={{ color: 'var(--color-text-secondary)' }}>{agent.adapterId}</span>
                </div>

                {/* 當前任務 */}
                {currentTask && (
                  <div
                    className="rounded-lg px-3 py-2 mb-2"
                    style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.08)',
                      border: '1px solid rgba(59, 130, 246, 0.2)',
                    }}
                  >
                    <div className="text-[10px] mb-0.5" style={{ color: 'var(--color-primary)' }}>
                      當前任務
                    </div>
                    <div className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                      {currentTask.title}
                    </div>
                    {currentTask.progress > 0 && (
                      <div className="w-full h-1 rounded-full mt-1.5" style={{ backgroundColor: 'var(--color-border)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${currentTask.progress}%`,
                            backgroundColor: 'var(--color-primary)',
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Capabilities */}
                {agent.capabilities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {agent.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-1.5 py-0.5 rounded text-[10px]"
                        style={{
                          backgroundColor: 'var(--color-border)',
                          color: 'var(--color-text-secondary)',
                        }}
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 展開：歷史任務列表 */}
              {isExpanded && (
                <div
                  className="border-t px-4 py-3"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    歷史任務（{agentTasks.length}）
                  </div>
                  {agentTasks.length === 0 ? (
                    <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      尚無任務紀錄
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      {agentTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between px-2 py-1.5 rounded"
                          style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
                        >
                          <span className="text-xs truncate flex-1" style={{ color: 'var(--color-text)' }}>
                            {task.title}
                          </span>
                          <span
                            className="text-[10px] ml-2 flex-shrink-0"
                            style={{ color: TASK_STATUS_COLOR[task.status] ?? 'var(--color-text-muted)' }}
                          >
                            {task.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* pulse 動畫用 inline style（Tailwind v4 不需要 @keyframes 設定） */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default AgentView;
