/**
 * TaskCard — 看板任務卡片
 */
import { useState, type DragEvent } from 'react';
import type { Task } from '../types';
import PriorityBadge from './PriorityBadge';

interface TaskCardProps {
  readonly task: Task;
  readonly onOpen: (task: Task) => void;
}

function TaskCard({ task, onOpen }: TaskCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  }

  function handleDragEnd() {
    setIsDragging(false);
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={() => onOpen(task)}
      className="rounded-lg p-3 cursor-pointer transition-all hover:brightness-110 select-none"
      style={{
        backgroundColor: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      {/* 標題列 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium leading-tight" style={{ color: 'var(--color-text)' }}>
          {task.title}
        </h4>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="w-full h-1.5 rounded-full mb-2" style={{ backgroundColor: 'var(--color-border)' }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${task.progress}%`,
              backgroundColor: task.progress === 100 ? 'var(--color-success)' : 'var(--color-primary)',
            }}
          />
        </div>
      )}

      {/* 底部資訊 */}
      <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <div className="flex items-center gap-2">
          {task.assigneeAgentId && (
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-border)' }}>
              {task.assigneeAgentId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded"
              style={{ backgroundColor: '#1e3a5f', color: '#60a5fa' }}
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span style={{ color: 'var(--color-text-muted)' }}>+{task.tags.length - 2}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
