/**
 * DagView -- DAG 視圖（依賴關係圖）
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Task, TaskStatus } from '../types';
import { useTaskStore } from '../stores/task.store';
import { useAgentStore } from '../stores/agent.store';
import DagTaskNode from '../components/DagTaskNode';
import TaskModal from '../components/TaskModal';

/** 狀態對應顏色（MiniMap 用） */
const STATUS_COLOR_MAP: Record<TaskStatus, string> = {
  backlog: '#71717a',
  todo: '#71717a',
  in_progress: '#3b82f6',
  review: '#eab308',
  done: '#22c55e',
  archived: '#71717a',
};

/** 自訂節點類型 */
const nodeTypes: NodeTypes = {
  dagTask: DagTaskNode,
};

/** 節點尺寸常數 */
const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;
const NODE_GAP_X = 60;
const NODE_GAP_Y = 80;

/**
 * 拓撲排序佈局 — 基於 Kahn's algorithm
 * 將任務依據依賴關係分層，每層內水平排列
 */
function layoutGraph(
  tasks: readonly Task[],
  agentMap: ReadonlyMap<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const taskIds = new Set(tasks.map((t) => t.id));
  const edges: Edge[] = [];

  // 建立入度表與鄰接表
  const inDegree = new Map<string, number>();
  const children = new Map<string, string[]>();

  for (const task of tasks) {
    inDegree.set(task.id, 0);
    children.set(task.id, []);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) continue;
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
      const parentChildren = children.get(depId) ?? [];
      children.set(depId, [...parentChildren, task.id]);

      edges.push({
        id: `${depId}->${task.id}`,
        source: depId,
        target: task.id,
        animated: true,
        style: { stroke: '#8a8f98' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#8a8f98' },
      });
    }
  }

  // Kahn's algorithm — 分層
  const layers: string[][] = [];
  let queue = tasks
    .filter((t) => (inDegree.get(t.id) ?? 0) === 0)
    .map((t) => t.id);

  while (queue.length > 0) {
    layers.push([...queue]);
    const nextQueue: string[] = [];
    for (const nodeId of queue) {
      for (const childId of children.get(nodeId) ?? []) {
        const newDeg = (inDegree.get(childId) ?? 1) - 1;
        inDegree.set(childId, newDeg);
        if (newDeg === 0) {
          nextQueue.push(childId);
        }
      }
    }
    queue = nextQueue;
  }

  // 處理環狀（理論上不應出現，但防禦性處理）
  const placed = new Set(layers.flat());
  const remaining = tasks.filter((t) => !placed.has(t.id)).map((t) => t.id);
  if (remaining.length > 0) {
    layers.push(remaining);
  }

  // 建立 node 並計算位置
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const nodes: Node[] = [];

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    const layerWidth = layer.length * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X;
    const startX = -layerWidth / 2;

    for (let colIdx = 0; colIdx < layer.length; colIdx++) {
      const taskId = layer[colIdx];
      const task = taskMap.get(taskId);
      if (!task) continue;

      nodes.push({
        id: task.id,
        type: 'dagTask',
        position: {
          x: startX + colIdx * (NODE_WIDTH + NODE_GAP_X),
          y: layerIdx * (NODE_HEIGHT + NODE_GAP_Y),
        },
        data: {
          label: task.title,
          status: task.status,
          progress: task.progress,
          assignee: task.assigneeAgentId
            ? agentMap.get(task.assigneeAgentId) ?? task.assigneeAgentId
            : undefined,
          priority: task.priority,
          taskId: task.id,
        },
      });
    }
  }

  return { nodes, edges };
}

function DagView() {
  const tasks = useTaskStore((s) => s.tasks);
  const loading = useTaskStore((s) => s.loading);
  const fetchTasks = useTaskStore((s) => s.fetchTasks);
  const agents = useAgentStore((s) => s.agents);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  /** Agent ID -> 名稱 對照 */
  const agentMap = useMemo(
    () => new Map(agents.map((a) => [a.id, a.name])),
    [agents],
  );

  /** 從任務列表計算圖表 */
  const { layoutNodes, layoutEdges } = useMemo(() => {
    const { nodes, edges } = layoutGraph(tasks, agentMap);
    return { layoutNodes: nodes, layoutEdges: edges };
  }, [tasks, agentMap]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // 當任務資料更新時重新佈局
  useEffect(() => {
    setNodes(layoutNodes);
    setEdges(layoutEdges);
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);

  /** 點擊節點 -> 開啟任務詳情 */
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      const task = tasks.find((t) => t.id === node.id);
      if (task) {
        setSelectedTask(task);
      }
    },
    [tasks],
  );

  /** MiniMap 節點顏色 */
  const miniMapNodeColor = useCallback((node: Node): string => {
    const status = (node.data as Record<string, unknown>)['status'] as TaskStatus | undefined;
    return status ? STATUS_COLOR_MAP[status] : '#71717a';
  }, []);

  if (loading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        載入中...
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <div className="text-lg font-medium mb-1 text-text-secondary">
            尚無任務
          </div>
          <p className="text-sm">在看板中新增任務後，這裡會顯示依賴關係圖</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-bg">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#28282c" gap={20} />
        <Controls
          style={{
            backgroundColor: '#0f1011',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
          }}
        />
        <MiniMap
          nodeColor={miniMapNodeColor}
          style={{
            backgroundColor: '#0f1011',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0.5rem',
          }}
        />
      </ReactFlow>

      {/* 任務詳情 Modal */}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

export default DagView;
