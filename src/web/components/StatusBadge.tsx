/**
 * StatusBadge — 狀態標籤元件
 */
import type { TaskStatus } from '../types';

interface StatusBadgeProps {
  readonly status: TaskStatus;
}

const STATUS_CONFIG: Record<TaskStatus, { readonly label: string; readonly bg: string; readonly text: string }> = {
  backlog: { label: '待辦列', bg: '#334155', text: '#94a3b8' },
  todo: { label: '待處理', bg: '#1e3a5f', text: '#60a5fa' },
  in_progress: { label: '進行中', bg: '#1a3a2a', text: '#4ade80' },
  review: { label: '審查中', bg: '#3b2f1a', text: '#fbbf24' },
  done: { label: '已完成', bg: '#14532d', text: '#22c55e' },
  archived: { label: '已歸檔', bg: '#1e1e2e', text: '#64748b' },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
