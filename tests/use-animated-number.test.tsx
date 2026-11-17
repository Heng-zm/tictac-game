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

function value() {
  return screen.getByTestId('animated-val').textContent;
}

/** Captures requestAnimationFrame callbacks so frames can be driven by hand. */
function mockRaf() {
  let callback: FrameRequestCallback | null = null;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    callback = cb;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  return {
    frame(timestamp: number) {
      const next = callback;
      act(() => {
        if (next) next(timestamp);
      });
    },
  };
}

describe('useAnimatedNumber', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('renders initial target value immediately when animateOnMount is omitted', () => {
    render(<NumberProbe value={1200} />);
    expect(value()).toBe('1200');
  });

  it('animates up from 0 on mount when animateOnMount is true', () => {
    const raf = mockRaf();

    render(<NumberProbe value={1000} durationMs={600} animateOnMount />);
    expect(value()).toBe('0');

    // First frame records startTime
    raf.frame(100);
    // Mid-flight progress
    raf.frame(400);
    expect(Number(value())).toBeGreaterThan(0);
    expect(Number(value())).toBeLessThan(1000);
    // Completed animation
    raf.frame(800);
    expect(value()).toBe('1000');
  });

  it('safely handles non-finite numbers', () => {
    render(<NumberProbe value={NaN} />);
    expect(value()).toBe('0');
  });

  it('animates towards the new target on update', () => {
    const raf = mockRaf();

    const { rerender } = render(<NumberProbe value={100} durationMs={500} />);
    expect(value()).toBe('100');

    rerender(<NumberProbe value={200} durationMs={500} />);

    raf.frame(100);
    raf.frame(350);
    raf.frame(700);

    expect(Number(value())).toBe(200);
  });

  it('keeps animating after the mount animation when the target changes', () => {
    const raf = mockRaf();

    const { rerender } = render(<NumberProbe value={100} durationMs={600} animateOnMount />);
    raf.frame(0);
    raf.frame(600);
    expect(value()).toBe('100');

    rerender(<NumberProbe value={300} durationMs={600} animateOnMount />);
    raf.frame(1000);
    expect(Number(value())).toBe(100);

    raf.frame(1600);
    expect(value()).toBe('300');
  });

  it('keeps decimal precision for decimal targets', () => {
    const raf = mockRaf();

    render(<NumberProbe value={63.6} durationMs={600} animateOnMount />);
    raf.frame(0);
    raf.frame(300);
    expect(value()).toBe('59.6');

    raf.frame(600);
    expect(value()).toBe('63.6');
  });

  it('does not produce NaN for a zero or invalid duration', () => {
    const raf = mockRaf();

    render(<NumberProbe value={500} durationMs={0} animateOnMount />);
    raf.frame(0);
    expect(value()).not.toContain('NaN');

    raf.frame(1);
    expect(value()).toBe('500');
  });

  it('shows the final value immediately when reduced motion is requested', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));

    render(<NumberProbe value={1000} durationMs={600} animateOnMount />);
    expect(value()).toBe('1000');
  });
});
