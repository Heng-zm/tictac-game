import { loadConfig } from './config';
import { applyRenderDefaults } from './config/render-defaults';
import { createGameServer } from './create-server';
import { createLogger } from './logger';

async function main(): Promise<void> {
  const renderDefaults = applyRenderDefaults();
  const config = loadConfig();
  const logger = createLogger(config);
  if (renderDefaults.generatedSessionSecret) {
    logger.warn(
      { event: 'render_generated_session_secret' },
      'SESSION_SECRET was not set; generated an ephemeral one for this Render instance. Set SESSION_SECRET to keep sessions across restarts.',
    );
  }
  if (renderDefaults.demoMode) {
    logger.warn(
      { event: 'demo_mode' },
      'DEMO_MODE is active: guest login is enabled and data is not persistent. Add TELEGRAM_BOT_TOKEN and TELEGRAM_BOT_USERNAME for Telegram login, or set DEMO_MODE=false to require configuration.',
    );
  }
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
