/**
 * PriorityBadge — 優先級標籤
 */
import type { TaskPriority } from '../types';

interface PriorityBadgeProps {
  readonly priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly bg: string; readonly text: string }> = {
  critical: { label: '緊急', bg: '#450a0a', text: '#ef4444' },
  high: { label: '高', bg: '#431407', text: '#f97316' },
  medium: { label: '中', bg: '#172554', text: '#3b82f6' },
  low: { label: '低', bg: '#1e293b', text: '#64748b' },
};

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

export default PriorityBadge;
