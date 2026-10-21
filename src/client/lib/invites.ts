import type { AppConfigPayload } from '../../shared/game-types';

export function buildInviteDeepLink(
  config: AppConfigPayload | null,
  token: string,
): string {
  const startParam = `invite_${token}`;
  if (config?.botUsername) {
    return `https://t.me/${config.botUsername}?startapp=${encodeURIComponent(startParam)}`;
  }
  const base = config?.miniAppUrl ?? window.location.origin;
  try {
    const url = new URL(base);
    url.searchParams.set('startapp', startParam);
    return url.toString();
  } catch {
    return `${window.location.origin}/?startapp=${encodeURIComponent(startParam)}`;
  }
}

export function isValidInviteToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
