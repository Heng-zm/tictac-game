// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Board } from '../src/client/components/Board';
import { encodeCell } from '../src/shared/game-types';

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

const boardRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  width: 400,
  height: 800,
  right: 400,
  bottom: 800,
  toJSON: () => ({}),
} as DOMRect;

function renderBoard(overrides: Partial<Parameters<typeof Board>[0]> = {}) {
  const onCell = vi.fn();
  render(
    <Board
      board={{}}
      winningLine={null}
      lastMoveCell={null}
      yourTurn
      disabled={false}
      onCell={onCell}
      {...overrides}
    />,
  );

  const grid = screen.getByRole('application', { name: 'Infinite 5-in-a-row board' });
  vi.spyOn(grid, 'getBoundingClientRect').mockReturnValue(boardRect);
  return { grid, onCell };
}

function tap(grid: HTMLElement, clientX = 200, clientY = 400, pointerId = 1) {
  const pointer = { pointerId, pointerType: 'touch', button: 0, clientX, clientY };
  fireEvent.pointerDown(grid, pointer);
  fireEvent.pointerUp(grid, pointer);
}

describe('Board input', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not place a stone when the HUD is tapped', () => {
    const { onCell } = renderBoard();
    const zoomIn = screen.getByTitle('Zoom in');
    const pointer = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 40, clientY: 40 };

    fireEvent.pointerDown(zoomIn, pointer);
    fireEvent.pointerUp(zoomIn, pointer);
    fireEvent.click(zoomIn);

    expect(onCell).not.toHaveBeenCalled();
  });

  it('ignores right-clicks and pointer cancellation', () => {
    const { grid, onCell } = renderBoard();

    fireEvent.pointerDown(grid, { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 200, clientY: 400 });
    fireEvent.pointerUp(grid, { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 200, clientY: 400 });
    expect(onCell).not.toHaveBeenCalled();

    fireEvent.pointerDown(grid, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 200, clientY: 400 });
    fireEvent.pointerCancel(grid, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 200, clientY: 400 });
    expect(onCell).not.toHaveBeenCalled();
  });

  it('places exactly one stone on a normal screen tap', () => {
    const { grid, onCell } = renderBoard();

    tap(grid);
    fireEvent.click(grid, { clientX: 200, clientY: 400, button: 0, detail: 1 });

    expect(onCell).toHaveBeenCalledOnce();
    expect(onCell).toHaveBeenCalledWith(encodeCell(0, 0));
  });

  it('maps a tap to the grid cell under the finger', () => {
    const { grid, onCell } = renderBoard();

    tap(grid, 248, 400, 8);

    expect(onCell).toHaveBeenCalledWith(encodeCell(1, 0));
  });

  it('does not place a stone after a drag', () => {
    const { grid, onCell } = renderBoard();

    fireEvent.pointerDown(grid, { pointerId: 4, pointerType: 'touch', button: 0, clientX: 200, clientY: 400 });
    fireEvent.pointerMove(grid, { pointerId: 4, pointerType: 'touch', button: 0, clientX: 260, clientY: 420 });
    fireEvent.pointerUp(grid, { pointerId: 4, pointerType: 'touch', button: 0, clientX: 260, clientY: 420 });

    expect(onCell).not.toHaveBeenCalled();
  });

  it('places a stone at the centre with the keyboard', () => {
    const { grid, onCell } = renderBoard();

    fireEvent.keyDown(grid, { key: 'Enter' });

    expect(onCell).toHaveBeenCalledOnce();
    expect(onCell).toHaveBeenCalledWith(encodeCell(0, 0));
  });

  it('does not place when the board is disabled or the centre is occupied', () => {
    const disabled = renderBoard({ disabled: true });
    tap(disabled.grid);
    expect(disabled.onCell).not.toHaveBeenCalled();
    cleanup();

    const occupied = renderBoard({ board: { [encodeCell(0, 0)]: 'X' } });
    tap(occupied.grid);
    expect(occupied.onCell).not.toHaveBeenCalled();
  });

  it('renders one settling winning beam instead of endless highlighted pulses', () => {
    const winningLine = [0, 1, 2, 3, 4].map((x) => encodeCell(x, 0));
    const board = Object.fromEntries(winningLine.map((cell) => [cell, 'X'])) as Record<number, 'X'>;

    renderBoard({ board, winningLine, lastMoveCell: winningLine[4] ?? null });

    const beam = document.querySelector('[data-winning-beam]');
    expect(beam).not.toBeNull();
    expect(beam?.querySelector('.winning-beam')).not.toBeNull();
    expect(document.querySelectorAll('.win-cell')).toHaveLength(5);
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });
});
