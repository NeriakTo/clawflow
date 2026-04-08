/**
 * BoardView — 看板視圖（Kanban）
 */
import { useState, useEffect, useCallback, type DragEvent } from 'react';
import type { Task, TaskStatus, TaskPriority } from '../types';
import { useTaskStore } from '../stores/task.store';
import { useAgentStore } from '../stores/agent.store';
import TaskCard from '../components/TaskCard';
import TaskModal from '../components/TaskModal';
import CreateTaskModal from '../components/CreateTaskModal';

/** 看板欄位定義 */
const BOARD_COLUMNS: readonly { readonly status: TaskStatus; readonly label: string; readonly color: string }[] = [
  { status: 'backlog', label: '待辦列', color: '#71717a' },
  { status: 'todo', label: '待處理', color: '#71717a' },
  { status: 'in_progress', label: '進行中', color: '#3b82f6' },
  { status: 'review', label: '審查中', color: '#eab308' },
  { status: 'done', label: '已完成', color: '#22c55e' },
];

const PRIORITY_OPTIONS: readonly TaskPriority[] = ['critical', 'high', 'medium', 'low'];

function BoardView() {
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const error = useTaskStore((s) => s.error);
  const filters = useTaskStore((s) => s.filters);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const setFilters = useTaskStore((s) => s.setFilters);
  const updateTask = useTaskStore((s) => s.updateTask);
  const agents = useAgentStore((s) => s.agents);

  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  /** 篩選後的任務 */
  const filteredTasks = tasks.filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchTag = t.tags.some((tag) => tag.toLowerCase().includes(q));
      if (!matchTitle && !matchTag) return false;
    }
    if (filters.priority && t.priority !== filters.priority) return false;
    if (filters.assignee && t.assigneeAgentId !== filters.assignee) return false;
    if (filters.tag && !t.tags.includes(filters.tag)) return false;
    return true;
  });

  /** 取得某欄的任務 */
  const getColumnTasks = useCallback(
    (status: TaskStatus): readonly Task[] =>
      filteredTasks.filter((t) => t.status === status),
    [filteredTasks],
  );

  /** 拖拉相關 handler */
  function handleDragOver(e: DragEvent<HTMLDivElement>, status: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(status);
  }

  function handleDragLeave() {
    setDragOverColumn(null);
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>, targetStatus: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    await updateTask(taskId, {
      title: undefined,
      description: undefined,
      status: targetStatus,
      priority: undefined,
      assigneeAgentId: undefined,
      tags: undefined,
      progress: undefined,
      completedAt: undefined,
    });
  }

  /** 收集所有不重複的 tags */
  const allTags = [...new Set(tasks.flatMap((t) => [...t.tags]))];

  /** 共用的 input/select 樣式 */
  const inputStyle = {
    backgroundColor: '#1a1a1f',
    border: '1px solid #2e2e38',
  };

  return (
    <div className="flex flex-col h-full">
      {/* 頂部工具列 */}
      <div
        className="flex items-center gap-4 px-6 py-4"
        style={{ borderBottom: '1px solid #24242b' }}
      >
        {/* 搜尋 */}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋任務..."
          className="px-3 py-1.5 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-accent w-64 text-text placeholder:text-text-faint"
          style={inputStyle}
        />

        {/* 優先級篩選 */}
        <select
          value={filters.priority ?? ''}
          onChange={(e) => { const v = e.target.value; setFilters({ ...filters, priority: v ? v as TaskPriority : undefined }); }}
          className="px-3 py-1.5 rounded-md text-sm focus:outline-none text-text"
          style={inputStyle}
        >
          <option value="">所有優先級</option>
          {PRIORITY_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Agent 篩選 */}
        <select
          value={filters.assignee ?? ''}
          onChange={(e) => { const v = e.target.value; setFilters({ ...filters, assignee: v || undefined }); }}
          className="px-3 py-1.5 rounded-md text-sm focus:outline-none text-text"
          style={inputStyle}
        >
          <option value="">所有 Agent</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        {/* Tag 篩選 */}
        <select
          value={filters.tag ?? ''}
          onChange={(e) => { const v = e.target.value; setFilters({ ...filters, tag: v || undefined }); }}
          className="px-3 py-1.5 rounded-md text-sm focus:outline-none text-text"
          style={inputStyle}
        >
          <option value="">所有標籤</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        <div className="flex-1" />

        {/* 新增任務按鈕 */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 rounded-md text-sm font-medium text-white bg-accent hover:opacity-90 transition-opacity"
        >
          + 新增任務
        </button>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div
          className="mx-4 mt-2 px-3 py-2 rounded-md text-sm text-danger"
          style={{
            backgroundColor: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
          }}
        >
          {error}
        </div>
      )}

      {/* 載入中 */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-text-muted">
          載入中...
        </div>
      )}

      {/* 看板欄位 */}
      <div className="flex-1 flex gap-4 p-5 overflow-x-auto">
        {BOARD_COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.status);
          const isDragOver = dragOverColumn === col.status;

          return (
            <div
              key={col.status}
              className="flex flex-col min-w-[300px] w-[300px] rounded-xl transition-colors"
              style={{
                backgroundColor: isDragOver ? 'rgba(94,106,210,0.05)' : '#1a1a1f',
                border: isDragOver
                  ? '1px solid #5e6ad2'
                  : '1px solid #24242b',
              }}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* 欄位標頭 */}
              <div
                className="flex items-center gap-2 px-4 py-4"
                style={{ borderBottom: '1px solid #24242b' }}
              >
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: col.color }}
                />
                <span className="font-medium text-sm text-text">
                  {col.label}
                </span>
                <span
                  className="text-xs px-1.5 py-0.5 rounded-md font-['Fira_Code']"
                  style={{
                    backgroundColor: '#24242b',
                    color: '#8a8f98',
                  }}
                >
                  {columnTasks.length}
                </span>
              </div>

              {/* 卡片列表 */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px]">
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={setSelectedTask}
                  />
                ))}
                {columnTasks.length === 0 && !loading && (
                  <div className="text-center py-8 text-sm text-text-faint">
                    尚無任務
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
      {showCreateModal && (
        <CreateTaskModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  );
}

export default BoardView;
