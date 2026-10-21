import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import pinoHttp from 'pino-http';
import { ZodError } from 'zod';
import { verifyTelegramInitData, TelegramAuthError } from './auth/telegram';
import { deriveDevProfile } from './auth/dev';
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from './auth/session';
import { createRequireAuth } from './auth/middleware';
import type { AppConfig } from './config';
import { getAllowedOrigins } from './config';
import type { AppConfigPayload, ApiErrorPayload, LeaderboardResponse } from '../shared/game-types';
import { PROTOCOL_VERSION } from '../shared/game-types';
import {
  devAuthSchema,
  historyQuerySchema,
  invitationTokenParamSchema,
  leaderboardQuerySchema,
  preferencesSchema,
  telegramInitDataSchema,
} from '../shared/schemas/payloads';
import type { GameRepository, UserEntity } from './database/types';
import type { Logger } from 'pino';
import { AppError, RepositoryConflictError } from './errors';
import type { MatchService } from './services/match-service';
import { hashInvitationToken } from './services/invitations';
import { toHistoryItem, toLeaderboardResponse, toUserProfile } from './services/profile';

export interface BotWebhookMount {
  path: string;
  handler: RequestHandler;
}

export interface AppDependencies {
  config: AppConfig;
  repository: GameRepository;
  logger: Logger;
  matchService: MatchService;
  botWebhook?: BotWebhookMount;
  beforeMatchAction?: (userId: string) => void;
  disableRateLimits?: boolean;
}

