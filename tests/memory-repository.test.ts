import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import type { FinalizationData, RecordMoveInput } from '../src/server/database/types';
import { hashInvitationToken } from '../src/server/services/invitations';
import type { Board, Side } from '../src/shared/game-types';
import { MutableClock, createTestUser, participant } from './helpers';
import type { UserEntity } from '../src/server/database/types';

function moveInput(
  matchId: string,
  version: number,
  side: Side,
  cell: number,
  actionId: string,
  boardAfter: Board,
  moveNumber: number,
  finalization?: FinalizationData,
): RecordMoveInput {
  return {
    matchId,
    expectedVersion: version,
    side,
    cell,
    actionId,
    boardAfter,
    nextTurn: finalization ? null : side === 'X' ? 'O' : 'X',
    moveNumber,
    turnDeadline: null,
    lastActivityAt: new Date('2026-10-21T12:00:00.000Z'),
    finalization: finalization ?? null,
  };
}

function winFinalization(now: Date): FinalizationData {
  return {
    winnerSide: 'X',
    result: 'X_WINS',
    finishReason: 'LINE',
    finishedAt: now,
    countStats: true,
  };
}

describe('MemoryGameRepository', () => {
  let clock: MutableClock;
  let repo: MemoryGameRepository;
  let alice: UserEntity;
  let bob: UserEntity;

  beforeEach(async () => {
    clock = new MutableClock();
    repo = new MemoryGameRepository(clock.now);
    alice = await createTestUser(repo, 1001n, 'Alice');
    bob = await createTestUser(repo, 1002n, 'Bob');
  });

  async function createRandomMatch(): Promise<string> {
    const match = await repo.createMatch({
      mode: 'RANDOM',
      status: 'ACTIVE',
      participants: [participant(alice, 'X'), participant(bob, 'O')],
      currentTurn: 'X',
      turnDeadline: null,
    });
    return match.id;
  }

  async function createAiMatch(): Promise<string> {
    const match = await repo.createMatch({
      mode: 'AI',
      status: 'ACTIVE',
      participants: [
        participant(alice, 'X'),
        {
          userId: null,
          side: 'O',
          isAi: true,
          aiDifficulty: 'HARD',
          displayName: 'Tic Tac Bot',
          username: null,
          photoUrl: null,
        },
      ],
      currentTurn: 'X',
      turnDeadline: null,
    });
    return match.id;
  }

  it('upserts Telegram users idempotently and updates profiles', async () => {
    const sameAlice = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
      lastName: 'Smith',
      username: 'alice',
      photoUrl: 'https://example.com/a.png',
      languageCode: 'de',
    });
    expect(sameAlice.id).toBe(alice.id);
    expect(sameAlice.firstName).toBe('Alice Updated');
    expect(sameAlice.username).toBe('alice');
    expect(sameAlice.lastName).toBe('Smith');
    expect(sameAlice.languageCode).toBe('de');
    expect(await repo.getUserById(alice.id)).toMatchObject({ firstName: 'Alice Updated' });
    expect(await repo.getUserById('missing')).toBeNull();
    expect(alice.stats).toMatchObject({ gamesPlayed: 0, rating: 1000, ratingGames: 0 });
  });

  it('preserves the language code when an update omits it', async () => {
    const withLocale = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice',
      languageCode: 'km',
    });
    expect(withLocale.languageCode).toBe('km');

    const withoutLocale = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
    });
    expect(withoutLocale.languageCode).toBe('km');

    const cleared = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
      languageCode: null,
    });
    expect(cleared.languageCode).toBeNull();
  });

  it('preserves the profile photo when an update omits it and clears it when null', async () => {
    const withPhoto = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice',
      photoUrl: 'https://example.com/a.png',
    });
    expect(withPhoto.photoUrl).toBe('https://example.com/a.png');

    const withoutPhoto = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
    });
    expect(withoutPhoto.photoUrl).toBe('https://example.com/a.png');

    const cleared = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
      photoUrl: null,
    });
    expect(cleared.photoUrl).toBeNull();
  });

  it('reserves both players and rejects duplicate reservations', async () => {
    const matchId = await createRandomMatch();
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBe(matchId);
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBe(matchId);
    expect((await repo.getReservationMatch(alice.id))?.id).toBe(matchId);

    await expect(createRandomMatch()).rejects.toMatchObject({ code: 'PLAYER_BUSY' });
    await expect(
      repo.createMatch({
        mode: 'RANDOM',
        status: 'ACTIVE',
        participants: [participant(alice, 'X'), participant(alice, 'O')],
        currentTurn: 'X',
        turnDeadline: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAYERS' });
  });

  it('applies moves, detects duplicates and rejects stale versions', async () => {
    const matchId = await createRandomMatch();
    const actionA = randomUUID();
    const boardA: Board = { 0: 'X' };

    const first = await repo.recordMove(moveInput(matchId, 0, 'X', 0, actionA, boardA, 1));
    expect(first.status).toBe('applied');
    expect(first.match.version).toBe(1);
    expect(first.match.board[0]).toBe('X');
    expect(first.match.currentTurn).toBe('O');
    expect(first.match.turnNumber).toBe(1);
    expect(first.match.lastMove).toEqual({ cell: 0, side: 'X' });
    expect(await repo.hasProcessedAction(matchId, actionA)).toBe(true);
    expect(await repo.hasProcessedAction(matchId, randomUUID())).toBe(false);

    const duplicate = await repo.recordMove(moveInput(matchId, 0, 'X', 0, actionA, boardA, 1));
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.match.version).toBe(1);
    expect(duplicate.match.board[0]).toBe('X');

    const stale = await repo.recordMove(
      moveInput(matchId, 0, 'O', 4, randomUUID(), { 0: 'X', 4: 'O' }, 2),
    );
    expect(stale.status).toBe('conflict');
    expect(stale.match.version).toBe(1);

    const boardB: Board = { 0: 'X', 4: 'O' };
    const second = await repo.recordMove(moveInput(matchId, 1, 'O', 4, randomUUID(), boardB, 2));
    expect(second.status).toBe('applied');
    expect(second.match.version).toBe(2);
    expect(second.match.currentTurn).toBe('X');
  });

  it('finalizes a human game and updates rating, stats and history', async () => {
    const matchId = await createRandomMatch();
    const now = clock.now();
    await repo.recordMove(
      moveInput(matchId, 0, 'X', 0, randomUUID(), { 0: 'X' }, 1),
    );
    await repo.recordMove(
      moveInput(matchId, 1, 'O', 3, randomUUID(), { 0: 'X', 3: 'O' }, 2),
    );
    await repo.recordMove(
      moveInput(matchId, 2, 'X', 1, randomUUID(), { 0: 'X', 1: 'X', 3: 'O' }, 3),
    );
    await repo.recordMove(
      moveInput(
        matchId,
        3,
        'O',
        4,
        randomUUID(),
        { 0: 'X', 1: 'X', 3: 'O', 4: 'O' },
        4,
      ),
    );
    const finish = await repo.recordMove(
      moveInput(
        matchId,
        4,
        'X',
        2,
        randomUUID(),
        { 0: 'X', 1: 'X', 2: 'X', 3: 'O', 4: 'O' },
        5,
        winFinalization(now),
      ),
    );

    expect(finish.status).toBe('applied');
    expect(finish.match).toMatchObject({
      status: 'FINISHED',
      result: 'X_WINS',
      winnerSide: 'X',
      finishReason: 'LINE',
      currentTurn: null,
      turnDeadline: null,
      finishedAt: now,
    });
    expect(finish.match.participants.find((p) => p.side === 'X')).toMatchObject({
      outcome: 'WIN',
      ratingDelta: 20,
      leftAt: now,
    });
    expect(finish.match.participants.find((p) => p.side === 'O')).toMatchObject({
      outcome: 'LOSS',
      ratingDelta: -20,
      leftAt: now,
    });

    const updatedAlice = await repo.getUserById(alice.id);
    const updatedBob = await repo.getUserById(bob.id);
    expect(updatedAlice?.activeMatchId).toBeNull();
    expect(updatedBob?.activeMatchId).toBeNull();
    expect(updatedAlice?.stats).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      humanGames: 1,
      rating: 1020,
      ratingGames: 1,
    });
    expect(updatedBob?.stats).toMatchObject({
      gamesPlayed: 1,
      losses: 1,
      rating: 980,
      ratingGames: 1,
    });

    const history = await repo.getRecentMatches(alice.id, 10);
    expect(history.matches).toHaveLength(1);
    expect(history.matches[0]?.id).toBe(matchId);
    expect(history.nextCursor).toBeNull();

    expect(await repo.getLeaderboard(10)).toEqual([
      expect.objectContaining({ user: expect.objectContaining({ id: alice.id }), stats: expect.objectContaining({ rating: 1020 }) }),
      expect.objectContaining({ user: expect.objectContaining({ id: bob.id }), stats: expect.objectContaining({ rating: 980 }) }),
    ]);
    expect(await repo.getUserRank(alice.id)).toBe(1);
    expect(await repo.getUserRank(bob.id)).toBe(2);
  });

  it('does not rate AI games but records AI statistics', async () => {
    const matchId = await createAiMatch();
    const now = clock.now();
    const finalization = winFinalization(now);
    await repo.recordMove(
      moveInput(
        matchId,
        0,
        'X',
        4,
        randomUUID(),
        { 4: 'X' },
        1,
        finalization,
      ),
    );

    const updated = await repo.getUserById(alice.id);
    expect(updated?.stats).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      aiGames: 1,
      aiWins: 1,
      humanGames: 0,
      rating: 1000,
      ratingGames: 0,
    });
    expect(await repo.getLeaderboard(10)).toEqual([]);
    expect(await repo.getUserRank(alice.id)).toBeNull();
    expect((await repo.getRecentMatches(alice.id, 10)).matches[0]?.mode).toBe('AI');
  });

  it('abandons games without counting statistics', async () => {
    const matchId = await createRandomMatch();
    const result = await repo.abandonMatch({
      matchId,
      expectedVersion: 0,
      finishReason: 'FORFEIT',
      finishedAt: clock.now(),
    });
    expect(result).toMatchObject({ status: 'ABANDONED', finishReason: 'FORFEIT' });
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(alice.id))?.stats.gamesPlayed).toBe(0);

    const history = await repo.getRecentMatches(alice.id, 10);
    expect(history.matches[0]?.participants.find((p) => p.side === 'X')?.outcome).toBeNull();
  });

  it('paginates finished match history', async () => {
    const finishMatch = async (): Promise<string> => {
      const matchId = await createRandomMatch();
      await repo.recordMove(
        moveInput(
          matchId,
          0,
          'X',
          0,
          randomUUID(),
          { 0: 'X' },
          1,
          winFinalization(clock.now()),
        ),
      );
      return matchId;
    };

    const firstId = await finishMatch();
    clock.advance(1_000);
    const secondId = await finishMatch();

    const pageOne = await repo.getRecentMatches(alice.id, 1);
    expect(pageOne.matches.map((match) => match.id)).toEqual([secondId]);
    expect(pageOne.nextCursor).toBe(secondId);

    const pageTwo = await repo.getRecentMatches(alice.id, 1, pageOne.nextCursor!);
    expect(pageTwo.matches.map((match) => match.id)).toEqual([firstId]);
    expect(pageTwo.nextCursor).toBeNull();
  });

  it('creates, previews, cancels and rejects duplicate invitations', async () => {
    const tokenHash = hashInvitationToken('a'.repeat(43));
    const expiresAt = new Date(clock.now().getTime() + 60_000);
    const { match, invitation } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt,
      displayName: alice.firstName,
    });
    expect(match).toMatchObject({ mode: 'FRIEND', status: 'WAITING', currentTurn: 'X' });
    expect(invitation).toMatchObject({ status: 'PENDING', inviterId: alice.id, matchId: match.id });
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBe(match.id);

    await expect(
      repo.createInvitationMatch({
        host: alice,
        tokenHash: hashInvitationToken('b'.repeat(43)),
        expiresAt,
        displayName: alice.firstName,
      }),
    ).rejects.toMatchObject({ code: 'PLAYER_BUSY' });

    const pending = await repo.getPendingInvitationForUser(alice.id);
    expect(pending?.id).toBe(invitation.id);
    expect((await repo.getInvitationByTokenHash(tokenHash))?.id).toBe(invitation.id);
    expect((await repo.getInvitationById(invitation.id))?.id).toBe(invitation.id);
    expect(await repo.getInvitationByTokenHash('missing')).toBeNull();

    expect(await repo.cancelInvitation(invitation.id, bob.id)).toEqual({ status: 'forbidden' });
    expect(await repo.cancelInvitation(invitation.id, alice.id)).toEqual({ status: 'cancelled' });
    expect(await repo.cancelInvitation(invitation.id, alice.id)).toEqual({ status: 'not_pending' });
    expect((await repo.getMatchById(match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getRecentMatches(alice.id, 10)).matches).toEqual([]);
  });

  it('accepts invitations exactly once and rejects self-acceptance and busy acceptors', async () => {
    const tokenHash = hashInvitationToken('c'.repeat(43));
    const expiresAt = new Date(clock.now().getTime() + 60_000);
    const { match, invitation } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt,
      displayName: alice.firstName,
    });

    expect(await repo.acceptInvitation(tokenHash, alice, null)).toEqual({ status: 'self' });

    const accepted = await repo.acceptInvitation(tokenHash, bob, null);
    expect(accepted.status).toBe('accepted');
    expect(accepted.match).toMatchObject({ id: match.id, status: 'ACTIVE', currentTurn: 'X' });
    expect(accepted.match?.participants).toHaveLength(2);
    expect(accepted.match?.participants.find((p) => p.side === 'O')?.userId).toBe(bob.id);
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBe(match.id);
    expect((await repo.getInvitationById(invitation.id))?.status).toBe('ACCEPTED');

    const charlie = await createTestUser(repo, 1003n, 'Charlie');
    expect(await repo.acceptInvitation(tokenHash, charlie, null)).toEqual({ status: 'already_used' });

    const tokenHash2 = hashInvitationToken('d'.repeat(43));
    await repo.createInvitationMatch({
      host: charlie,
      tokenHash: tokenHash2,
      expiresAt,
      displayName: charlie.firstName,
    });
    expect(await repo.acceptInvitation(tokenHash2, bob, null)).toEqual({ status: 'acceptor_busy' });
    expect(await repo.acceptInvitation(hashInvitationToken('e'.repeat(43)), bob, null)).toEqual({
      status: 'not_found',
    });
  });

  it('expires invitations and releases the host reservation', async () => {
    const tokenHash = hashInvitationToken('f'.repeat(43));
    const expiresAt = new Date(clock.now().getTime() + 1_000);
    const { match } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt,
      displayName: alice.firstName,
    });
    clock.advance(2_000);

    expect(await repo.getPendingInvitationForUser(alice.id)).toBeNull();
    expect((await repo.getInvitationByTokenHash(tokenHash))?.status).toBe('EXPIRED');
    expect((await repo.getMatchById(match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect(await repo.acceptInvitation(tokenHash, bob, null)).toEqual({ status: 'expired' });
  });

  it('rejects accepting a cancelled invitation', async () => {
    const tokenHash = hashInvitationToken('9'.repeat(43));
    const { invitation } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt: new Date(clock.now().getTime() + 60_000),
      displayName: alice.firstName,
    });
    await repo.cancelInvitation(invitation.id, alice.id);
    expect(await repo.acceptInvitation(tokenHash, bob, null)).toEqual({ status: 'cancelled' });
  });

  it('runs maintenance for expired invitations, stale matches and old invitations', async () => {
    const tokenHash = hashInvitationToken('1'.repeat(43));
    await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt: new Date(clock.now().getTime() + 1_000),
      displayName: alice.firstName,
    });

    clock.advance(40 * 24 * 60 * 60 * 1000);
    const firstPass = await repo.runMaintenance(clock.now(), 24 * 60 * 60 * 1000);
    expect(firstPass.expiredInvitations).toBe(1);
    expect(firstPass.abandonedMatches).toBe(1);
    expect(firstPass.deletedInvitations).toBe(1);
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();

    await createRandomMatch();
    clock.advance(2 * 24 * 60 * 60 * 1000);
    const summary = await repo.runMaintenance(clock.now(), 24 * 60 * 60 * 1000);

    expect(summary.expiredInvitations).toBe(0);
    expect(summary.abandonedMatches).toBe(1);
    expect(summary.deletedInvitations).toBe(0);
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBeNull();
  });

  it('expires pending invitations attached to stale waiting matches', async () => {
    const tokenHash = hashInvitationToken('2'.repeat(43));
    const { match, invitation } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt: new Date(clock.now().getTime() + 5 * 24 * 60 * 60 * 1000),
      displayName: alice.firstName,
    });

    clock.advance(2 * 24 * 60 * 60 * 1000);
    const summary = await repo.runMaintenance(clock.now(), 24 * 60 * 60 * 1000);

    expect(summary.expiredInvitations).toBe(1);
    expect(summary.abandonedMatches).toBe(1);
    expect((await repo.getInvitationById(invitation.id))?.status).toBe('EXPIRED');
    expect((await repo.getMatchById(match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
  });

  it('sets preferences and touches users', async () => {
    const updated = await repo.setAutoAiFallback(alice.id, true);
    expect(updated.autoAiFallback).toBe(true);
    const notifications = await repo.setTurnNotifications(alice.id, true);
    expect(notifications.turnNotifications).toBe(true);
    expect(notifications.autoAiFallback).toBe(true);
    expect((await repo.getUserById(alice.id))?.turnNotifications).toBe(true);
    clock.advance(5_000);
    await repo.touchUser(alice.id);
    expect((await repo.getUserById(alice.id))?.lastSeenAt).toEqual(clock.now());
  });
});
