/**
 * App — 根元件（state-based routing）
 */
import { useState, useEffect } from 'react';
import type { ViewRoute, WsEvent } from './types';
import { useWsStore } from './stores/ws.store';
import { useTaskStore } from './stores/task.store';
import { useAgentStore } from './stores/agent.store';
import Navbar from './components/Navbar';
import BoardView from './views/BoardView';
import DagView from './views/DagView';
import TimelineView from './views/TimelineView';
import AgentView from './views/AgentView';
import DashboardView from './views/DashboardView';

function App() {
  const [currentView, setCurrentView] = useState<ViewRoute>('board');

  const wsConnect = useWsStore((s) => s.connect);
  const wsDisconnect = useWsStore((s) => s.disconnect);
  const wsSubscribe = useWsStore((s) => s.subscribe);
  const handleTaskEvent = useTaskStore((s) => s.handleTaskEvent);
  const handleAgentEvent = useAgentStore((s) => s.handleAgentEvent);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);

  // 初始化 WebSocket 連線
  useEffect(() => {
    wsConnect();
    void fetchAgents();
    return () => {
      wsDisconnect();
    };
  }, [wsConnect, wsDisconnect, fetchAgents]);

  // 訂閱 WebSocket 事件，分派到對應 store
  useEffect(() => {
    const unsubscribe = wsSubscribe((event: WsEvent) => {
      if (event.event.startsWith('task.')) {
        handleTaskEvent(event);
      } else if (event.event.startsWith('agent.')) {
        handleAgentEvent(event);
      }
    });
    return unsubscribe;
  }, [wsSubscribe, handleTaskEvent, handleAgentEvent]);

  function renderView() {
    switch (currentView) {
      case 'board':
        return <BoardView />;
      case 'dag':
        return <DagView />;
      case 'timeline':
        return <TimelineView />;
      case 'agent':
        return <AgentView />;
      case 'dashboard':
        return <DashboardView />;
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Navbar currentView={currentView} onNavigate={setCurrentView} />
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
}

export default App;
