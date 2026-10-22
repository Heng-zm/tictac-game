import { History, Home, Minus, RotateCcw, Trophy, X } from 'lucide-react';
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
} from '../lib/game';
import { Button, Modal, Pill } from './ui';

export function GameResult({
  match,
  open,
  rematchBusy,
  onRematch,
  onHome,
  onHistory,
}: {
  match: PublicMatchState;
  open: boolean;
  rematchBusy: boolean;
  onRematch: () => void;
  onHome: () => void;
  onHistory: () => void;
}) {
  const outcome = describeOutcome(match);
  const opponent = opponentFor(match);
  const title = outcome === 'win' ? 'You win!' : outcome === 'loss' ? 'You lost' : 'Draw';
  const impact = ratingImpactFor(match);
  const impactTone = impact === null ? 'neutral' : impact > 0 ? 'success' : 'danger';
  const impactLabel =
    impact === null
      ? isRatedMatch(match)
        ? 'No rating change'
        : 'Unrated'
      : `Rating ${impact > 0 ? '+' : ''}${impact}`;
  const rematch = match.rematch;
  const waiting = rematch.requestedByYou && !rematch.requestedByOpponent;
  const opponentWaiting = rematch.requestedByOpponent && !rematch.requestedByYou;

  const rematchLabel = waiting
    ? 'Waiting for opponent…'
    : opponentWaiting
      ? 'Accept rematch'
      : rematchBusy
        ? 'Starting…'
        : 'Play again';

  return (
    <Modal open={open} dismissible={false} ariaLabel="Game result">
      <div className="-mt-1 text-center">
        <div
          className={cn(
            'mx-auto flex h-14 w-14 animate-pop-in items-center justify-center rounded-2xl border',
            outcome === 'win'
              ? 'border-success/30 bg-success/15 text-success'
              : outcome === 'draw'
                ? 'border-line bg-elevated text-muted'
                : 'border-danger/25 bg-danger/10 text-danger',
          )}
        >
          {outcome === 'win' ? (
            <Trophy className="h-8 w-8" aria-hidden />
          ) : outcome === 'draw' ? (
            <Minus className="h-8 w-8" aria-hidden />
          ) : (
            <X className="h-8 w-8" aria-hidden />
          )}
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <Pill>{modeLabel(match.mode)}</Pill>
          <Pill tone={impactTone}>{impactLabel}</Pill>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-ink">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[19rem] text-sm leading-relaxed text-muted">{finishReasonCopy(match)}</p>
        {opponent ? (
          <p className="mt-2 text-xs font-semibold text-muted">
            vs {opponent.displayName}
            {opponent.isAi && opponent.aiDifficulty ? ` · ${opponent.aiDifficulty.toLowerCase()}` : ''}
          </p>
        ) : null}

        <FinalBoard match={match} />

        <div className="mt-5 space-y-2">
          {rematch.available || match.mode === 'AI' ? (
            <Button
              size="lg"
              className="w-full"
              loading={rematchBusy || waiting}
              disabled={waiting}
              icon={RotateCcw}
              onClick={onRematch}
            >
              {rematchLabel}
            </Button>
          ) : (
            <p className="rounded-2xl border border-line bg-elevated/60 px-3 py-2.5 text-xs font-medium text-muted">
              The rematch window for this game has closed.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={Home} onClick={onHome}>
              Home
            </Button>
            <Button variant="secondary" icon={History} onClick={onHistory}>
              History
            </Button>
          </div>
        </div>
        {waiting ? (
          <p className="mt-3 text-[11px] text-muted">Your opponent will see the rematch request instantly.</p>
        ) : null}
      </div>
    </Modal>
  );
}

const FINAL_BOARD_RADIUS = 2;

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
    <div
      className="mx-auto mt-4 grid w-[9rem] grid-cols-5 gap-1 rounded-2xl border border-line bg-elevated/50 p-1.5"
      role="img"
      aria-label="Final board around the deciding area"
    >
      {cells.map(({ cell, value }) => (
        <span
          key={cell}
          className={cn(
            'flex aspect-square items-center justify-center rounded-md border text-sm font-bold leading-none',
            winningCells.has(cell)
              ? 'border-amber-400/70 bg-amber-400/15'
              : cn('border-line/70', value ? 'bg-surface' : 'bg-surface/40'),
            value === 'X' ? 'text-accent' : value === 'O' ? 'text-danger' : 'text-muted',
          )}
        >
          {value ?? ''}
        </span>
      ))}
    </div>
  );
}
