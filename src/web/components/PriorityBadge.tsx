/**
 * PriorityBadge — 優先級標籤
 */
import type { TaskPriority } from '../types';

interface PriorityBadgeProps {
  readonly priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly classes: string }> = {
  critical: { label: '緊急', classes: 'bg-red-500/20 text-red-400' },
  high: { label: '高', classes: 'bg-orange-500/20 text-orange-400' },
  medium: { label: '中', classes: 'bg-blue-500/20 text-blue-400' },
  low: { label: '低', classes: 'bg-gray-500/20 text-gray-400' },
};

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-md ${config.classes}`}>
      {config.label}
    </span>
  );
}

export default PriorityBadge;
