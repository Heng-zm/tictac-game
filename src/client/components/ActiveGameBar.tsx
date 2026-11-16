import { ChevronRight, Clock3, Swords, WifiOff } from 'lucide-react';
import type { PublicMatchState } from '../../shared/game-types';
import type { ConnectionStatus } from '../hooks/use-game-client';
import { formatDuration, useCountdown } from '../hooks/use-time';
import { opponentFor } from '../lib/game';
import { cn } from '../lib/cn';

/**
 * Keeps an active board reachable while the player browses the secondary tabs.
 * The Home screen already has its full resume card, so this compact bar is only
 * rendered on Profile and Leaderboard.
 */
export function ActiveGameBar({
  match,
  connection,
  clockOffsetMs = 0,
  onResume,
}: {
  match: PublicMatchState;
  connection: ConnectionStatus;
  /** Estimated server time minus device time, in milliseconds. */
  clockOffsetMs?: number;
  onResume: () => void;
}) {
  const opponent = opponentFor(match);
  const opponentName = opponent?.displayName ?? 'Opponent';
  const yourTurn = match.currentTurn === match.youSide;
  const reconnecting = connection !== 'online';
  const paused = match.turnTimerPaused;
  const remaining = useCountdown(match.turnDeadline, undefined, clockOffsetMs);
  const showClock = !reconnecting && !paused && yourTurn && remaining !== null;
  const urgent = showClock && remaining <= 10_000;

  const status = reconnecting
    ? { label: 'Reconnecting', tone: 'text-amber-600 dark:text-amber-400' }
    : paused
      ? { label: 'Game paused', tone: 'text-amber-600 dark:text-amber-400' }
      : yourTurn
        ? { label: 'Your turn', tone: 'text-accent' }
        : opponent?.isAi
          ? { label: 'Bot is thinking', tone: 'text-muted' }
          : { label: `${opponentName} is thinking`, tone: 'text-muted' };

  const ariaStatus = reconnecting
    ? 'Reconnecting'
    : paused
      ? 'Game paused'
      : yourTurn
        ? `Your turn${showClock ? `, ${formatDuration(remaining)} remaining` : ''}`
        : `${opponentName} is thinking`;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+88px)] z-30 px-3 animate-fade-up">
      <button
        type="button"
        onClick={onResume}
        aria-label={`Resume active game. ${ariaStatus}. Playing ${opponentName}.`}
        className={cn(
          'group pointer-events-auto mx-auto flex w-full max-w-[560px] items-center gap-3 rounded-2xl border p-2.5 pl-3 text-left shadow-lg backdrop-blur-xl transition-all duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          reconnecting || paused
            ? 'border-amber-500/35 bg-surface/90 shadow-amber-500/10'
            : yourTurn
              ? 'border-accent/40 bg-surface/90 shadow-accent/15 ring-1 ring-accent/20 hover:border-accent/60'
              : 'border-line/80 bg-surface/90 hover:border-line hover:bg-surface/95',
        )}
      >
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm transition-transform duration-200 group-hover:scale-110',
            reconnecting || paused
              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              : yourTurn
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-accent/30'
                : 'bg-elevated text-ink',
          )}
        >
          {reconnecting ? <WifiOff className="h-4 w-4" aria-hidden /> : <Swords className="h-4 w-4" aria-hidden />}
        </span>

        <span className="min-w-0 flex-1">
          <span className={cn('flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]', status.tone)}>
            {yourTurn && !reconnecting && !paused ? (
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
              </span>
            ) : null}
            <span className="truncate">{status.label}</span>
            {showClock ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] tracking-normal font-bold tabular-nums',
                  urgent ? 'bg-danger/10 text-danger animate-pulse' : 'bg-accent/10 text-accent',
                )}
              >
                <Clock3 className="h-2.5 w-2.5" aria-hidden />
                {formatDuration(remaining)}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-sm font-semibold text-ink">{opponentName}</span>
        </span>

        <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-accent transition-transform duration-200 group-hover:translate-x-0.5">
          Resume
          <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </button>
    </div>
  );
}
