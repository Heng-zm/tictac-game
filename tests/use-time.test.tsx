// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCountdown } from '../src/client/hooks/use-time';

const renderState = { count: 0 };

function Probe({ target, offsetMs = 0 }: { target: string; offsetMs?: number }) {
  const remaining = useCountdown(target, undefined, offsetMs);
  renderState.count += 1;
  return <span>{remaining}</span>;
}

describe('useCountdown', () => {
  afterEach(() => {
    cleanup();
    renderState.count = 0;
    vi.useRealTimers();
  });

  it('applies a server clock offset', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));

    render(<Probe target="2026-10-28T12:00:05.000Z" offsetMs={3_000} />);

    expect(screen.getByText('2000')).toBeTruthy();
  });

  it('stops ticking after the target is reached', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T12:00:00.000Z'));

    render(<Probe target="2026-10-28T12:00:01.000Z" />);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });

    const rendersAtExpiry = renderState.count;
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(renderState.count).toBe(rendersAtExpiry);
  });
});
