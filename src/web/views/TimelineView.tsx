/**
 * TimelineView -- 時間軸視圖（甘特圖風格）
 */
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Task, TaskStatus } from '../types';
import { useTaskStore } from '../stores/task.store';
import { useAgentStore } from '../stores/agent.store';

/** 狀態對應顏色 */
const STATUS_COLOR_MAP: Record<TaskStatus, string> = {
  backlog: '#71717a',
  todo: '#71717a',
  in_progress: '#3b82f6',
  review: '#eab308',
  done: '#22c55e',
  archived: '#71717a',
};

/** 狀態中文標籤 */
const STATUS_LABEL_MAP: Record<TaskStatus, string> = {
  backlog: '待辦列',
  todo: '待處理',
  in_progress: '進行中',
  review: '審查中',
  done: '已完成',
  archived: '已封存',
};

/** 時間刻度選項 */
const SCALE_OPTIONS = [
  { label: '15 分鐘', minutes: 15 },
  { label: '30 分鐘', minutes: 30 },
  { label: '1 小時', minutes: 60 },
  { label: '3 小時', minutes: 180 },
  { label: '6 小時', minutes: 360 },
  { label: '12 小時', minutes: 720 },
] as const;

/** 每格寬度（px） */
const CELL_WIDTH = 120;
const ROW_HEIGHT = 44;
const LABEL_WIDTH = 220;

interface TooltipInfo {
  readonly task: Task;
  readonly x: number;
  readonly y: number;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' });
}

