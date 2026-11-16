import { useState } from 'react';
import {
  Check,
  Eye,
  Flag,
  History,
  Home,
  Minus,
  RotateCcw,
  Share2,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import type { PublicMatchState } from '../../shared/game-types';
import { decodeCell, encodeCell } from '../../shared/game-types';
import { cn } from '../lib/cn';
import {
  describeOutcome,
  findWinningLine,
  finishReasonCopy,
  isRatedMatch,
  modeLabel,
  opponentFor,
  ratingImpactFor,
  yourPlayer,
} from '../lib/game';
import { formatDuration } from '../hooks/use-time';
import { Avatar, Button, Modal, Pill } from './ui';

export function GameResult({
  match,
  open,
  taunt,
  rematchBusy,
  onRematch,
  onHome,
  onHistory,
}: {
  match: PublicMatchState;
  open: boolean;
  /** Last line from the bot, shown as a parting shot in AI games. */
  taunt?: string | null;
  rematchBusy: boolean;
  onRematch: () => void;
  onHome: () => void;
  onHistory: () => void;
}) {
  const [minimized, setMinimized] = useState(false);
  const [copied, setCopied] = useState(false);

  const outcome = describeOutcome(match);
  const you = yourPlayer(match);
  const opponent = opponentFor(match);

  const youName = you?.displayName ?? 'You';
  const opponentName = opponent?.displayName ?? 'Opponent';

  const title =
    outcome === 'win'
      ? 'You win!'
      : outcome === 'loss'
        ? 'You lost'
        : outcome === 'draw'
          ? 'Draw'
          : 'Game abandoned';

  const impact = ratingImpactFor(match);
  const impactTone = impact === null ? 'neutral' : impact > 0 ? 'success' : impact < 0 ? 'danger' : 'neutral';
  const impactLabel =
    impact === null
      ? isRatedMatch(match)
        ? 'No rating change'
        : 'Unrated'
      : impact === 0
        ? 'No rating change'
        : `Rating ${impact > 0 ? '+' : ''}${impact}`;

  const rematch = match.rematch;
  const waiting = rematch.requestedByYou && !rematch.requestedByOpponent;
  const opponentWaiting = rematch.requestedByOpponent && !rematch.requestedByYou;
  const canRematch = match.status === 'FINISHED' && (rematch.available || match.mode === 'AI');

  const rematchLabel = waiting
    ? 'Waiting for opponent…'
    : opponentWaiting
      ? 'Accept rematch'
      : rematchBusy
        ? 'Starting…'
        : 'Play again';

  const movesCount = Object.keys(match.board).length;
  const matchDurationMs =
    match.startedAt && match.finishedAt
      ? Math.max(0, new Date(match.finishedAt).getTime() - new Date(match.startedAt).getTime())
      : null;
  const durationText = matchDurationMs !== null ? formatDuration(matchDurationMs) : null;

  const handleShare = async () => {
    const text = `🎮 Tic Tac Toe (5-in-a-Row)\n${outcome === 'win' ? '🏆 Victory' : outcome === 'loss' ? '💀 Defeat' : '🤝 Draw'} vs ${opponentName}!\n⚡ ${movesCount} moves · ${modeLabel(match.mode)}\nPlay at: https://t.me/TicTacToeGameBot`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard write failures in unsupported WebViews
    }
  };

  // Minimized review bar so player can freely pan/inspect the board
  if (open && minimized) {
    return (
      <div
        className="pointer-events-auto fixed bottom-5 inset-x-0 mx-auto z-40 flex w-[calc(100%-1.5rem)] max-w-md items-center justify-between gap-3 rounded-2xl border border-line/90 bg-surface/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl animate-fade-up ring-1 ring-line/50"
        role="region"
        aria-label="Match outcome summary"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-xs',
              outcome === 'win'
                ? 'border border-amber-400/40 bg-amber-400/15 text-amber-500 shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                : outcome === 'loss'
                  ? 'border border-danger/40 bg-danger/15 text-danger shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                  : 'border border-line bg-elevated text-muted',
            )}
          >
            {outcome === 'win' ? (
              <Trophy className="h-4 w-4" aria-hidden />
            ) : outcome === 'loss' ? (
              <X className="h-4 w-4" aria-hidden />
            ) : outcome === 'abandoned' ? (
              <Flag className="h-4 w-4" aria-hidden />
            ) : (
              <Minus className="h-4 w-4" aria-hidden />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-ink">{title}</p>
            <p className="truncate text-[10px] font-semibold text-muted">{impactLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="secondary" icon={Eye} onClick={() => setMinimized(false)}>
            Result
          </Button>
          {canRematch ? (
            <Button
              size="sm"
              variant="primary"
              icon={RotateCcw}
              onClick={onRematch}
              loading={rematchBusy || waiting}
              disabled={waiting}
            >
              Rematch
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Modal open={open && !minimized} dismissible={false} ariaLabel="Game result">
      <div className="-mt-1 text-center">
        {/* Outcome Emblem Badge */}
        <div
          className={cn(
            'relative mx-auto flex h-16 w-16 animate-pop-in items-center justify-center rounded-3xl border shadow-md transition-transform',
            outcome === 'win'
              ? 'border-amber-400/40 bg-gradient-to-br from-amber-400/20 via-yellow-400/10 to-amber-500/25 text-amber-400 shadow-[0_0_24px_rgba(251,191,36,0.35)]'
              : outcome === 'draw'
                ? 'border-line bg-elevated text-muted'
                : outcome === 'abandoned'
                  ? 'border-line bg-elevated text-muted'
                  : 'border-danger/25 bg-danger/10 text-danger shadow-danger/10',
          )}
        >
          {outcome === 'win' ? (
            <>
              <span className="pointer-events-none absolute -inset-2 rounded-full border border-amber-400/35 animate-pulse-ring" aria-hidden />
              <Trophy className="h-9 w-9 animate-celebration-burst drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" aria-hidden />
            </>
          ) : outcome === 'draw' ? (
            <Minus className="h-8 w-8" aria-hidden />
          ) : outcome === 'abandoned' ? (
            <Flag className="h-8 w-8" aria-hidden />
          ) : (
            <X className="h-8 w-8 animate-pop-in" aria-hidden />
          )}
        </div>

        {/* Mode & Rating Pills */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Pill>{modeLabel(match.mode)}</Pill>
          <Pill tone={impactTone}>{impactLabel}</Pill>
        </div>

        {/* Title & Finish Reason */}
        <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
        <p className="mx-auto mt-1 max-w-[20rem] text-xs sm:text-sm leading-relaxed text-muted">
          {finishReasonCopy(match)}
        </p>

        {/* Versus Matchup Card */}
        <div className="mx-auto mt-3.5 flex max-w-[20rem] items-center justify-between rounded-2xl border border-line/70 bg-elevated/40 px-3.5 py-2 backdrop-blur-xs">
          {/* You */}
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={youName} photoUrl={you?.photoUrl} size="sm" />
            <div className="min-w-0 text-left">
              <p className="truncate text-xs font-bold text-ink">{youName}</p>
              <span
                className={cn(
                  'inline-block text-[10px] font-extrabold',
                  match.youSide === 'X' ? 'text-accent' : 'text-danger',
                )}
              >
                Playing {match.youSide}
              </span>
            </div>
          </div>

          {/* VS Divider */}
          <div className="flex flex-col items-center px-2 text-muted">
            <Swords className="h-3.5 w-3.5 opacity-60" aria-hidden />
            <span className="text-[9px] font-black uppercase tracking-wider opacity-60">VS</span>
          </div>

          {/* Opponent */}
          <div className="flex items-center gap-2 min-w-0 flex-row-reverse text-right">
            <Avatar name={opponentName} photoUrl={opponent?.photoUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-ink">{opponentName}</p>
              <span
                className={cn(
                  'inline-block text-[10px] font-extrabold',
                  match.youSide === 'X' ? 'text-danger' : 'text-accent',
                )}
              >
                {opponent?.isAi ? 'Bot' : 'Playing ' + (match.youSide === 'X' ? 'O' : 'X')}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Match Metrics Tiles */}
        <div className="mx-auto mt-3 grid max-w-[20rem] grid-cols-3 gap-2">
          <div className="rounded-xl border border-line/60 bg-elevated/30 p-2 text-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Moves</span>
            <p className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">{movesCount}</p>
          </div>
          <div className="rounded-xl border border-line/60 bg-elevated/30 p-2 text-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Duration</span>
            <p className="mt-0.5 text-sm font-extrabold tabular-nums text-ink">{durationText ?? '<1m'}</p>
          </div>
          <div className="rounded-xl border border-line/60 bg-elevated/30 p-2 text-center">
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-muted">Rating</span>
            <p
              className={cn(
                'mt-0.5 text-sm font-extrabold tabular-nums',
                impact && impact > 0
                  ? 'text-emerald-500'
                  : impact && impact < 0
                    ? 'text-rose-500'
                    : 'text-muted',
              )}
            >
              {impact !== null && impact !== 0 ? (impact > 0 ? `+${impact}` : `${impact}`) : '±0'}
            </p>
          </div>
        </div>

        {/* Deciding Area Mini Board */}
        <FinalBoard match={match} />

        {/* Bot Parting Shot / Taunt */}
        {taunt ? (
          <p className="mx-auto mt-3 max-w-[20rem] rounded-2xl border border-line/60 bg-elevated/60 px-3 py-2 text-xs italic leading-relaxed text-muted">
            “{taunt}”
          </p>
        ) : null}

        {/* Action Controls */}
        <div className="mt-4 space-y-2">
          {canRematch ? (
            <Button
              size="lg"
              className={cn(
                'w-full shadow-md',
                opponentWaiting && 'ring-2 ring-accent ring-offset-2 ring-offset-surface animate-pulse',
              )}
              loading={rematchBusy || waiting}
              disabled={waiting}
              icon={RotateCcw}
              onClick={onRematch}
            >
              {rematchLabel}
            </Button>
          ) : (
            <p className="rounded-2xl border border-line bg-elevated/60 px-3 py-2.5 text-xs font-medium text-muted">
              {match.status === 'ABANDONED'
                ? 'This game ended without a result. No rating was changed.'
                : 'The rematch window for this game has closed.'}
            </p>
          )}

          {/* Secondary Action Grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              icon={Eye}
              onClick={() => setMinimized(true)}
              title="Inspect full board"
            >
              Review Board
            </Button>
            <Button
              variant="secondary"
              icon={copied ? Check : Share2}
              onClick={handleShare}
              title="Share match summary"
            >
              {copied ? 'Copied!' : 'Share'}
            </Button>
            <Button variant="secondary" icon={Home} onClick={onHome}>
              Home
            </Button>
            <Button variant="secondary" icon={History} onClick={onHistory}>
              History
            </Button>
          </div>
        </div>

        {waiting ? (
          <p className="mt-2.5 text-[11px] text-muted">Your opponent will see the rematch request instantly.</p>
        ) : null}
      </div>
    </Modal>
  );
}

const FINAL_BOARD_RADIUS = 2;

function FinalStoneMark({ value, isWinning }: { value: 'X' | 'O'; isWinning?: boolean }) {
  if (value === 'X') {
    return (
      <svg
        viewBox="0 0 100 100"
        className={cn(
          'h-3.5 w-3.5 stroke-[16] stroke-accent drop-shadow-[0_0_4px_rgba(37,99,235,0.7)]',
          isWinning && 'stroke-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]',
        )}
        strokeLinecap="round"
        aria-hidden
      >
        <line x1="22" y1="22" x2="78" y2="78" />
        <line x1="78" y1="22" x2="22" y2="78" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn(
        'h-3.5 w-3.5 stroke-[14] stroke-danger drop-shadow-[0_0_4px_rgba(239,68,68,0.7)] fill-none',
        isWinning && 'stroke-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]',
      )}
      aria-hidden
    >
      <circle cx="50" cy="50" r="28" />
    </svg>
  );
}

function FinalBoard({ match }: { match: PublicMatchState }) {
  const occupied = Object.keys(match.board).map(Number);
  if (occupied.length === 0) return null;

  const winningLine = findWinningLine(match.board);
  const winningCells = new Set<number>(winningLine ?? []);
  const average = occupied.reduce(
    (sum, cell) => {
      const { x, y } = decodeCell(cell);
      return { x: sum.x + x, y: sum.y + y };
    },
    { x: 0, y: 0 },
  );
  const focusCell =
    winningLine?.[Math.floor(winningLine.length / 2)] ??
    encodeCell(Math.round(average.x / occupied.length), Math.round(average.y / occupied.length));
  const focus = decodeCell(focusCell);
  const span = FINAL_BOARD_RADIUS * 2 + 1;
  const cells = Array.from({ length: span * span }, (_, index) => {
    const x = focus.x + (index % span) - FINAL_BOARD_RADIUS;
    const y = focus.y + Math.floor(index / span) - FINAL_BOARD_RADIUS;
    const cell = encodeCell(x, y);
    return { cell, value: match.board[cell] };
  });

  return (
    <div className="mx-auto mt-3 max-w-[20rem]">
      <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold text-muted">
        <span>Deciding 5×5 area</span>
        {winningLine ? (
          <span className="text-amber-500 font-bold">5 in a row</span>
        ) : (
          <span>{occupied.length} total moves</span>
        )}
      </div>
      <div
        className="mx-auto grid w-[10rem] grid-cols-5 gap-1 rounded-2xl border border-line/80 bg-elevated/60 p-1.5 shadow-sm"
        role="img"
        aria-label="Final board around the deciding area"
      >
        {cells.map(({ cell, value }) => (
          <span
            key={cell}
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-lg border text-xs font-black leading-none transition-all',
              winningCells.has(cell)
                ? 'border-amber-400/80 bg-amber-400/20 text-amber-500 dark:text-amber-300 ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                : cn('border-line/60', value ? 'bg-surface shadow-xs' : 'bg-surface/30'),
            )}
          >
            <span className="sr-only">{value ?? ''}</span>
            {value ? <FinalStoneMark value={value} isWinning={winningCells.has(cell)} /> : null}
          </span>
        ))}
      </div>
    </div>
  );
}
