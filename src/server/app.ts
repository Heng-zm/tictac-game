import compression from 'compression';
import cookieParser from 'cookie-parser';
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
import {
  verifyTelegramInitData,
  TelegramAuthError,
  type VerifiedTelegramUser,
} from './auth/telegram';
import {
  BROWSER_LOGIN_COOKIE,
  BROWSER_LOGIN_COOKIE_PATH,
  BROWSER_LOGIN_TTL_SECONDS,
  BrowserLoginStore,
  parseBrowserLoginCookie,
  serializeBrowserLoginCookie,
} from './auth/browser-login';
import { deriveDevProfile } from './auth/dev';
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from './auth/session';
import { createRequireAuth } from './auth/middleware';
import { isSameOriginRequest } from './http/origin';
import { sanitizeRequestUrl } from './logger';
import type { AppConfig } from './config';
import { getAllowedOrigins } from './config';
import type { AppConfigPayload, ApiErrorPayload, LeaderboardResponse } from '../shared/game-types';
import { PROTOCOL_VERSION } from '../shared/game-types';
import {
  TELEGRAM_LOGIN_START_PREFIX,
  type TelegramLoginStartResponse,
  type TelegramLoginStatusResponse,
} from '../shared/telegram-login';
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
import type { TurnNotificationTestService } from './services/turn-notifier';
import { toHistoryItem, toLeaderboardResponse, toUserProfile } from './services/profile';

export interface BotWebhookMount {
  path: string;
  handler: RequestHandler;
}

type TelegramLoginProfile = Pick<
  VerifiedTelegramUser,
  'telegramId' | 'firstName' | 'lastName' | 'username' | 'languageCode'
> & { photoUrl?: string | null };

async function completeTelegramLogin(
  repository: GameRepository,
  config: AppConfig,
  res: Response,
  verified: TelegramLoginProfile,
): Promise<UserEntity> {
  const user = await repository.upsertTelegramUser({
    telegramId: verified.telegramId,
    firstName: verified.firstName,
    lastName: verified.lastName,
    username: verified.username,
    // Browser sign-in does not receive a profile photo from bot updates, so an
    // absent value preserves whatever the Mini App already stored.
    ...(verified.photoUrl !== undefined ? { photoUrl: verified.photoUrl } : {}),
    // Browser flows may not provide a language code. Leave the stored Mini App
    // locale untouched in that case.
    ...(verified.languageCode ? { languageCode: verified.languageCode } : {}),
  });
  const token = createSessionToken(user, config.sessionSecret);
  setSessionCookie(res, token, { secure: config.isProduction });
  return user;
}

export interface AppDependencies {
  config: AppConfig;
  repository: GameRepository;
  logger: Logger;
  matchService: MatchService;
  browserLogins?: BrowserLoginStore;
  botWebhook?: BotWebhookMount;
  turnNotificationTester?: TurnNotificationTestService;
  beforeMatchAction?: (userId: string) => void;
  disableRateLimits?: boolean;
}

