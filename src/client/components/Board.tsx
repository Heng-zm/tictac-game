import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import type { Board as BoardType, Side } from '../../shared/game-types';
import { decodeCell, encodeCell } from '../../shared/game-types';
import { cn } from '../lib/cn';

interface BoardProps {
  board: BoardType;
  winningLine: number[] | null;
  lastMoveCell: number | null;
  yourTurn: boolean;
  disabled: boolean;
  onCell: (cell: number) => void;
}

const CELL_SIZE = 44; // Cell size in px
const VISIBLE_RADIUS = 7; // Shows 15x15 window around current center

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-[62%] w-[62%] text-accent" aria-hidden>
      <path
        d="M24 24 L76 76 M76 24 L24 76"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
        className="mark-stroke animate-in zoom-in-50 duration-200"
      />
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-[65%] w-[65%] text-danger" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="27"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        pathLength={100}
        className="mark-stroke animate-in zoom-in-50 duration-200"
      />
    </svg>
  );
}

export function Board({
  board,
  winningLine,
  lastMoveCell,
  yourTurn,
  disabled,
  onCell,
}: BoardProps) {
  // Center coordinate of the viewport in grid coordinates (x, y)
  const [center, setCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // Dragging state
  const isDragging = useRef(false);
  const dragStart = useRef<{ clientX: number; clientY: number; startCenterX: number; startCenterY: number }>({
    clientX: 0,
    clientY: 0,
    startCenterX: 0,
    startCenterY: 0,
  });
  const didDrag = useRef(false);

  const winningSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);

  // Center on latest move when opponent moves or match opens
  const lastMoveRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastMoveCell !== null && lastMoveCell !== lastMoveRef.current) {
      lastMoveRef.current = lastMoveCell;
      const { x, y } = decodeCell(lastMoveCell);
      setCenter({ x, y });
    }
  }, [lastMoveCell]);

  const recenter = useCallback(() => {
    if (lastMoveCell !== null) {
      const { x, y } = decodeCell(lastMoveCell);
      setCenter({ x, y });
    } else {
      setCenter({ x: 0, y: 0 });
    }
    setZoom(1);
  }, [lastMoveCell]);

  // Pointer drag events for smooth panning on mobile & desktop
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag with primary mouse button or touch
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    isDragging.current = true;
    didDrag.current = false;
    dragStart.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startCenterX: center.x,
      startCenterY: center.y,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const deltaX = e.clientX - dragStart.current.clientX;
    const deltaY = e.clientY - dragStart.current.clientY;

    if (Math.hypot(deltaX, deltaY) > 6) {
      didDrag.current = true;
    }

    // Convert pixel delta to grid units
    const currentCellSize = CELL_SIZE * zoom;
    const gridDeltaX = Math.round(deltaX / currentCellSize);
    const gridDeltaY = Math.round(deltaY / currentCellSize);

    const newCenterX = dragStart.current.startCenterX - gridDeltaX;
    const newCenterY = dragStart.current.startCenterY - gridDeltaY;

    if (newCenterX !== center.x || newCenterY !== center.y) {
      setCenter({ x: newCenterX, y: newCenterY });
    }
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const zoomIn = () => setZoom((z) => Math.min(1.4, Number((z + 0.15).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(0.7, Number((z - 0.15).toFixed(2))));

  // Generate cells visible around current center
  const visibleCells = useMemo(() => {
    const list: Array<{ x: number; y: number; cell: number; value: Side | undefined }> = [];
    const minX = center.x - VISIBLE_RADIUS;
    const maxX = center.x + VISIBLE_RADIUS;
    const minY = center.y - VISIBLE_RADIUS;
    const maxY = center.y + VISIBLE_RADIUS;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = encodeCell(x, y);
        list.push({ x, y, cell, value: board[cell] });
      }
    }
    return list;
  }, [center.x, center.y, board]);

  const gridDimension = (VISIBLE_RADIUS * 2 + 1) * CELL_SIZE * zoom;

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Board container */}
      <div
        className="relative touch-none overflow-hidden rounded-3xl border border-line bg-surface/75 shadow-soft backdrop-blur-md"
        style={{
          width: '100%',
          maxWidth: '380px',
          aspectRatio: '1 / 1',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Infinite Grid Canvas */}
        <div
          role="grid"
          aria-label="Infinite 5-in-a-row Caro grid"
          className="absolute inset-0 flex items-center justify-center"
        >
          <div
            className="grid transition-transform duration-75"
            style={{
              gridTemplateColumns: `repeat(${VISIBLE_RADIUS * 2 + 1}, ${CELL_SIZE * zoom}px)`,
              gridTemplateRows: `repeat(${VISIBLE_RADIUS * 2 + 1}, ${CELL_SIZE * zoom}px)`,
              width: `${gridDimension}px`,
              height: `${gridDimension}px`,
            }}
          >
            {visibleCells.map(({ x, y, cell, value }) => {
              const isWinning = winningSet.has(cell);
              const isLast = lastMoveCell === cell;
              const isCenter = x === 0 && y === 0;
              const canPlay = !disabled && yourTurn && value === undefined;

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  aria-label={`Position ${x}, ${y}, ${value ?? 'empty'}`}
                  aria-disabled={!canPlay}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!didDrag.current && canPlay) {
                      onCell(cell);
                    }
                  }}
                  onPointerEnter={() => canPlay && setHoveredCell(cell)}
                  onPointerLeave={() => setHoveredCell(null)}
                  style={{
                    width: `${CELL_SIZE * zoom}px`,
                    height: `${CELL_SIZE * zoom}px`,
                  }}
                  className={cn(
                    'group relative flex items-center justify-center border border-line/40 transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70',
                    value === undefined && canPlay && 'cursor-pointer hover:bg-accent/10 active:scale-95',
                    value === undefined && !canPlay && 'cursor-default',
                    value !== undefined && 'cursor-default',
                    isWinning && 'border-amber-400/80 bg-amber-400/15',
                    isCenter && value === undefined && 'bg-accent/5',
                  )}
                >
                  {/* Center origin indicator */}
                  {isCenter && value === undefined && (
                    <span className="pointer-events-none absolute h-2 w-2 rounded-full bg-accent/40" />
                  )}

                  {/* Placed stones */}
                  {value === 'X' ? <XMark /> : null}
                  {value === 'O' ? <OMark /> : null}

                  {/* Latest move indicator dot (just like in reference image) */}
                  {isLast && (
                    <span
                      className={cn(
                        'pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-surface animate-pulse',
                        value === 'X' ? 'bg-accent' : 'bg-danger',
                      )}
                    />
                  )}

                  {/* Winning glow */}
                  {isWinning && (
                    <span className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-amber-400/70 shadow-[0_0_12px_rgba(251,191,36,0.5)]" />
                  )}

                  {/* Hover ghost preview */}
                  {hoveredCell === cell && canPlay && (
                    <span className="pointer-events-none absolute text-sm font-bold text-accent/30">
                      +
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Viewport Floating HUD Controls */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between">
          <div className="rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[10px] font-semibold text-muted shadow-sm backdrop-blur-md">
            Center: ({center.x}, {center.y}) · 5 to win
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-line bg-surface/90 p-1 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={recenter}
              title="Recenter on latest move"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-90"
            >
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              title="Zoom out"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-90"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              title="Zoom in"
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-90"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
