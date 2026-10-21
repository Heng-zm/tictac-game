import pino, { type Logger } from 'pino';
import type { AppConfig } from '../src/server/config';
import type { GameRepository, UserEntity } from '../src/server/database/types';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import type { GameServer } from '../src/server/sockets/types';
import { userRoom } from '../src/server/sockets/types';

export const TEST_SESSION_SECRET = 'test-only-session-secret-with-enough-entropy-42';
export const TEST_BOT_TOKEN = '123456789:AAEhBOweik6ad9r_QXMENrgM6vVGM6z2N3A';

export function makeTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    isProduction: false,
    port: 0,
    databaseUrl: null,
    databaseMode: 'memory',
    demoMode: false,
    sessionSecret: TEST_SESSION_SECRET,
    miniAppUrl: 'http://localhost:5173',
    telegramBotToken: null,
    telegramBotUsername: null,
    telegramWebhookUrl: null,
    telegramWebhookSecret: null,
    devAuthEnabled: true,
    allowedOrigins: ['http://localhost:5173'],
    queueAiTimeoutMs: 10_000,
    queueMaxWaitMs: 600_000,
    disconnectGraceMs: 30_000,
    turnTimeoutMs: 0,
    inviteTtlMinutes: 1_440,
    authMaxAgeSeconds: 86_400,
    aiThinkMinMs: 0,
    aiThinkMaxMs: 0,
    aiFallbackDifficulty: 'MEDIUM',
    maintenanceIntervalMs: 3_600_000,
    matchStaleAfterMs: 86_400_000,
    logLevel: 'silent',
    trustProxy: 0,
    ...overrides,
  };
}

export function makeTestLogger(): Logger {
  return pino({ level: 'silent' });
}

export class MutableClock {
  private current: Date;

  constructor(initial: string | Date = '2026-10-21T12:00:00.000Z') {
    this.current = typeof initial === 'string' ? new Date(initial) : initial;
  }

  readonly now = (): Date => new Date(this.current);

  advance(ms: number): Date {
    this.current = new Date(this.current.getTime() + ms);
    return this.now();
  }

  set(value: string | Date): void {
    this.current = typeof value === 'string' ? new Date(value) : value;
  }
}

export async function createTestUser(
  repository: GameRepository,
  telegramId: bigint,
  firstName = `Player ${telegramId}`,
): Promise<UserEntity> {
  return repository.upsertTelegramUser({
    telegramId,
    firstName,
    username: null,
    lastName: null,
    photoUrl: null,
    languageCode: 'en',
  });
}

export interface EmittedEvent {
  room: string;
  event: string;
  payload: unknown;
}

type EmitFn = (event: string, payload: unknown) => boolean;

/** Minimal in-memory stand-in for the Socket.IO server used by service tests. */
export class FakeIo {
  readonly emitted: EmittedEvent[] = [];
  readonly rooms = new Map<string, Set<string>>();

  to(room: string): { emit: EmitFn } {
    return {
      emit: (event, payload) => {
        this.emitted.push({ room, event, payload });
        return true;
      },
    };
  }

  in(room: string): {
    socketsJoin: (rooms: string | string[]) => void;
    socketsLeave: (rooms: string | string[]) => void;
  } {
    return {
      socketsJoin: (rooms) => {
        for (const target of Array.isArray(rooms) ? rooms : [rooms]) {
          const members = this.rooms.get(target) ?? new Set<string>();
          members.add(room);
          this.rooms.set(target, members);
        }
      },
      socketsLeave: (rooms) => {
        for (const target of Array.isArray(rooms) ? rooms : [rooms]) {
          this.rooms.get(target)?.delete(room);
        }
      },
    };
  }

  asGameServer(): GameServer {
    return this as unknown as GameServer;
  }

  events(event?: string): EmittedEvent[] {
    return event ? this.emitted.filter((item) => item.event === event) : [...this.emitted];
  }

  eventsForRoom(room: string, event?: string): EmittedEvent[] {
    return this.emitted.filter(
      (item) => item.room === room && (!event || item.event === event),
    );
  }

  last<T>(event: string): T | undefined {
    const matches = this.events(event);
    return matches[matches.length - 1]?.payload as T | undefined;
  }

  lastForRoom<T>(userId: string, event: string): T | undefined {
    const matches = this.eventsForRoom(userRoom(userId), event);
    return matches[matches.length - 1]?.payload as T | undefined;
  }

  reset(): void {
    this.emitted.length = 0;
  }
}

export function createMemoryRepository(clock: MutableClock = new MutableClock()): MemoryGameRepository {
  return new MemoryGameRepository(clock.now);
}

export function participant(
  user: UserEntity,
  side: 'X' | 'O',
): {
  userId: string;
  side: 'X' | 'O';
  isAi: false;
  displayName: string;
  username: null;
  photoUrl: null;
} {
  return {
    userId: user.id,
    side,
    isAi: false,
    displayName: user.firstName,
    username: null,
    photoUrl: null,
  };
}
