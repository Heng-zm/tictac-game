import { describe, expect, it, vi } from 'vitest';
import { formatClock, formatDuration, formatLongDuration } from '../src/client/hooks/use-time';
import { parseHash } from '../src/client/hooks/use-hash-route';
import { readStartParam } from '../src/client/lib/telegram';
import { alignInviteLinkToCurrentOrigin, buildInviteDeepLink } from '../src/client/lib/invites';

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
});
