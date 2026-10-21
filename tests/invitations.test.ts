import { describe, expect, it } from 'vitest';
import {
  INVITE_TOKEN_PATTERN,
  buildInviteDeepLink,
  extractInviteToken,
  generateInvitationToken,
  hashInvitationToken,
} from '../src/server/services/invitations';
import { makeTestConfig } from './helpers';

describe('invitation helpers', () => {
  it('generates URL-safe 32-byte tokens and stable hashes', () => {
    const { token, tokenHash } = generateInvitationToken();
    expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(tokenHash).toBe(hashInvitationToken(token));
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(generateInvitationToken().token).not.toBe(token);
  });

  it('builds Telegram start deep links', () => {
    const config = makeTestConfig({ telegramBotUsername: 'tictactoe_bot' });
    const { token } = generateInvitationToken();
    const link = buildInviteDeepLink(config, token);
    expect(link).toBe(`https://t.me/tictactoe_bot?start=invite_${token}`);

    const withApp = buildInviteDeepLink(
      makeTestConfig({ telegramBotUsername: 'tictactoe_bot', telegramAppName: 'app' }),
      token,
    );
    expect(withApp).toBe(`https://t.me/tictactoe_bot/app?startapp=invite_${token}`);
  });

  it('falls back to the Mini App URL during local development', () => {
    const config = makeTestConfig({
      telegramBotUsername: null,
      miniAppUrl: 'http://localhost:5173',
    });
    const { token } = generateInvitationToken();
    const link = buildInviteDeepLink(config, token);
    expect(link).toBe(`http://localhost:5173/?startapp=invite_${token}`);
  });

  it('extracts only valid invite start parameters', () => {
    const { token } = generateInvitationToken();
    const config = makeTestConfig({ telegramBotUsername: 'tictactoe_bot' });
    const link = new URL(buildInviteDeepLink(config, token));
    expect(extractInviteToken(link.searchParams.get('start'))).toBe(token);
    expect(extractInviteToken('invite_short')).toBeNull();
    expect(extractInviteToken('invite_'.concat('!'.repeat(43)))).toBeNull();
    expect(extractInviteToken('other_value')).toBeNull();
    expect(extractInviteToken(null)).toBeNull();
  });
});
