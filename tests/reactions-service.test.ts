import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/server/config';
import type { UserEntity } from '../src/server/database/types';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import { MatchService } from '../src/server/services/match-service';
import type { MatchReactionEvent } from '../src/shared/events';
import {
  FakeIo,
  MutableClock,
  TEST_SESSION_SECRET,
  createTestUser,
  makeTestConfig,
  makeTestLogger,
} from './helpers';

const BASE_CONFIG: Partial<AppConfig> = {
  sessionSecret: TEST_SESSION_SECRET,
  disconnectGraceMs: 1_000,
  turnTimeoutMs: 0,
  inviteTtlMinutes: 1_440,
  aiThinkMinMs: 0,
  aiThinkMaxMs: 0,
};

describe('MatchService — Sticker Reactions & Quick Chat', () => {
  let clock: MutableClock;
  let repo: MemoryGameRepository;
  let io: FakeIo;
  let alice: UserEntity;
  let bob: UserEntity;
  let charlie: UserEntity;
  let service: MatchService;
  const services: MatchService[] = [];

  beforeEach(async () => {
    vi.useFakeTimers();
    clock = new MutableClock();
    vi.setSystemTime(clock.now());
    io = new FakeIo();
    repo = new MemoryGameRepository(clock.now);
    alice = await createTestUser(repo, 3001n, 'Alice');
    bob = await createTestUser(repo, 3002n, 'Bob');
    charlie = await createTestUser(repo, 3003n, 'Charlie');
    service = new MatchService({
      io: io.asGameServer(),
      repository: repo,
      config: makeTestConfig(BASE_CONFIG),
      logger: makeTestLogger(),
      now: clock.now,
      random: () => 0.25,
    });
    services.push(service);
    await service.handleConnected(alice);
    await service.handleConnected(bob);
    await service.handleConnected(charlie);
  });

  afterEach(() => {
    for (const item of services) item.shutdown();
    services.length = 0;
    vi.useRealTimers();
  });

  it('broadcasts reaction event to the match room when a participant sends an animated sticker', async () => {
    const match = await service.createRandomMatch(alice.id, bob.id);
    io.emitted.length = 0;

    const res = await service.sendReaction(alice.id, match.id, 'greeting');
    expect(res).toEqual({ sent: true });

    const reactionEvents = io.emitted.filter(
      (e) => e.room === `match:${match.id}` && e.event === 'match:reaction',
    );
    expect(reactionEvents).toHaveLength(1);

    const payload = reactionEvents[0]!.payload as MatchReactionEvent;
    expect(payload.matchId).toBe(match.id);
    expect(payload.stickerId).toBe('greeting');
    expect(payload.senderSide).toBe('X');
    expect(typeof payload.reactionId).toBe('string');
    expect(payload.reactionId.length).toBeGreaterThan(0);
    expect(payload.timestamp).toBe(clock.now().toISOString());
  });

  it('allows the opponent to also send reactions in the same match', async () => {
    const match = await service.createRandomMatch(alice.id, bob.id);
    io.emitted.length = 0;

    await service.sendReaction(bob.id, match.id, 'good_game');

    const reactionEvents = io.emitted.filter(
      (e) => e.room === `match:${match.id}` && e.event === 'match:reaction',
    );
    expect(reactionEvents).toHaveLength(1);
    const payload = reactionEvents[0]!.payload as MatchReactionEvent;
    expect(payload.senderSide).toBe('O');
    expect(payload.stickerId).toBe('good_game');
  });

  it('rejects reactions from users who are not part of the match', async () => {
    const match = await service.createRandomMatch(alice.id, bob.id);

    await expect(service.sendReaction(charlie.id, match.id, 'clapping')).rejects.toMatchObject({
      code: 'MATCH_FORBIDDEN',
    });
  });

  it('rejects reactions for non-existent matches', async () => {
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    await expect(service.sendReaction(alice.id, fakeUuid, 'victory')).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    });
  });

  it('rejects reactions if the match is still WAITING (e.g. unaccepted friend invite)', async () => {
    const invite = await service.createInvitation(alice);

    await expect(service.sendReaction(alice.id, invite.matchId, 'greeting')).rejects.toMatchObject({
      code: 'GAME_NOT_ACTIVE',
    });
  });

  it('schedules a playful bot reaction response when human reacts in AI game', async () => {
    const aiMatch = await service.startAi(alice.id, 'MEDIUM', 'X');
    io.emitted.length = 0;

    await service.sendReaction(alice.id, aiMatch.id, 'greeting');

    // Human reaction was emitted immediately
    expect(io.emitted.filter((e) => e.event === 'match:reaction')).toHaveLength(1);

    // Fast-forward timer past the bot delay (700-1100ms)
    vi.advanceTimersByTime(1500);

    // Bot response reaction has been emitted to the room!
    const reactions = io.emitted.filter((e) => e.event === 'match:reaction');
    expect(reactions.length).toBeGreaterThanOrEqual(2);

    const botReaction = reactions[reactions.length - 1]!.payload as MatchReactionEvent;
    expect(botReaction.senderSide).toBe('O'); // Bot is on side O
    expect(['greeting', 'respect']).toContain(botReaction.stickerId);
  });
});
