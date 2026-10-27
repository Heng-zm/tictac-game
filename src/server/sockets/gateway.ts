import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import { ZodError, type z } from 'zod';
import type { SocketAck } from '../../shared/game-types';
import type { AppConfig } from '../config';
import { parseCookieHeader, SESSION_COOKIE_NAME, verifySessionToken } from '../auth/session';
import type { GameRepository } from '../database/types';
import { AppError, RepositoryConflictError, SocketError } from '../errors';
import { MatchmakingQueue } from '../matchmaking/queue';
import type { MatchService } from '../services/match-service';
import { toUserProfile } from '../services/profile';
import {
  aiStartSchema,
  inviteAcceptSchema,
  inviteCancelSchema,
  matchIdOnlySchema,
  matchChatSchema,
  matchJoinSchema,
  matchReactionSchema,
  matchVoiceSchema,
  moveSubmitSchema,
  queueJoinSchema,
} from '../../shared/schemas/payloads';
import type { GameServer, GameSocket } from './types';
import { userRoom } from './types';

const EVENT_LIMITS: Record<string, { max: number; windowMs: number }> = {
  'queue:join': { max: 8, windowMs: 60_000 },
  'queue:cancel': { max: 12, windowMs: 60_000 },
  'ai:start': { max: 8, windowMs: 60_000 },
  'invite:create': { max: 6, windowMs: 60_000 },
  'invite:accept': { max: 12, windowMs: 60_000 },
  'invite:cancel': { max: 12, windowMs: 60_000 },
  'match:join': { max: 40, windowMs: 60_000 },
  'move:submit': { max: 20, windowMs: 2_000 },
  'match:rematch': { max: 12, windowMs: 60_000 },
  'match:leave': { max: 12, windowMs: 60_000 },
  'match:reaction': { max: 10, windowMs: 10_000 },
  'match:chat': { max: 10, windowMs: 10_000 },
  'match:voice': { max: 8, windowMs: 15_000 },
};

interface SocketGatewayDependencies {
  io: GameServer;
  repository: GameRepository;
  config: AppConfig;
  logger: Logger;
  matchService: MatchService;
  rateLimit?: boolean;
}

export interface SocketGateway {
  queue: MatchmakingQueue;
  notifyShutdown: (message: string) => void;
  shutdown: () => void;
}

