import { loadConfig } from './config';
import { createGameServer } from './create-server';
import { createLogger } from './logger';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const runtime = createGameServer({ config, logger });

  let stopInitiated = false;
  const shutdown = (signal: string): void => {
    if (stopInitiated) return;
    stopInitiated = true;
    logger.info({ event: 'shutdown_requested', signal }, 'Shutting down gracefully');
    const forceExit = setTimeout(() => {
      logger.error({ event: 'shutdown_timeout' }, 'Graceful shutdown timed out; exiting');
      process.exit(1);
    }, 15_000);
    forceExit.unref();

    void runtime
      .stop()
      .then(() => {
        clearTimeout(forceExit);
        process.exit(0);
      })
      .catch((error: unknown) => {
        logger.error({ event: 'shutdown_failed', err: error }, 'Graceful shutdown failed');
        process.exit(1);
      });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    logger.error({ event: 'unhandled_rejection', err: reason }, 'Unhandled promise rejection');
  });
  process.on('uncaughtException', (error) => {
    logger.fatal({ event: 'uncaught_exception', err: error }, 'Uncaught exception');
    shutdown('uncaughtException');
  });

  try {
    await runtime.start();
  } catch (error) {
    logger.fatal({ event: 'startup_failed', err: error }, 'Server failed to start');
    await runtime.stop().catch(() => undefined);
    process.exit(1);
  }
}

void main();
