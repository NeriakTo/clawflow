/**
 * StatusBadge — 狀態標籤元件
 */
import type { TaskStatus } from '../types';

interface StatusBadgeProps {
  readonly status: TaskStatus;
}

const STATUS_CONFIG: Record<TaskStatus, { readonly label: string; readonly style: { backgroundColor: string; color: string } }> = {
  backlog: { label: '待辦列', style: { backgroundColor: 'rgba(113,113,122,0.15)', color: '#a1a1aa' } },
  todo: { label: '待處理', style: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' } },
  in_progress: { label: '進行中', style: { backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' } },
  review: { label: '審查中', style: { backgroundColor: 'rgba(234,179,8,0.15)', color: '#fbbf24' } },
  done: { label: '已完成', style: { backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399' } },
  archived: { label: '已歸檔', style: { backgroundColor: 'rgba(113,113,122,0.15)', color: '#71717a' } },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={config.style}
    >
      {config.label}
    </span>
  );
}

export default StatusBadge;
