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
    <nav className="flex items-center justify-between px-6 py-3 border-b"
         style={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }}>
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold" style={{ color: 'var(--color-primary)' }}>
          clawflow
        </span>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.route}
              onClick={() => onNavigate(item.route)}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: currentView === item.route ? 'var(--color-primary)' : 'transparent',
                color: currentView === item.route ? '#fff' : 'var(--color-text-secondary)',
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ backgroundColor: connected ? 'var(--color-success)' : 'var(--color-danger)' }}
        />
        {connected ? '已連線' : '已斷線'}
      </div>
    </nav>
  );
}

export default Navbar;
