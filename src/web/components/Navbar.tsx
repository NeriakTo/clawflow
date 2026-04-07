/**
 * Navbar — 導航列
 */
import type { ViewRoute } from '../types';
import { useWsStore } from '../stores/ws.store';

interface NavbarProps {
  readonly currentView: ViewRoute;
  readonly onNavigate: (view: ViewRoute) => void;
}

const NAV_ITEMS: readonly { readonly route: ViewRoute; readonly label: string }[] = [
  { route: 'board', label: '看板' },
  { route: 'dag', label: 'DAG' },
  { route: 'timeline', label: '時間軸' },
  { route: 'agent', label: 'Agent' },
  { route: 'dashboard', label: '儀表板' },
];

function Navbar({ currentView, onNavigate }: NavbarProps) {
  const connected = useWsStore((s) => s.connected);

  return (
    <nav className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold text-accent font-['Fira_Code']">
          clawflow
        </span>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.route;
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-surface2 text-accent border-b-2 border-accent'
                    : 'text-text-secondary hover:bg-surface2'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${
            connected ? 'bg-success' : 'bg-danger'
          }`}
        />
        {connected ? '已連線' : '已斷線'}
      </div>
    </nav>
  );
}

export default Navbar;
