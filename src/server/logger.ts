import pino, { type Logger } from 'pino';
import type { AppConfig } from './config';

let rootLogger: Logger | null = null;

/**
 * Paths that must never reach structured logs. Request headers are covered
 * explicitly because pino-http can be configured to serialize them; the
 * wildcard entries cover tokens embedded in socket payloads, errors, and
 * application objects.
 */
export const LOG_REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-telegram-bot-api-secret-token"]',
  'res.headers["set-cookie"]',
  '*.initData',
  '*.token',
  '*.tokenHash',
  '*.secret',
  '*.secretToken',
  '*.webhookSecret',
  '*.session',
  '*.sessionSecret',
  '*.password',
  '*.authorization',
  '*.cookie',
  '*.apiKey',
  '*.databaseUrl',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'DATABASE_URL',
  'SESSION_SECRET',
] as const;

const SENSITIVE_QUERY_KEY =
  /(?:token|secret|password|auth|session|key|initdata|init_data|start)/i;

export function createLogger(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>): Logger {
  rootLogger = pino({
    level: config.logLevel,
    base: {
      service: 'tictactoe-telegram',
      env: config.nodeEnv,
    },
    redact: {
      paths: [...LOG_REDACT_PATHS],
      censor: '[redacted]',
    },
  });
  return rootLogger;
}

export function getLogger(): Logger {
  if (!rootLogger) {
    rootLogger = pino({ level: 'silent' });
  }
  return rootLogger;
}

export function getRequestLogger(logger: Logger, requestId: string): Logger {
  return logger.child({ requestId });
}

/**
 * Strips credentials from request URLs before they are logged. Invite tokens
 * and other bearer-like query parameters are not useful in logs and can leak
 * through log aggregation.
 */
export function sanitizeRequestUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, 'http://internal.local');
  } catch {
    return '[invalid-url]';
  }

  const pathname = parsed.pathname
    .replace(/invite_[A-Za-z0-9_-]{43}/g, 'invite_[redacted]')
    .replace(/\/api\/invites\/[^/?#]+/g, '/api/invites/[redacted]');

  for (const key of new Set(parsed.searchParams.keys())) {
    if (SENSITIVE_QUERY_KEY.test(key)) {
      parsed.searchParams.set(key, 'redacted');
    }
  }

  return `${pathname}${parsed.search}`;
}
