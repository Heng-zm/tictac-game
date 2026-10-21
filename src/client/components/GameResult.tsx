import { History, Home, Minus, RotateCcw, Trophy, X } from 'lucide-react';
import type { PublicMatchState } from '../../shared/game-types';
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
    <Modal open={open} dismissible={false}>
      <div className="-mt-1 text-center">
        <div
          className={cn(
            'mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border',
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

function FinalBoard({ match }: { match: PublicMatchState }) {
  if (!match.board.some(Boolean)) return null;

  const winningLine = findWinningLine(match.board);
  const winningCells = new Set<number>(winningLine ?? []);

  return (
    <div
      className="mx-auto mt-4 grid w-[8.5rem] grid-cols-3 gap-1 rounded-2xl border border-line bg-elevated/50 p-1.5"
      role="img"
      aria-label="Final board"
    >
      {match.board.map((cell, index) => (
        <span
          key={index}
          className={cn(
            'flex aspect-square items-center justify-center rounded-lg border text-base font-bold leading-none',
            cell ? 'bg-surface' : 'bg-surface/40',
            winningCells.has(index) ? 'border-accent/40 bg-accent/10' : 'border-line/70',
            cell === 'X' ? 'text-accent' : cell === 'O' ? 'text-danger' : 'text-muted',
          )}
        >
          {cell ?? ''}
        </span>
      ))}
    </div>
  );
}
