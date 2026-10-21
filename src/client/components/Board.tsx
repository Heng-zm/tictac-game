import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import type { Board as BoardType, Side } from '../../shared/game-types';
import { decodeCell, encodeCell } from '../../shared/game-types';
import { cn } from '../lib/cn';
import { hapticImpact } from '../lib/telegram';

interface BoardProps {
  board: BoardType;
  winningLine: number[] | null;
  lastMoveCell: number | null;
  yourTurn: boolean;
  disabled: boolean;
  onCell: (cell: number) => void;
}

const CELL_SIZE = 48; // Base cell dimension in px for comfortable mobile finger tapping
const BUFFER_CELLS = 2; // Extra cells rendered beyond viewport edge for seamless scrolling

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-[68%] w-[68%] text-accent drop-shadow-sm" aria-hidden>
      <path
        d="M22 22 L78 78 M78 22 L22 78"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
        className="mark-stroke animate-in zoom-in-75 duration-150"
      />
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="h-[70%] w-[70%] text-danger drop-shadow-sm" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        pathLength={100}
        className="mark-stroke animate-in zoom-in-75 duration-150"
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
    width: 380,
    height: 380,
  });

  // Pan offset in continuous floating-point pixels
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [isPanning, setIsPanning] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  // Drag tracking refs
  const dragStart = useRef<{ clientX: number; clientY: number; startPanX: number; startPanY: number }>({
    clientX: 0,
    clientY: 0,
    startPanX: 0,
    startPanY: 0,
  });
  const didMove = useRef(false);
  const activePointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const initialPinchDist = useRef<number | null>(null);
  const initialPinchZoom = useRef<number>(1);

  const winningSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);

  // Track container dimensions with ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Center on cell helper
  const centerOnCell = useCallback((cellNumber: number, animated = true) => {
    const { x, y } = decodeCell(cellNumber);
    // Grid coordinate (x, y) translates to pixel center:
    const targetPanX = -x * CELL_SIZE;
    const targetPanY = -y * CELL_SIZE;

    if (!animated) {
      setPan({ x: targetPanX, y: targetPanY });
    } else {
      setPan({ x: targetPanX, y: targetPanY });
    }
  }, []);

  // Recenter when opponent places a move or when first loaded
  const lastMoveRef = useRef<number | null>(null);
  useEffect(() => {
    if (lastMoveCell !== null && lastMoveCell !== lastMoveRef.current) {
      lastMoveRef.current = lastMoveCell;
      centerOnCell(lastMoveCell, true);
    }
  }, [lastMoveCell, centerOnCell]);

  const recenter = useCallback(() => {
    hapticImpact('light');
    if (lastMoveCell !== null) {
      centerOnCell(lastMoveCell, true);
    } else {
      setPan({ x: 0, y: 0 });
    }
    setZoom(1);
  }, [lastMoveCell, centerOnCell]);

  const zoomIn = useCallback(() => {
    hapticImpact('light');
    setZoom((z) => Math.min(1.5, Number((z + 0.15).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    hapticImpact('light');
    setZoom((z) => Math.max(0.65, Number((z - 0.15).toFixed(2))));
  }, []);

  // Multi-touch & pointer handlers for continuous 1:1 finger tracking
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button or touch
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.current.size === 1) {
      didMove.current = false;
      dragStart.current = {
        clientX: e.clientX,
        clientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    } else if (activePointers.current.size === 2) {
      // Two-finger pinch zoom start
      const points = Array.from(activePointers.current.values());
      const p1 = points[0]!;
      const p2 = points[1]!;
      initialPinchDist.current = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      initialPinchZoom.current = zoom;
      didMove.current = true;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(e.pointerId)) return;
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Handle 2-finger pinch zoom
    if (activePointers.current.size === 2 && initialPinchDist.current) {
      const points = Array.from(activePointers.current.values());
      const p1 = points[0]!;
      const p2 = points[1]!;
      const currentDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      const ratio = currentDist / initialPinchDist.current;
      const newZoom = Math.min(1.5, Math.max(0.65, initialPinchZoom.current * ratio));
      setZoom(Number(newZoom.toFixed(2)));
      didMove.current = true;
      return;
    }

    const deltaX = e.clientX - dragStart.current.clientX;
    const deltaY = e.clientY - dragStart.current.clientY;

    if (!didMove.current && Math.hypot(deltaX, deltaY) > 8) {
      didMove.current = true;
      setIsPanning(true);
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }

    if (!didMove.current) return;

    // Direct 1:1 hardware pixel panning
    setPan({
      x: dragStart.current.startPanX + deltaX / zoom,
      y: dragStart.current.startPanY + deltaY / zoom,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasMoved = didMove.current;
    activePointers.current.delete(e.pointerId);

    if (activePointers.current.size === 0) {
      setIsPanning(false);
      initialPinchDist.current = null;
    } else if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.entries())[0]!;
      dragStart.current = {
        clientX: remaining[1].x,
        clientY: remaining[1].y,
        startPanX: pan.x,
        startPanY: pan.y,
      };
      initialPinchDist.current = null;
    }

    // Clean tap without drag - mathematically compute and place stone
    if (!wasMoved && !disabled && yourTurn) {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;
      const centerX = rect.width / 2 + pan.x * zoom;
      const centerY = rect.height / 2 + pan.y * zoom;
      const gridX = Math.round((clickX - centerX) / (CELL_SIZE * zoom));
      const gridY = Math.round((clickY - centerY) / (CELL_SIZE * zoom));
      const cell = encodeCell(gridX, gridY);

      if (board[cell] === undefined) {
        hapticImpact('medium');
        onCell(cell);
      }
    }
  };

  // Compute visible grid window in grid coordinates (x, y) based on viewport and pan
  const { minX, maxX, minY, maxY, currentCenterX, currentCenterY } = useMemo(() => {
    const halfW = containerSize.width / 2;
    const halfH = containerSize.height / 2;

    const centerCol = -pan.x / CELL_SIZE;
    const centerRow = -pan.y / CELL_SIZE;

    const spanX = Math.ceil(halfW / (CELL_SIZE * zoom)) + BUFFER_CELLS;
    const spanY = Math.ceil(halfH / (CELL_SIZE * zoom)) + BUFFER_CELLS;

    return {
      minX: Math.floor(centerCol - spanX),
      maxX: Math.ceil(centerCol + spanX),
      minY: Math.floor(centerRow - spanY),
      maxY: Math.ceil(centerRow + spanY),
      currentCenterX: Math.round(centerCol),
      currentCenterY: Math.round(centerRow),
    };
  }, [pan.x, pan.y, zoom, containerSize.width, containerSize.height]);

  // Generate visible cell list with memoization
  const visibleCells = useMemo(() => {
    const cells: Array<{ x: number; y: number; cell: number; value: Side | undefined }> = [];

    // Render cells in the visible range
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cell = encodeCell(x, y);
        cells.push({ x, y, cell, value: board[cell] });
      }
    }

    // Always include placed stones and winning line even if temporarily just off-screen
    const visibleSet = new Set(cells.map((c) => c.cell));
    for (const [cellKey, value] of Object.entries(board)) {
      const cellNum = Number(cellKey);
      if (!visibleSet.has(cellNum)) {
        const { x, y } = decodeCell(cellNum);
        cells.push({ x, y, cell: cellNum, value });
      }
    }

    return cells;
  }, [minX, maxX, minY, maxY, board]);

  return (
    <div className="relative flex flex-col items-center select-none w-full">
      {/* Board Container */}
      <div
        ref={containerRef}
        className={cn(
          'relative w-full aspect-square max-w-[min(100%,calc(var(--app-vh,100dvh)-220px))] sm:max-w-[430px] touch-none overflow-hidden rounded-2xl sm:rounded-3xl',
          'border border-line/80 bg-surface/85 shadow-soft backdrop-blur-md transition-shadow',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Infinite Grid Plane - GPU Hardware Accelerated */}
        <div
          role="grid"
          aria-label="Infinite 5-in-a-row Caro grid"
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <div
            className="relative will-change-transform"
            style={{
              width: 0,
              height: 0,
              transform: `translate3d(${pan.x * zoom}px, ${pan.y * zoom}px, 0) scale(${zoom})`,
              transition: isPanning ? 'none' : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {visibleCells.map(({ x, y, cell, value }) => {
              const isWinning = winningSet.has(cell);
              const isLast = lastMoveCell === cell;
              const isCenter = x === 0 && y === 0;
              const canPlay = !disabled && yourTurn && value === undefined;

              // Absolute pixel position of this cell relative to (0,0) center
              const left = (x - 0.5) * CELL_SIZE;
              const top = (y - 0.5) * CELL_SIZE;

              return (
                <button
                  key={cell}
                  type="button"
                  role="gridcell"
                  aria-label={`Position ${x}, ${y}, ${value ?? 'empty'}`}
                  aria-disabled={!canPlay}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!didMove.current && canPlay) {
                      hapticImpact('medium');
                      onCell(cell);
                    }
                  }}
                  onPointerEnter={() => canPlay && setHoveredCell(cell)}
                  onPointerLeave={() => setHoveredCell(null)}
                  style={{
                    position: 'absolute',
                    left: `${left}px`,
                    top: `${top}px`,
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                  }}
                  className={cn(
                    'pointer-events-auto group relative flex items-center justify-center',
                    'border border-line/35 transition-colors duration-100',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70',
                    value === undefined && canPlay && 'cursor-pointer hover:bg-accent/10 active:scale-90',
                    value === undefined && !canPlay && 'cursor-default',
                    value !== undefined && 'cursor-default',
                    isWinning && 'border-amber-400/80 bg-amber-400/20 shadow-[0_0_12px_rgba(251,191,36,0.4)]',
                    isCenter && value === undefined && 'bg-accent/5',
                  )}
                >
                  {/* Subtle origin coordinate guide point */}
                  {isCenter && value === undefined && (
                    <span className="pointer-events-none absolute h-2 w-2 rounded-full bg-accent/40" />
                  )}

                  {/* Star points (Hoshi) every 5 cells for visual navigation */}
                  {Math.abs(x) % 5 === 0 && Math.abs(y) % 5 === 0 && !isCenter && value === undefined && (
                    <span className="pointer-events-none absolute h-1 w-1 rounded-full bg-muted/20" />
                  )}

                  {/* Placed Stones */}
                  {value === 'X' ? <XMark /> : null}
                  {value === 'O' ? <OMark /> : null}

                  {/* Latest Move Indicator Dot (Matching reference design) */}
                  {isLast && (
                    <span
                      className={cn(
                        'pointer-events-none absolute right-1.5 top-1.5 h-2 w-2 rounded-full ring-2 ring-surface',
                        value === 'X' ? 'bg-accent shadow-[0_0_8px_rgba(37,99,235,0.8)]' : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]',
                        'animate-pulse',
                      )}
                    />
                  )}

                  {/* Winning stone halo glow */}
                  {isWinning && (
                    <span className="pointer-events-none absolute inset-0 rounded-sm ring-2 ring-amber-400/80 shadow-[0_0_14px_rgba(251,191,36,0.6)] animate-pulse" />
                  )}

                  {/* Hover ghost placement preview */}
                  {hoveredCell === cell && canPlay && (
                    <span className="pointer-events-none absolute text-base font-bold text-accent/40">
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
          <div className="rounded-full border border-line bg-surface/92 px-2.5 py-1 text-[10px] font-semibold text-muted shadow-sm backdrop-blur-md">
            Pos: ({currentCenterX}, {currentCenterY}) · 5 to win
          </div>

          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-surface/92 p-1 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={recenter}
              title="Recenter on latest move"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-85"
            >
              <Crosshair className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={zoomOut}
              title="Zoom out"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-85"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={zoomIn}
              title="Zoom in"
              className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-85"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
