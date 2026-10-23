import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Board as BoardType } from '../../shared/game-types';
import { decodeCell, encodeCell } from '../../shared/game-types';
import { cn } from '../lib/cn';
import { hapticImpact } from '../lib/telegram';

interface BoardProps {
  board: BoardType;
  winningLine: number[] | null;
  lastMoveCell: number | null;
  pendingCell?: number | null;
  yourTurn: boolean;
  disabled: boolean;
  onCell: (cell: number) => void;
}

const CELL_SIZE = 48; // Base cell dimension in px for comfortable mobile finger tapping.
const MIN_ZOOM = 0.65;
const MAX_ZOOM = 1.5;
// Must stay larger than MAX_ZOOM * CELL_SIZE so the repeating grid always
// covers the viewport while its transform is wrapped by one cell.
const GRID_OVERSCAN = 96;
const DRAG_THRESHOLD = 6;
const INERTIA_DECAY = 0.005;

interface Point {
  x: number;
  y: number;
}

interface PinchState {
  distance: number;
  zoom: number;
  worldX: number;
  worldY: number;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

function scheduleFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return window.setTimeout(() => callback(performance.now()), 16);
}

function cancelScheduledFrame(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else window.clearTimeout(id);
}

function XMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark-enter h-[68%] w-[68%] text-accent" aria-hidden>
      <path
        d="M22 22 L78 78 M78 22 L22 78"
        fill="none"
        stroke="currentColor"
        strokeWidth="14"
        strokeLinecap="round"
        pathLength={100}
        className="mark-stroke"
      />
    </svg>
  );
}

function OMark() {
  return (
    <svg viewBox="0 0 100 100" className="mark-enter h-[70%] w-[70%] text-danger" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        pathLength={100}
        className="mark-stroke"
      />
    </svg>
  );
}

