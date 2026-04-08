/**
 * PriorityBadge — 優先級標籤
 */
import type { TaskPriority } from '../types';

interface PriorityBadgeProps {
  readonly priority: TaskPriority;
}

const PRIORITY_CONFIG: Record<TaskPriority, { readonly label: string; readonly style: { backgroundColor: string; color: string } }> = {
  critical: { label: '緊急', style: { backgroundColor: 'rgba(239,68,68,0.15)', color: '#f87171' } },
  high: { label: '高', style: { backgroundColor: 'rgba(234,179,8,0.15)', color: '#fbbf24' } },
  medium: { label: '中', style: { backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa' } },
  low: { label: '低', style: { backgroundColor: 'rgba(113,113,122,0.15)', color: '#a1a1aa' } },
};

function PriorityBadge({ priority }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority];

  return (
    <span
      className="text-xs px-1.5 py-0.5 rounded-md"
      style={config.style}
    >
      {config.label}
    </span>
  );
}

export default PriorityBadge;
