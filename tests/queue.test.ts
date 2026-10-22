import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MatchmakingQueue } from '../src/server/matchmaking/queue';
import type { QueueStatus } from '../src/shared/game-types';
import { MutableClock, makeTestConfig, makeTestLogger } from './helpers';

describe('MatchmakingQueue', () => {
  let clock: MutableClock;
  let statuses: Array<{ userId: string; status: QueueStatus }>;
  let matched: Array<[string, string]>;
  let fallbacks: string[];
  let queue: MatchmakingQueue;

  beforeEach(() => {
    vi.useFakeTimers();
    clock = new MutableClock();
    vi.setSystemTime(clock.now());
    statuses = [];
    matched = [];
    fallbacks = [];
    queue = new MatchmakingQueue({
      config: makeTestConfig({ queueAiTimeoutMs: 60_000, queueMaxWaitMs: 120_000 }),
      logger: makeTestLogger(),
      now: clock.now,
      notify: (userId, status) => statuses.push({ userId, status }),
      onMatch: async (first, second) => {
        matched.push([first, second]);
      },
      onAutoFallback: async (userId) => {
        fallbacks.push(userId);
      },
    });
  });

  afterEach(() => {
    queue.shutdown();
    vi.useRealTimers();
  });

  async function advance(ms: number): Promise<void> {
    clock.advance(ms);
    await vi.advanceTimersByTimeAsync(ms);
  }

  it('returns searching status and pairs the oldest waiting player', async () => {
    const first = queue.join('user-a', false);
    expect(first).toMatchObject({
      state: 'searching',
      mode: 'RANDOM',
      waitingPlayers: 1,
      autoFallback: false,
    });
    expect(first.fallbackAt).toBe('2026-10-21T12:01:00.000Z');

    const second = queue.join('user-b', false);
    // Both entries are removed immediately when a pair is found.
    expect(second.state).toBe('matched');
    expect(second.waitingPlayers).toBe(0);
    await vi.advanceTimersByTimeAsync(0);

    expect(matched).toEqual([['user-a', 'user-b']]);
    expect(queue.size()).toBe(0);
    expect(queue.isQueued('user-a')).toBe(false);
  });

  it('does not match a user with themselves or duplicate an existing entry', async () => {
    queue.join('user-a', false);
    const again = queue.join('user-a', false);
    expect(again.state).toBe('searching');
    expect(again.waitingPlayers).toBe(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(matched).toEqual([]);
  });

  it('cancels and notifies only when requested', () => {
    queue.join('user-a', false);
    expect(queue.cancel('user-a')).toBe(true);
    expect(statuses.at(-1)?.status).toMatchObject({ state: 'cancelled' });
    expect(queue.cancel('user-a')).toBe(false);

    statuses = [];
    queue.join('user-b', false);
    queue.handleDisconnect('user-b');
    expect(queue.isQueued('user-b')).toBe(false);
    expect(statuses).toEqual([]);
  });

  it('offers a bot fallback after the configured wait but stays queued', async () => {
    queue.join('user-a', false);
    await advance(60_000);

    expect(queue.isQueued('user-a')).toBe(true);
    const offer = statuses.at(-1);
    expect(offer?.status).toMatchObject({
      state: 'searching',
      fallbackAvailable: true,
      autoFallback: false,
    });
    expect(offer?.status.message).toBeUndefined();
    expect(fallbacks).toEqual([]);
  });

  it('starts an AI match automatically when the preference is set', async () => {
    queue.join('user-a', true);
    await advance(60_000);

    expect(fallbacks).toEqual(['user-a']);
    expect(queue.isQueued('user-a')).toBe(false);
    expect(statuses.at(-1)?.status.state).toBe('matched');
  });

  it('starts the bot immediately when auto-fallback is enabled after the offer', async () => {
    queue.join('user-a', false);
    await advance(60_000);
    expect(fallbacks).toEqual([]);

    const status = queue.join('user-a', true);
    expect(status.state).toBe('matched');
    await vi.advanceTimersByTimeAsync(0);

    expect(fallbacks).toEqual(['user-a']);
    expect(queue.isQueued('user-a')).toBe(false);
    expect(statuses.at(-1)?.status).toMatchObject({
      state: 'matched',
      autoFallback: true,
      fallbackAvailable: true,
    });
  });

  it('expires entries after the maximum wait and clears all timers on shutdown', async () => {
    const expiringQueue = new MatchmakingQueue({
      config: makeTestConfig({ queueAiTimeoutMs: 60_000, queueMaxWaitMs: 5_000 }),
      logger: makeTestLogger(),
      now: clock.now,
      notify: (userId, status) => statuses.push({ userId, status }),
      onMatch: async () => undefined,
      onAutoFallback: async () => undefined,
    });
    try {
      expiringQueue.join('user-a', false);
      await advance(5_000);
      expect(expiringQueue.size()).toBe(0);
      expect(statuses.at(-1)?.status).toMatchObject({ state: 'expired' });

      expiringQueue.join('user-b', false);
      expiringQueue.join('user-c', false);
      expiringQueue.shutdown();
      expect(expiringQueue.size()).toBe(0);
      await advance(60_000);
      expect(statuses.filter((entry) => entry.status.state === 'expired')).toHaveLength(1);
    } finally {
      expiringQueue.shutdown();
    }
  });

  it('notifies both players when match creation fails', async () => {
    const failingQueue = new MatchmakingQueue({
      config: makeTestConfig({ queueAiTimeoutMs: 60_000, queueMaxWaitMs: 120_000 }),
      logger: makeTestLogger(),
      now: clock.now,
      notify: (userId, status) => statuses.push({ userId, status }),
      onMatch: async () => {
        throw new Error('database unavailable');
      },
      onAutoFallback: async () => undefined,
    });
    try {
      failingQueue.join('user-a', false);
      failingQueue.join('user-b', false);
      await vi.advanceTimersByTimeAsync(0);
      expect(statuses).toEqual([
        expect.objectContaining({
          userId: 'user-a',
          status: expect.objectContaining({ state: 'error' }),
        }),
        expect.objectContaining({
          userId: 'user-b',
          status: expect.objectContaining({ state: 'error' }),
        }),
      ]);
    } finally {
      failingQueue.shutdown();
    }
  });

  it('reports status for a queued user and null afterwards', () => {
    expect(queue.getStatus('user-a')).toBeNull();
    queue.join('user-a', false);
    clock.advance(500);
    expect(queue.getStatus('user-a')).toMatchObject({ state: 'searching', elapsedMs: 500 });
    queue.cancel('user-a');
    expect(queue.getStatus('user-a')).toBeNull();
  });
});
