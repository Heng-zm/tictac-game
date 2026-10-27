import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaGameRepository, createPrismaClient } from '../src/server/database/prisma-repository';
import type { FinalizationData, RecordMoveInput, UserEntity } from '../src/server/database/types';
import { hashInvitationToken } from '../src/server/services/invitations';
import { boardFromString, type Board, type Side } from '../src/shared/game-types';
import { createTestUser, participant } from './helpers';

const integrationDatabaseUrl = process.env.TEST_DATABASE_URL;
const describeIntegration = integrationDatabaseUrl ? describe : describe.skip;

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
    lastActivityAt: new Date(),
    finalization: finalization ?? null,
  };
}

function winFinalization(finishedAt = new Date()): FinalizationData {
  return {
    winnerSide: 'X',
    result: 'X_WINS',
    finishReason: 'LINE',
    finishedAt,
    countStats: true,
  };
}

describeIntegration('PrismaGameRepository (PostgreSQL integration)', () => {
  let prisma: PrismaClient;
  let repo: PrismaGameRepository;
  let alice: UserEntity;
  let bob: UserEntity;

  beforeAll(async () => {
    prisma = createPrismaClient(integrationDatabaseUrl!, false);
    repo = new PrismaGameRepository(prisma);
    await prisma.$connect();
    if (!(await repo.ready())) {
      throw new Error(`TEST_DATABASE_URL is set but PostgreSQL is not reachable: ${integrationDatabaseUrl}`);
    }
    await truncateAll(prisma);
  });

  afterAll(async () => {
    if (prisma) await prisma.$disconnect();
  });

  beforeEach(async () => {
    await truncateAll(prisma);
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

  it('upserts Telegram users idempotently and keeps preferences and stats', async () => {
    const sameAlice = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Updated',
      lastName: 'Smith',
      username: 'alice',
      photoUrl: 'https://example.com/a.png',
      languageCode: 'de',
    });
    expect(sameAlice.id).toBe(alice.id);
    expect(sameAlice).toMatchObject({
      firstName: 'Alice Updated',
      lastName: 'Smith',
      username: 'alice',
      photoUrl: 'https://example.com/a.png',
      languageCode: 'de',
    });
    expect(sameAlice.stats).toMatchObject({ gamesPlayed: 0, rating: 1000, ratingGames: 0 });
    expect(await repo.getUserById('missing')).toBeNull();

    expect((await repo.setAutoAiFallback(alice.id, true)).autoAiFallback).toBe(true);
    expect((await repo.setTurnNotifications(alice.id, true)).turnNotifications).toBe(true);
    const afterUpsert = await repo.upsertTelegramUser({
      telegramId: 1001n,
      firstName: 'Alice Again',
      username: null,
      lastName: null,
      photoUrl: null,
      languageCode: null,
    });
    expect(afterUpsert.autoAiFallback).toBe(true);
    expect(afterUpsert.turnNotifications).toBe(true);
    expect(afterUpsert.stats.gamesPlayed).toBe(0);

    await prisma.user.update({ where: { id: alice.id }, data: { lastSeenAt: new Date(0) } });
    await repo.touchUser(alice.id);
    expect((await repo.getUserById(alice.id))?.lastSeenAt.getTime()).toBeGreaterThan(0);
  });

  it('reserves both players and rolls back rejected duplicate reservations', async () => {
    const matchId = await createRandomMatch();
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBe(matchId);
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBe(matchId);
    expect((await repo.getReservationMatch(alice.id))?.id).toBe(matchId);

    await expect(createRandomMatch()).rejects.toMatchObject({ code: 'PLAYER_BUSY' });
    expect(await prisma.match.count()).toBe(1);
    await expect(
      repo.createMatch({
        mode: 'RANDOM',
        status: 'ACTIVE',
        participants: [participant(alice, 'X'), participant(alice, 'O')],
        currentTurn: 'X',
        turnDeadline: null,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PLAYERS' });
    expect(await prisma.match.count()).toBe(1);
  });

  it('applies moves transactionally, detects duplicates and rejects stale versions', async () => {
    const matchId = await createRandomMatch();
    const actionA = randomUUID();
    const boardA: Board = { 0: 'X' };

    const first = await repo.recordMove(moveInput(matchId, 0, 'X', 0, actionA, boardA, 1));
    expect(first.status).toBe('applied');
    expect(first.match).toMatchObject({ version: 1, currentTurn: 'O', turnNumber: 1 });
    expect(first.match.lastMove).toEqual({ cell: 0, side: 'X' });
    expect(first.match.board[0]).toBe('X');
    expect(await repo.hasProcessedAction(matchId, actionA)).toBe(true);
    expect(await repo.hasProcessedAction(matchId, randomUUID())).toBe(false);

    const duplicate = await repo.recordMove(moveInput(matchId, 0, 'X', 0, actionA, boardA, 1));
    expect(duplicate.status).toBe('duplicate');
    expect(duplicate.match.version).toBe(1);
    expect(await prisma.move.count({ where: { matchId } })).toBe(1);

    const stale = await repo.recordMove(
      moveInput(matchId, 0, 'O', 4, randomUUID(), { 0: 'X', 4: 'O' }, 2),
    );
    expect(stale.status).toBe('conflict');
    expect(stale.match.version).toBe(1);

    const second = await repo.recordMove(
      moveInput(
        matchId,
        1,
        'O',
        4,
        randomUUID(),
        { 0: 'X', 4: 'O' },
        2,
      ),
    );
    expect(second.status).toBe('applied');
    expect(second.match).toMatchObject({ version: 2, currentTurn: 'X', turnNumber: 2 });
    expect(await prisma.move.count({ where: { matchId } })).toBe(2);

    const stored = await prisma.match.findUniqueOrThrow({ where: { id: matchId } });
    expect(boardFromString(stored.board)).toEqual({ 0: 'X', 4: 'O' });
  });

  it('finalizes rated games with participants, rating, stats, history and leaderboard', async () => {
    const matchId = await createRandomMatch();
    const finishedAt = new Date();
    const finish = await repo.recordMove(
      moveInput(
        matchId,
        0,
        'X',
        0,
        randomUUID(),
        { 0: 'X' },
        1,
        winFinalization(finishedAt),
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
    });
    expect(finish.match.participants.find((p) => p.side === 'X')).toMatchObject({
      outcome: 'WIN',
      ratingDelta: 20,
    });
    expect(finish.match.participants.find((p) => p.side === 'O')).toMatchObject({
      outcome: 'LOSS',
      ratingDelta: -20,
    });

    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(alice.id))?.stats).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      humanGames: 1,
      rating: 1020,
      ratingGames: 1,
    });
    expect((await repo.getUserById(bob.id))?.stats).toMatchObject({
      gamesPlayed: 1,
      losses: 1,
      rating: 980,
      ratingGames: 1,
    });

    const history = await repo.getRecentMatches(alice.id, 10);
    expect(history.matches.map((match) => match.id)).toEqual([matchId]);
    expect(history.nextCursor).toBeNull();

    const leaderboard = await repo.getLeaderboard(10);
    expect(leaderboard).toEqual([
      expect.objectContaining({
        user: expect.objectContaining({ id: alice.id }),
        stats: expect.objectContaining({ rating: 1020 }),
      }),
      expect.objectContaining({
        user: expect.objectContaining({ id: bob.id }),
        stats: expect.objectContaining({ rating: 980 }),
      }),
    ]);
    expect(await repo.getUserRank(alice.id)).toBe(1);
    expect(await repo.getUserRank(bob.id)).toBe(2);

    const retry = await repo.recordMove(
      moveInput(
        matchId,
        0,
        'X',
        0,
        randomUUID(),
        { 0: 'X' },
        1,
      ),
    );
    expect(retry.status).toBe('conflict');
    expect(retry.match.status).toBe('FINISHED');
  });

  it('records AI statistics without changing the rated leaderboard', async () => {
    const matchId = await createAiMatch();
    const finish = await repo.recordMove(
      moveInput(
        matchId,
        0,
        'X',
        4,
        randomUUID(),
        { 4: 'X' },
        1,
        winFinalization(),
      ),
    );

    expect(finish.status).toBe('applied');
    expect(finish.match.mode).toBe('AI');
    expect(finish.match.participants.find((p) => p.side === 'O')).toMatchObject({
      isAi: true,
      aiDifficulty: 'HARD',
      outcome: 'LOSS',
      ratingDelta: 0,
    });
    expect((await repo.getUserById(alice.id))?.stats).toMatchObject({
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

  it('abandons matches without rating them and releases reservations', async () => {
    const matchId = await createRandomMatch();
    const result = await repo.abandonMatch({
      matchId,
      expectedVersion: 0,
      finishReason: 'FORFEIT',
      finishedAt: new Date(),
    });

    expect(result).toMatchObject({ status: 'ABANDONED', finishReason: 'FORFEIT' });
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(alice.id))?.stats.gamesPlayed).toBe(0);
    const history = await repo.getRecentMatches(alice.id, 10);
    expect(history.matches[0]?.participants.every((p) => p.outcome === null)).toBe(true);
  });

  it('paginates finished match history by the stable cursor', async () => {
    const finishMatch = async (finishedAt: Date): Promise<string> => {
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
          winFinalization(finishedAt),
        ),
      );
      return matchId;
    };

    const firstId = await finishMatch(new Date(Date.now() - 2_000));
    const secondId = await finishMatch(new Date(Date.now() - 1_000));

    const pageOne = await repo.getRecentMatches(alice.id, 1);
    expect(pageOne.matches.map((match) => match.id)).toEqual([secondId]);
    expect(pageOne.nextCursor).toBe(secondId);

    const pageTwo = await repo.getRecentMatches(alice.id, 1, pageOne.nextCursor!);
    expect(pageTwo.matches.map((match) => match.id)).toEqual([firstId]);
    expect(pageTwo.nextCursor).toBeNull();
  });

  it('creates, previews, cancels and accepts invitations exactly once', async () => {
    const tokenHash = hashInvitationToken('c'.repeat(43));
    const expiresAt = new Date(Date.now() + 60_000);
    const { match, invitation } = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt,
      displayName: alice.firstName,
    });

    expect(match).toMatchObject({ mode: 'FRIEND', status: 'WAITING', currentTurn: 'X' });
    expect(invitation).toMatchObject({ status: 'PENDING', inviterId: alice.id, matchId: match.id });
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBe(match.id);
    expect((await repo.getPendingInvitationForUser(alice.id))?.id).toBe(invitation.id);
    expect((await repo.getInvitationByTokenHash(tokenHash))?.id).toBe(invitation.id);
    expect((await repo.getInvitationById(invitation.id))?.id).toBe(invitation.id);
    expect(await repo.getInvitationByTokenHash('missing')).toBeNull();

    expect(await repo.acceptInvitation(tokenHash, alice, null)).toEqual({ status: 'self' });
    expect(await repo.cancelInvitation(invitation.id, bob.id)).toEqual({ status: 'forbidden' });

    const accepted = await repo.acceptInvitation(tokenHash, bob, null);
    expect(accepted.status).toBe('accepted');
    expect(accepted.match).toMatchObject({ id: match.id, status: 'ACTIVE', currentTurn: 'X' });
    expect(accepted.match?.participants).toHaveLength(2);
    expect(accepted.match?.participants.find((p) => p.side === 'O')?.userId).toBe(bob.id);
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBe(match.id);
    expect((await repo.getInvitationById(invitation.id))?.status).toBe('ACCEPTED');
    expect(await repo.acceptInvitation(tokenHash, alice, null)).toEqual({ status: 'self' });

    const charlie = await createTestUser(repo, 1003n, 'Charlie');
    expect(await repo.acceptInvitation(tokenHash, charlie, null)).toEqual({ status: 'already_used' });

    const secondTokenHash = hashInvitationToken('d'.repeat(43));
    await repo.createInvitationMatch({
      host: charlie,
      tokenHash: secondTokenHash,
      expiresAt,
      displayName: charlie.firstName,
    });
    expect(await repo.acceptInvitation(secondTokenHash, bob, null)).toEqual({ status: 'acceptor_busy' });
    expect(await repo.cancelInvitation(invitation.id, alice.id)).toEqual({ status: 'not_pending' });
  });

  it('cancels and expires invitations, releasing host reservations', async () => {
    const cancelHash = hashInvitationToken('e'.repeat(43));
    const cancelled = await repo.createInvitationMatch({
      host: alice,
      tokenHash: cancelHash,
      expiresAt: new Date(Date.now() + 60_000),
      displayName: alice.firstName,
    });
    expect(await repo.cancelInvitation(cancelled.invitation.id, alice.id)).toEqual({ status: 'cancelled' });
    expect((await repo.getMatchById(cancelled.match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect(await repo.acceptInvitation(cancelHash, bob, null)).toEqual({ status: 'cancelled' });

    const expiredHash = hashInvitationToken('f'.repeat(43));
    const expired = await repo.createInvitationMatch({
      host: alice,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 1_000),
      displayName: alice.firstName,
    });
    expect(await repo.getPendingInvitationForUser(alice.id)).toBeNull();
    expect((await repo.getInvitationById(expired.invitation.id))?.status).toBe('EXPIRED');
    expect((await repo.getMatchById(expired.match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getRecentMatches(alice.id, 10)).matches).toEqual([]);
    expect(await repo.acceptInvitation(expiredHash, bob, null)).toEqual({ status: 'expired' });
    expect(await repo.acceptInvitation(hashInvitationToken('9'.repeat(43)), bob, null)).toEqual({
      status: 'not_found',
    });
  });

  it('runs maintenance for expired invitations, stale matches and old invitations', async () => {
    const now = new Date();
    const tokenHash = hashInvitationToken('1'.repeat(43));
    const expired = await repo.createInvitationMatch({
      host: alice,
      tokenHash,
      expiresAt: new Date(now.getTime() - 60_000),
      displayName: alice.firstName,
    });
    await prisma.invitation.update({
      where: { id: expired.invitation.id },
      data: { createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) },
    });

    const firstPass = await repo.runMaintenance(now, 24 * 60 * 60 * 1000);
    expect(firstPass.expiredInvitations).toBe(1);
    expect(firstPass.abandonedMatches).toBe(1);
    expect(firstPass.deletedInvitations).toBe(1);
    expect(firstPass.repairedReservations).toBe(1);
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();

    const matchId = await createRandomMatch();
    await prisma.match.update({
      where: { id: matchId },
      data: { lastActivityAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    });
    const secondPass = await repo.runMaintenance(now, 24 * 60 * 60 * 1000);
    expect(secondPass.expiredInvitations).toBe(0);
    expect(secondPass.abandonedMatches).toBe(1);
    expect(secondPass.deletedInvitations).toBe(0);
    expect(secondPass.repairedReservations).toBe(2);
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
    expect((await repo.getUserById(bob.id))?.activeMatchId).toBeNull();

    await prisma.user.update({ where: { id: alice.id }, data: { activeMatchId: randomUUID() } });
    const thirdPass = await repo.runMaintenance(now, 24 * 60 * 60 * 1000);
    expect(thirdPass.repairedReservations).toBe(1);
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();

    const staleTokenHash = hashInvitationToken('2'.repeat(43));
    const staleInvite = await repo.createInvitationMatch({
      host: alice,
      tokenHash: staleTokenHash,
      expiresAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
      displayName: alice.firstName,
    });
    await prisma.match.update({
      where: { id: staleInvite.match.id },
      data: { lastActivityAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
    });

    const stalePass = await repo.runMaintenance(now, 24 * 60 * 60 * 1000);
    expect(stalePass.expiredInvitations).toBe(1);
    expect(stalePass.abandonedMatches).toBe(1);
    expect((await repo.getInvitationById(staleInvite.invitation.id))?.status).toBe('EXPIRED');
    expect((await repo.getMatchById(staleInvite.match.id))?.status).toBe('ABANDONED');
    expect((await repo.getUserById(alice.id))?.activeMatchId).toBeNull();
  });
});

async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Move", "Invitation", "MatchParticipant", "UserStats", "Match", "User" RESTART IDENTITY CASCADE',
  );
}
