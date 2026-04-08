/**
 * CreateTaskModal — 新增任務 Modal
 */
import { useState, type FormEvent } from 'react';
import type { TaskPriority, CreateTaskDto } from '../types';
import { useTaskStore } from '../stores/task.store';

interface CreateTaskModalProps {
  readonly onClose: () => void;
}

const PRIORITY_OPTIONS: readonly TaskPriority[] = ['critical', 'high', 'medium', 'low'];

/** 共用的 input/select 樣式 */
const inputStyle = {
  backgroundColor: '#1a1a1f',
  border: '1px solid #2e2e38',
};

function CreateTaskModal({ onClose }: CreateTaskModalProps) {
  const createTask = useTaskStore((s) => s.createTask);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [tags, setTags] = useState('');
  const [assignee, setAssignee] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    try {
      const dto: CreateTaskDto = {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        assigneeAgentId: assignee.trim() || undefined,
      };
      await createTask(dto);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <h2 className="text-lg font-medium mb-4 text-text">
          新增任務
        </h2>
        <form onSubmit={handleSubmit}>
          {/* 標題 */}
          <div className="mb-3">
            <label className="block text-xs mb-1 text-text-muted">
              標題 <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent text-text placeholder:text-text-faint"
              style={inputStyle}
              placeholder="輸入任務標題"
            />
          </div>

          {/* 描述 */}
          <div className="mb-3">
            <label className="block text-xs mb-1 text-text-muted">描述</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent text-text placeholder:text-text-faint"
              style={inputStyle}
              placeholder="任務描述（選填）"
            />
          </div>

          {/* 優先級 */}
          <div className="mb-3">
            <label className="block text-xs mb-1 text-text-muted">優先級</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none text-text"
              style={inputStyle}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Tags */}
          <div className="mb-3">
            <label className="block text-xs mb-1 text-text-muted">標籤（逗號分隔）</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none text-text placeholder:text-text-faint"
              style={inputStyle}
              placeholder="例：frontend, urgent"
            />
          </div>

          {/* Assignee */}
          <div className="mb-4">
            <label className="block text-xs mb-1 text-text-muted">指派 Agent</label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full px-3 py-2 rounded-md text-sm focus:outline-none text-text placeholder:text-text-faint"
              style={inputStyle}
              placeholder="Agent ID（選填）"
            />
          </div>

          {/* 按鈕 */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-text"
              style={{
                backgroundColor: '#1a1a1f',
                border: '1px solid #2e2e38',
              }}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50 bg-accent"
            >
              {saving ? '建立中...' : '建立'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateTaskModal;
