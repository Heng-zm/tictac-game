import { describe, expect, it } from 'vitest';
import { formatLongDuration } from '../src/client/hooks/use-time';
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
});
