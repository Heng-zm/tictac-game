import { createHash } from 'node:crypto';
import { normalizeDisplayName } from '../../shared/schemas/payloads';
import type { TelegramProfileInput } from '../database/types';

/**
 * Development identities are deliberately negative and only valid when
 * DEV_AUTH_ENABLED is true while NODE_ENV is not production.
 */
export function deriveDevProfile(deviceKey: string, displayName?: string): TelegramProfileInput {
  const digest = createHash('sha256').update(`ttt-dev:${deviceKey}`).digest();
  // 48 bits keeps the value well inside PostgreSQL BIGINT and Telegram's range.
  const numeric = digest.readUIntBE(0, 6);
  const telegramId = -BigInt(numeric || 1);
  const suffix = digest.toString('hex').slice(0, 4).toUpperCase();
  return {
    telegramId,
    firstName: normalizeDisplayName(displayName, `Guest ${suffix}`),
    lastName: null,
    username: null,
    photoUrl: null,
    languageCode: 'en',
  };
}
