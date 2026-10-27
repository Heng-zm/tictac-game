import type { IncomingMessage } from 'node:http';

/**
 * A browser request from the same host should always be allowed, even when the
 * deployment URL (for example a LAN IP or a custom domain) is not listed in
 * CORS_ORIGINS. This keeps same-origin static assets and API calls working
 * behind proxies and during local network testing.
 */
export function isSameOriginRequest(
  req: Pick<IncomingMessage, 'headers'>,
  origin: string | undefined,
): boolean {
  if (!origin) return true;
  const host = req.headers.host;
  if (!host) return false;
  try {
    const parsed = new URL(origin);
    // Browser origins are http(s). Reject opaque and non-HTTP origins such as
    // `null`, `file:`, or a data URL even if their host happens to match.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.host === host.toLowerCase();
  } catch {
    return false;
  }
}
