import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatClock, formatDuration, formatLongDuration } from '../src/client/hooks/use-time';
import { parseHash } from '../src/client/hooks/use-hash-route';
import {
  parseGameMatchId,
  readStartParam,
  requestTelegramWriteAccess,
  setVerticalSwipeLock,
} from '../src/client/lib/telegram';
import { alignInviteLinkToCurrentOrigin, buildInviteDeepLink } from '../src/client/lib/invites';
import { rankForRating } from '../src/client/lib/ranks';

const localConfig = {
  botUsername: null,
  miniAppUrl: 'http://localhost:5173',
};

const publicConfig = {
  botUsername: null,
  miniAppUrl: 'https://tictactoe.example.com',
};

describe('client UI formatting', () => {
  it('formats invitation windows with hours and minutes', () => {
    expect(formatLongDuration(24 * 60 * 60_000)).toBe('24h');
    expect(formatLongDuration(23 * 60 * 60_000 + 59 * 60_000)).toBe('23h 59m');
    expect(formatLongDuration(45_000)).toBe('1m');
    expect(formatLongDuration(null)).toBe('--');
    expect(formatLongDuration(Number.NaN)).toBe('--');
  });

  it('safely formats duration without returning NaN', () => {
    expect(formatDuration(null)).toBe('--:--');
    expect(formatDuration(Number.NaN)).toBe('--:--');
    expect(formatDuration(65_000)).toBe('1:05');
  });

  it('safely formats clock without throwing on invalid date', () => {
    expect(formatClock('invalid-date')).toBe('');
  });

  it('parses hash routes and strips trailing query parameters cleanly', () => {
    expect(parseHash('#/game/123e4567-e89b-12d3-a456-426614174000?tgWebAppVersion=8.0')).toEqual({
      name: 'game',
      matchId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(parseHash('#/invite/abcdef1234567890abcdef1234567890abcdef12345?tgWebAppStartParam=foo')).toEqual({
      name: 'invite',
      token: 'abcdef1234567890abcdef1234567890abcdef12345',
    });
    expect(parseHash('#/search?foo=bar')).toEqual({ name: 'search' });
    expect(parseHash('#/profile/history?foo=bar')).toEqual({ name: 'profile', tab: 'history' });
    expect(parseHash('#/')).toEqual({ name: 'home' });
  });

  it('keeps local invite links reachable from the app origin', () => {
    const link = 'http://localhost:5173/?startapp=invite_example';
    expect(alignInviteLinkToCurrentOrigin(link, localConfig, 'http://192.168.18.11:3000')).toBe(
      'http://192.168.18.11:3000/?startapp=invite_example',
    );
  });

  it('does not rewrite public or Telegram invite links', () => {
    const publicLink = 'https://tictactoe.example.com/?startapp=invite_example';
    expect(alignInviteLinkToCurrentOrigin(publicLink, publicConfig, 'https://other.example.com')).toBe(publicLink);
    expect(
      alignInviteLinkToCurrentOrigin('https://t.me/tictactoe_bot?startapp=invite_example', localConfig, 'https://other.example.com'),
    ).toBe('https://t.me/tictactoe_bot?startapp=invite_example');
  });

  it('builds a local link against the current origin', () => {
    expect(buildInviteDeepLink(localConfig, 'example', 'http://localhost:3000')).toBe(
      'http://localhost:3000/?startapp=invite_example',
    );
  });

  it('reads start param from search or hash query params when window is defined', () => {
    expect(readStartParam()).toBeNull();
    const mockWindow = {
      location: {
        search: '?tgWebAppStartParam=invite_foo',
        hash: '#/game/123',
      },
    };
    vi.stubGlobal('window', mockWindow);
    expect(readStartParam()).toBe('invite_foo');

    mockWindow.location.search = '';
    mockWindow.location.hash = '#/test?tgWebAppStartParam=invite_hash';
    expect(readStartParam()).toBe('invite_hash');

    vi.unstubAllGlobals();
  });

  it('parses only valid game notification start params', () => {
    const matchId = '123e4567-e89b-42d3-a456-426614174000';
    expect(parseGameMatchId(`game_${matchId}`)).toBe(matchId);
    expect(parseGameMatchId('invite_foo')).toBeNull();
    expect(parseGameMatchId('game_short')).toBeNull();
    expect(parseGameMatchId(null)).toBeNull();
  });

  it('derives ladder tiers and progress from the rating', () => {
    expect(rankForRating(999)).toMatchObject({
      name: 'Rookie',
      nextRank: { name: 'Bronze' },
      pointsToNext: 1,
    });
    expect(rankForRating(1000)).toMatchObject({
      name: 'Bronze',
      nextRank: { name: 'Silver' },
      pointsToNext: 100,
      progress: 0,
    });
    expect(rankForRating(1099)).toMatchObject({ name: 'Bronze', pointsToNext: 1 });
    expect(rankForRating(1100)).toMatchObject({ name: 'Silver', nextRank: { name: 'Gold' } });
    expect(rankForRating(1800)).toMatchObject({ name: 'Master', nextRank: null, progress: 1 });
  });
});

describe('Telegram write access', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubWindow(requestWriteAccess: (callback?: (granted: boolean) => void) => void) {
    vi.stubGlobal('window', {
      Telegram: { WebApp: { initDataUnsafe: {}, requestWriteAccess } },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });
  }

  it('resolves allowed without prompting when permission is already granted', async () => {
    const requestWriteAccess = vi.fn();
    vi.stubGlobal('window', {
      Telegram: {
        WebApp: {
          initDataUnsafe: { user: { allows_write_to_pm: true } },
          requestWriteAccess,
        },
      },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });

    await expect(requestTelegramWriteAccess()).resolves.toBe('allowed');
    expect(requestWriteAccess).not.toHaveBeenCalled();
  });

  it('maps the Telegram callback to allowed or denied', async () => {
    stubWindow((callback) => callback?.(true));
    await expect(requestTelegramWriteAccess()).resolves.toBe('allowed');

    vi.unstubAllGlobals();
    stubWindow((callback) => callback?.(false));
    await expect(requestTelegramWriteAccess()).resolves.toBe('denied');
  });

  it('reports unsupported on older Telegram clients', async () => {
    vi.stubGlobal('window', {
      Telegram: { WebApp: { initDataUnsafe: {} } },
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
    });

    await expect(requestTelegramWriteAccess()).resolves.toBe('unsupported');
  });
});

describe('Telegram vertical swipe lock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables and restores vertical swipes around the game screen', () => {
    const disableVerticalSwipes = vi.fn();
    const enableVerticalSwipes = vi.fn();
    vi.stubGlobal('window', {
      Telegram: { WebApp: { disableVerticalSwipes, enableVerticalSwipes } },
    });

    setVerticalSwipeLock(true);
    expect(disableVerticalSwipes).toHaveBeenCalledOnce();
    expect(enableVerticalSwipes).not.toHaveBeenCalled();

    setVerticalSwipeLock(false);
    expect(enableVerticalSwipes).toHaveBeenCalledOnce();
  });

  it('is a no-op on clients without vertical swipe controls', () => {
    vi.stubGlobal('window', { Telegram: { WebApp: {} } });
    expect(() => setVerticalSwipeLock(true)).not.toThrow();

    vi.stubGlobal('window', {});
    expect(() => setVerticalSwipeLock(false)).not.toThrow();
  });
});
