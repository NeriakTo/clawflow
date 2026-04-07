/**
 * DashboardView -- 儀表板（統計總覽）
 */
import { useEffect, useMemo } from 'react';
import { useTaskStore } from '../stores/task.store';
import { useAgentStore } from '../stores/agent.store';
import { useDashboardStore } from '../stores/dashboard.store';
import type { TaskStatus } from '../types';

/** 狀態對應顏色 */
const STATUS_COLOR_MAP: Record<TaskStatus, string> = {
  backlog: '#71717a',
  todo: '#71717a',
  in_progress: '#3b82f6',
  review: '#eab308',
  done: '#22c55e',
  archived: '#71717a',
};

/** 事件類型對應顏色 */
function eventColor(event: string): string {
  if (event.includes('completed') || event.includes('done')) return '#22c55e';
  if (event.includes('failed') || event.includes('error')) return '#ef4444';
  if (event.includes('started') || event.includes('in_progress')) return '#3b82f6';
  if (event.includes('created') || event.includes('registered')) return '#eab308';
  return '#71717a';
}

/** SVG 環形圖元件 */
function DonutChart({ completed, total }: { readonly completed: number; readonly total: number }) {
  const size = 140;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const rate = total > 0 ? completed / total : 0;
  const offset = circumference * (1 - rate);
  const percentage = total > 0 ? Math.round(rate * 100) : 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景環 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#2e2e38"
        strokeWidth={strokeWidth}
      />
      {/* 進度環 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#22c55e"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      {/* 中央文字 */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="#e4e4e7"
        fontSize="24"
        fontWeight="bold"
        fontFamily="'Fira Code', monospace"
      >
        {percentage}%
      </text>
    </svg>
  );
}

/** 統計卡片 */
function StatCard({
  label,
  value,
  color,
}: {
  readonly label: string;
  readonly value: number;
  readonly color: string;
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1 bg-surface border border-border">
      <span className="text-xs text-text-muted">
        {label}
      </span>
      <span className="text-2xl font-bold font-['Fira_Code']" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function formatTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds} 秒前`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

function DashboardView() {
  const tasks = useTaskStore((s) => s.tasks);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const agents = useAgentStore((s) => s.agents);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  const stats = useDashboardStore((s) => s.stats);
  const events = useDashboardStore((s) => s.events);
  const fetchStats = useDashboardStore((s) => s.fetchStats);
  const fetchEvents = useDashboardStore((s) => s.fetchEvents);

  useEffect(() => {
    void fetchTasks();
    void fetchAgents();
    void fetchStats();
    void fetchEvents();
  }, [fetchTasks, fetchAgents, fetchStats, fetchEvents]);

  /** 基於本地 tasks 的即時統計（優先；stats API 可能延遲） */
  const localStats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const review = tasks.filter((t) => t.status === 'review').length;
    const done = tasks.filter((t) => t.status === 'done').length;
    const failed = tasks.filter((t) => t.status === 'backlog' && t.progress === 0).length;
    return { total, inProgress: inProgress + review, done, failed };
  }, [tasks]);

  /** Agent 負載分配 */
  const agentLoad = useMemo(() => {
    const agentMap = new Map(agents.map((a) => [a.id, a.name]));
    const countMap = new Map<string, number>();

    for (const task of tasks) {
      if (task.assigneeAgentId) {
        countMap.set(task.assigneeAgentId, (countMap.get(task.assigneeAgentId) ?? 0) + 1);
      }
    }

    return [...countMap.entries()]
      .map(([agentId, count]) => ({
        agentId,
        agentName: agentMap.get(agentId) ?? agentId,
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks, agents]);

  const displayStats = stats ?? localStats;
  const maxLoad = agentLoad.length > 0 ? Math.max(...agentLoad.map((a) => a.count)) : 1;

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-6xl mx-auto">
        {/* 統計卡片列 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="任務總數" value={displayStats.total} color="#e4e4e7" />
          <StatCard label="進行中" value={displayStats.inProgress} color="#4f8ff7" />
          <StatCard label="已完成" value={displayStats.done} color="#22c55e" />
          <StatCard label="失敗" value={displayStats.failed} color="#ef4444" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 完成率環形圖 */}
          <div className="rounded-xl p-4 bg-surface border border-border">
            <h3 className="text-sm font-semibold text-text mb-4">
              完成率
            </h3>
            <div className="flex items-center justify-center">
              <DonutChart completed={displayStats.done} total={displayStats.total} />
            </div>
            <div className="flex justify-center gap-4 mt-4 text-xs text-text-muted">
              <span>已完成 {displayStats.done}</span>
              <span>總數 {displayStats.total}</span>
            </div>
          </div>

          {/* Agent 負載分配 */}
          <div className="rounded-xl p-4 bg-surface border border-border">
            <h3 className="text-sm font-semibold text-text mb-4">
              Agent 負載分配
            </h3>
            {agentLoad.length === 0 ? (
              <div className="text-xs text-text-muted">
                尚無 Agent 任務分配
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {agentLoad.map((item) => (
                  <div key={item.agentId}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-text-secondary">{item.agentName}</span>
                      <span className="text-text-muted">{item.count} 個任務</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-border">
                      <div
                        className="h-full rounded-full transition-all bg-accent"
                        style={{
                          width: `${(item.count / maxLoad) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 最近事件時間線 */}
          <div className="rounded-xl p-4 bg-surface border border-border">
            <h3 className="text-sm font-semibold text-text mb-4">
              最近事件
            </h3>
            {events.length === 0 ? (
              <div className="text-xs text-text-muted">
                尚無事件
              </div>
            ) : (
              <div className="flex flex-col gap-0 max-h-[400px] overflow-y-auto">
                {events.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-3 py-2 border-b border-border/30 last:border-b-0">
                    {/* 時間線圓點 */}
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: eventColor(evt.event) }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-text">
                        {evt.message}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-muted">
                        <span>{evt.source}</span>
                        <span>{formatTimeAgo(evt.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 任務狀態分布（底部小圖） */}
        <div className="rounded-xl p-4 mt-4 bg-surface border border-border">
          <h3 className="text-sm font-semibold text-text mb-3">
            任務狀態分布
          </h3>
          <div className="flex gap-2 h-4 rounded-full overflow-hidden bg-border">
            {tasks.length > 0 &&
              (['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'] as const).map((status) => {
                const count = tasks.filter((t) => t.status === status).length;
                if (count === 0) return null;
                const pct = (count / tasks.length) * 100;
                return (
                  <div
                    key={status}
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: STATUS_COLOR_MAP[status],
                    }}
                    title={`${status}: ${count}`}
                  />
                );
              })}
          </div>
          <div className="flex flex-wrap gap-4 mt-2">
            {(['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'] as const).map((status) => {
              const count = tasks.filter((t) => t.status === status).length;
              if (count === 0) return null;
              return (
                <span key={status} className="flex items-center gap-1.5 text-xs text-text-muted">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_COLOR_MAP[status] }}
                  />
                  {status} ({count})
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardView;
