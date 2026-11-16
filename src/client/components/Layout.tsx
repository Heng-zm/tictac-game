import { useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import { Home, RefreshCw, Trophy, User, WifiOff } from 'lucide-react';
import { cn } from '../lib/cn';
import { hapticSelection } from '../lib/telegram';
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
            'pointer-events-auto flex max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-2xl border px-3.5 py-1.5 text-xs font-semibold leading-snug shadow-soft backdrop-blur-xl animate-fade-down transition-all duration-200',
            shutdown || offline
              ? 'border-danger/40 bg-danger/10 text-danger shadow-[0_0_16px_rgba(239,68,68,0.2)]'
              : connecting
                ? 'border-accent/40 bg-surface/90 text-accent shadow-[0_0_16px_rgba(37,99,235,0.2)]'
                : 'border-line/80 bg-surface/90 text-ink',
          )}
        >
          {shutdown || offline ? (
            <WifiOff className="h-3.5 w-3.5 shrink-0 text-danger" aria-hidden />
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
              className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold underline-offset-2 hover:underline hover:bg-danger/15 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50 transition-colors"
            >
              <RefreshCw className="h-3 w-3 transition-transform duration-300 hover:rotate-180" aria-hidden />
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
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/90 backdrop-blur-xl shadow-[0_-8px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-8px_30px_rgba(0,0,0,0.4)] md:bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-[440px] md:rounded-full md:border md:shadow-2xl md:px-2 md:py-1.5 transition-all duration-200"
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-[560px] items-stretch gap-1.5 px-3 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 sm:px-4 md:p-0">
        {items.map((item) => {
          const selected = active === item.name;
          const Icon = item.icon;
          const showActiveGame = item.name === 'home' && hasActiveGame;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => {
                hapticSelection();
                onNavigate(item.path);
              }}
              aria-current={selected ? 'page' : undefined}
              aria-label={showActiveGame ? `${item.label} (game in progress)` : item.label}
              className={cn(
                'group relative flex flex-1 flex-col items-center gap-1 rounded-2xl border border-transparent px-2 py-2 text-[10px] font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 md:flex-row md:justify-center md:gap-2 md:py-2 md:text-xs md:rounded-full',
                selected
                  ? 'border-accent/25 bg-accent/10 text-accent font-bold shadow-sm shadow-accent/10 ring-1 ring-accent/20'
                  : 'text-muted hover:bg-elevated/70 hover:text-ink',
              )}
            >
              <span className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-200 group-hover:scale-115 group-active:scale-90',
                    selected ? 'animate-icon-pop text-accent scale-110' : 'text-muted group-hover:text-ink',
                  )}
                  aria-hidden
                />
                {showActiveGame ? (
                  <span className="absolute -right-1 -top-0.5 flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-surface shadow-[0_0_8px_rgba(37,99,235,0.9)]" />
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
              {selected ? (
                <span
                  className="absolute bottom-1 h-0.5 w-3.5 rounded-full bg-accent shadow-[0_0_6px_rgba(37,99,235,0.7)] md:hidden transition-all duration-200"
                  aria-hidden
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

type PageWidth = 'narrow' | 'medium' | 'wide';

const pageWidths: Record<PageWidth, string> = {
  narrow: 'max-w-[520px]',
  medium: 'max-w-[520px] md:max-w-[720px]',
  wide: 'max-w-[520px] md:max-w-[760px] lg:max-w-[1040px]',
};

export function Page({
  children,
  className,
  withNav = false,
  width = 'narrow',
  ambient = false,
}: {
  children: ReactNode;
  className?: string;
  withNav?: boolean;
  width?: PageWidth;
  ambient?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-full px-4 pt-[calc(env(safe-area-inset-top)+16px)] sm:px-5 md:px-6 md:pt-7',
        pageWidths[width],
        withNav ? 'page-with-nav' : 'pb-[calc(env(safe-area-inset-bottom)+28px)] md:pb-10',
        className,
      )}
    >
      {ambient ? (
        <div
          className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-36 w-72 rounded-full bg-accent/8 blur-3xl"
          aria-hidden
        />
      ) : null}
      {children}
    </div>
  );
}

export function PageSection({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('space-y-3 pt-2', className)} {...rest}>
      {children}
    </section>
  );
}
