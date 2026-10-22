import { GrammyError } from 'grammy';
import { describe, expect, it } from 'vitest';
import { isPermanentTelegramDeliveryError } from '../src/server/bot/bot';

function telegramError(code: number, description: string): GrammyError {
  return new GrammyError(
    'Call to sendMessage failed',
    { ok: false, error_code: code, description },
    'sendMessage',
    {},
  );
}

describe('Telegram delivery error classification', () => {
  it('treats blocked and unreachable recipients as permanent', () => {
    expect(
      isPermanentTelegramDeliveryError(
        telegramError(403, 'Forbidden: bot was blocked by the user'),
      ),
    ).toBe(true);
    expect(
      isPermanentTelegramDeliveryError(telegramError(400, 'Bad Request: chat not found')),
    ).toBe(true);
    expect(
      isPermanentTelegramDeliveryError(
        telegramError(400, "Bad Request: bot can't initiate conversation with a user"),
      ),
    ).toBe(true);
    expect(
      isPermanentTelegramDeliveryError(telegramError(400, 'Bad Request: user is deactivated')),
    ).toBe(true);
  });

  it('keeps notifications enabled for transient failures', () => {
    expect(
      isPermanentTelegramDeliveryError(telegramError(429, 'Too Many Requests: retry later')),
    ).toBe(false);
    expect(
      isPermanentTelegramDeliveryError(telegramError(500, 'Internal Server Error')),
    ).toBe(false);
    expect(isPermanentTelegramDeliveryError(new Error('network unavailable'))).toBe(false);
    expect(isPermanentTelegramDeliveryError('not an error')).toBe(false);
  });
});
