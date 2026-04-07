/**
 * StatusBadge — 狀態標籤元件
 */
import type { TaskStatus } from '../types';

interface StatusBadgeProps {
  readonly status: TaskStatus;
}

const STATUS_CONFIG: Record<TaskStatus, { readonly label: string; readonly classes: string }> = {
  backlog: { label: '待辦列', classes: 'bg-gray-500/20 text-gray-400' },
  todo: { label: '待處理', classes: 'bg-blue-500/20 text-blue-400' },
  in_progress: { label: '進行中', classes: 'bg-green-500/20 text-green-400' },
  review: { label: '審查中', classes: 'bg-yellow-500/20 text-yellow-400' },
  done: { label: '已完成', classes: 'bg-emerald-500/20 text-emerald-400' },
  archived: { label: '已歸檔', classes: 'bg-gray-500/20 text-gray-500' },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.classes}`}>
      {config.label}
    </span>
  );
}

export default StatusBadge;
