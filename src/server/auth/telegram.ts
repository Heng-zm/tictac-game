import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import {
  telegramWebAppUserSchema,
  normalizeDisplayName,
  type TelegramWebAppUserInput,
} from '../../shared/schemas/payloads';

export type TelegramAuthErrorCode =
  | 'INIT_DATA_MISSING'
  | 'INIT_DATA_MALFORMED'
  | 'INIT_DATA_EXPIRED'
  | 'INIT_DATA_INVALID'
  | 'INIT_DATA_USER_MISSING'
  | 'INIT_DATA_USER_INVALID'
  | 'LOGIN_DATA_MISSING'
  | 'LOGIN_DATA_MALFORMED'
  | 'LOGIN_DATA_INVALID'
  | 'LOGIN_DATA_EXPIRED'
  | 'LOGIN_DATA_USER_INVALID'
  | 'BOT_CONFIG_MISSING';

export class TelegramAuthError extends Error {
  constructor(
    public readonly code: TelegramAuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TelegramAuthError';
  }
}

export interface VerifiedTelegramUser {
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  authDate: Date;
}

export interface VerifyOptions {
  maxAgeSeconds: number;
  now?: Date;
  futureToleranceSeconds?: number;
}

interface ParsedInitData {
  params: Map<string, string>;
  hash: string;
  authDate: number;
  userRaw: string;
}

/**
 * Implements Telegram's documented Mini App initData HMAC validation.
 * The raw initData is never trusted, logged, or stored.
 */
export function verifyTelegramInitData(
  initData: string,
  botToken: string | null,
  options: VerifyOptions,
): VerifiedTelegramUser {
  if (!botToken) {
    throw new TelegramAuthError('BOT_CONFIG_MISSING', 'Telegram authentication is not configured');
  }
  if (!initData || typeof initData !== 'string') {
    throw new TelegramAuthError('INIT_DATA_MISSING', 'Telegram authentication data is missing');
  }
  if (initData.length > 8192) {
    throw new TelegramAuthError('INIT_DATA_MALFORMED', 'Telegram authentication data is too large');
  }

  const parsed = parseInitData(initData);
  verifyHash(parsed, botToken);
  verifyAuthDate(parsed.authDate, options, {
    malformed: 'INIT_DATA_MALFORMED',
    invalid: 'INIT_DATA_INVALID',
    expired: 'INIT_DATA_EXPIRED',
  });

  let rawUser: unknown;
  try {
    rawUser = JSON.parse(parsed.userRaw);
  } catch {
    throw new TelegramAuthError('INIT_DATA_USER_INVALID', 'Telegram user data could not be parsed');
  }
  const userResult = telegramWebAppUserSchema.safeParse(rawUser);
  if (!userResult.success) {
    throw new TelegramAuthError('INIT_DATA_USER_INVALID', 'Telegram user data is invalid');
  }
  if (userResult.data.is_bot) {
    throw new TelegramAuthError('INIT_DATA_USER_INVALID', 'Bot accounts cannot use the game');
  }

  return toVerifiedUser(userResult.data, parsed.authDate);
}

/**
 * Verifies the payload returned by Telegram's Login Widget for browser users.
 * The widget signs fields with HMAC-SHA256 using SHA256(botToken) as the key.
 * See https://core.telegram.org/widgets/login#checking-authorization.
 */
export function verifyTelegramLoginData(
  data: unknown,
  botToken: string | null,
  options: VerifyOptions,
): VerifiedTelegramUser {
  if (!botToken) {
    throw new TelegramAuthError('BOT_CONFIG_MISSING', 'Telegram authentication is not configured');
  }
  if (data === undefined || data === null) {
    throw new TelegramAuthError('LOGIN_DATA_MISSING', 'Telegram login data is missing');
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new TelegramAuthError('LOGIN_DATA_MALFORMED', 'Telegram login data is malformed');
  }

  const params = new Map<string, string>();
  for (const [key, value] of Object.entries(data)) {
    if (!/^[A-Za-z0-9_]+$/.test(key)) {
      throw new TelegramAuthError('LOGIN_DATA_MALFORMED', 'Telegram login data contains an invalid field');
    }
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      params.set(key, String(value));
    } else {
      throw new TelegramAuthError('LOGIN_DATA_MALFORMED', 'Telegram login data contains an invalid value');
    }
  }

  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new TelegramAuthError('LOGIN_DATA_MALFORMED', 'Telegram login hash is missing or malformed');
  }
  const authDateRaw = params.get('auth_date');
  if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) {
    throw new TelegramAuthError('LOGIN_DATA_MALFORMED', 'Telegram login timestamp is missing or malformed');
  }

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(compareParamKeys)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const supplied = Buffer.from(hash, 'hex');
  if (supplied.length !== computed.length || !timingSafeEqual(supplied, computed)) {
    throw new TelegramAuthError('LOGIN_DATA_INVALID', 'Telegram login signature is invalid');
  }

  const authDate = Number(authDateRaw);
  verifyAuthDate(authDate, options, {
    malformed: 'LOGIN_DATA_MALFORMED',
    invalid: 'LOGIN_DATA_INVALID',
    expired: 'LOGIN_DATA_EXPIRED',
  });

  // Query-string values are always strings, while the shared Telegram user
  // schema expects a numeric id. Normalize the fields Telegram actually sends.
  const idRaw = params.get('id');
  if (!idRaw || !/^\d{1,16}$/.test(idRaw)) {
    throw new TelegramAuthError('LOGIN_DATA_USER_INVALID', 'Telegram login user data is invalid');
  }
  const telegramId = Number(idRaw);
  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    throw new TelegramAuthError('LOGIN_DATA_USER_INVALID', 'Telegram login user data is invalid');
  }
  const userResult = telegramWebAppUserSchema.safeParse({ ...data, id: telegramId, auth_date: authDate });
  if (!userResult.success) {
    throw new TelegramAuthError('LOGIN_DATA_USER_INVALID', 'Telegram login user data is invalid');
  }
  if (userResult.data.is_bot) {
    throw new TelegramAuthError('LOGIN_DATA_USER_INVALID', 'Bot accounts cannot use the game');
  }

  return toVerifiedUser(userResult.data, authDate);
}

