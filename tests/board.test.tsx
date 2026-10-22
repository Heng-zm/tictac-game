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

function renderBoard() {
  const onCell = vi.fn();
  render(
    <Board
      board={{}}
      winningLine={null}
      lastMoveCell={null}
      yourTurn
      disabled={false}
      onCell={onCell}
    />,
  );
  return { onCell };
}

describe('Board input', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
  });

  afterEach(() => {
    cleanup();
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
    const { onCell } = renderBoard();
    const cell = screen.getByLabelText('Position 0, 0, empty');

    fireEvent.pointerDown(cell, { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 90, clientY: 90 });
    fireEvent.pointerUp(cell, { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 90, clientY: 90 });
    expect(onCell).not.toHaveBeenCalled();

    fireEvent.pointerDown(cell, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 90, clientY: 90 });
    fireEvent.pointerCancel(cell, { pointerId: 3, pointerType: 'touch', button: 0, clientX: 90, clientY: 90 });
    expect(onCell).not.toHaveBeenCalled();
  });

  it('places exactly one stone on a normal cell tap', () => {
    const { onCell } = renderBoard();
    const cell = screen.getByLabelText('Position 0, 0, empty');
    const pointer = { pointerId: 4, pointerType: 'touch', button: 0, clientX: 90, clientY: 90 };

    fireEvent.pointerDown(cell, pointer);
    fireEvent.pointerUp(cell, pointer);
    fireEvent.click(cell);

    expect(onCell).toHaveBeenCalledOnce();
    expect(onCell).toHaveBeenCalledWith(encodeCell(0, 0));
  });
});
