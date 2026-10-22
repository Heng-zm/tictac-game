import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/server/config';
import type { UserEntity } from '../src/server/database/types';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import { MatchService } from '../src/server/services/match-service';
import type { MatchVoiceEvent } from '../src/shared/events';
import { matchVoiceSchema } from '../src/shared/schemas/payloads';
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

describe('MatchService — Walkie-Talkie Voice Transmission', () => {
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
    alice = await createTestUser(repo, 4001n, 'Alice');
    bob = await createTestUser(repo, 4002n, 'Bob');
    charlie = await createTestUser(repo, 4003n, 'Charlie');
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

  it('validates matchVoiceSchema payload constraints', () => {
    const valid = {
      matchId: '11111111-1111-4111-8111-111111111111',
      audioData: 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=',
      durationMs: 2500,
      waveform: [0.1, 0.5, 0.9, 0.2],
    };
    expect(matchVoiceSchema.safeParse(valid).success).toBe(true);

    // Duration too short (<400ms)
    expect(matchVoiceSchema.safeParse({ ...valid, durationMs: 200 }).success).toBe(false);

    // Duration too long (>11000ms)
    expect(matchVoiceSchema.safeParse({ ...valid, durationMs: 12000 }).success).toBe(false);

    // Audio data empty
    expect(matchVoiceSchema.safeParse({ ...valid, audioData: '' }).success).toBe(false);
  });

  it('allows active match participants to transmit walkie-talkie audio and broadcasts to matchRoom', async () => {
    const match = await service.startAi(alice.id, 'EASY', 'X');
    const dummyAudio = 'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQ8=';
    const waveform = [0.2, 0.8, 0.5, 0.9, 0.4];

    const res = await service.sendVoice(alice.id, match.id, dummyAudio, 1800, waveform);
    expect(res).toEqual({ sent: true });

    const roomEvents = io.emitted.filter(
      (e) => e.room === `match:${match.id}` && e.event === 'match:voice',
    );
    expect(roomEvents).toHaveLength(1);

    const event = roomEvents[0]!.payload as MatchVoiceEvent;
    expect(event.matchId).toBe(match.id);
    expect(event.senderSide).toBe('X');
    expect(event.audioData).toBe(dummyAudio);
    expect(event.durationMs).toBe(1800);
    expect(event.waveform).toEqual(waveform);
    expect(event.voiceId).toBeDefined();
    expect(event.timestamp).toBeDefined();
  });

  it('rejects voice message from a non-participant with MATCH_FORBIDDEN', async () => {
    const match = await service.startAi(alice.id, 'EASY', 'X');
    await expect(
      service.sendVoice(charlie.id, match.id, 'dummy-data', 1500),
    ).rejects.toMatchObject({
      code: 'MATCH_FORBIDDEN',
    });
  });

  it('rejects voice message when match is not active or finished', async () => {
    const invite = await service.createInvitation(alice);
    await expect(
      service.sendVoice(alice.id, invite.matchId, 'dummy-data', 1500),
    ).rejects.toMatchObject({
      code: 'GAME_NOT_ACTIVE',
    });
  });

  it('schedules AI simulated roger-beep walkie-talkie response in AI match', async () => {
    const match = await service.startAi(alice.id, 'EASY', 'X');
    io.emitted.length = 0;

    await service.sendVoice(alice.id, match.id, 'dummy-data', 1200);

    const initialEvents = io.emitted.filter(
      (e) => e.room === `match:${match.id}` && e.event === 'match:voice',
    );
    expect(initialEvents).toHaveLength(1);

    // Fast forward timer to trigger AI roger beep response
    await vi.advanceTimersByTimeAsync(3000);

    const voiceEvents = io.emitted.filter(
      (e) => e.room === `match:${match.id}` && e.event === 'match:voice',
    );
    expect(voiceEvents.length).toBeGreaterThanOrEqual(2);

    const botVoice = voiceEvents[1]!.payload as MatchVoiceEvent;
    expect(botVoice.senderSide).toBe('O');
    expect(botVoice.audioData).toContain('data:audio/wav;base64,');
  });
});
