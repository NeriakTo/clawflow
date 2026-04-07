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
         style={{
           backgroundColor: 'var(--color-card)',
           borderColor: 'var(--color-border)',
           boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
         }}>
      <div className="flex items-center gap-6">
        <span className="text-lg font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
          clawflow
        </span>
        <div className="flex gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.route;
            return (
              <button
                key={item.route}
                onClick={() => onNavigate(item.route)}
                className="px-3 py-1.5 rounded text-sm font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? 'rgba(79, 143, 247, 0.12)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  borderLeft: isActive ? '3px solid var(--color-primary)' : '3px solid transparent',
                }}
              >
                {item.label}
              </button>
            );
          })}
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