export const Board = memo(function Board({
  board,
  winningLine,
  lastMoveCell,
  pendingCell = null,
  yourTurn,
  disabled,
  onCell,
}: BoardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const instructionsId = useId();

  // The camera lives in refs so a pointer move can update transforms without
  // making React reconcile the board on every frame.
  const panRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const sizeRef = useRef({ width: 0, height: 0 });
  const lastCellSizeRef = useRef(0);

  const activePointers = useRef<Map<number, Point>>(new Map());
  const dragStart = useRef({ clientX: 0, clientY: 0, panX: 0, panY: 0 });
  const pinchRef = useRef<PinchState | null>(null);
  const didMove = useRef(false);
  const velocityRef = useRef<Point>({ x: 0, y: 0 });
  const lastMotionRef = useRef({ x: 0, y: 0, time: 0 });

  const applyRafRef = useRef<number | null>(null);
  const inertiaRafRef = useRef<number | null>(null);
  const animationRafRef = useRef<number | null>(null);
  const lastMoveRef = useRef<number | null>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);

  const winningSet = useMemo(() => new Set(winningLine ?? []), [winningLine]);
  const stones = useMemo(
    () =>
      Object.entries(board).map(([cellKey, side]) => {
        const cell = Number(cellKey);
        const { x, y } = decodeCell(cell);
        return { cell, x, y, side };
      }),
    [board],
  );
  const winningBeam = useMemo(() => {
    if (!winningLine || winningLine.length < 2) return null;
    const firstCell = winningLine[0];
    const lastCell = winningLine[winningLine.length - 1];
    if (firstCell === undefined || lastCell === undefined) return null;

    const start = decodeCell(firstCell);
    const end = decodeCell(lastCell);
    const dx = (end.x - start.x) * CELL_SIZE;
    const dy = (end.y - start.y) * CELL_SIZE;

    return {
      angle: Math.atan2(dy, dx),
      length: Math.hypot(dx, dy) + CELL_SIZE * 0.72,
      x: ((start.x + end.x) / 2) * CELL_SIZE,
      y: ((start.y + end.y) / 2) * CELL_SIZE,
    };
  }, [winningLine]);

  const applyView = useCallback(() => {
    const pan = panRef.current;
    const zoom = zoomRef.current;

    const world = worldRef.current;
    if (world) {
      world.style.transform = `translate3d(${pan.x * zoom}px, ${pan.y * zoom}px, 0) scale(${zoom})`;
    }

    const grid = gridRef.current;
    if (grid) {
      const cell = CELL_SIZE * zoom;
      if (Math.abs(cell - lastCellSizeRef.current) > 0.01) {
        lastCellSizeRef.current = cell;
        grid.style.backgroundSize = `${cell}px ${cell}px`;
      }

      const { width, height } = sizeRef.current;
      const phaseX = mod(width / 2 + pan.x * zoom + cell / 2 + GRID_OVERSCAN, cell);
      const phaseY = mod(height / 2 + pan.y * zoom + cell / 2 + GRID_OVERSCAN, cell);
      grid.style.transform = `translate3d(${phaseX}px, ${phaseY}px, 0)`;
    }
  }, []);

  const stopMotion = useCallback(() => {
    if (applyRafRef.current !== null) {
      cancelScheduledFrame(applyRafRef.current);
      applyRafRef.current = null;
    }
    if (inertiaRafRef.current !== null) {
      cancelScheduledFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
    if (animationRafRef.current !== null) {
      cancelScheduledFrame(animationRafRef.current);
      animationRafRef.current = null;
    }
    velocityRef.current = { x: 0, y: 0 };
  }, []);

  const requestApply = useCallback(() => {
    if (applyRafRef.current !== null) return;
    applyRafRef.current = scheduleFrame(() => {
      applyRafRef.current = null;
      applyView();
    });
  }, [applyView]);

  const animateTo = useCallback(
    (targetX: number, targetY: number, targetZoom: number, duration = 300) => {
      stopMotion();

      const startX = panRef.current.x;
      const startY = panRef.current.y;
      const startZoom = zoomRef.current;
      const travel = Math.hypot(targetX - startX, targetY - startY);
      const zoomTravel = Math.abs(targetZoom - startZoom);

      if (travel < 0.01 && zoomTravel < 0.001) {
        applyView();
        return;
      }

      if (duration <= 0 || prefersReducedMotion()) {
        panRef.current = { x: targetX, y: targetY };
        zoomRef.current = targetZoom;
        applyView();
        return;
      }

      const startedAt = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        panRef.current = {
          x: startX + (targetX - startX) * eased,
          y: startY + (targetY - startY) * eased,
        };
        zoomRef.current = startZoom + (targetZoom - startZoom) * eased;
        applyView();

        if (progress < 1) {
          animationRafRef.current = scheduleFrame(tick);
        } else {
          animationRafRef.current = null;
        }
      };

      animationRafRef.current = scheduleFrame(tick);
    },
    [applyView, stopMotion],
  );

  const startInertia = useCallback(() => {
    if (prefersReducedMotion()) return;

    const initial = velocityRef.current;
    const speed = Math.hypot(initial.x, initial.y);
    if (speed < 0.05) return;

    // Avoid a single high-frequency pointer sample throwing the view far away.
    const capped = speed > 5 ? 5 / speed : 1;
    velocityRef.current = { x: initial.x * capped, y: initial.y * capped };
    const zoom = zoomRef.current;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = Math.min(48, now - lastTime);
      lastTime = now;
      const decay = Math.exp(-INERTIA_DECAY * delta);
      velocityRef.current = {
        x: velocityRef.current.x * decay,
        y: velocityRef.current.y * decay,
      };

      panRef.current = {
        x: panRef.current.x + (velocityRef.current.x * delta) / zoom,
        y: panRef.current.y + (velocityRef.current.y * delta) / zoom,
      };
      applyView();

      if (Math.hypot(velocityRef.current.x, velocityRef.current.y) > 0.02) {
        inertiaRafRef.current = scheduleFrame(tick);
      } else {
        inertiaRafRef.current = null;
        velocityRef.current = { x: 0, y: 0 };
      }
    };

    inertiaRafRef.current = scheduleFrame(tick);
  }, [applyView]);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        sizeRef.current = { width: rect.width, height: rect.height };
        applyView();
      }
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
        sizeRef.current = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
        applyView();
      });
      observer.observe(element);
    }

    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [applyView]);

  useEffect(
    () => () => {
      if (applyRafRef.current !== null) cancelScheduledFrame(applyRafRef.current);
      if (inertiaRafRef.current !== null) cancelScheduledFrame(inertiaRafRef.current);
      if (animationRafRef.current !== null) cancelScheduledFrame(animationRafRef.current);
    },
    [],
  );

  // Follow the opponent's latest move unless the player is actively dragging.
  useEffect(() => {
    if (lastMoveCell === null) {
      if (lastMoveRef.current !== null) {
        lastMoveRef.current = null;
        animateTo(0, 0, 1, 320);
      }
      return;
    }

    if (lastMoveCell === lastMoveRef.current) return;
    lastMoveRef.current = lastMoveCell;
    if (activePointers.current.size > 0) return;

    const { x, y } = decodeCell(lastMoveCell);
    const targetX = -x * CELL_SIZE;
    const targetY = -y * CELL_SIZE;
    const travel = Math.hypot(targetX - panRef.current.x, targetY - panRef.current.y);
    const duration = Math.min(320, Math.max(200, Math.round(140 + Math.sqrt(travel) * 10)));
    animateTo(targetX, targetY, zoomRef.current, duration);
  }, [lastMoveCell, animateTo]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      stopMotion();

      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const zoom = zoomRef.current;
      if (event.ctrlKey || event.metaKey) {
        const factor = Math.exp(-event.deltaY * 0.0015);
        const nextZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
        if (nextZoom === zoom) return;

        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const worldX = (localX - rect.width / 2 - panRef.current.x * zoom) / zoom;
        const worldY = (localY - rect.height / 2 - panRef.current.y * zoom) / zoom;
        panRef.current = {
          x: (localX - rect.width / 2) / nextZoom - worldX,
          y: (localY - rect.height / 2) / nextZoom - worldY,
        };
        zoomRef.current = nextZoom;
      } else {
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? rect.height : 1;
        panRef.current = {
          x: panRef.current.x - (event.deltaX * unit) / zoom,
          y: panRef.current.y - (event.deltaY * unit) / zoom,
        };
      }

      requestApply();
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [requestApply, stopMotion]);

  const recenter = useCallback(() => {
    hapticImpact('light');
    const target = lastMoveCell === null ? { x: 0, y: 0 } : decodeCell(lastMoveCell);
    animateTo(-target.x * CELL_SIZE, -target.y * CELL_SIZE, 1, 300);
  }, [animateTo, lastMoveCell]);

  const zoomIn = useCallback(() => {
    const next = clamp(Number((zoomRef.current + 0.15).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    if (next === zoomRef.current) return;
    hapticImpact('light');
    animateTo(panRef.current.x, panRef.current.y, next, 180);
  }, [animateTo]);

  const zoomOut = useCallback(() => {
    const next = clamp(Number((zoomRef.current - 0.15).toFixed(2)), MIN_ZOOM, MAX_ZOOM);
    if (next === zoomRef.current) return;
    hapticImpact('light');
    animateTo(panRef.current.x, panRef.current.y, next, 180);
  }, [animateTo]);

  const cellAtPoint = useCallback((clientX: number, clientY: number): number | null => {
    const element = containerRef.current;
    if (!element) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const zoom = zoomRef.current;
    const worldX = (clientX - rect.left - rect.width / 2 - panRef.current.x * zoom) / zoom;
    const worldY = (clientY - rect.top - rect.height / 2 - panRef.current.y * zoom) / zoom;
    return encodeCell(Math.round(worldX / CELL_SIZE), Math.round(worldY / CELL_SIZE));
  }, []);

  const placeCellAt = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !yourTurn) return;
      const cell = cellAtPoint(clientX, clientY);
      if (cell === null || board[cell] !== undefined) return;
      hapticImpact('medium');
      onCell(cell);
    },
    [board, cellAtPoint, disabled, onCell, yourTurn],
  );

  const updateHover = useCallback(
    (clientX: number, clientY: number) => {
      if (disabled || !yourTurn) {
        setHoveredCell((current) => (current === null ? current : null));
        return;
      }
      const cell = cellAtPoint(clientX, clientY);
      const next = cell !== null && board[cell] === undefined ? cell : null;
      setHoveredCell((current) => (current === next ? current : next));
    },
    [board, cellAtPoint, disabled, yourTurn],
  );

  const beginPinch = () => {
    const points = Array.from(activePointers.current.values());
    if (points.length < 2) return;
    const [first, second] = points;
    if (!first || !second) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return;

    const zoom = zoomRef.current;
    const midX = (first.x + second.x) / 2 - rect.left;
    const midY = (first.y + second.y) / 2 - rect.top;
    const pan = panRef.current;

    pinchRef.current = {
      distance: Math.max(1, Math.hypot(first.x - second.x, first.y - second.y)),
      zoom,
      worldX: (midX - rect.width / 2 - pan.x * zoom) / zoom,
      worldY: (midY - rect.height / 2 - pan.y * zoom) / zoom,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    stopMotion();
    try {
      // Capture immediately so a mouse released outside the window still
      // finishes the gesture instead of leaving a stale pointer behind.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail in older WebViews; panning still works.
    }
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.current.size === 1) {
      didMove.current = false;
      pinchRef.current = null;
      setIsPanning(false);
      setHoveredCell(null);
      dragStart.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        panX: panRef.current.x,
        panY: panRef.current.y,
      };
      lastMotionRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: performance.now(),
      };
      velocityRef.current = { x: 0, y: 0 };
    } else if (activePointers.current.size === 2) {
      didMove.current = true;
      setIsPanning(true);
      velocityRef.current = { x: 0, y: 0 };
      beginPinch();
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) {
      if (event.pointerType === 'mouse') updateHover(event.clientX, event.clientY);
      return;
    }

    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.current.size >= 2) {
      if (!pinchRef.current) beginPinch();
      const points = Array.from(activePointers.current.values());
      const [first, second] = points;
      const pinch = pinchRef.current;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!first || !second || !pinch || !rect || rect.width <= 0 || rect.height <= 0) return;

      const distance = Math.max(1, Math.hypot(first.x - second.x, first.y - second.y));
      const nextZoom = clamp(pinch.zoom * (distance / pinch.distance), MIN_ZOOM, MAX_ZOOM);
      const midX = (first.x + second.x) / 2 - rect.left;
      const midY = (first.y + second.y) / 2 - rect.top;

      zoomRef.current = nextZoom;
      panRef.current = {
        x: (midX - rect.width / 2) / nextZoom - pinch.worldX,
        y: (midY - rect.height / 2) / nextZoom - pinch.worldY,
      };
      requestApply();
      return;
    }

    if (activePointers.current.size !== 1) return;

    const deltaX = event.clientX - dragStart.current.clientX;
    const deltaY = event.clientY - dragStart.current.clientY;

    if (!didMove.current && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      didMove.current = true;
      setIsPanning(true);
    }

    if (!didMove.current) return;

    const now = performance.now();
    const previous = lastMotionRef.current;
    if (now - previous.time > 100) {
      lastMotionRef.current = { x: event.clientX, y: event.clientY, time: now };
      velocityRef.current = { x: 0, y: 0 };
    } else {
      const deltaTime = now - previous.time;
      if (deltaTime > 0) {
        const instantX = (event.clientX - previous.x) / deltaTime;
        const instantY = (event.clientY - previous.y) / deltaTime;
        velocityRef.current = {
          x: velocityRef.current.x * 0.35 + instantX * 0.65,
          y: velocityRef.current.y * 0.35 + instantY * 0.65,
        };
        lastMotionRef.current = { x: event.clientX, y: event.clientY, time: now };
      }
    }

    const zoom = zoomRef.current;
    panRef.current = {
      x: dragStart.current.panX + deltaX / zoom,
      y: dragStart.current.panY + deltaY / zoom,
    };
    requestApply();
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!activePointers.current.has(event.pointerId)) return;

    const wasTap = !didMove.current && activePointers.current.size === 1;
    const releasedOverHud =
      event.target instanceof Element && Boolean(event.target.closest('[data-board-hud]'));

    activePointers.current.delete(event.pointerId);
    pinchRef.current = null;

    if (activePointers.current.size === 0) {
      setIsPanning(false);

      if (wasTap && !releasedOverHud) {
        placeCellAt(event.clientX, event.clientY);
      }

      if (didMove.current) {
        const now = performance.now();
        if (now - lastMotionRef.current.time > 90) {
          velocityRef.current = { x: 0, y: 0 };
        }
        startInertia();
      } else {
        velocityRef.current = { x: 0, y: 0 };
      }
    } else if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      if (remaining) {
        dragStart.current = {
          clientX: remaining.x,
          clientY: remaining.y,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        lastMotionRef.current = { x: remaining.x, y: remaining.y, time: performance.now() };
      }
      velocityRef.current = { x: 0, y: 0 };
    }
  };

  const handlePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointers.current.has(event.pointerId)) return;

    activePointers.current.delete(event.pointerId);
    pinchRef.current = null;
    velocityRef.current = { x: 0, y: 0 };

    if (activePointers.current.size === 0) {
      setIsPanning(false);
    } else if (activePointers.current.size === 1) {
      const remaining = Array.from(activePointers.current.values())[0];
      if (remaining) {
        dragStart.current = {
          clientX: remaining.x,
          clientY: remaining.y,
          panX: panRef.current.x,
          panY: panRef.current.y,
        };
        lastMotionRef.current = { x: remaining.x, y: remaining.y, time: performance.now() };
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;

    const key = event.key;
    const pan = panRef.current;
    let handled = true;

    if (key === 'ArrowLeft') panRef.current = { ...pan, x: pan.x + CELL_SIZE };
    else if (key === 'ArrowRight') panRef.current = { ...pan, x: pan.x - CELL_SIZE };
    else if (key === 'ArrowUp') panRef.current = { ...pan, y: pan.y + CELL_SIZE };
    else if (key === 'ArrowDown') panRef.current = { ...pan, y: pan.y - CELL_SIZE };
    else if (key === 'Enter' || key === ' ') {
      if (!event.repeat) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) placeCellAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    } else if (key === 'Home') {
      recenter();
    } else if (key === '+' || key === '=') {
      zoomIn();
    } else if (key === '-' || key === '_') {
      zoomOut();
    } else {
      handled = false;
    }

    if (!handled) return;
    event.preventDefault();

    // Home and the zoom keys already start their own animated view change.
    if (key === 'Home' || key === '+' || key === '=' || key === '-' || key === '_') return;

    stopMotion();
    requestApply();
  };

  const hovered = hoveredCell !== null ? decodeCell(hoveredCell) : null;
  const canHover = hoveredCell !== null && !disabled && yourTurn && board[hoveredCell] === undefined;

  return (
    <div className="relative h-full w-full select-none bg-app">
      <div
        ref={containerRef}
        role="application"
        aria-label="Infinite 5-in-a-row board"
        aria-describedby={instructionsId}
        aria-roledescription="infinite game grid"
        tabIndex={0}
        className={cn(
          'game-grid-surface relative h-full w-full touch-none overflow-hidden outline-none',
          'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60',
          isPanning ? 'cursor-grabbing' : 'cursor-grab',
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={() => {
          if (activePointers.current.size === 0) setHoveredCell(null);
        }}
        onKeyDown={handleKeyDown}
        onContextMenu={(event) => event.preventDefault()}
      >
        {/* Repeating line layer. It is translated by at most one cell, so it
            covers the viewport while the board itself stays visually infinite. */}
        <div
          ref={gridRef}
          aria-hidden
          className="pointer-events-none absolute will-change-transform"
          style={{
            inset: -GRID_OVERSCAN,
            backgroundImage:
              'linear-gradient(to right, rgb(var(--app-muted-rgb) / 0.22) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--app-muted-rgb) / 0.22) 1px, transparent 1px)',
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        {/* Stones live in a single transformed layer. Panning changes this
            layer's transform only; React never re-renders per pointermove. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div
            ref={worldRef}
            className="relative h-0 w-0 origin-top-left will-change-transform"
            style={{ transform: 'translate3d(0px, 0px, 0) scale(1)' }}
          >
            {winningBeam ? (
              <div
                aria-hidden
                data-winning-beam
                className="pointer-events-none absolute flex items-center justify-center"
                style={{
                  left: `${winningBeam.x}px`,
                  top: `${winningBeam.y}px`,
                  width: `${winningBeam.length}px`,
                  height: `${CELL_SIZE * 0.84}px`,
                  transform: `translate(-50%, -50%) rotate(${winningBeam.angle}rad)`,
                }}
              >
                <span className="absolute inset-x-0 top-1/2 h-6 -translate-y-1/2 rounded-full bg-amber-400/10" />
                <span className="winning-beam relative h-[3px] w-full rounded-full bg-gradient-to-r from-amber-400/0 via-amber-300 to-amber-400/0 shadow-[0_0_14px_rgba(251,191,36,0.55)]" />
              </div>
            ) : null}

            {stones.map(({ cell, x, y, side }) => {
              const isWinning = winningSet.has(cell);
              const isLast = lastMoveCell === cell;
              const isPending = pendingCell === cell;

              return (
                <div
                  key={cell}
                  className={cn(
                    'pointer-events-none absolute flex items-center justify-center transition-opacity duration-150',
                    isPending && 'opacity-90',
                  )}
                  style={{
                    left: `${x * CELL_SIZE}px`,
                    top: `${y * CELL_SIZE}px`,
                    width: `${CELL_SIZE}px`,
                    height: `${CELL_SIZE}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {isWinning ? (
                    <span className="win-cell pointer-events-none absolute inset-0.5 rounded-xl bg-amber-400/15 ring-2 ring-amber-400/80 shadow-[0_0_18px_rgba(251,191,36,0.55)]" />
                  ) : null}
                  {isPending ? (
                    <span
                      className="pointer-events-none absolute inset-0.5 rounded-xl ring-2 ring-accent/70 ring-dashed animate-pulse bg-accent/10"
                      aria-hidden
                    />
                  ) : null}
                  {side === 'X' ? <XMark /> : <OMark />}
                  {isLast && !isPending ? (
                    <span
                      className={cn(
                        'last-move-dot pointer-events-none absolute right-1 top-1 h-2 w-2 rounded-full ring-2 ring-surface',
                        side === 'X'
                          ? 'bg-accent shadow-[0_0_8px_rgba(37,99,235,0.8)]'
                          : 'bg-danger shadow-[0_0_8px_rgba(239,68,68,0.8)]',
                      )}
                    />
                  ) : null}
                </div>
              );
            })}

            {board[encodeCell(0, 0)] === undefined ? (
              <span
                aria-hidden
                className="pointer-events-none absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/45 ring-4 ring-accent/10"
                style={{ left: 0, top: 0 }}
              />
            ) : null}

            {hovered && canHover ? (
              <div
                aria-hidden
                className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-dashed border-accent/50 bg-accent/5 text-lg font-semibold text-accent/40"
                style={{
                  left: `${hovered.x * CELL_SIZE}px`,
                  top: `${hovered.y * CELL_SIZE}px`,
                  width: `${CELL_SIZE - 8}px`,
                  height: `${CELL_SIZE - 8}px`,
                }}
              >
                +
              </div>
            ) : null}
          </div>
        </div>

        <p id={instructionsId} className="sr-only">
          Drag to pan, pinch or use plus and minus to zoom. Use the arrow keys to move the view and press Enter or Space to
          place a stone at the centre of the screen.
        </p>
      </div>
    </div>
  );
});
