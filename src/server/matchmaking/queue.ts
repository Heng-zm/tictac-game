import type { Logger } from 'pino';
import type { MatchMode, QueueStatus } from '../../shared/game-types';
import type { AppConfig } from '../config';
import { AppError } from '../errors';

interface QueueEntry {
  userId: string;
  mode: MatchMode;
  joinedAt: Date;
  autoAiFallback: boolean;
  fallbackOffered: boolean;
  fallbackTimer: ReturnType<typeof setTimeout> | null;
  expiryTimer: ReturnType<typeof setTimeout> | null;
}

export interface MatchmakingDependencies {
  config: AppConfig;
  logger: Logger;
  notify: (userId: string, status: QueueStatus) => void;
  onMatch: (firstUserId: string, secondUserId: string) => Promise<void>;
  onAutoFallback: (userId: string) => Promise<void>;
  now?: () => Date;
}

const MAX_QUEUE_SIZE = 10_000;
const QUEUE_MODE: MatchMode = 'RANDOM';

export class MatchmakingQueue {
  private readonly entries = new Map<string, QueueEntry>();
  private readonly now: () => Date;

  constructor(private readonly deps: MatchmakingDependencies) {
    this.now = deps.now ?? (() => new Date());
  }

  join(userId: string, autoAiFallback: boolean): QueueStatus {
    const existing = this.entries.get(userId);
    if (existing) {
      if (existing.autoAiFallback !== autoAiFallback) {
        existing.autoAiFallback = autoAiFallback;
        if (!existing.fallbackOffered) {
          this.scheduleFallback(existing);
        } else if (autoAiFallback) {
          // The fallback prompt was already offered. Enabling the preference
          // now should start the bot immediately instead of waiting for expiry.
          return this.startAutoFallback(existing);
        }
      }
      return this.toStatus(existing);
    }
    if (this.entries.size >= MAX_QUEUE_SIZE) {
      throw new AppError(503, 'QUEUE_FULL', 'Matchmaking is busy. Please try again in a moment.');
    }

    const opponent = this.findOpponent(userId);
    const joinedAt = this.now();
    const entry: QueueEntry = {
      userId,
      mode: QUEUE_MODE,
      joinedAt,
      autoAiFallback,
      fallbackOffered: false,
      fallbackTimer: null,
      expiryTimer: null,
    };
    this.entries.set(userId, entry);
    this.scheduleFallback(entry);
    entry.expiryTimer = setTimeout(() => this.handleExpiry(userId), this.deps.config.queueMaxWaitMs);
    entry.expiryTimer.unref?.();

    if (opponent) {
      this.removeEntry(opponent.userId);
      this.removeEntry(userId);
      void this.startHumanMatch(opponent.userId, userId);
      return {
        state: 'matched',
        mode: QUEUE_MODE,
        elapsedMs: 0,
        fallbackAt: null,
        fallbackAvailable: false,
        autoFallback: autoAiFallback,
        waitingPlayers: this.entries.size,
      };
    }

    return this.toStatus(entry);
  }

  cancel(userId: string, notify = true): boolean {
    const entry = this.entries.get(userId);
    if (!entry) return false;
    this.removeEntry(userId);
    if (notify) this.notify(userId, 'cancelled', 'Search cancelled');
    return true;
  }

  handleDisconnect(userId: string): void {
    this.cancel(userId, false);
  }

  isQueued(userId: string): boolean {
    return this.entries.has(userId);
  }

  size(): number {
    return this.entries.size;
  }

  getStatus(userId: string): QueueStatus | null {
    const entry = this.entries.get(userId);
    return entry ? this.toStatus(entry) : null;
  }

  shutdown(): void {
    for (const userId of [...this.entries.keys()]) {
      this.removeEntry(userId);
    }
  }

  private findOpponent(userId: string): QueueEntry | undefined {
    let candidate: QueueEntry | undefined;
    for (const entry of this.entries.values()) {
      if (entry.userId === userId || entry.mode !== QUEUE_MODE) continue;
      if (!candidate || entry.joinedAt.getTime() < candidate.joinedAt.getTime()) {
        candidate = entry;
      }
    }
    return candidate;
  }

