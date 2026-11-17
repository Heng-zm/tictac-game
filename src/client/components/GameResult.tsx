import { useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Flag,
  Home,
  Minus,
  RotateCcw,
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
import { Avatar, Button, Modal, Pill } from './ui';

const CONFETTI_COLORS = ['#fbbf24', '#f59e0b', '#fde68a', '#38bdf8', '#a78bfa', '#34d399'];
const CONFETTI_PIECES = 26;

/** One-shot confetti burst over the result dialog. Portaled so the dialog's
 *  scroll container cannot clip it, and CSS-driven so reduced-motion wins. */
function WinConfetti() {
  return createPortal(
    <div className="result-confetti" aria-hidden>
      {Array.from({ length: CONFETTI_PIECES }, (_, index) => {
        const angle = (index / CONFETTI_PIECES) * Math.PI * 2;
        const distance = 120 + ((index * 47) % 180);
        const style = {
          '--confetti-x': `${Math.round(Math.cos(angle) * distance)}px`,
          '--confetti-y': `${Math.round(Math.sin(angle) * distance * 0.8 + 40)}px`,
          '--confetti-tilt': `${(index % 5) * 22 - 44}deg`,
          '--confetti-spin': `${(index % 2 === 0 ? 1 : -1) * (200 + (index % 4) * 120)}deg`,
          '--confetti-delay': `${(index % 6) * 20}ms`,
          backgroundColor: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
        } as CSSProperties;
        return <span key={index} className="result-confetti__piece" style={style} />;
      })}
    </div>,
    document.body,
  );
}

export function GameResult({
  match,
  open,
  taunt,
  rematchBusy,
  onRematch,
  onHome,
  onHistory: _onHistory,
}: {
  match: PublicMatchState;
  open: boolean;
  /** Last line from the bot, shown as a parting shot in AI games. */
  taunt?: string | null;
  rematchBusy: boolean;
  onRematch: () => void;
  onHome: () => void;
  onHistory?: () => void;
}) {
  const [minimized, setMinimized] = useState(false);

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
    <Modal
      open={open && !minimized}
      dismissible={false}
      ariaLabel="Game result"
      className={cn(
        outcome === 'win' && 'result-card--win',
        outcome === 'loss' && 'result-card--defeat',
      )}
    >
      {outcome === 'win' ? <WinConfetti /> : null}
      <div className="-mt-1 text-center">
        {/* Outcome Emblem Badge */}
        <div
          className={cn(
            'relative mx-auto flex h-14 w-14 sm:h-16 sm:w-16 animate-pop-in items-center justify-center rounded-3xl border shadow-md transition-transform',
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
              <Trophy className="h-8 w-8 sm:h-9 sm:w-9 animate-celebration-burst drop-shadow-[0_0_12px_rgba(251,191,36,0.7)]" aria-hidden />
            </>
          ) : outcome === 'draw' ? (
            <Minus className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
          ) : outcome === 'abandoned' ? (
            <Flag className="h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
          ) : (
            <>
              <span
                className="result-defeat-ring pointer-events-none absolute -inset-2 rounded-full border border-danger/45"
                aria-hidden
              />
              <X className="result-defeat-mark h-7 w-7 sm:h-8 sm:w-8" aria-hidden />
            </>
          )}
        </div>

        {/* Mode & Rating Pills */}
        <div className="mt-3 sm:mt-4 flex items-center justify-center gap-2">
          <Pill>{modeLabel(match.mode)}</Pill>
          <Pill tone={impactTone}>{impactLabel}</Pill>
        </div>

        {/* Title & Finish Reason */}
        <h2 className="mt-2 text-xl font-bold tracking-tight text-ink sm:mt-2.5 sm:text-2xl md:text-3xl">{title}</h2>
        <p className="mx-auto mt-1 max-w-[20rem] text-xs sm:text-sm leading-relaxed text-muted">
          {finishReasonCopy(match)}
        </p>

        {/* Versus Matchup Card */}
        <div className="mx-auto mt-2.5 sm:mt-3.5 flex max-w-[20rem] items-center justify-between rounded-2xl border border-line/70 bg-elevated/40 px-2.5 py-1.5 sm:px-3.5 sm:py-2 backdrop-blur-xs">
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


        {/* Deciding Area Mini Board */}
        <FinalBoard match={match} onReview={() => setMinimized(true)} />

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
            <Button variant="secondary" icon={Home} onClick={onHome}>
              Home
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
          'h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[14] stroke-accent drop-shadow-[0_0_6px_rgba(59,130,246,0.65)]',
          isWinning && 'stroke-amber-500 dark:stroke-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]',
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
        'h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[13] stroke-danger drop-shadow-[0_0_6px_rgba(239,68,68,0.65)] fill-none',
        isWinning && 'stroke-amber-500 dark:stroke-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.9)]',
      )}
      aria-hidden
    >
      <circle cx="50" cy="50" r="28" />
    </svg>
  );
}

function FinalBoard({ match, onReview }: { match: PublicMatchState; onReview?: () => void }) {
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
      <div
        className="mx-auto grid w-[12.5rem] sm:w-[13.5rem] grid-cols-5 gap-1.5 rounded-3xl border border-line/80 bg-elevated/40 p-2 sm:p-2.5 shadow-sm backdrop-blur-xs transition-transform hover:scale-[1.02] cursor-pointer"
        role="img"
        aria-label="Final board showing the deciding 5-in-a-row area"
        onClick={onReview}
        title="Inspect full board"
      >
        {cells.map(({ cell, value }) => (
          <span
            key={cell}
            className={cn(
              'relative flex aspect-square items-center justify-center rounded-xl sm:rounded-2xl border transition-all',
              winningCells.has(cell)
                ? 'border-2 border-amber-400/90 bg-amber-400/20 text-amber-500 dark:text-amber-300 ring-2 ring-amber-400/40 shadow-[0_0_12px_rgba(251,191,36,0.55)]'
                : cn('border-line/50', value ? 'bg-surface shadow-xs' : 'bg-surface/30'),
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
