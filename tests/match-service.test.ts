import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppConfig } from '../src/server/config';
import type { MatchEntity, UserEntity } from '../src/server/database/types';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import { MatchService } from '../src/server/services/match-service';
import type { CreatedInvitation, PublicMatchState, Side } from '../src/shared/game-types';
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

describe('MatchService', () => {
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
    alice = await createTestUser(repo, 2001n, 'Alice');
    bob = await createTestUser(repo, 2002n, 'Bob');
    charlie = await createTestUser(repo, 2003n, 'Charlie');
    service = await startService();
  });

  afterEach(() => {
    for (const item of services) item.shutdown();
    services.length = 0;
    vi.useRealTimers();
  });

  async function startService(overrides: Partial<AppConfig> = {}): Promise<MatchService> {
    const instance = new MatchService({
      io: io.asGameServer(),
      repository: repo,
      config: makeTestConfig({ ...BASE_CONFIG, ...overrides }),
      logger: makeTestLogger(),
      now: clock.now,
      random: () => 0.1,
    });
    services.push(instance);
    await instance.handleConnected(alice);
    await instance.handleConnected(bob);
    await instance.handleConnected(charlie);
    return instance;
  }

  async function createRandomMatch(): Promise<MatchEntity> {
    return service.createRandomMatch(alice.id, bob.id);
  }

  function sideUser(match: MatchEntity, side: Side): string {
    const participant = match.participants.find((item) => item.side === side);
    if (!participant?.userId) throw new Error(`No human participant on side ${side}`);
    return participant.userId;
  }

  async function playToXWin(match: MatchEntity): Promise<{ finalActionId: string; finalState: PublicMatchState }> {
    const moves: Array<[Side, number]> = [
      ['X', 0],
      ['O', 3],
      ['X', 1],
      ['O', 4],
      ['X', 2],
    ];
    let last: PublicMatchState | null = null;
    let finalActionId = '';
    for (const [side, cell] of moves) {
      finalActionId = randomUUID();
      last = await service.submitMove(sideUser(match, side), match.id, cell, finalActionId);
    }
    if (!last) throw new Error('Game was not played');
    return { finalActionId, finalState: last };
  }

  function inviteToken(invitation: CreatedInvitation): string {
    const startParam = new URL(invitation.deepLink).searchParams.get('startapp');
    if (!startParam?.startsWith('invite_')) throw new Error('Missing invite start parameter');
    return startParam.slice('invite_'.length);
  }

  async function advance(ms: number): Promise<void> {
    clock.advance(ms);
    await vi.advanceTimersByTimeAsync(ms);
    await flushAsyncWork();
  }

  async function flushAsyncWork(): Promise<void> {
    for (let index = 0; index < 5; index += 1) await Promise.resolve();
  }

  it('creates a random match, assigns sides and emits match:found', async () => {
    const match = await createRandomMatch();
    expect(match).toMatchObject({ mode: 'RANDOM', status: 'ACTIVE', currentTurn: 'X', version: 0 });
    expect(match.participants.find((p) => p.side === 'X')?.userId).toBe(alice.id);
    expect(match.participants.find((p) => p.side === 'O')?.userId).toBe(bob.id);

    const aliceFound = io.lastForRoom<{ match: PublicMatchState }>(alice.id, 'match:found');
    const bobFound = io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:found');
    expect(aliceFound?.match.youSide).toBe('X');
    expect(aliceFound?.match.players.X?.isYou).toBe(true);
    expect(aliceFound?.match.players.O?.displayName).toBe('Bob');
    expect(bobFound?.match.youSide).toBe('O');
    expect(aliceFound?.match).toMatchObject({
      protocol: 1,
      status: 'ACTIVE',
      currentTurn: 'X',
      turnTimerPaused: false,
    });
  });

  it('rejects self-matches', async () => {
    await expect(service.createRandomMatch(alice.id, alice.id)).rejects.toMatchObject({
      code: 'PLAYER_BUSY',
    });
  });

  it('accepts valid moves and rejects out-of-turn, occupied and invalid cells', async () => {
    const match = await createRandomMatch();
    const aliceId = sideUser(match, 'X');
    const bobId = sideUser(match, 'O');

    const state = await service.submitMove(aliceId, match.id, 0, randomUUID());
    expect(state.board[0]).toBe('X');
    expect(state.currentTurn).toBe('O');
    expect(state.version).toBe(1);
    expect(io.events('move:accepted')).toHaveLength(1);
    expect(io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:state')?.match.board[0]).toBe('X');

    await expect(service.submitMove(aliceId, match.id, 1, randomUUID())).rejects.toMatchObject({
      code: 'OUT_OF_TURN',
    });
    await expect(service.submitMove(bobId, match.id, 0, randomUUID())).rejects.toMatchObject({
      code: 'OCCUPIED_CELL',
    });
    await expect(service.submitMove(bobId, match.id, 9, randomUUID())).rejects.toMatchObject({
      code: 'INVALID_CELL',
    });
  });

  it('makes duplicate action IDs idempotent', async () => {
    const match = await createRandomMatch();
    const aliceId = sideUser(match, 'X');
    const actionId = randomUUID();
    const first = await service.submitMove(aliceId, match.id, 0, actionId);
    const duplicate = await service.submitMove(aliceId, match.id, 0, actionId);
    expect(duplicate.version).toBe(first.version);
    expect(duplicate.board).toEqual(first.board);
    expect(io.events('move:accepted')).toHaveLength(1);
  });

  it('keeps retries of the finishing move idempotent', async () => {
    const match = await createRandomMatch();
    const { finalActionId, finalState } = await playToXWin(match);

    expect(finalState.status).toBe('FINISHED');
    expect(finalState.result).toBe('X_WINS');
    expect(finalState.finishReason).toBe('LINE');
    expect(finalState.players.X?.isYou).toBe(true);

    const retry = await service.submitMove(alice.id, match.id, 2, finalActionId);
    expect(retry.status).toBe('FINISHED');
    expect(retry.version).toBe(finalState.version);
    expect(retry.board).toEqual(finalState.board);
  });

  it('keeps finishing-move retries idempotent after a server restart', async () => {
    const match = await createRandomMatch();
    const { finalActionId, finalState } = await playToXWin(match);

    // A fresh service has no in-memory processed-action set; durability comes
    // from the repository's move history.
    const restarted = await startService();
    const retry = await restarted.submitMove(alice.id, match.id, 2, finalActionId);

    expect(retry.status).toBe('FINISHED');
    expect(retry.version).toBe(finalState.version);
    expect(retry.board).toEqual(finalState.board);
  });

  it('rejects further moves and non-participants after a game ends', async () => {
    const match = await createRandomMatch();
    await playToXWin(match);

    await expect(service.submitMove(alice.id, match.id, 4, randomUUID())).rejects.toMatchObject({
      code: 'GAME_FINISHED',
    });
    await expect(service.submitMove(charlie.id, match.id, 4, randomUUID())).rejects.toMatchObject({
      code: 'MATCH_FORBIDDEN',
    });
    await expect(service.submitMove(alice.id, randomUUID(), 4, randomUUID())).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    });
  });

  it('authorizes match joins and exposes finished and waiting states', async () => {
    const match = await createRandomMatch();
    await expect(service.joinMatch(charlie.id, match.id)).rejects.toMatchObject({
      code: 'MATCH_FORBIDDEN',
    });
    await expect(service.joinMatch(alice.id, randomUUID())).rejects.toMatchObject({
      code: 'MATCH_NOT_FOUND',
    });

    const joined = await service.joinMatch(bob.id, match.id);
    expect(joined.id).toBe(match.id);
    expect(joined.youSide).toBe('O');

    await playToXWin(match);
    const finished = await service.joinMatch(alice.id, match.id);
    expect(finished.status).toBe('FINISHED');

    const invitation = await service.createInvitation(charlie);
    await expect(service.joinMatch(charlie.id, invitation.matchId)).rejects.toMatchObject({
      code: 'GAME_NOT_ACTIVE',
    });
  });

  it('creates and accepts friend invitations with authorization and replay protection', async () => {
    const invitation = await service.createInvitation(alice);
    const token = inviteToken(invitation);
    expect(invitation.deepLink).toContain(`startapp=invite_${token}`);
    expect(io.lastForRoom<{ invitation: { id: string } }>(alice.id, 'invite:waiting')?.invitation.id).toBe(
      invitation.id,
    );

    await expect(service.acceptInvitation(alice, token)).rejects.toMatchObject({
      code: 'INVITATION_OWN',
    });

    const hostPreview = await service.getInvitePreview(alice.id, token);
    expect(hostPreview).toMatchObject({
      status: 'PENDING',
      youAreInviter: true,
      yourSide: 'X',
      matchId: invitation.matchId,
    });

    const guestPreview = await service.getInvitePreview(bob.id, token);
    expect(guestPreview).toMatchObject({ youAreInviter: false, yourSide: 'O' });

    const accepted = await service.acceptInvitation(bob, token);
    expect(accepted.match).toMatchObject({ id: invitation.matchId, status: 'ACTIVE', currentTurn: 'X' });
    expect(accepted.match.participants).toHaveLength(2);
    expect(io.lastForRoom<{ match: PublicMatchState }>(alice.id, 'match:found')?.match.id).toBe(
      invitation.matchId,
    );
    expect(io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:found')?.match.youSide).toBe('O');
    expect((await service.getInvitePreview(alice.id, token)).status).toBe('ACCEPTED');

    await expect(service.acceptInvitation(charlie, token)).rejects.toMatchObject({
      code: 'INVITATION_USED',
    });
  });

  it('cancels invitations only for the host and releases the reservation', async () => {
    const invitation = await service.createInvitation(alice);
    await expect(service.cancelInvitation(bob.id, invitation.id)).rejects.toMatchObject({
      code: 'INVITATION_FORBIDDEN',
    });
    await expect(service.cancelInvitation(charlie.id, randomUUID())).rejects.toMatchObject({
      code: 'INVITATION_INVALID',
    });

    await service.cancelInvitation(alice.id, invitation.id);
    expect((await repo.getMatchById(invitation.matchId))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    await expect(service.cancelInvitation(alice.id, invitation.id)).rejects.toMatchObject({
      code: 'INVITATION_USED',
    });
  });

  it('expires invitations after the configured TTL', async () => {
    const invitation = await service.createInvitation(charlie);
    const token = inviteToken(invitation);
    await advance(1_441 * 60_000);

    expect((await service.getInvitePreview(charlie.id, token)).status).toBe('EXPIRED');
    expect((await repo.getMatchById(invitation.matchId))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(charlie.id))?.activeMatchId).toBeNull();
    await expect(service.acceptInvitation(bob, token)).rejects.toMatchObject({
      code: 'INVITATION_EXPIRED',
    });
  });

  it('rejects invitations for busy acceptors and busy hosts', async () => {
    const invitation = await service.createInvitation(alice);
    const token = inviteToken(invitation);
    await service.acceptInvitation(bob, token);
    await expect(service.createInvitation(alice)).rejects.toMatchObject({ code: 'PLAYER_BUSY' });

    await expect(service.assertAvailable(alice.id)).rejects.toMatchObject({ code: 'PLAYER_BUSY' });
    await expect(service.assertAvailable('missing-user')).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
  });

  it('reports a pending invitation when the host has a waiting match', async () => {
    await service.createInvitation(alice);
    await expect(service.assertAvailable(alice.id)).rejects.toMatchObject({
      code: 'INVITATION_PENDING',
    });
  });

  it('clears stale or orphaned activeMatchId during assertAvailable', async () => {
    const memoryRepo = repo as unknown as { users: Map<string, { activeMatchId: string | null }> };
    memoryRepo.users.get(alice.id)!.activeMatchId = randomUUID();

    await expect(service.assertAvailable(alice.id)).resolves.toBeUndefined();
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
  });

  it('plays an AI match and lets Hard block optimally', async () => {
    const match = await service.startAi(alice.id, 'HARD', 'X');
    expect(match.mode).toBe('AI');
    expect(match.participants.find((p) => p.isAi)).toMatchObject({
      side: 'O',
      aiDifficulty: 'HARD',
      userId: null,
    });

    await service.submitMove(alice.id, match.id, 0, randomUUID());
    await vi.advanceTimersByTimeAsync(0);
    await flushAsyncWork();

    const afterAi = await repo.getMatchById(match.id);
    expect(afterAi?.turnNumber).toBe(2);
    expect(afterAi?.board[0]).toBe('X');
    expect(afterAi?.board[4]).toBe('O');
    expect(afterAi?.currentTurn).toBe('X');
    expect(io.events('move:accepted').some((event) => (event.payload as { side?: Side }).side === 'O')).toBe(true);
  });

  it('starts an AI fallback with the configured difficulty', async () => {
    service = await startService({ aiFallbackDifficulty: 'MEDIUM' });
    const match = await service.startAiFallback(alice.id);
    expect(match.mode).toBe('AI');
    expect(match.participants.find((p) => p.isAi)?.aiDifficulty).toBe('MEDIUM');
    expect(match.participants.find((p) => p.isAi)?.side).toBe('O');
  });

  it('handles reconnect within the grace period and forfeits after it expires', async () => {
    const match = await createRandomMatch();

    await service.handleDisconnected(alice.id);
    const disconnected = io.lastForRoom<{ graceEndsAt: string }>(bob.id, 'opponent:disconnected');
    expect(disconnected?.graceEndsAt).toBe(new Date(clock.now().getTime() + 1_000).toISOString());
    expect(io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:state')?.match.opponentConnection).toBe(
      'disconnected',
    );

    await service.handleConnected(alice);
    expect(io.lastForRoom<{ matchId: string }>(bob.id, 'opponent:reconnected')?.matchId).toBe(match.id);
    await advance(5_000);
    expect((await repo.getMatchById(match.id))?.status).toBe('ACTIVE');

    await service.handleDisconnected(alice.id);
    await advance(1_000);
    const finished = await repo.getMatchById(match.id);
    expect(finished).toMatchObject({
      status: 'FINISHED',
      result: 'O_WINS',
      winnerSide: 'O',
      finishReason: 'DISCONNECT',
    });
    expect(io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:finished')?.match.finishReason).toBe(
      'DISCONNECT',
    );
  });

  it('abandons a human match when both players are offline', async () => {
    const match = await createRandomMatch();
    await service.handleDisconnected(alice.id);
    await service.handleDisconnected(bob.id);
    await advance(1_000);

    expect((await repo.getMatchById(match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.stats.gamesPlayed).toBe(0);
  });

  it('forfeits on turn timeout and pauses the timer while the player is offline', async () => {
    service = await startService({ turnTimeoutMs: 1_000, disconnectGraceMs: 10_000 });
    const match = await createRandomMatch();
    expect((await repo.getMatchById(match.id))?.turnDeadline).not.toBeNull();

    await service.handleDisconnected(alice.id);
    expect(
      io.lastForRoom<{ match: PublicMatchState }>(bob.id, 'match:state')?.match.turnDeadline,
    ).toBeNull();
    await advance(2_000);
    expect((await repo.getMatchById(match.id))?.status).toBe('ACTIVE');

    await service.handleConnected(alice);
    await advance(1_000);
    expect(await repo.getMatchById(match.id)).toMatchObject({
      status: 'FINISHED',
      result: 'O_WINS',
      finishReason: 'TIMEOUT',
    });
  });

  it('resumes a paused turn with its remaining time after reconnecting', async () => {
    service = await startService({ turnTimeoutMs: 1_000, disconnectGraceMs: 10_000 });
    const match = await createRandomMatch();
    await advance(250);
    expect((await repo.getMatchById(match.id))?.turnDeadline?.getTime()).toBe(clock.now().getTime() + 750);

    await service.handleDisconnected(alice.id);
    await advance(2_000);

    await service.handleConnected(alice);
    await advance(700);
    expect((await repo.getMatchById(match.id))?.status).toBe('ACTIVE');

    await advance(60);
    expect(await repo.getMatchById(match.id)).toMatchObject({
      status: 'FINISHED',
      result: 'O_WINS',
      finishReason: 'TIMEOUT',
    });
  });

  it('keeps the paused turn time when the other player reconnects first', async () => {
    service = await startService({ turnTimeoutMs: 1_000, disconnectGraceMs: 10_000 });
    const match = await createRandomMatch();
    await advance(250);

    await service.handleDisconnected(alice.id);
    await advance(500);
    await service.handleDisconnected(bob.id);
    await service.handleConnected(bob);
    await advance(500);

    await service.handleConnected(alice);
    await advance(700);
    expect((await repo.getMatchById(match.id))?.status).toBe('ACTIVE');

    await advance(60);
    expect(await repo.getMatchById(match.id)).toMatchObject({
      status: 'FINISHED',
      result: 'O_WINS',
      finishReason: 'TIMEOUT',
    });
  });

  it('creates a rated rematch when both players agree', async () => {
    const match = await createRandomMatch();
    await playToXWin(match);

    const firstRequest = await service.requestRematch(alice.id, match.id);
    expect(firstRequest.matchId).toBe(match.id);
    expect(firstRequest.rematch).toMatchObject({
      available: true,
      requestedByYou: true,
      requestedByOpponent: false,
    });

    const secondRequest = await service.requestRematch(bob.id, match.id);
    expect(secondRequest.matchId).not.toBe(match.id);
    const rematch = await repo.getMatchById(secondRequest.matchId);
    expect(rematch).toMatchObject({
      mode: 'RANDOM',
      status: 'ACTIVE',
      rematchOfId: match.id,
      currentTurn: 'X',
    });
    expect(rematch?.participants.find((p) => p.side === 'X')?.userId).toBe(bob.id);
    expect(rematch?.participants.find((p) => p.side === 'O')?.userId).toBe(alice.id);
    expect(secondRequest.rematch.requestedByYou).toBe(false);
  });

  it('rejects rematches before completion', async () => {
    const match = await createRandomMatch();
    await expect(service.requestRematch(alice.id, match.id)).rejects.toMatchObject({
      code: 'REMATCH_NOT_AVAILABLE',
    });
  });

  it('forfeits a human game when a player leaves and abandons an AI game', async () => {
    const match = await createRandomMatch();
    await service.leaveMatch(alice.id, match.id);
    expect(await repo.getMatchById(match.id)).toMatchObject({
      status: 'FINISHED',
      result: 'O_WINS',
      finishReason: 'FORFEIT',
    });

    const aiMatch = await service.startAi(bob.id, 'EASY', 'X');
    await service.leaveMatch(bob.id, aiMatch.id);
    expect(await repo.getMatchById(aiMatch.id)).toMatchObject({
      status: 'ABANDONED',
      finishReason: 'ABANDONED',
    });
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBeNull();
    await expect(service.leaveMatch(charlie.id, aiMatch.id)).rejects.toMatchObject({
      code: 'MATCH_FORBIDDEN',
    });
  });

  it('prevents starting a second AI game while one is active', async () => {
    await service.startAi(alice.id, 'EASY', 'X');
    await expect(service.startAi(alice.id, 'MEDIUM', 'O')).rejects.toMatchObject({
      code: 'PLAYER_BUSY',
    });
  });
});