  private async startHumanMatch(firstUserId: string, secondUserId: string): Promise<void> {
    try {
      await this.deps.onMatch(firstUserId, secondUserId);
    } catch (error) {
      this.deps.logger.warn(
        { event: 'matchmaking_pair_failed', code: error instanceof AppError ? error.code : 'UNKNOWN' },
        'Failed to create matched game',
      );
      const message = 'We could not start that match. Please search again.';
      this.notify(firstUserId, 'error', message);
      this.notify(secondUserId, 'error', message);
    }
  }

  private scheduleFallback(entry: QueueEntry): void {
    if (entry.fallbackTimer) clearTimeout(entry.fallbackTimer);
    const elapsed = this.now().getTime() - entry.joinedAt.getTime();
    const delay = Math.max(0, this.deps.config.queueAiTimeoutMs - elapsed);
    entry.fallbackTimer = setTimeout(() => void this.handleFallback(entry.userId), delay);
    entry.fallbackTimer.unref?.();
  }

  private async handleFallback(userId: string): Promise<void> {
    const entry = this.entries.get(userId);
    if (!entry || entry.fallbackOffered) return;
    entry.fallbackOffered = true;
    entry.fallbackTimer = null;

    if (entry.autoAiFallback) {
      this.startAutoFallback(entry);
      return;
    }
    this.notify(userId, 'searching', undefined, true);
  }

  private startAutoFallback(entry: QueueEntry): QueueStatus {
    this.removeEntry(entry.userId);
    const status: QueueStatus = {
      state: 'matched',
      mode: QUEUE_MODE,
      elapsedMs: Math.max(0, this.now().getTime() - entry.joinedAt.getTime()),
      fallbackAt: null,
      fallbackAvailable: true,
      autoFallback: true,
      waitingPlayers: this.entries.size,
      message: 'No human players found. Starting a bot match.',
    };
    this.deps.notify(entry.userId, status);
    void this.deps.onAutoFallback(entry.userId).catch((error: unknown) => {
      this.deps.logger.warn(
        { event: 'ai_fallback_failed', code: error instanceof AppError ? error.code : 'UNKNOWN' },
        'AI fallback failed',
      );
      this.notify(entry.userId, 'error', 'Could not start a bot match. Please try again.');
    });
    return status;
  }

  private handleExpiry(userId: string): void {
    const entry = this.entries.get(userId);
    if (!entry) return;
    this.removeEntry(userId);
    this.notify(userId, 'expired', 'No human opponent found. You can start a bot match instead.');
  }

  private removeEntry(userId: string): void {
    const entry = this.entries.get(userId);
    if (!entry) return;
    if (entry.fallbackTimer) clearTimeout(entry.fallbackTimer);
    if (entry.expiryTimer) clearTimeout(entry.expiryTimer);
    this.entries.delete(userId);
  }

  private notify(userId: string, state: QueueStatus['state'], message?: string, fallbackAvailable = false): void {
    const entry = this.entries.get(userId);
    const fallbackAt = entry
      ? new Date(entry.joinedAt.getTime() + this.deps.config.queueAiTimeoutMs).toISOString()
      : null;
    this.deps.notify(userId, {
      state,
      mode: QUEUE_MODE,
      elapsedMs: entry ? Math.max(0, this.now().getTime() - entry.joinedAt.getTime()) : 0,
      fallbackAt,
      fallbackAvailable: fallbackAvailable || Boolean(entry?.fallbackOffered),
      autoFallback: entry?.autoAiFallback ?? false,
      waitingPlayers: this.entries.size,
      ...(message ? { message } : {}),
    });
  }

  private toStatus(entry: QueueEntry): QueueStatus {
    return {
      state: 'searching',
      mode: entry.mode,
      elapsedMs: Math.max(0, this.now().getTime() - entry.joinedAt.getTime()),
      fallbackAt: new Date(entry.joinedAt.getTime() + this.deps.config.queueAiTimeoutMs).toISOString(),
      fallbackAvailable: entry.fallbackOffered,
      autoFallback: entry.autoAiFallback,
      waitingPlayers: this.entries.size,
    };
  }
}
