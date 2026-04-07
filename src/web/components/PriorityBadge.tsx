/**
 * PriorityBadge — 優先級標籤
 */
import type { TaskPriority } from '../types';

interface PriorityBadgeProps {
  readonly priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly bg: string; readonly text: string }> = {
  critical: { label: '緊急', bg: '#3b1219', text: '#f87171' },
  high: { label: '高', bg: '#3b2506', text: '#fbbf24' },
  medium: { label: '中', bg: '#152040', text: '#4f8ff7' },
  low: { label: '低', bg: '#1a2438', text: '#4a5f82' },
};

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className="inline-flex items-center px-1.5 py-px rounded-full text-[10px] font-medium leading-tight"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

export default PriorityBadge;
