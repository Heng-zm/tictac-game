import { createHash, randomBytes } from 'node:crypto';
import type { AppConfig } from '../config';

export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInvitationToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashInvitationToken(token) };
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function buildInviteDeepLink(config: AppConfig, token: string): string {
  const startParam = `invite_${token}`;
  if (config.telegramBotUsername) {
    if (config.telegramAppName) {
      return `https://t.me/${encodeURIComponent(config.telegramBotUsername)}/${encodeURIComponent(config.telegramAppName)}?startapp=${startParam}`;
    }
    return `https://t.me/${encodeURIComponent(config.telegramBotUsername)}?start=${startParam}`;
  }
  // Local development fallback: the client also understands ?startapp=.
  const base = config.miniAppUrl ?? 'http://localhost:5173';
  const url = new URL(base);
  url.searchParams.set('startapp', startParam);
  return url.toString();
}

export function extractInviteToken(startParam: string | null | undefined): string | null {
  if (!startParam) return null;
  if (!startParam.startsWith('invite_')) return null;
  const token = startParam.slice('invite_'.length);
  return INVITE_TOKEN_PATTERN.test(token) ? token : null;
}
