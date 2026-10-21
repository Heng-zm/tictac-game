import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION_TTL_SECONDS,
  SESSION_COOKIE_NAME,
  createSessionToken,
  parseCookieHeader,
  verifySessionToken,
} from '../src/server/auth/session';
import { TEST_SESSION_SECRET } from './helpers';

const NOW = new Date('2026-10-21T12:00:00.000Z');

describe('session tokens', () => {
  it('round-trips a signed session for a Telegram user', () => {
    const token = createSessionToken(
      { id: 'user-1', telegramId: 123456789n },
      TEST_SESSION_SECRET,
      NOW,
    );
    const payload = verifySessionToken(token, TEST_SESSION_SECRET, NOW);
    expect(payload).toMatchObject({
      v: 1,
      uid: 'user-1',
      tid: '123456789',
    });
    expect(payload?.exp).toBe(payload!.iat + DEFAULT_SESSION_TTL_SECONDS);
  });

  it('supports development guest IDs (negative Telegram IDs)', () => {
    const token = createSessionToken(
      { id: 'guest-1', telegramId: -987654321n },
      TEST_SESSION_SECRET,
      NOW,
    );
    expect(verifySessionToken(token, TEST_SESSION_SECRET, NOW)?.tid).toBe('-987654321');
  });

  it('rejects tokens signed with another secret or tampered with', () => {
    const token = createSessionToken({ id: 'user-1', telegramId: 1n }, TEST_SESSION_SECRET, NOW);
    expect(verifySessionToken(token, `${TEST_SESSION_SECRET}-other`, NOW)).toBeNull();

    const [body, signature] = token.split('.');
    expect(body).toBeDefined();
    expect(signature).toBeDefined();
    const tamperedBody = Buffer.from(
      JSON.stringify({ v: 1, uid: 'user-2', tid: '1', iat: payloadIat(token), exp: payloadIat(token) + 100 }),
    ).toString('base64url');
    expect(verifySessionToken(`${tamperedBody}.${signature}`, TEST_SESSION_SECRET, NOW)).toBeNull();

    const flipped = `${signature!.slice(0, -2)}${signature!.endsWith('AA') ? 'BB' : 'AA'}`;
    expect(verifySessionToken(`${body}.${flipped}`, TEST_SESSION_SECRET, NOW)).toBeNull();
  });

  it('rejects expired and future-issued tokens', () => {
    const expired = createSessionToken(
      { id: 'user-1', telegramId: 1n },
      TEST_SESSION_SECRET,
      new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000),
    );
    expect(verifySessionToken(expired, TEST_SESSION_SECRET, NOW)).toBeNull();

    const future = createSessionToken(
      { id: 'user-1', telegramId: 1n },
      TEST_SESSION_SECRET,
      new Date(NOW.getTime() + 10 * 60 * 1000),
    );
    expect(verifySessionToken(future, TEST_SESSION_SECRET, NOW)).toBeNull();
  });

  it('rejects malformed tokens and unsafe payloads', () => {
    expect(verifySessionToken(undefined, TEST_SESSION_SECRET, NOW)).toBeNull();
    expect(verifySessionToken('', TEST_SESSION_SECRET, NOW)).toBeNull();
    expect(verifySessionToken('a.b.c', TEST_SESSION_SECRET, NOW)).toBeNull();
    expect(verifySessionToken('a'.repeat(2000), TEST_SESSION_SECRET, NOW)).toBeNull();
    expect(verifySessionToken('body.invalidsignature', TEST_SESSION_SECRET, NOW)).toBeNull();
  });

  it('parses cookies and decodes values safely', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
    expect(parseCookieHeader(`${SESSION_COOKIE_NAME}=abc.def; theme=dark`)).toEqual({
      [SESSION_COOKIE_NAME]: 'abc.def',
      theme: 'dark',
    });
    expect(parseCookieHeader('a=%E0%A4%A; b=hello%20world; malformed')).toEqual({
      a: '%E0%A4%A',
      b: 'hello world',
    });
  });
});

function payloadIat(token: string): number {
  const body = token.split('.')[0]!;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { iat: number };
  return payload.iat;
}
