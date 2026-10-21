import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TelegramAuthError,
  buildTelegramInitDataForTest,
  verifyTelegramInitData,
} from '../src/server/auth/telegram';
import { TEST_BOT_TOKEN } from './helpers';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

const VALID_USER = {
  id: 123456789,
  first_name: 'Alice',
  last_name: 'Example',
  username: 'alice_example',
  language_code: 'en',
  photo_url: 'https://example.com/alice.png',
};

function signParams(params: Record<string, string>, botToken = TEST_BOT_TOKEN): string {
  const dataCheckString = Object.entries(params)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return new URLSearchParams({ ...params, hash }).toString();
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(TelegramAuthError);
    expect((error as TelegramAuthError).code).toBe(code);
    return;
  }
  throw new Error(`Expected TelegramAuthError with code ${code}`);
}

describe('Telegram initData verification', () => {
  it('verifies correctly signed initData and normalizes the profile', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS - 10);
    const verified = verifyTelegramInitData(initData, TEST_BOT_TOKEN, {
      maxAgeSeconds: 86_400,
      now: NOW,
    });
    expect(verified).toEqual({
      telegramId: 123456789n,
      firstName: 'Alice',
      lastName: 'Example',
      username: 'alice_example',
      photoUrl: 'https://example.com/alice.png',
      languageCode: 'en',
      authDate: new Date((NOW_SECONDS - 10) * 1000),
    });
  });

  it('accepts extra signed fields regardless of order', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS - 10, {
      start_param: 'invite_example',
      chat_type: 'private',
    });
    expect(() =>
      verifyTelegramInitData(initData, TEST_BOT_TOKEN, { maxAgeSeconds: 86_400, now: NOW }),
    ).not.toThrow();
  });

  it('rejects tampered user data', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS - 10);
    const tampered = initData.replace('Alice', 'Mallory');
    expectCode(
      () => verifyTelegramInitData(tampered, TEST_BOT_TOKEN, { maxAgeSeconds: 86_400, now: NOW }),
      'INIT_DATA_INVALID',
    );
  });

  it('rejects a signature produced with another bot token', () => {
    const initData = buildTelegramInitDataForTest(
      '999999999:AAothertokenwithlongenoughbody1234567',
      VALID_USER,
      NOW_SECONDS - 10,
    );
    expectCode(
      () => verifyTelegramInitData(initData, TEST_BOT_TOKEN, { maxAgeSeconds: 86_400, now: NOW }),
      'INIT_DATA_INVALID',
    );
  });

  it('rejects expired initData', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS - 101);
    expectCode(
      () => verifyTelegramInitData(initData, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_EXPIRED',
    );
  });

  it('rejects initData from the future beyond tolerance', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS + 300);
    expectCode(
      () => verifyTelegramInitData(initData, TEST_BOT_TOKEN, { maxAgeSeconds: 86_400, now: NOW }),
      'INIT_DATA_INVALID',
    );
  });

  it('allows small clock skew into the future', () => {
    const initData = buildTelegramInitDataForTest(TEST_BOT_TOKEN, VALID_USER, NOW_SECONDS + 30);
    expect(() =>
      verifyTelegramInitData(initData, TEST_BOT_TOKEN, { maxAgeSeconds: 86_400, now: NOW }),
    ).not.toThrow();
  });

  it('rejects missing configuration and missing initData', () => {
    expectCode(
      () => verifyTelegramInitData('', null, { maxAgeSeconds: 100, now: NOW }),
      'BOT_CONFIG_MISSING',
    );
    expectCode(
      () => verifyTelegramInitData('', TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_MISSING',
    );
  });

  it('rejects oversized, malformed and duplicate fields', () => {
    expectCode(
      () => verifyTelegramInitData('x'.repeat(8193), TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_MALFORMED',
    );
    expectCode(
      () => verifyTelegramInitData('auth_date=1&user=%7B%7D', TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_MALFORMED',
    );
    const duplicates = signParams({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify(VALID_USER),
    });
    // URLSearchParams will reject the duplicate before the signature is checked.
    expectCode(
      () =>
        verifyTelegramInitData(`${duplicates}&auth_date=${NOW_SECONDS}`, TEST_BOT_TOKEN, {
          maxAgeSeconds: 100,
          now: NOW,
        }),
      'INIT_DATA_MALFORMED',
    );
  });

  it('rejects invalid hash values and missing auth_date', () => {
    expectCode(
      () =>
        verifyTelegramInitData(
          `auth_date=${NOW_SECONDS}&user=${encodeURIComponent(JSON.stringify(VALID_USER))}&hash=abc`,
          TEST_BOT_TOKEN,
          { maxAgeSeconds: 100, now: NOW },
        ),
      'INIT_DATA_MALFORMED',
    );
    const noAuthDate = signParams({ user: JSON.stringify(VALID_USER) });
    expectCode(
      () => verifyTelegramInitData(noAuthDate, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_MALFORMED',
    );
  });

  it('rejects missing, malformed and bot user payloads', () => {
    const missingUser = signParams({ auth_date: String(NOW_SECONDS), query_id: 'AAH_test' });
    expectCode(
      () => verifyTelegramInitData(missingUser, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_USER_MISSING',
    );

    const malformedUser = signParams({
      auth_date: String(NOW_SECONDS),
      user: '{not-json',
    });
    expectCode(
      () => verifyTelegramInitData(malformedUser, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_USER_INVALID',
    );

    const botUser = signParams({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 42, first_name: 'Bot', is_bot: true }),
    });
    expectCode(
      () => verifyTelegramInitData(botUser, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_USER_INVALID',
    );

    const negativeId = signParams({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: -42, first_name: 'Guest' }),
    });
    expectCode(
      () => verifyTelegramInitData(negativeId, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_USER_INVALID',
    );

    const httpPhoto = signParams({
      auth_date: String(NOW_SECONDS),
      user: JSON.stringify({ id: 42, first_name: 'Alice', photo_url: 'http://example.com/a.png' }),
    });
    expectCode(
      () => verifyTelegramInitData(httpPhoto, TEST_BOT_TOKEN, { maxAgeSeconds: 100, now: NOW }),
      'INIT_DATA_USER_INVALID',
    );
  });

  it('normalizes empty names and invalid optional names', () => {
    const initData = buildTelegramInitDataForTest(
      TEST_BOT_TOKEN,
      { id: 7, first_name: '   ', last_name: '   ' },
      NOW_SECONDS - 1,
    );
    const verified = verifyTelegramInitData(initData, TEST_BOT_TOKEN, {
      maxAgeSeconds: 100,
      now: NOW,
    });
    expect(verified.firstName).toBe('Player');
    expect(verified.lastName).toBeNull();
    expect(verified.username).toBeNull();
  });
});