function TimelineView() {
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const agents = useAgentStore((s) => s.agents);

  const [scaleIndex, setScaleIndex] = useState(2); // 預設 1 小時
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const minutesPerCell = SCALE_OPTIONS[scaleIndex].minutes;

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  /** Agent ID -> 名稱 對照 */
  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a.name])),
    [agents],
  );

  /** 計算時間範圍 */
  const { timeStart, timeEnd, sortedTasks } = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      return {
        timeStart: now,
        timeEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
        sortedTasks: [] as readonly Task[],
      };
    }

    const timestamps = tasks.map((t) => new Date(t.createdAt).getTime());
    const minTs = Math.min(...timestamps);
    const maxTs = Math.max(
      ...tasks.map((t) => {
        if (t.completedAt) return new Date(t.completedAt).getTime();
        return Date.now();
      }),
    );

    // 前後各留一格餘量
    const padding = minutesPerCell * 60 * 1000;
    const start = new Date(minTs - padding);
    const end = new Date(maxTs + padding);

    // 按建立時間排序
    const sorted = [...tasks].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    return { timeStart: start, timeEnd: end, sortedTasks: sorted };
  }, [tasks, minutesPerCell]);

  /** 時間格線標籤 */
  const gridLabels = useMemo(() => {
    const labels: { time: Date; label: string; dateLabel: string }[] = [];
    const cellMs = minutesPerCell * 60 * 1000;
    // 對齊到刻度
    const startMs = Math.floor(timeStart.getTime() / cellMs) * cellMs;
    let current = startMs;

    while (current <= timeEnd.getTime()) {
      const d = new Date(current);
      labels.push({
        time: d,
        label: formatTime(d),
        dateLabel: formatDate(d),
      });
      current += cellMs;
    }
    return labels;
  }, [timeStart, timeEnd, minutesPerCell]);

  /** 總寬度 */
  const totalWidth = gridLabels.length * CELL_WIDTH;

  /** 將時間戳轉成 px 偏移 */
  const timeToX = useCallback(
    (ts: number): number => {
      const totalMs = timeEnd.getTime() - timeStart.getTime();
      if (totalMs === 0) return 0;
      return ((ts - timeStart.getTime()) / totalMs) * totalWidth;
    },
    [timeStart, timeEnd, totalWidth],
  );

  /** Tooltip 處理 */
  function handleBarEnter(e: React.MouseEvent, task: Task) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTooltip({
      task,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    });
  }

  function handleBarLeave() {
    setTooltip(null);
  }

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        載入中...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <div className="text-lg font-medium mb-1 text-text-secondary">
            尚無任務
          </div>
          <p className="text-sm">在看板中新增任務後，這裡會顯示時間軸</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 工具列 */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <span className="text-sm text-text-secondary">
          時間刻度：
        </span>
        <div className="flex gap-1">
          {SCALE_OPTIONS.map((opt, idx) => (
            <button
              key={opt.minutes}
              onClick={() => setScaleIndex(idx)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                scaleIndex === idx
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:text-text'
              }`}
              style={scaleIndex === idx ? {} : {
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-xs text-text-muted">
          共 {tasks.length} 個任務
        </span>
      </div>

      {/* 時間軸主體 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左側：任務名稱 */}
        <div
          className="flex-shrink-0 overflow-y-auto bg-surface"
          style={{
            width: LABEL_WIDTH,
            borderRight: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          {/* 標頭佔位 */}
          <div
            className="px-3 flex items-center text-xs font-medium text-text-secondary"
            style={{
              height: 48,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            任務
          </div>
          {sortedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-2 px-3"
              style={{
                height: ROW_HEIGHT,
                borderBottom: '1px solid rgba(255,255,255,0.03)',
              }}
            >
              <span
                className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUS_COLOR_MAP[task.status] }}
              />
              <span
                className="text-xs truncate text-text"
                title={task.title}
              >
                {task.title}
              </span>
            </div>
          ))}
        </div>

        {/* 右側：時間格線 + 色條 */}
        <div className="flex-1 overflow-auto" ref={scrollRef}>
          <div style={{ minWidth: totalWidth }}>
            {/* 時間標頭 */}
            <div
              className="flex sticky top-0 z-10 bg-bg"
              style={{
                height: 48,
                borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {gridLabels.map((g, idx) => (
                <div
                  key={idx}
                  className="flex-shrink-0 flex flex-col items-center justify-center"
                  style={{
                    width: CELL_WIDTH,
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  <span className="text-[10px] text-text-faint font-['Fira_Code']">
                    {g.dateLabel}
                  </span>
                  <span className="text-xs text-text-secondary font-['Fira_Code']">
                    {g.label}
                  </span>
                </div>
              ))}
            </div>

            {/* 色條區域 */}
            <div className="relative">
              {/* 背景格線 */}
              {gridLabels.map((_, idx) => (
                <div
                  key={idx}
                  className="absolute top-0 bottom-0"
                  style={{
                    left: idx * CELL_WIDTH,
                    width: CELL_WIDTH,
                    borderRight: '1px solid rgba(255,255,255,0.03)',
                  }}
                />
              ))}

              {/* 任務色條 */}
              {sortedTasks.map((task, rowIdx) => {
                const startTs = new Date(task.createdAt).getTime();
                const endTs = task.completedAt
                  ? new Date(task.completedAt).getTime()
                  : Date.now();

                const x = timeToX(startTs);
                const barWidth = Math.max(timeToX(endTs) - x, 8);

                return (
                  <div
                    key={task.id}
                    className="relative"
                    style={{
                      height: ROW_HEIGHT,
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    <div
                      className="absolute rounded cursor-pointer transition-opacity hover:opacity-80"
                      style={{
                        left: x,
                        width: barWidth,
                        top: 8,
                        height: ROW_HEIGHT - 16,
                        backgroundColor: STATUS_COLOR_MAP[task.status],
                        opacity: 0.85,
                      }}
                      onMouseEnter={(e) => handleBarEnter(e, task)}
                      onMouseLeave={handleBarLeave}
                    >
                      {/* 進度指示 */}
                      {task.progress > 0 && task.progress < 100 && (
                        <div
                          className="absolute inset-0 rounded"
                          style={{
                            width: `${task.progress}%`,
                            backgroundColor: 'rgba(255, 255, 255, 0.15)',
                          }}
                        />
                      )}
                      {/* 色條內標題（夠寬才顯示） */}
                      {barWidth > 60 && (
                        <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium truncate text-white">
                          {task.title}
                        </span>
                      )}
                    </div>
                    {/* 行底線佔位 — 用 rowIdx 保持對齊（未用到但保留 key 一致性） */}
                    {rowIdx < 0 && null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 rounded-lg px-3 py-2 pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            backgroundColor: '#191a1b',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div className="text-xs font-medium mb-1 text-text">
            {tooltip.task.title}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-text-secondary">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: STATUS_COLOR_MAP[tooltip.task.status] }}
            />
            <span>{STATUS_LABEL_MAP[tooltip.task.status]}</span>
            <span>|</span>
            <span className="font-['Fira_Code']">進度 {tooltip.task.progress}%</span>
          </div>
          <div className="text-[10px] mt-0.5 text-text-muted font-['Fira_Code']">
            {formatTime(new Date(tooltip.task.createdAt))}
            {' → '}
            {tooltip.task.completedAt
              ? formatTime(new Date(tooltip.task.completedAt))
              : '進行中'}
          </div>
          {tooltip.task.assigneeAgentId && (
            <div className="text-[10px] mt-0.5 text-text-muted">
              Agent: {agentMap.get(tooltip.task.assigneeAgentId) ?? tooltip.task.assigneeAgentId}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TimelineView;
