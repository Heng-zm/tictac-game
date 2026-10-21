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
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
