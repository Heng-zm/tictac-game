import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Lifetime of a browser sign-in request. The user has to open Telegram, tap
 * Verify, and let the browser poll, so keep this long enough to be practical
 * but short enough that a leaked bot link is not useful for long.
 */
export const BROWSER_LOGIN_TTL_SECONDS = 10 * 60;

export const BROWSER_LOGIN_COOKIE = 'ttt_login_pending';
export const BROWSER_LOGIN_COOKIE_PATH = '/api/auth/telegram/bot';

const LOGIN_ID_PATTERN = /^[a-f0-9]{32}$/;
const LOGIN_SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface BrowserLoginIdentity {
  telegramId: bigint;
  firstName: string;
  lastName: string | null;
  username: string | null;
  /** Bot message updates do not include profile photos; omit to preserve the stored one. */
  photoUrl?: string | null;
  languageCode: string | null;
}

export interface BrowserLoginCreated {
  id: string;
  secret: string;
  expiresAt: number;
}

interface PendingBrowserLogin {
  id: string;
  secretHash: Buffer;
  expiresAt: number;
  telegramId: bigint | null;
  identity: BrowserLoginIdentity | null;
}

export type BrowserLoginClaimResult =
  | { status: 'pending'; expiresAt: number }
  | { status: 'verified' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'claimed' };

export type BrowserLoginVerifyResult =
  | { status: 'verified'; identity: BrowserLoginIdentity }
  | { status: 'already_verified' }
  | { status: 'not_found' }
  | { status: 'expired' }
  | { status: 'not_claimed' }
  | { status: 'claimed_by_other' };

export type BrowserLoginLookupResult =
  | { status: 'pending'; expiresAt: number }
  | { status: 'verified'; identity: BrowserLoginIdentity }
  | { status: 'expired' }
  | { status: 'invalid' };

interface BrowserLoginStoreOptions {
  ttlMs?: number;
  now?: () => Date;
  /** Bounds memory use from repeated sign-in attempts. */
  maxEntries?: number;
}

/**
 * In-memory, single-instance store shared by the HTTP app and the Telegram
 * bot. Requests are one-time and expire quickly. A restart invalidates
 * in-flight sign-ins, which is acceptable because the browser can simply
 * request a new link.
 */
export class BrowserLoginStore {
  private readonly entries = new Map<string, PendingBrowserLogin>();
  private readonly ttlMs: number;
  private readonly now: () => Date;
  private readonly maxEntries: number;

  constructor(options: BrowserLoginStoreOptions = {}) {
    this.ttlMs = options.ttlMs ?? BROWSER_LOGIN_TTL_SECONDS * 1000;
    this.now = options.now ?? (() => new Date());
    this.maxEntries = options.maxEntries ?? 5_000;
  }

  create(): BrowserLoginCreated {
    const now = this.now().getTime();
    this.prune(now);

    const id = randomBytes(16).toString('hex');
    const secret = randomBytes(32).toString('base64url');
    const expiresAt = now + this.ttlMs;
    this.entries.set(id, {
      id,
      secretHash: hashSecret(secret),
      expiresAt,
      telegramId: null,
      identity: null,
    });
    return { id, secret, expiresAt };
  }

  /** Called when the bot receives `/start login_<id>`. */
  claim(id: string, telegramId: bigint): BrowserLoginClaimResult {
    const now = this.now().getTime();
    const entry = this.entries.get(id);
    if (entry && entry.expiresAt <= now) {
      this.entries.delete(id);
      return { status: 'expired' };
    }
    if (!entry) return { status: 'not_found' };
    if (entry.telegramId !== null && entry.telegramId !== telegramId) {
      return { status: 'claimed' };
    }
    if (entry.identity) return { status: 'verified' };

    entry.telegramId = telegramId;
    return { status: 'pending', expiresAt: entry.expiresAt };
  }

  /** Called when the user taps the bot's Verify button. */
  verify(id: string, telegramId: bigint, identity: BrowserLoginIdentity): BrowserLoginVerifyResult {
    const now = this.now().getTime();
    const entry = this.entries.get(id);
    if (entry && entry.expiresAt <= now) {
      this.entries.delete(id);
      return { status: 'expired' };
    }
    if (!entry) return { status: 'not_found' };
    if (entry.identity) return { status: 'already_verified' };
    if (entry.telegramId === null) return { status: 'not_claimed' };
    if (entry.telegramId !== telegramId) return { status: 'claimed_by_other' };

    entry.identity = identity;
    return { status: 'verified', identity };
  }

  /**
   * Validates the browser-bound cookie and reports the pending request state.
   * The caller removes the entry after the session has been issued.
   */
  lookup(id: string, secret: string): BrowserLoginLookupResult {
    const now = this.now().getTime();
    const entry = this.entries.get(id);
    if (entry && entry.expiresAt <= now) {
      this.entries.delete(id);
      return { status: 'expired' };
    }
    if (!entry) return { status: 'invalid' };
    if (!secretsMatch(entry.secretHash, secret)) return { status: 'invalid' };
    if (entry.identity) return { status: 'verified', identity: entry.identity };
    return { status: 'pending', expiresAt: entry.expiresAt };
  }

  remove(id: string): void {
    this.entries.delete(id);
  }

  private prune(now: number): void {
    for (const [id, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(id);
    }
    if (this.entries.size < this.maxEntries) return;
    // Map iteration preserves insertion order, so the first entries are the
    // oldest sign-in attempts.
    for (const id of this.entries.keys()) {
      if (this.entries.size < this.maxEntries) break;
      this.entries.delete(id);
    }
  }
}

export interface BrowserLoginCookie {
  id: string;
  secret: string;
}

export function serializeBrowserLoginCookie(value: BrowserLoginCookie): string {
  return `${value.id}.${value.secret}`;
}

export function parseBrowserLoginCookie(value: unknown): BrowserLoginCookie | null {
  if (typeof value !== 'string' || value.length > 96) return null;
  const separator = value.indexOf('.');
  if (separator < 0) return null;
  const id = value.slice(0, separator);
  const secret = value.slice(separator + 1);
  if (!LOGIN_ID_PATTERN.test(id) || !LOGIN_SECRET_PATTERN.test(secret)) return null;
  return { id, secret };
}

function hashSecret(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function secretsMatch(expected: Buffer, supplied: string): boolean {
  if (!LOGIN_SECRET_PATTERN.test(supplied)) return false;
  const suppliedHash = hashSecret(supplied);
  return suppliedHash.length === expected.length && timingSafeEqual(suppliedHash, expected);
}
