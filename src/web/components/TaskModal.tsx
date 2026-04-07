/**
 * TaskModal — 任務詳情 Modal（可編輯）
 */
import { useState, useEffect, type FormEvent } from 'react';
import type { Task, TaskStatus, TaskPriority } from '../types';
import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';
import { useTaskStore } from '../stores/task.store';

interface TaskModalProps {
  readonly task: Task;
  readonly onClose: () => void;
}

const STATUS_OPTIONS: readonly TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done', 'archived'];
const PRIORITY_OPTIONS: readonly TaskPriority[] = ['critical', 'high', 'medium', 'low'];

function TaskModal({ task, onClose }: TaskModalProps) {
  const updateTask = useTaskStore((s) => s.updateTask);
  const deleteTask = useTaskStore((s) => s.deleteTask);

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [tags, setTags] = useState(task.tags.join(', '));
  const [saving, setSaving] = useState(false);

  // 同步外部更新
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? '');
    setStatus(task.status);
    setPriority(task.priority);
    setTags(task.tags.join(', '));
  }, [task]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateTask(task.id, {
        title,
        description: description || undefined,
        status,
        priority,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        assigneeAgentId: undefined,
        progress: undefined,
        completedAt: undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('確定要刪除此任務嗎？')) return;
    await deleteTask(task.id);
    onClose();
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <form onSubmit={handleSave}>
          {/* 標頭 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              <PriorityBadge priority={priority} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm px-2 py-1 rounded hover:opacity-80"
              style={{ color: 'var(--color-text-muted)' }}
            >
              ✕
            </button>
          </div>

          {/* 標題 */}
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-lg mb-3 text-sm focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              '--tw-ring-color': 'var(--color-primary)',
            } as React.CSSProperties}
            placeholder="任務標題"
          />

          {/* 描述 */}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-lg mb-3 text-sm resize-none focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-bg)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              '--tw-ring-color': 'var(--color-primary)',
            } as React.CSSProperties}
            placeholder="任務描述（選填）"
          />

          {/* 狀態 & 優先級 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>狀態</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>優先級</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                style={{
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags */}
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>標籤（逗號分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
              placeholder="例：frontend, urgent"
            />
          </div>

          {/* 依賴關係 */}
          {task.dependencies.length > 0 && (
            <div className="mb-3">
              <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>依賴任務</label>
              <div className="flex flex-wrap gap-1">
                {task.dependencies.map((depId) => (
                  <span
                    key={depId}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
                  >
                    {depId.slice(0, 8)}...
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 進度 */}
          <div className="mb-4">
            <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
              進度：{task.progress}%
            </label>
            <div className="w-full h-2 rounded-full" style={{ backgroundColor: 'var(--color-border)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${task.progress}%`,
                  backgroundColor: task.progress === 100 ? 'var(--color-success)' : 'var(--color-primary)',
                }}
              />
            </div>
          </div>

          {/* 按鈕列 */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={handleDelete}
              className="px-3 py-1.5 rounded text-sm font-medium"
              style={{ color: 'var(--color-danger)' }}
            >
              刪除
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded text-sm font-medium"
                style={{ backgroundColor: 'var(--color-border)', color: 'var(--color-text)' }}
              >
                取消
              </button>
              <button
                type="submit"
                disabled={saving || !title.trim()}
                className="px-4 py-1.5 rounded text-sm font-medium text-white disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskModal;
