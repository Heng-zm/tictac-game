import { createServer, type Server as HttpServer } from 'node:http';
import type { Logger } from 'pino';
import { Server as SocketServer } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../shared/events';
import { createApp } from './app';
import { BrowserLoginStore } from './auth/browser-login';
import { createBotController, type BotController } from './bot/bot';
import { getAllowedOrigins, type AppConfig } from './config';
import { isSameOriginRequest } from './http/origin';
import type { GameRepository } from './database/types';
import { MemoryGameRepository } from './database/memory-repository';
import { createPrismaClient, PrismaGameRepository } from './database/prisma-repository';
import { createSocketGateway, type SocketGateway } from './sockets/gateway';
import type { InterServerEvents, SocketData } from './sockets/types';
import { MatchService } from './services/match-service';
import { TurnNotifier } from './services/turn-notifier';

export interface CreateGameServerOptions {
  config: AppConfig;
  logger: Logger;
  repository?: GameRepository;
  disableRateLimits?: boolean;
  startMaintenance?: boolean;
  startBot?: boolean;
}

export interface GameServerRuntime {
  app: ReturnType<typeof createApp>;
  httpServer: HttpServer;
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
  matchService: MatchService;
  gateway: SocketGateway;
  repository: GameRepository;
  bot: BotController | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function createGameServer(options: CreateGameServerOptions): GameServerRuntime {
  const { config, logger } = options;
  if (config.databaseMode === 'postgres' && !config.databaseUrl) {
    throw new Error('DB_MODE=postgres requires DATABASE_URL.');
  }
  const repository =
    options.repository ??
    (config.databaseMode === 'postgres' && config.databaseUrl
      ? new PrismaGameRepository(createPrismaClient(config.databaseUrl, config.isProduction))
      : new MemoryGameRepository());

  if (!options.repository && config.databaseMode === 'memory') {
    logger.warn(
      { event: 'memory_repository', production: config.isProduction },
      config.isProduction
        ? 'DB_MODE=memory is active in production. All users, matches, ratings, and history will be lost when the server restarts.'
        : 'DATABASE_URL is not set; using an in-memory repository. Data will be lost when the server stops.',
    );
  }

  const httpServer = createServer();
  const browserLogins = new BrowserLoginStore();
  const allowedOrigins = getAllowedOrigins(config);
  const io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      path: '/socket.io',
      serveClient: false,
      cors: {
        // The CORS headers are permissive; `allowRequest` below performs the
        // actual origin check and also covers WebSocket handshakes, which are
        // not subject to browser CORS.
        origin: true,
        credentials: true,
      },
      allowRequest: (req, callback) => {
        const origin = req.headers.origin;
        if (!origin || allowedOrigins.has(origin) || isSameOriginRequest(req, origin)) {
          callback(null, true);
          return;
        }
        callback('Origin is not allowed', false);
      },
      maxHttpBufferSize: 1024 * 1024,
      pingInterval: 10_000,
      pingTimeout: 10_000,
      perMessageDeflate: false,
    },
  );

  const bot = options.startBot === false ? null : createBotController({ config, logger, browserLogins });
  const turnNotifier = bot ? new TurnNotifier({ repository, config, logger, sender: bot }) : undefined;
  const matchService = new MatchService({
    io,
    repository,
    config,
    logger,
    ...(turnNotifier ? { turnNotifier } : {}),
  });
  const gateway = createSocketGateway({
    io,
    repository,
    config,
    logger,
    matchService,
    rateLimit: !options.disableRateLimits,
  });
  const app = createApp({
    config,
    repository,
    logger,
    matchService,
    browserLogins,
    ...(bot ? { botWebhook: bot.webhook } : {}),
    ...(turnNotifier ? { turnNotificationTester: turnNotifier } : {}),
    beforeMatchAction: (userId) => {
      gateway.queue.cancel(userId, false);
    },
    disableRateLimits: options.disableRateLimits,
  });

  httpServer.on('request', app);

  let started = false;
  let stopping: Promise<void> | null = null;
  let maintenanceTimer: ReturnType<typeof setInterval> | null = null;
  let initialMaintenanceTimer: ReturnType<typeof setTimeout> | null = null;
  let maintenanceRunning = false;

  async function runMaintenance(): Promise<void> {
    if (maintenanceRunning) return;
    maintenanceRunning = true;
    try {
      const summary = await repository.runMaintenance(new Date(), config.matchStaleAfterMs);
      // Stale matches are abandoned directly in the repository. Reconcile the
      // service cache so timers and player state do not stay active.
      await matchService.reconcileActiveMatches();
      if (
        summary.expiredInvitations > 0 ||
        summary.abandonedMatches > 0 ||
        summary.deletedInvitations > 0 ||
        summary.repairedReservations > 0
      ) {
        logger.info({ event: 'maintenance_completed', ...summary }, 'Maintenance pass completed');
      }
    } catch (error) {
      logger.error({ event: 'maintenance_failed', err: error }, 'Maintenance pass failed');
    } finally {
      maintenanceRunning = false;
    }
  }

  async function start(): Promise<void> {
    if (started) return;
    const ready = await repository.ready().catch(() => false);
    if (!ready) {
      throw new Error('The database is not reachable. Refusing to start the game server.');
    }

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        httpServer.off('listening', onListening);
        reject(error);
      };
      const onListening = () => {
        httpServer.off('error', onError);
        resolve();
      };
      httpServer.once('error', onError);
      httpServer.once('listening', onListening);
      httpServer.listen(config.port);
    });

    httpServer.requestTimeout = 30_000;
    httpServer.headersTimeout = 35_000;
    httpServer.keepAliveTimeout = 65_000;

    if (options.startMaintenance !== false) {
      maintenanceTimer = setInterval(() => {
        void runMaintenance();
      }, config.maintenanceIntervalMs);
      maintenanceTimer.unref?.();
      initialMaintenanceTimer = setTimeout(() => {
        void runMaintenance();
      }, 15_000);
      initialMaintenanceTimer.unref?.();
    }

    if (bot) {
      try {
        await bot.start();
      } catch (error) {
        logger.error({ event: 'bot_start_failed', err: error }, 'Telegram bot could not be started');
      }
    }

    started = true;
    logger.info(
      {
        event: 'server_started',
        port: config.port,
        environment: config.nodeEnv,
        repository: config.databaseMode === 'postgres' ? 'postgresql' : 'memory',
      },
      'Tic Tac Toe server is listening',
    );
  }

  async function stop(): Promise<void> {
    if (stopping) return stopping;
    stopping = (async () => {
      if (maintenanceTimer) clearInterval(maintenanceTimer);
      if (initialMaintenanceTimer) clearTimeout(initialMaintenanceTimer);
      maintenanceTimer = null;
      initialMaintenanceTimer = null;

      gateway.notifyShutdown('The server is restarting. Your game will be waiting for you.');
      matchService.shutdown();
      gateway.shutdown();
      if (bot) {
        const botStop = bot.stop().catch(() => undefined);
        await Promise.race([botStop, delay(2_000)]);
      }
      await closeHttpAndSockets(io, httpServer);
      await repository.close().catch((error: unknown) => {
        logger.warn({ event: 'repository_close_failed', err: error }, 'Repository did not close cleanly');
      });
      started = false;
      logger.info({ event: 'server_stopped' }, 'Tic Tac Toe server stopped');
    })();
    return stopping;
  }

  return { app, httpServer, io, matchService, gateway, repository, bot, start, stop };
}

function closeHttpAndSockets(
  io: SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  httpServer: HttpServer,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const finish = () => resolve();
    const timeout = setTimeout(finish, 5_000);
    timeout.unref?.();
    io.close(() => {
      clearTimeout(timeout);
      if (!httpServer.listening) {
        finish();
        return;
      }
      httpServer.close(() => finish());
    });
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