export function createApp(deps: AppDependencies): express.Express {
  const { config, repository, logger, matchService } = deps;
  const browserLogins = deps.browserLogins ?? new BrowserLoginStore();
  const app = express();
  if (config.trustProxy > 0) app.set('trust proxy', config.trustProxy);

  const allowedOrigins = getAllowedOrigins(config);
  const connectSources = ["'self'"];
  for (const origin of allowedOrigins) {
    connectSources.push(origin);
    if (origin.startsWith('https://')) {
      connectSources.push(`wss://${origin.slice('https://'.length)}`);
    } else if (origin.startsWith('http://')) {
      connectSources.push(`ws://${origin.slice('http://'.length)}`);
    }
  }
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
          url: sanitizeRequestUrl(req.url ?? ''),
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
      hsts: config.isProduction
        ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
        : false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://telegram.org'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          connectSrc: connectSources,
          mediaSrc: ["'self'", 'blob:', 'data:'],
          fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameSrc: ["'self'"],
          frameAncestors: ["'self'", 'https://web.telegram.org', 'https://*.telegram.org'],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
        },
      },
    }),
  );
  // Helmet 8 no longer emits Permissions-Policy. Keep microphone available for
  // the in-game voice notes while disabling capabilities the app never uses.
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), geolocation=(), microphone=(self), payment=(), usb=(), interest-cohort=()',
    );
    next();
  });
  app.use(compression());
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!origin) {
      next();
      return;
    }
    if (!allowedOrigins.has(origin) && !isSameOriginRequest(req, origin)) {
      res.status(403).json(errorBody(req, 'ORIGIN_NOT_ALLOWED', 'Origin is not allowed'));
      return;
    }

    res.vary('Origin');
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
      res.setHeader('Access-Control-Max-Age', '600');
      res.status(204).end();
      return;
    }

    next();
  });
  // Authenticated API responses must never be reused by a shared cache. This
  // runs before body parsing so 413/415 error responses are not cacheable.
  app.use('/api', (_req, res, next) => {
    res.setHeader('cache-control', 'no-store');
    next();
  });

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
    if (origin && !allowedOrigins.has(origin) && !isSameOriginRequest(req, origin)) {
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

  const browserLoginStartLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 30,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json(errorBody(req, 'AUTH_RATE_LIMITED', 'Too many sign-in attempts'));
        },
      });

  const browserLoginStatusLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 600,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        handler: (req, res) => {
          res.status(429).json(errorBody(req, 'RATE_LIMITED', 'Too many sign-in status checks'));
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

  const notificationTestLimiter = deps.disableRateLimits
    ? passthrough
    : rateLimit({
        windowMs: 60_000,
        limit: 3,
        standardHeaders: 'draft-7',
        legacyHeaders: false,
        keyGenerator: (req) => (req.authUser as UserEntity).id,
        handler: (req, res) => {
          res
            .status(429)
            .json(errorBody(req, 'NOTIFICATION_RATE_LIMITED', 'Too many test notifications. Try again later.'));
        },
      });

  app.get('/api/config', (_req, res) => {
    const payload: AppConfigPayload = {
      protocol: PROTOCOL_VERSION,
      botUsername: config.telegramBotUsername,
      botAppName: config.telegramAppName,
      miniAppUrl: config.miniAppUrl,
      devAuthEnabled: config.devAuthEnabled,
      demoMode: config.demoMode,
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
    const user = await completeTelegramLogin(repository, config, res, verified);
    res.status(200).json({ user: toUserProfile(user) });
  });

  const browserLoginConfigured = Boolean(config.telegramBotToken && config.telegramBotUsername);
  const createBrowserLoginUrl = (id: string): string => {
    const username = (config.telegramBotUsername ?? '').replace(/^@/, '');
    return `https://t.me/${username}?start=${TELEGRAM_LOGIN_START_PREFIX}${id}`;
  };

  app.post('/api/auth/telegram/bot/start', browserLoginStartLimiter, (_req, res) => {
    if (!browserLoginConfigured) {
      throw new AppError(503, 'TELEGRAM_AUTH_UNAVAILABLE', 'Telegram authentication is not configured');
    }
    const pending = browserLogins.create();
    res.cookie(BROWSER_LOGIN_COOKIE, serializeBrowserLoginCookie(pending), {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: BROWSER_LOGIN_COOKIE_PATH,
      maxAge: BROWSER_LOGIN_TTL_SECONDS * 1000,
    });
    const payload: TelegramLoginStartResponse = {
      url: createBrowserLoginUrl(pending.id),
      expiresAt: new Date(pending.expiresAt).toISOString(),
    };
    res.setHeader('cache-control', 'no-store');
    res.json(payload);
  });

  // The browser polls this endpoint while the user taps Verify in Telegram.
  // The HttpOnly pending cookie binds the result to the requesting browser.
  app.get('/api/auth/telegram/bot/status', browserLoginStatusLimiter, async (req, res) => {
    res.setHeader('cache-control', 'no-store');
    if (!browserLoginConfigured) {
      throw new AppError(503, 'TELEGRAM_AUTH_UNAVAILABLE', 'Telegram authentication is not configured');
    }

    const cookie = parseBrowserLoginCookie(req.cookies?.[BROWSER_LOGIN_COOKIE]);
    if (!cookie) {
      res.json({ status: 'invalid' } satisfies TelegramLoginStatusResponse);
      return;
    }

    const result = browserLogins.lookup(cookie.id, cookie.secret);
    if (result.status === 'pending') {
      res.json({
        status: 'pending',
        url: createBrowserLoginUrl(cookie.id),
        expiresAt: new Date(result.expiresAt).toISOString(),
      } satisfies TelegramLoginStatusResponse);
      return;
    }

    if (result.status === 'verified') {
      // Only consume the request after the session has been issued, so a
      // transient database error leaves the pending sign-in retryable.
      const user = await completeTelegramLogin(repository, config, res, result.identity);
      browserLogins.remove(cookie.id);
      clearBrowserLoginCookie(res, config.isProduction);
      res.json({
        status: 'verified',
        user: toUserProfile(user),
      } satisfies TelegramLoginStatusResponse);
      return;
    }

    clearBrowserLoginCookie(res, config.isProduction);
    res.json({ status: result.status } satisfies TelegramLoginStatusResponse);
  });

  app.post('/api/auth/dev', authLimiter, async (req, res) => {
    if (!config.devAuthEnabled || (config.isProduction && !config.demoMode)) {
      throw new AppError(403, 'DEV_AUTH_DISABLED', 'Development authentication is disabled');
    }
    const parsed = devAuthSchema.parse(req.body);
    const profile = deriveDevProfile(parsed.deviceKey, parsed.displayName);
    const user = await repository.upsertTelegramUser(profile);
    const token = createSessionToken(user, config.sessionSecret);
    setSessionCookie(res, token, { secure: config.isProduction });
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
    let user = req.authUser as UserEntity;
    if (parsed.autoAiFallback !== undefined) {
      user = await repository.setAutoAiFallback(user.id, parsed.autoAiFallback);
    }
    if (parsed.turnNotifications !== undefined) {
      user = await repository.setTurnNotifications(user.id, parsed.turnNotifications);
    }
    res.json({ user: toUserProfile(user) });
  });

  app.post(
    '/api/me/notifications/test',
    requireAuth,
    notificationTestLimiter,
    async (req, res) => {
      const tester = deps.turnNotificationTester;
      if (!tester) {
        throw new AppError(503, 'NOTIFICATIONS_UNAVAILABLE', 'Turn notifications are not configured');
      }
      const user = req.authUser as UserEntity;
      if (!user.turnNotifications) {
        throw new AppError(409, 'NOTIFICATIONS_DISABLED', 'Enable turn notifications first');
      }

      const delivery = await tester.sendTestNotification(user);
      if (delivery === 'sent') {
        res.json({ status: 'sent' });
        return;
      }
      if (delivery === 'blocked') {
        throw new AppError(
          409,
          'NOTIFICATIONS_DISABLED',
          'Telegram could not reach you, so turn notifications were disabled',
        );
      }
      throw new AppError(
        502,
        'NOTIFICATION_DELIVERY_FAILED',
        'Telegram could not deliver the test notification. Try again later.',
      );
    },
  );

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

function clearBrowserLoginCookie(res: Response, secure: boolean): void {
  res.clearCookie(BROWSER_LOGIN_COOKIE, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: BROWSER_LOGIN_COOKIE_PATH,
  });
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

    const bodyErrorType =
      typeof error === 'object' && error !== null && 'type' in error
        ? (error as { type?: unknown }).type
        : undefined;
    if (bodyErrorType === 'entity.too.large') {
      res
        .status(413)
        .json(errorBody(req, 'PAYLOAD_TOO_LARGE', 'Request body is too large.'));
      return;
    }
    if (bodyErrorType === 'encoding.unsupported' || bodyErrorType === 'charset.unsupported') {
      res
        .status(415)
        .json(errorBody(req, 'UNSUPPORTED_MEDIA_TYPE', 'Request body encoding is not supported.'));
      return;
    }

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
