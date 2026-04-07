/**
 * DagTaskNode — DAG 視圖自訂節點
 */
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { TaskStatus } from '../types';

interface DagTaskNodeData {
  readonly label: string;
  readonly status: TaskStatus;
  readonly progress: number;
  readonly assignee: string | undefined;
  readonly priority: string;
  readonly taskId: string;
}

/** 狀態對應顏色 */
const STATUS_COLOR_MAP: Record<TaskStatus, string> = {
  backlog: '#64748b',
  todo: '#64748b',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  done: '#22c55e',
  archived: '#64748b',
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

function DagTaskNode({ data }: NodeProps) {
  const nodeData = data as unknown as DagTaskNodeData;
  const borderColor = STATUS_COLOR_MAP[nodeData.status] ?? '#64748b';
  const statusLabel = STATUS_LABEL_MAP[nodeData.status] ?? nodeData.status;

  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[180px] max-w-[240px] shadow-lg"
      style={{
        backgroundColor: 'var(--color-card)',
        border: `2px solid ${borderColor}`,
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: borderColor }} />

      {/* 標題 */}
      <div className="text-xs font-medium mb-1.5 leading-tight" style={{ color: 'var(--color-text)' }}>
        {nodeData.label}
      </div>

      {/* 狀態標籤 */}
      <div className="flex items-center gap-1.5 mb-1.5">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: borderColor }}
        />
        <span className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
          {statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      {nodeData.progress > 0 && (
        <div
          className="w-full h-1 rounded-full mb-1.5"
          style={{ backgroundColor: 'var(--color-border)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${nodeData.progress}%`,
              backgroundColor: nodeData.progress === 100 ? 'var(--color-success)' : 'var(--color-primary)',
            }}
          />
        </div>
      )}

      {/* Assignee */}
      {nodeData.assignee && (
        <div className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
          {nodeData.assignee}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ background: borderColor }} />
    </div>
  );
}

export default memo(DagTaskNode);
