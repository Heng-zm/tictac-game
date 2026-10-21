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
            'pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold leading-snug shadow-soft backdrop-blur-md',
            shutdown || offline
              ? 'border-danger/30 bg-danger/15 text-danger'
              : connecting
                ? 'border-accent/30 bg-accent/10 text-accent'
                : 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-300',
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
}: {
  active: NavName;
  onNavigate: (path: string) => void;
}) {
  const items = [
    { name: 'home' as const, label: 'Play', icon: Home, path: '/' },
    { name: 'leaderboard' as const, label: 'Ranks', icon: Trophy, path: '/leaderboard' },
    { name: 'profile' as const, label: 'Profile', icon: User, path: '/profile' },
  ];
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/80 bg-surface/85 backdrop-blur-xl"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-[560px] items-stretch justify-around px-3 pb-[calc(env(safe-area-inset-bottom)+6px)] pt-1.5">
        {items.map((item) => {
          const selected = active === item.name;
          const Icon = item.icon;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onNavigate(item.path)}
              aria-current={selected ? 'page' : undefined}
              className={cn(
                'group flex min-w-[76px] flex-col items-center gap-0.5 rounded-2xl px-3 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                selected ? 'text-accent' : 'text-muted hover:text-ink',
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-10 items-center justify-center rounded-full transition',
                  selected && 'bg-accent/10',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
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
        'mx-auto w-full max-w-[560px] px-4 pt-[calc(env(safe-area-inset-top)+14px)]',
        withNav ? 'pb-[calc(env(safe-area-inset-bottom)+86px)]' : 'pb-[calc(env(safe-area-inset-bottom)+24px)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