export function createApp(deps: AppDependencies): express.Express {
  const { config, repository, logger, matchService } = deps;
  const app = express();
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  const allowedOrigins = getAllowedOrigins(config);
  app.disable('x-powered-by');
  app.set('json escape', true);

  app.use((req, res, next) => {
    const requestId = randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);
    next();
  });

  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as Request).requestId,
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/ready',
      },
      serializers: {
        req: (req) => ({
          id: req.id,
          method: req.method,
          url: sanitizeUrl(req.url ?? ''),
        }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
      customLogLevel: (_req, res, error) => {
        if (error || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
      },
    }),
  );

  app.use(
    helmet({
      frameguard: false,
      // HSTS on localhost would poison development browsers for other projects.
      hsts: config.isProduction,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://telegram.org'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
        },
      },
    }),
  );
  app.use(compression());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Requested-With'],
      optionsSuccessStatus: 204,
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '32kb', type: ['application/json'] }));
  app.use(cookieParser());

  // Native clients and same-origin requests may omit Origin. Browser mutations
  // with a cross-site Origin are rejected in addition to SameSite cookies.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      res.status(403).json(errorBody(req, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
      return;
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ status: 'ok', version: '1.0.0', uptimeSeconds: Math.round(process.uptime()) });
  });

  app.get('/ready', async (_req, res) => {
    const ready = await repository.ready().catch(() => false);
    res.setHeader('cache-control', 'no-store');
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      checks: { database: ready ? 'ok' : 'unavailable' },
    });
  });

  if (deps.botWebhook) {
    app.post(deps.botWebhook.path, deps.botWebhook.handler);
  }

  const authLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 12,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json(errorBody(req, 'AUTH_RATE_LIMITED', 'Too many authentication attempts'));
        },
      });

  const apiLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 600,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json(errorBody(req, 'RATE_LIMITED', 'Too many requests. Please slow down.'));
        },
      });

  const inviteLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 30,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json(errorBody(req, 'RATE_LIMITED', 'Too many invitation requests'));
        },
      });

  app.get('/api/config', (_req, res) => {
    const payload: AppConfigPayload = {
      protocol: PROTOCOL_VERSION,
      botUsername: config.telegramBotUsername,
      miniAppUrl: config.miniAppUrl,
      devAuthEnabled: config.devAuthEnabled,
      environment: config.nodeEnv,
      queueAiTimeoutMs: config.queueAiTimeoutMs,
      queueMaxWaitMs: config.queueMaxWaitMs,
      turnTimeoutMs: config.turnTimeoutMs,
      disconnectGraceMs: config.disconnectGraceMs,
      inviteTtlMinutes: config.inviteTtlMinutes,
      aiFallbackDifficulty: config.aiFallbackDifficulty,
    };
    res.setHeader('cache-control', 'no-store');
    res.json(payload);
  });

  app.post('/api/auth/telegram', authLimiter, async (req, res) => {
    const { initData } = telegramInitDataSchema.parse(req.body);
    if (!config.telegramBotToken) {
      throw new AppError(503, 'TELEGRAM_AUTH_UNAVAILABLE', 'Telegram authentication is not configured');
    }
    let verified;
    try {
      verified = verifyTelegramInitData(initData, config.telegramBotToken, {
        maxAgeSeconds: config.authMaxAgeSeconds,
      });
    } catch (error) {
      if (error instanceof TelegramAuthError) {
        if (error.code === 'BOT_CONFIG_MISSING') {
          throw new AppError(503, 'TELEGRAM_AUTH_UNAVAILABLE', 'Telegram authentication is not configured');
        }
        if (error.code === 'INIT_DATA_EXPIRED') {
          throw new AppError(401, 'INIT_DATA_EXPIRED', 'Telegram authentication expired. Reopen the game.');
        }
        throw new AppError(401, 'INIT_DATA_INVALID', 'Telegram authentication is invalid');
      }
      throw error;
    }
    const user = await repository.upsertTelegramUser({
      telegramId: verified.telegramId,
      firstName: verified.firstName,
      lastName: verified.lastName,
      username: verified.username,
      photoUrl: verified.photoUrl,
      languageCode: verified.languageCode,
    });
    const token = createSessionToken(user, config.sessionSecret);
    setSessionCookie(res, token, { secure: config.isProduction });
    res.status(200).json({ user: toUserProfile(user) });
  });

  app.post('/api/auth/dev', authLimiter, async (req, res) => {
    if (!config.devAuthEnabled || config.isProduction) {
      throw new AppError(403, 'DEV_AUTH_DISABLED', 'Development authentication is disabled');
    }
    const parsed = devAuthSchema.parse(req.body);
    const profile = deriveDevProfile(parsed.deviceKey, parsed.displayName);
    const user = await repository.upsertTelegramUser(profile);
    const token = createSessionToken(user, config.sessionSecret);
    setSessionCookie(res, token, { secure: false });
    res.status(200).json({ user: toUserProfile(user) });
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(res, config.isProduction);
    res.status(204).end();
  });

  const requireAuth = createRequireAuth(repository, config);

  app.use('/api', apiLimiter);

  app.get('/api/me', requireAuth, (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ user: toUserProfile(req.authUser as UserEntity) });
  });

  app.patch('/api/me/preferences', requireAuth, async (req, res) => {
    const parsed = preferencesSchema.parse(req.body);
    const user = await repository.setAutoAiFallback((req.authUser as UserEntity).id, parsed.autoAiFallback);
    res.json({ user: toUserProfile(user) });
  });

  app.get('/api/me/stats', requireAuth, (req, res) => {
    res.setHeader('cache-control', 'no-store');
    res.json({ stats: toUserProfile(req.authUser as UserEntity).stats });
  });

  app.get('/api/history', requireAuth, async (req, res) => {
    const query = historyQuerySchema.parse(req.query);
    const user = req.authUser as UserEntity;
    const page = await repository.getRecentMatches(user.id, query.limit, query.cursor);
    res.setHeader('cache-control', 'no-store');
    res.json({
      items: page.matches.map((match) => toHistoryItem(match, user.id)),
      nextCursor: page.nextCursor,
    });
  });

  app.get('/api/leaderboard', requireAuth, async (req, res) => {
    const query = leaderboardQuerySchema.parse(req.query);
    const user = req.authUser as UserEntity;
    const [rows, rank] = await Promise.all([
      repository.getLeaderboard(query.limit),
      repository.getUserRank(user.id),
    ]);
    const payload: LeaderboardResponse = toLeaderboardResponse(rows, user.id, rank);
    res.setHeader('cache-control', 'no-store');
    res.json(payload);
  });

  app.get('/api/invites/:token', inviteLimiter, requireAuth, async (req, res) => {
    const { token } = invitationTokenParamSchema.parse(req.params);
    const preview = await matchService.getInvitePreview((req.authUser as UserEntity).id, token);
    res.setHeader('cache-control', 'no-store');
    res.json({ invite: preview });
  });

  app.post('/api/invites/:token/accept', inviteLimiter, requireAuth, async (req, res) => {
    const { token } = invitationTokenParamSchema.parse(req.params);
    const user = req.authUser as UserEntity;
    deps.beforeMatchAction?.(user.id);
    const result = await matchService.acceptInvitation(user, token);
    res.json({ matchId: result.match.id });
  });

  app.post('/api/invites/:token/cancel', inviteLimiter, requireAuth, async (req, res) => {
    const { token } = invitationTokenParamSchema.parse(req.params);
    const user = req.authUser as UserEntity;
    const invitation = await repository.getInvitationByTokenHash(hashInvitationToken(token));
    if (!invitation) throw new AppError(404, 'INVITATION_INVALID', 'This invitation link is invalid');
    await matchService.cancelInvitation(user.id, invitation.id);
    res.json({ cancelled: true });
  });

  app.use('/api', (req, res) => {
    res.status(404).json(errorBody(req, 'NOT_FOUND', 'API endpoint not found'));
  });

  const clientDir = path.resolve(process.cwd(), 'dist/client');
  const indexFile = path.join(clientDir, 'index.html');
  if (existsSync(indexFile)) {
    app.use(
      express.static(clientDir, {
        index: false,
        fallthrough: true,
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('cache-control', 'public, max-age=31536000, immutable');
          } else {
            res.setHeader('cache-control', 'public, max-age=300');
          }
        },
      }),
    );
  }

  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (
      req.path.startsWith('/api') ||
      req.path.startsWith('/socket.io') ||
      req.path === '/health' ||
      req.path === '/ready'
    ) {
      next();
      return;
    }
    if (!existsSync(indexFile)) {
      res
        .status(503)
        .type('text/plain')
        .send('Client build is missing. Run "npm run build" or use the Vite development server.');
      return;
    }
    res.setHeader('cache-control', 'no-store');
    res.sendFile(indexFile);
  });

  app.use(errorHandler(logger));
  return app;
}

