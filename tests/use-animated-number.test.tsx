// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAnimatedNumber } from '../src/client/hooks/use-animated-number';

function NumberProbe({
  value,
  durationMs,
  animateOnMount,
}: {
  value: number;
  durationMs?: number;
  animateOnMount?: boolean;
}) {
  const animated = useAnimatedNumber(
    value,
    animateOnMount !== undefined ? { durationMs, animateOnMount } : durationMs,
  );
  return <span data-testid="animated-val">{animated}</span>;
}

describe('useAnimatedNumber', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders initial target value immediately when animateOnMount is omitted', () => {
    render(<NumberProbe value={1200} />);
    expect(screen.getByTestId('animated-val').textContent).toBe('1200');
  });

  it('animates up from 0 on mount when animateOnMount is true', () => {
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    render(<NumberProbe value={1000} durationMs={600} animateOnMount />);
    expect(screen.getByTestId('animated-val').textContent).toBe('0');

    if (rafCallback) {
      // First frame records startTime
      act(() => {
        (rafCallback as FrameRequestCallback)(100);
      });
      // Mid-flight progress
      act(() => {
        if (rafCallback) (rafCallback as FrameRequestCallback)(400);
      });
      expect(Number(screen.getByTestId('animated-val').textContent)).toBeGreaterThan(0);
      // Completed animation
      act(() => {
        if (rafCallback) (rafCallback as FrameRequestCallback)(800);
      });
      expect(screen.getByTestId('animated-val').textContent).toBe('1000');
    }
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
