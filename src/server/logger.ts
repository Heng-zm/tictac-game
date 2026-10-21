import pino, { type Logger } from 'pino';
import type { AppConfig } from './config';

let rootLogger: Logger | null = null;

export function createLogger(config: Pick<AppConfig, 'logLevel' | 'nodeEnv'>): Logger {
  rootLogger = pino({
    level: config.logLevel,
    base: {
      service: 'tictactoe-telegram',
      env: config.nodeEnv,
    },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        '*.initData',
        '*.token',
        '*.tokenHash',
        '*.session',
        'TELEGRAM_BOT_TOKEN',
        'DATABASE_URL',
        'SESSION_SECRET',
      ],
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
