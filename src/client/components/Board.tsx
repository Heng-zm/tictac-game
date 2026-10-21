import type { Cell } from '../../shared/game-types';
import { cn } from '../lib/cn';

interface BoardProps {
  board: Cell[];
  winningLine: readonly [number, number, number] | null;
  lastMoveCell: number | null;
  yourTurn: boolean;
  disabled: boolean;
  onCell: (index: number) => void;
}

function cellName(index: number): string {
  const row = Math.floor(index / 3) + 1;
  const column = (index % 3) + 1;
  return `Row ${row}, column ${column}`;
}

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark-x h-[52%] w-[52%]" aria-hidden>
      <path
        d="M27 27 L73 73 M73 27 L27 73"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="round"
        pathLength={100}
        className="mark-stroke"
      />
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark-o h-[55%] w-[55%]" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        pathLength={100}
        className="mark-stroke"
      />
    </svg>
  );
}

function winningLineGeometry(line: readonly [number, number, number]) {
  const centers = line.map((index) => ({
    x: (index % 3) + 0.5,
    y: Math.floor(index / 3) + 0.5,
  }));
  const start = centers[0];
  const end = centers[2];
  if (!start || !end) return null;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const extension = 0.28;
  return {
    x1: clamp(start.x - (dx / length) * extension),
    y1: clamp(start.y - (dy / length) * extension),
    x2: clamp(end.x + (dx / length) * extension),
    y2: clamp(end.y + (dy / length) * extension),
  };
}

function clamp(value: number): number {
  return Math.min(2.92, Math.max(0.08, value));
}

export function Board({ board, winningLine, lastMoveCell, yourTurn, disabled, onCell }: BoardProps) {
  const line = winningLine ? winningLineGeometry(winningLine) : null;
  const winning = new Set(winningLine ?? []);
  const winningSide = winningLine ? board[winningLine[0]] : null;
  const isOWin = winningSide === 'O';

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex: number | null = null;
    if (e.key === 'ArrowUp') {
      targetIndex = currentIndex >= 3 ? currentIndex - 3 : null;
    } else if (e.key === 'ArrowDown') {
      targetIndex = currentIndex <= 5 ? currentIndex + 3 : null;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = currentIndex % 3 !== 0 ? currentIndex - 1 : null;
    } else if (e.key === 'ArrowRight') {
      targetIndex = currentIndex % 3 !== 2 ? currentIndex + 1 : null;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      const targetButton = e.currentTarget.parentElement?.children[targetIndex] as HTMLElement | undefined;
      targetButton?.focus();
    }
  };

  return (
    <div className="game-board-frame relative select-none">
      <div
        role="grid"
        aria-label="Tic Tac Toe board"
        className="grid grid-cols-3 gap-2"
      >
        {board.map((cell, index) => {
          const isWinning = winning.has(index);
          const canPlay = !disabled && yourTurn && cell === null;
          return (
            <button
              key={index}
              type="button"
              role="gridcell"
              aria-label={`${cellName(index)}, ${cell ?? 'empty'}`}
              aria-disabled={!canPlay}
              onClick={() => {
                if (canPlay) onCell(index);
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-surface transition duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
                cell === 'X' ? 'text-accent' : cell === 'O' ? 'text-danger' : 'text-ink',
                cell === null && canPlay && 'cursor-pointer hover:border-accent/30 hover:bg-accent/5 active:scale-[0.98]',
                !canPlay && 'cursor-default',
                cell === null ? 'border-line' : 'border-line/60',
                isWinning &&
                  (isOWin
                    ? 'border-danger/30 bg-danger/5'
                    : 'border-accent/30 bg-accent/5'),
              )}
            >
              {cell === 'X' ? <XMark /> : null}
              {cell === 'O' ? <OMark /> : null}
              {lastMoveCell === index && !isWinning ? (
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-current opacity-50" />
              ) : null}
              {cell === null && canPlay ? (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-light text-muted opacity-0 transition group-hover:opacity-40">
                  +
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {line ? (
        <svg
          viewBox="0 0 3 3"
          className="pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible"
          aria-hidden
        >
          <line
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            pathLength={100}
            stroke={isOWin ? 'var(--app-danger)' : 'var(--app-accent)'}
            strokeWidth="0.09"
            strokeLinecap="round"
            className={cn(
              'animate-draw-line',
              isOWin ? 'drop-shadow-[0_0_6px_var(--app-danger)]' : 'drop-shadow-[0_0_6px_var(--app-accent)]',
            )}
            style={{ strokeDasharray: 100 }}
          />
        </svg>
      ) : null}
    </div>
  );
}