function sanitizeUrl(url: string): string {
  return url
    .replace(/invite_[A-Za-z0-9_-]{43}/g, 'invite_[redacted]')
    .replace(/\/api\/invites\/[^/?#]+/g, '/api/invites/[redacted]');
}

function errorBody(req: Request, code: string, message: string) {
  return {
    error: {
      code,
      message,
      requestId: req.requestId,
    },
  } satisfies ApiErrorPayload;
}

function passthrough(_req: Request, _res: Response, next: NextFunction): void {
  next();
}

function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) return;

    if (error instanceof ZodError) {
      res.status(400).json(errorBody(req, 'VALIDATION_ERROR', 'The request contains invalid data.'));
      return;
    }
    if (
      error instanceof SyntaxError &&
      'type' in error &&
      (error as SyntaxError & { type?: string }).type === 'entity.parse.failed'
    ) {
      res.status(400).json(errorBody(req, 'INVALID_JSON', 'Request body must be valid JSON.'));
      return;
    }
    if (error instanceof AppError) {
      res.status(error.statusCode).json(errorBody(req, error.code, error.message));
      return;
    }
    if (error instanceof RepositoryConflictError) {
      res.status(409).json(errorBody(req, error.code, error.message));
      return;
    }
    if (error instanceof TelegramAuthError) {
      res.status(401).json(errorBody(req, 'AUTH_INVALID', 'Telegram authentication is invalid.'));
      return;
    }

    logger.error(
      { err: error, requestId: req.requestId },
      'Unhandled request error',
    );
    res.status(500).json(errorBody(req, 'INTERNAL_ERROR', 'Something went wrong. Please try again.'));
  };
}
