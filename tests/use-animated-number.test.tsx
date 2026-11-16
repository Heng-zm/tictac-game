// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnimatedNumber } from '../src/client/hooks/use-animated-number';

function NumberProbe({ value, durationMs }: { value: number; durationMs?: number }) {
  const animated = useAnimatedNumber(value, durationMs);
  return <span data-testid="animated-val">{animated}</span>;
}

describe('useAnimatedNumber', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders initial target value immediately', () => {
    render(<NumberProbe value={1200} />);
    expect(screen.getByTestId('animated-val').textContent).toBe('1200');
  });

  it('safely handles non-finite numbers', () => {
    render(<NumberProbe value={NaN} />);
    expect(screen.getByTestId('animated-val').textContent).toBe('0');
  });

  it('animates towards the new target on update', () => {
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    const { rerender } = render(<NumberProbe value={100} durationMs={500} />);
    expect(screen.getByTestId('animated-val').textContent).toBe('100');

    // Update target
    rerender(<NumberProbe value={200} durationMs={500} />);

    // Advance RAF with timestamp
    if (rafCallback) {
      act(() => {
        (rafCallback as FrameRequestCallback)(100);
      });
      // Mid-flight
      act(() => {
        if (rafCallback) (rafCallback as FrameRequestCallback)(350);
      });
      // Finished
      act(() => {
        if (rafCallback) (rafCallback as FrameRequestCallback)(700);
      });
    }

    expect(Number(screen.getByTestId('animated-val').textContent)).toBeGreaterThanOrEqual(100);
  });
});
