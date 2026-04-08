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
      className={`rounded-lg p-3 cursor-pointer transition-colors select-none ${
        isDragging ? 'opacity-50' : ''
      }`}
      style={{
        backgroundColor: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
    >
      {/* 標題列 */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium leading-tight text-text">
          {task.title}
        </h4>
        <PriorityBadge priority={task.priority} />
      </div>

      {/* Progress bar */}
      {task.progress > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div
            className="flex-1 h-1 rounded-full"
            style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${task.progress}%`,
                backgroundColor: task.progress === 100 ? '#22c55e' : '#5e6ad2',
              }}
            />
          </div>
          <span className="text-[10px] flex-shrink-0 text-text-muted font-['Fira_Code']">
            {task.progress}%
          </span>
        </div>
      )}

      {/* 底部資訊 */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <div className="flex items-center gap-2">
          {task.assigneeAgentId && (
            <span
              className="px-1.5 py-0.5 rounded text-text-secondary text-xs"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              {task.assigneeAgentId}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="rounded-full px-1.5 py-0.5 text-xs"
              style={{
                backgroundColor: 'rgba(94,106,210,0.15)',
                color: '#828fff',
              }}
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-text-faint">+{task.tags.length - 2}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default TaskCard;