function parseInitData(initData: string): ParsedInitData {
  const params = new URLSearchParams(initData);
  const seen = new Set<string>();
  const map = new Map<string, string>();
  for (const [key, value] of params.entries()) {
    if (seen.has(key)) {
      throw new TelegramAuthError('INIT_DATA_MALFORMED', 'Telegram authentication data contains duplicate fields');
    }
    seen.add(key);
    map.set(key, value);
  }

  const hash = map.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/i.test(hash)) {
    throw new TelegramAuthError('INIT_DATA_MALFORMED', 'Telegram authentication hash is missing or malformed');
  }
  const authDateRaw = map.get('auth_date');
  if (!authDateRaw || !/^\d{1,12}$/.test(authDateRaw)) {
    throw new TelegramAuthError('INIT_DATA_MALFORMED', 'Telegram authentication timestamp is missing or malformed');
  }
  const userRaw = map.get('user');
  if (!userRaw) {
    throw new TelegramAuthError('INIT_DATA_USER_MISSING', 'Telegram user data is missing');
  }
  return {
    params: map,
    hash,
    authDate: Number(authDateRaw),
    userRaw,
  };
}

function verifyHash(parsed: ParsedInitData, botToken: string): void {
  const dataCheckString = [...parsed.params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(compareParamKeys)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const supplied = Buffer.from(parsed.hash, 'hex');

  if (supplied.length !== computed.length || !timingSafeEqual(supplied, computed)) {
    throw new TelegramAuthError('INIT_DATA_INVALID', 'Telegram authentication signature is invalid');
  }
}

function verifyAuthDate(
  authDate: number,
  options: VerifyOptions,
  codes: {
    malformed: TelegramAuthErrorCode;
    invalid: TelegramAuthErrorCode;
    expired: TelegramAuthErrorCode;
  },
): void {
  const now = options.now ?? new Date();
  const nowSeconds = Math.floor(now.getTime() / 1000);
  const tolerance = options.futureToleranceSeconds ?? 120;
  if (!Number.isFinite(authDate) || authDate <= 0) {
    throw new TelegramAuthError(codes.malformed, 'Telegram authentication data has an invalid timestamp');
  }
  if (authDate > nowSeconds + tolerance) {
    throw new TelegramAuthError(codes.invalid, 'Telegram authentication data is from the future');
  }
  if (nowSeconds - authDate > options.maxAgeSeconds) {
    throw new TelegramAuthError(codes.expired, 'Telegram authentication has expired. Reopen the game.');
  }
}

function toVerifiedUser(user: TelegramWebAppUserInput, authDateSeconds: number): VerifiedTelegramUser {
  return {
    telegramId: BigInt(user.id),
    firstName: normalizeDisplayName(user.first_name, 'Player'),
    lastName: normalizeOptionalName(user.last_name),
    username: user.username ?? null,
    photoUrl: user.photo_url ?? null,
    languageCode: user.language_code ?? null,
    authDate: new Date(authDateSeconds * 1000),
  };
}

/**
 * Telegram signs fields sorted by key using JavaScript's default string order.
 * Avoid localeCompare here: its result depends on the host locale and ICU data.
 */
function compareParamKeys([a]: [string, string], [b]: [string, string]): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizeOptionalName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeDisplayName(value, '');
  return normalized || null;
}

/**
 * Builds initData for integration tests and local tooling. Never used at runtime.
 */
export function buildTelegramInitDataForTest(
  botToken: string,
  user: Record<string, unknown>,
  authDate: number,
  extra: Record<string, string> = {},
): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(authDate));
  params.set('query_id', 'AAH_test');
  params.set('user', JSON.stringify(user));
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  const dataCheckString = [...params.entries()]
    .sort(compareParamKeys)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

/**
 * Builds a Telegram Login Widget payload for tests and local tooling. Never
 * used at runtime.
 */
export function buildTelegramLoginDataForTest(
  botToken: string,
  user: Record<string, string | number>,
  authDate: number,
): Record<string, string | number> {
  const data: Record<string, string | number> = { ...user, auth_date: authDate };
  const dataCheckString = Object.entries(data)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHash('sha256').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  return { ...data, hash };
}
