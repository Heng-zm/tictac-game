import { useEffect, useState, type ReactNode } from 'react';
import { Home, RefreshCw, Trophy, User, WifiOff } from 'lucide-react';
import { cn } from '../lib/cn';
import type { ConnectionStatus } from '../hooks/use-game-client';

export function ConnectionBanner({
  connection,
  onRetry,
}: {
  connection: ConnectionStatus;
  onRetry: () => void;
}) {
  const [browserOnline, setBrowserOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setBrowserOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  const offline = !browserOnline;
  const hidden = connection === 'online' && !offline;
  if (hidden) return null;

  const shutdown = connection === 'shutdown';
  const connecting = connection === 'idle' || connection === 'connecting';
  const message = shutdown
    ? 'Server restarting — your game is safe.'
    : offline
      ? 'Offline — moves sync when you reconnect.'
      : connecting
        ? 'Connecting to the game…'
        : 'Reconnecting to the game…';

  return (
    <>
      {/* Keep the fixed status pill from covering the page header. Page already
          adds the safe-area inset, so this only reserves the pill's own height. */}
      <div className="h-11" aria-hidden />
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-[calc(env(safe-area-inset-top)+8px)]"
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            'pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium leading-snug shadow-soft backdrop-blur-md',
            shutdown || offline
              ? 'border-danger/25 bg-danger/10 text-danger'
              : connecting
                ? 'border-accent/25 bg-surface/95 text-accent'
                : 'border-line bg-surface/95 text-ink',
          )}
        >
          {shutdown || offline ? (
            <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
          )}
          <span className="min-w-0">{message}</span>
          {(offline || shutdown) && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Retry
            </button>
          )}
        </div>
      </div>
    </>
  );
}

type NavName = 'home' | 'leaderboard' | 'profile';

export function BottomNav({
  active,
  onNavigate,
  hasActiveGame = false,
}: {
  active: NavName;
  onNavigate: (path: string) => void;
  hasActiveGame?: boolean;
}) {
  const items = [
    { name: 'home' as const, label: 'Play', icon: Home, path: '/' },
    { name: 'leaderboard' as const, label: 'Ranks', icon: Trophy, path: '/leaderboard' },
    { name: 'profile' as const, label: 'Profile', icon: User, path: '/profile' },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)]"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-[520px] items-stretch gap-1 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-soft backdrop-blur-xl">
        {items.map((item) => {
          const selected = active === item.name;
          const Icon = item.icon;
          const showActiveGame = item.name === 'home' && hasActiveGame;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={selected ? 'page' : undefined}
              aria-label={showActiveGame ? `${item.label} (game in progress)` : undefined}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                selected ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-elevated hover:text-ink',
              )}
            >
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden />
                {showActiveGame ? (
                  <span
                    className="absolute -right-1.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-accent ring-2 ring-surface"
                    aria-hidden
                  />
                ) : null}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function Page({
  children,
  className,
  withNav = false,
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[520px] px-5 pt-[calc(env(safe-area-inset-top)+16px)]',
        withNav ? 'pb-[calc(env(safe-area-inset-bottom)+100px)]' : 'pb-[calc(env(safe-area-inset-bottom)+28px)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
