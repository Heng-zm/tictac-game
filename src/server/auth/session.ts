import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import type { UserEntity } from '../database/types';

export const SESSION_COOKIE_NAME = 'ttt_session';
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Small allowance for clock skew when validating tokens minted by this server. */
const MAX_SESSION_TTL_SECONDS = DEFAULT_SESSION_TTL_SECONDS + 5 * 60;

export interface SessionPayload {
  v: 1;
  uid: string;
  tid: string;
  iat: number;
  exp: number;
}

export function createSessionToken(
  user: Pick<UserEntity, 'id' | 'telegramId'>,
  secret: string,
  now: Date = new Date(),
  ttlSeconds = DEFAULT_SESSION_TTL_SECONDS,
): string {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const payload: SessionPayload = {
    v: 1,
    uid: user.id,
    tid: user.telegramId.toString(),
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(body, secret);
  return `${body}.${signature}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  secret: string,
  now: Date = new Date(),
): SessionPayload | null {
  if (!token || typeof token !== 'string' || token.length > 1024) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, suppliedSignature] = parts;
  if (!body || !suppliedSignature || !/^[A-Za-z0-9_-]{43}$/.test(suppliedSignature)) return null;

  const expected = sign(body, secret);
  const supplied = Buffer.from(suppliedSignature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) {
    return null;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isSessionPayload(payload)) return null;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (payload.exp <= nowSeconds || payload.iat > nowSeconds + 120) return null;
  return payload;
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.v === 1 &&
    typeof candidate.uid === 'string' &&
    candidate.uid.length > 0 &&
    candidate.uid.length <= 64 &&
    typeof candidate.tid === 'string' &&
    candidate.tid.length <= 32 &&
    /^-?\d+$/.test(candidate.tid) &&
    typeof candidate.iat === 'number' &&
    Number.isInteger(candidate.iat) &&
    typeof candidate.exp === 'number' &&
    Number.isInteger(candidate.exp) &&
    candidate.exp > candidate.iat &&
    candidate.exp - candidate.iat <= MAX_SESSION_TTL_SECONDS
  );
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function setSessionCookie(
  res: Response,
  token: string,
  options: { secure: boolean; ttlSeconds?: number },
): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secure,
    // Telegram Web renders Mini Apps in an iframe, so production cookies must
    // be usable in a cross-site context. Local development stays on Lax.
    sameSite: options.secure ? 'none' : 'lax',
    path: '/',
    maxAge: (options.ttlSeconds ?? DEFAULT_SESSION_TTL_SECONDS) * 1000,
  });
}

export function clearSessionCookie(res: Response, secure: boolean): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    const rawValue = part.slice(separator + 1).trim();
    try {
      result[key] = decodeURIComponent(rawValue);
    } catch {
      result[key] = rawValue;
    }
  }
  return result;
}