export function createSocketGateway(deps: SocketGatewayDependencies): SocketGateway {
  const { io, repository, config, logger, matchService } = deps;
  const userSockets = new Map<string, Set<string>>();
  const socketLogger = logger.child({ component: 'socket' });

  const queue = new MatchmakingQueue({
    config,
    logger: socketLogger,
    notify: (userId, status) => {
      io.to(userRoom(userId)).emit('queue:status', status);
    },
    onMatch: async (firstUserId, secondUserId) => {
      await matchService.createRandomMatch(firstUserId, secondUserId);
    },
    onAutoFallback: async (userId) => {
      await matchService.startAiFallback(userId);
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookieHeader(socket.handshake.headers.cookie);
      const token = cookies[SESSION_COOKIE_NAME];
      const payload = verifySessionToken(token, config.sessionSecret);
      if (!payload) throw new AppError(401, 'AUTH_REQUIRED', 'Please sign in with Telegram');
      const user = await repository.getUserById(payload.uid);
      if (!user || user.telegramId.toString() !== payload.tid) {
        throw new AppError(401, 'AUTH_REQUIRED', 'Your session is no longer valid');
      }
      socket.data.user = user;
      socket.data.userId = user.id;
      next();
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(401, 'AUTH_REQUIRED', 'Socket authentication failed');
      const err = new Error(appError.message) as Error & { data?: { code: string } };
      err.data = { code: appError.code };
      next(err);
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    const log = socketLogger.child({ userId: user.id, socketId: socket.id });
    const limiter = new SocketRateLimiter(deps.rateLimit !== false);

    const sockets = userSockets.get(user.id) ?? new Set<string>();
    sockets.add(socket.id);
    userSockets.set(user.id, sockets);

    socket.join(userRoom(user.id));
    socket.emit('session:ready', {
      protocol: 1,
      serverTime: new Date().toISOString(),
      user: toUserProfile(user),
    });
    void matchService.handleConnected(user).catch((error: unknown) => {
      log.error({ err: error, event: 'match_resume_failed' }, 'Failed to resume match after connect');
    });

    registerHandlers(socket, log, limiter);

    socket.on('disconnect', (reason) => {
      const current = userSockets.get(user.id);
      current?.delete(socket.id);
      if (current && current.size > 0) return;
      userSockets.delete(user.id);
      queue.handleDisconnect(user.id);
      void matchService.handleDisconnected(user.id).catch((error: unknown) => {
        log.error({ err: error, event: 'presence_disconnect_failed' }, 'Failed to mark player offline');
      });
      void repository.touchUser(user.id).catch(() => undefined);
      log.info({ event: 'socket_disconnect', reason }, 'Socket disconnected');
    });

    log.info({ event: 'socket_connect' }, 'Socket connected');
  });

  function registerHandlers(socket: GameSocket, log: Logger, limiter: SocketRateLimiter): void {
    const userId = socket.data.userId;

    socket.on('queue:join', (payload, ack) => {
      void handleEvent(
        'queue:join',
        ack,
        async () => {
          const parsed = queueJoinSchema.parse(payload);
          await matchService.assertAvailable(userId);
          const status = queue.join(userId, parsed.autoAiFallback ?? socket.data.user.autoAiFallback);
          return { status };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('queue:cancel', (ack) => {
      void handleEvent(
        'queue:cancel',
        ack,
        async () => {
          queue.cancel(userId);
          return { cancelled: true as const };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('ai:start', (payload, ack) => {
      void handleEvent(
        'ai:start',
        ack,
        async () => {
          const parsed = aiStartSchema.parse(payload);
          queue.cancel(userId, false);
          const match = await matchService.startAi(userId, parsed.difficulty, parsed.side);
          return { matchId: match.id };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('invite:create', (ack) => {
      void handleEvent(
        'invite:create',
        ack,
        async () => {
          queue.cancel(userId, false);
          const invitation = await matchService.createInvitation(socket.data.user);
          return { invitation };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('invite:accept', (payload, ack) => {
      void handleEvent(
        'invite:accept',
        ack,
        async () => {
          const parsed = inviteAcceptSchema.parse(payload);
          queue.cancel(userId, false);
          const result = await matchService.acceptInvitation(socket.data.user, parsed.token);
          return { matchId: result.match.id };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('invite:cancel', (payload, ack) => {
      void handleEvent(
        'invite:cancel',
        ack,
        async () => {
          const parsed = inviteCancelSchema.parse(payload);
          await matchService.cancelInvitation(userId, parsed.invitationId);
          return { cancelled: true as const };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('match:join', (payload, ack) => {
      void handleEvent(
        'match:join',
        ack,
        async () => {
          const parsed = matchJoinSchema.parse(payload);
          // Joining the room is handled by MatchService.joinMatch only after it
          // has verified that this user is a participant. Joining here first
          // would let a rejected non-participant receive room broadcasts.
          const match = await matchService.joinMatch(userId, parsed.matchId);
          return { match };
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('match:reaction', (payload, ack) => {
      void handleEvent(
        'match:reaction',
        ack,
        async () => {
          const parsed = matchReactionSchema.parse(payload);
          return matchService.sendReaction(userId, parsed.matchId, parsed.stickerId);
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('match:chat', (payload, ack) => {
      void handleEvent(
        'match:chat',
        ack,
        async () => {
          const parsed = matchChatSchema.parse(payload);
          return matchService.sendChat(userId, parsed.matchId, parsed.text);
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('match:voice', (payload, ack) => {
      void handleEvent(
        'match:voice',
        ack,
        async () => {
          const parsed = matchVoiceSchema.parse(payload);
          return matchService.sendVoice(
            userId,
            parsed.matchId,
            parsed.audioData,
            parsed.durationMs,
            parsed.waveform,
          );
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('move:submit', (payload, ack) => {
      void handleEvent(
        'move:submit',
        ack,
        async () => {
          const parsed = moveSubmitSchema.parse(payload);
          const match = await matchService.submitMove(
            userId,
            parsed.matchId,
            parsed.cell,
            parsed.actionId,
          );
          return { match };
        },
        limiter,
        log,
        socket,
        (error) => {
          const parsed = moveSubmitSchema.safeParse(payload);
          if (parsed.success) {
            socket.emit('move:rejected', {
              matchId: parsed.data.matchId,
              actionId: parsed.data.actionId,
              code: error.code,
              message: error.message,
            });
          }
        },
      );
    });

    socket.on('match:rematch', (payload, ack) => {
      void handleEvent(
        'match:rematch',
        ack,
        async () => {
          const parsed = matchIdOnlySchema.parse(payload);
          return matchService.requestRematch(userId, parsed.matchId);
        },
        limiter,
        log,
        socket,
      );
    });

    socket.on('match:leave', (payload, ack) => {
      void handleEvent(
        'match:leave',
        ack,
        async () => {
          const parsed = matchIdOnlySchema.parse(payload);
          await matchService.leaveMatch(userId, parsed.matchId);
          return { left: true as const };
        },
        limiter,
        log,
        socket,
      );
    });
  }

  async function handleEvent<T>(
    event: string,
    ack: ((result: SocketAck<T>) => void) | undefined,
    work: () => Promise<T>,
    limiter: SocketRateLimiter,
    log: Logger,
    socket: GameSocket,
    onClientError?: (error: { code: string; message: string }) => void,
  ): Promise<void> {
    const requestId = randomUUID();
    const respond = typeof ack === 'function' ? ack : () => undefined;
    const limit = EVENT_LIMITS[event] ?? { max: 60, windowMs: 60_000 };

    if (!limiter.allow('*', 240, 60_000) || !limiter.allow(event, limit.max, limit.windowMs)) {
      respond({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
      });
      return;
    }

    try {
      const data = await work();
      respond({ ok: true, data });
    } catch (error) {
      const mapped = mapSocketError(error);
      if (error instanceof ZodError) {
        log.info({ event, requestId, code: mapped.code }, 'Rejected invalid socket payload');
      } else if (mapped.code === 'INTERNAL_ERROR') {
        log.error({ event, requestId, err: error }, 'Socket event failed');
        socket.emit('server:error', {
          code: mapped.code,
          message: mapped.message,
          requestId,
        });
      } else {
        log.warn({ event, requestId, code: mapped.code }, 'Socket event rejected');
      }
      respond({ ok: false, error: { ...mapped, requestId } });
      onClientError?.(mapped);
    }
  }

  function notifyShutdown(message: string): void {
    io.emit('server:shutdown', { message });
  }

  function shutdown(): void {
    queue.shutdown();
  }

  return { queue, notifyShutdown, shutdown };
}

class SocketRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(private readonly enabled: boolean) {}

  allow(key: string, max: number, windowMs: number): boolean {
    if (!this.enabled) return true;
    const now = Date.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (bucket.count >= max) return false;
    bucket.count += 1;
    return true;
  }
}

function mapSocketError(error: unknown): { code: string; message: string } {
  if (error instanceof ZodError) {
    return { code: 'VALIDATION_ERROR', message: 'The request contains invalid data.' };
  }
  if (error instanceof AppError || error instanceof SocketError || error instanceof RepositoryConflictError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' };
}

// Re-exported for tests that need the exact inferred payload types.
export type QueueJoinPayloadSchema = z.infer<typeof queueJoinSchema>;
export type ParsedInviteAccept = z.infer<typeof inviteAcceptSchema>;
export type ParsedMoveSubmit = z.infer<typeof moveSubmitSchema>;
