import {
  Prisma,
  PrismaClient,
  type Invitation as PrismaInvitation,
  type Match as PrismaMatch,
  type MatchParticipant as PrismaMatchParticipant,
  type User as PrismaUser,
  type UserStats as PrismaUserStats,
} from '@prisma/client';
import type { AiDifficulty, FinishReason, InvitationStatus, MatchMode, MatchResult, MatchStatus, ParticipantOutcome, Side } from '../../shared/game-types';
import { boardFromString, boardToString, createEmptyBoard } from '../../shared/game-types';
import { ratingDeltaFor, statsDeltaFor } from '../game/scoring';
import { RepositoryConflictError } from '../errors';
import type {
  AbandonMatchInput,
  AcceptInvitationResult,
  CancelInvitationResult,
  CreateInvitationInput,
  CreateMatchInput,
  FinalizationData,
  FinalizeMatchInput,
  GameRepository,
  InvitationEntity,
  InvitationWithMatch,
  LeaderboardRow,
  MaintenanceSummary,
  MatchEntity,
  ParticipantEntity,
  RecentMatchPage,
  RecordMoveInput,
  RepositoryFinalizeResult,
  RepositoryMoveResult,
  StatsEntity,
  TelegramProfileInput,
  UserEntity,
  UserLite,
} from './types';

type Tx = Prisma.TransactionClient;
type MatchWithParticipants = PrismaMatch & { participants: PrismaMatchParticipant[] };
type UserWithStats = PrismaUser & { stats: PrismaUserStats | null };
type InvitationFull = PrismaInvitation & {
  inviter: PrismaUser;
  match: MatchWithParticipants;
};

const matchInclude = { participants: true } satisfies Prisma.MatchInclude;
const userInclude = { stats: true } satisfies Prisma.UserInclude;
const invitationInclude = {
  inviter: true,
  match: { include: { participants: true } },
} satisfies Prisma.InvitationInclude;

export class PrismaGameRepository implements GameRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async ready(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  async upsertTelegramUser(profile: TelegramProfileInput): Promise<UserEntity> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const user = await tx.user.upsert({
        where: { telegramId: profile.telegramId },
        create: {
          telegramId: profile.telegramId,
          firstName: profile.firstName,
          lastName: profile.lastName ?? null,
          username: profile.username ?? null,
          photoUrl: profile.photoUrl ?? null,
          languageCode: profile.languageCode ?? null,
          lastSeenAt: now,
          stats: { create: {} },
        },
        update: {
          firstName: profile.firstName,
          lastName: profile.lastName ?? null,
          username: profile.username ?? null,
          photoUrl: profile.photoUrl ?? null,
          languageCode: profile.languageCode ?? null,
          lastSeenAt: now,
        },
      });
      await tx.userStats.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });
      const fresh = await tx.user.findUniqueOrThrow({ where: { id: user.id }, include: userInclude });
      return mapUser(fresh);
    });
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async setAutoAiFallback(userId: string, value: boolean): Promise<UserEntity> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { autoAiFallback: value },
      include: userInclude,
    });
    return mapUser(user);
  }

  async touchUser(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
      select: { id: true },
    });
  }

  async clearUserReservation(userId: string, matchId?: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        ...(matchId ? { activeMatchId: matchId } : { activeMatchId: { not: null } }),
      },
      data: { activeMatchId: null },
    });
  }

  async createMatch(input: CreateMatchInput): Promise<MatchEntity> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const humanIds = [...new Set(input.participants.map((p) => p.userId).filter((id): id is string => Boolean(id)))];
      if (humanIds.length !== input.participants.filter((p) => p.userId).length) {
        throw new RepositoryConflictError('INVALID_PLAYERS', 'A player cannot occupy both sides');
      }

      const match = await tx.match.create({
        data: {
          mode: input.mode,
          status: input.status,
          board: boardToString(createEmptyBoard()),
          currentTurn: input.currentTurn,
          turnNumber: 0,
          turnDeadline: input.turnDeadline,
          rematchOfId: input.rematchOfId ?? null,
          startedAt: now,
          lastActivityAt: now,
          participants: {
            create: input.participants.map((participant) => ({
              userId: participant.userId,
              side: participant.side,
              isAi: participant.isAi,
              aiDifficulty: participant.aiDifficulty ?? null,
              displayName: participant.displayName,
              username: participant.username,
              photoUrl: participant.photoUrl,
            })),
          },
        },
        include: matchInclude,
      });

      for (const userId of humanIds) {
        const reserved = await tx.user.updateMany({
          where: { id: userId, activeMatchId: null },
          data: { activeMatchId: match.id },
        });
        if (reserved.count !== 1) {
          throw new RepositoryConflictError('PLAYER_BUSY', 'A player is already in another match');
        }
      }

      return mapMatch(match);
    });
  }

  async createInvitationMatch(input: CreateInvitationInput): Promise<{ match: MatchEntity; invitation: InvitationEntity }> {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const match = await tx.match.create({
        data: {
          mode: 'FRIEND',
          status: 'WAITING',
          board: boardToString(createEmptyBoard()),
          currentTurn: 'X',
          turnNumber: 0,
          startedAt: now,
          lastActivityAt: now,
          participants: {
            create: [
              {
                userId: input.host.id,
                side: 'X',
                isAi: false,
                displayName: input.displayName,
                username: input.host.username,
                photoUrl: input.host.photoUrl,
              },
            ],
          },
        },
        include: matchInclude,
      });

      const reserved = await tx.user.updateMany({
        where: { id: input.host.id, activeMatchId: null },
        data: { activeMatchId: match.id },
      });
      if (reserved.count !== 1) {
        throw new RepositoryConflictError('PLAYER_BUSY', 'You already have a game or invitation in progress');
      }

      const invitation = await tx.invitation.create({
        data: {
          tokenHash: input.tokenHash,
          inviterId: input.host.id,
          matchId: match.id,
          expiresAt: input.expiresAt,
        },
      });

      return { match: mapMatch(match), invitation: mapInvitation(invitation) };
    });
  }

  async getMatchById(matchId: string): Promise<MatchEntity | null> {
    const match = await this.prisma.match.findUnique({ where: { id: matchId }, include: matchInclude });
    return match ? mapMatch(match) : null;
  }

  async getReservationMatch(userId: string): Promise<MatchEntity | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeMatchId: true },
    });
    if (!user?.activeMatchId) return null;
    return this.getMatchById(user.activeMatchId);
  }

  async hasProcessedAction(matchId: string, actionId: string): Promise<boolean> {
    const move = await this.prisma.move.findUnique({
      where: { matchId_actionId: { matchId, actionId } },
      select: { id: true },
    });
    return move !== null;
  }

  async recordMove(input: RecordMoveInput): Promise<RepositoryMoveResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.move.findUnique({
        where: { matchId_actionId: { matchId: input.matchId, actionId: input.actionId } },
        select: { id: true },
      });
      if (existing) {
        return { status: 'duplicate', match: await loadMatchOrThrow(tx, input.matchId) };
      }

      const current = await tx.match.findUnique({
        where: { id: input.matchId },
        include: matchInclude,
      });
      if (!current) {
        throw new RepositoryConflictError('MATCH_NOT_FOUND', 'Match does not exist');
      }

      const result = await tx.match.updateMany({
        where: { id: input.matchId, status: 'ACTIVE', version: input.expectedVersion },
        data: {
          board: boardToString(input.boardAfter),
          currentTurn: input.nextTurn,
          turnNumber: input.moveNumber,
          turnDeadline: input.finalization ? null : input.turnDeadline,
          lastActivityAt: input.lastActivityAt,
          version: { increment: 1 },
          ...(input.finalization
            ? {
                status: 'FINISHED',
                result: input.finalization.result,
                winnerSide: input.finalization.winnerSide,
                finishReason: input.finalization.finishReason,
                finishedAt: input.finalization.finishedAt,
              }
            : {}),
        },
      });

      if (result.count !== 1) {
        const duplicate = await tx.move.findUnique({
          where: { matchId_actionId: { matchId: input.matchId, actionId: input.actionId } },
          select: { id: true },
        });
        return {
          status: duplicate ? 'duplicate' : 'conflict',
          match: await loadMatchOrThrow(tx, input.matchId),
        };
      }

      await tx.move.create({
        data: {
          matchId: input.matchId,
          participantSide: input.side,
          actionId: input.actionId,
          cell: input.cell,
          moveNumber: input.moveNumber,
          boardAfter: boardToString(input.boardAfter),
        },
      });

      if (input.finalization) {
        await applyFinalization(tx, current, input.finalization);
      }

      return { status: 'applied', match: await loadMatchOrThrow(tx, input.matchId) };
    });
  }

  async finalizeMatch(input: FinalizeMatchInput): Promise<RepositoryFinalizeResult> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.match.findUnique({
        where: { id: input.matchId },
        include: matchInclude,
      });
      if (!current) {
        throw new RepositoryConflictError('MATCH_NOT_FOUND', 'Match does not exist');
      }
      const updated = await tx.match.updateMany({
        where: { id: input.matchId, status: 'ACTIVE', version: input.expectedVersion },
        data: {
          status: 'FINISHED',
          result: input.finalization.result,
          winnerSide: input.finalization.winnerSide,
          finishReason: input.finalization.finishReason,
          finishedAt: input.finalization.finishedAt,
          currentTurn: null,
          turnDeadline: null,
          lastActivityAt: input.lastActivityAt,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        return { status: 'conflict', match: await loadMatchOrThrow(tx, input.matchId) };
      }
      await applyFinalization(tx, current, input.finalization);
      return { status: 'applied', match: await loadMatchOrThrow(tx, input.matchId) };
    });
  }

  async abandonMatch(input: AbandonMatchInput): Promise<MatchEntity | null> {
    return this.prisma.$transaction(async (tx) => {
      const statuses = input.statuses ?? ['WAITING', 'ACTIVE'];
      const updated = await tx.match.updateMany({
        where: {
          id: input.matchId,
          status: { in: statuses },
          ...(input.expectedVersion === undefined ? {} : { version: input.expectedVersion }),
        },
        data: {
          status: 'ABANDONED',
          finishReason: input.finishReason,
          finishedAt: input.finishedAt,
          currentTurn: null,
          turnDeadline: null,
          lastActivityAt: input.finishedAt,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        const match = await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
        return match ? mapMatch(match) : null;
      }
      await tx.user.updateMany({
        where: { activeMatchId: input.matchId },
        data: { activeMatchId: null },
      });
      await tx.matchParticipant.updateMany({
        where: { matchId: input.matchId },
        data: { leftAt: input.finishedAt },
      });
      const match = await tx.match.findUnique({ where: { id: input.matchId }, include: matchInclude });
      return match ? mapMatch(match) : null;
    });
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<InvitationWithMatch | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { tokenHash },
      include: invitationInclude,
    });
    return invitation ? mapInvitationFull(invitation) : null;
  }

  async getInvitationById(invitationId: string): Promise<InvitationWithMatch | null> {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: invitationInclude,
    });
    return invitation ? mapInvitationFull(invitation) : null;
  }

  async getPendingInvitationForUser(userId: string): Promise<InvitationWithMatch | null> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { inviterId: userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      include: invitationInclude,
    });
    if (!invitation) return null;
    if (invitation.expiresAt.getTime() <= Date.now()) {
      await this.expireInvitation(invitation.id);
      return null;
    }
    return mapInvitationFull(invitation);
  }

  async acceptInvitation(
    tokenHash: string,
    acceptor: UserEntity,
    turnDeadline: Date | null,
  ): Promise<AcceptInvitationResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const invitation = await tx.invitation.findUnique({
          where: { tokenHash },
          include: invitationInclude,
        });
        if (!invitation) return { status: 'not_found' };
        const now = new Date();

        if (invitation.inviterId === acceptor.id) return { status: 'self' };

        if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() <= now.getTime()) {
          await expireInvitationWithinTx(tx, invitation, now);
          return { status: 'expired' };
        }
        if (invitation.status === 'ACCEPTED') return { status: 'already_used' };
        if (invitation.status === 'CANCELLED') return { status: 'cancelled' };
        if (invitation.status !== 'PENDING') return { status: 'already_used' };
        if (invitation.match.status !== 'WAITING') return { status: 'cancelled' };

        const acceptorCurrent = await tx.user.findUnique({
          where: { id: acceptor.id },
          select: { activeMatchId: true },
        });
        if (!acceptorCurrent || acceptorCurrent.activeMatchId !== null) {
          return { status: 'acceptor_busy' };
        }

        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, status: 'PENDING', expiresAt: { gt: now } },
          data: { status: 'ACCEPTED', acceptedById: acceptor.id, acceptedAt: now },
        });
        if (claimed.count !== 1) {
          const latest = await tx.invitation.findUnique({ where: { id: invitation.id }, select: { status: true } });
          return { status: latest?.status === 'ACCEPTED' ? 'already_used' : 'cancelled' };
        }

        const reserved = await tx.user.updateMany({
          where: { id: acceptor.id, activeMatchId: null },
          data: { activeMatchId: invitation.matchId },
        });
        if (reserved.count !== 1) {
          throw new BusyRollback();
        }

        const activated = await tx.match.updateMany({
          where: { id: invitation.matchId, status: 'WAITING' },
          data: {
            status: 'ACTIVE',
            startedAt: now,
            lastActivityAt: now,
            currentTurn: 'X',
            turnDeadline,
          },
        });
        if (activated.count !== 1) {
          throw new BusyRollback();
        }

        await tx.matchParticipant.create({
          data: {
            matchId: invitation.matchId,
            userId: acceptor.id,
            side: 'O',
            isAi: false,
            displayName: acceptor.firstName,
            username: acceptor.username,
            photoUrl: acceptor.photoUrl,
          },
        });

        const match = await loadMatchOrThrow(tx, invitation.matchId);
        return { status: 'accepted', match };
      });
    } catch (error) {
      if (error instanceof BusyRollback) return { status: 'acceptor_busy' };
      throw error;
    }
  }

  async cancelInvitation(invitationId: string, inviterId: string): Promise<CancelInvitationResult> {
    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({ where: { id: invitationId } });
      if (!invitation) return { status: 'not_found' };
      if (invitation.inviterId !== inviterId) return { status: 'forbidden' };
      if (invitation.status !== 'PENDING') return { status: 'not_pending' };
      const now = new Date();
      const cancelled = await tx.invitation.updateMany({
        where: { id: invitation.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      if (cancelled.count !== 1) return { status: 'not_pending' };
      await tx.match.updateMany({
        where: { id: invitation.matchId, status: 'WAITING' },
        data: {
          status: 'ABANDONED',
          finishReason: 'CANCELLED',
          finishedAt: now,
          currentTurn: null,
          turnDeadline: null,
          lastActivityAt: now,
          version: { increment: 1 },
        },
      });
      await tx.user.updateMany({
        where: { activeMatchId: invitation.matchId },
        data: { activeMatchId: null },
      });
      return { status: 'cancelled' };
    });
  }

  async expireInvitation(invitationId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: { id: invitationId },
        include: { match: true },
      });
      if (!invitation) return;
      await expireInvitationWithinTx(tx, invitation, new Date());
    });
  }

  async getRecentMatches(userId: string, limit: number, cursor?: string): Promise<RecentMatchPage> {
    const matches = await this.prisma.match.findMany({
      where: {
        status: { in: ['FINISHED', 'ABANDONED'] },
        finishedAt: { not: null },
        AND: [
          { participants: { some: { userId } } },
          // Cancelled or expired invitations abandon a WAITING match that only
          // ever had the host. Exclude those unfinished single-player matches.
          {
            participants: {
              some: { OR: [{ isAi: true }, { userId: { not: userId } }] },
            },
          },
        ],
      },
      include: matchInclude,
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const hasMore = matches.length > limit;
    const page = hasMore ? matches.slice(0, limit) : matches;
    return {
      matches: page.map(mapMatch),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getLeaderboard(limit: number): Promise<LeaderboardRow[]> {
    const rows = await this.prisma.userStats.findMany({
      where: { ratingGames: { gt: 0 } },
      orderBy: [{ rating: 'desc' }, { wins: 'desc' }, { ratingGames: 'desc' }],
      take: limit,
      include: { user: true },
    });
    return rows.map((row) => ({
      user: mapUserLite(row.user),
      stats: mapStats(row),
    }));
  }

  async getUserRank(userId: string): Promise<number | null> {
    const stats = await this.prisma.userStats.findUnique({ where: { userId } });
    if (!stats || stats.ratingGames <= 0) return null;
    const better = await this.prisma.userStats.count({
      where: {
        ratingGames: { gt: 0 },
        OR: [
          { rating: { gt: stats.rating } },
          { rating: stats.rating, wins: { gt: stats.wins } },
          { rating: stats.rating, wins: stats.wins, ratingGames: { gt: stats.ratingGames } },
        ],
      },
    });
    return better + 1;
  }

  async runMaintenance(now: Date, staleAfterMs: number): Promise<MaintenanceSummary> {
    const summary: MaintenanceSummary = {
      expiredInvitations: 0,
      abandonedMatches: 0,
      deletedInvitations: 0,
      repairedReservations: 0,
    };

    const expired = await this.prisma.invitation.findMany({
      where: { status: 'PENDING', expiresAt: { lte: now } },
      select: { id: true, matchId: true },
      take: 1000,
    });
    if (expired.length > 0) {
      const ids = expired.map((invitation) => invitation.id);
      const matchIds = expired.map((invitation) => invitation.matchId);
      await this.prisma.$transaction(async (tx) => {
        const result = await tx.invitation.updateMany({
          where: { id: { in: ids }, status: 'PENDING' },
          data: { status: 'EXPIRED' },
        });
        summary.expiredInvitations = result.count;
        const matches = await tx.match.updateMany({
          where: { id: { in: matchIds }, status: 'WAITING' },
          data: {
            status: 'ABANDONED',
            finishReason: 'CANCELLED',
            finishedAt: now,
            currentTurn: null,
            turnDeadline: null,
            lastActivityAt: now,
            version: { increment: 1 },
          },
        });
        summary.abandonedMatches += matches.count;
        const reservations = await tx.user.updateMany({
          where: { activeMatchId: { in: matchIds } },
          data: { activeMatchId: null },
        });
        summary.repairedReservations += reservations.count;
      });
    }

    const staleCutoff = new Date(now.getTime() - staleAfterMs);
    const stale = await this.prisma.match.findMany({
      where: { status: { in: ['ACTIVE', 'WAITING'] }, lastActivityAt: { lt: staleCutoff } },
      select: { id: true },
      take: 1000,
    });
    if (stale.length > 0) {
      const ids = stale.map((match) => match.id);
      await this.prisma.$transaction(async (tx) => {
        const abandoned = await tx.match.updateMany({
          where: { id: { in: ids }, status: { in: ['ACTIVE', 'WAITING'] } },
          data: {
            status: 'ABANDONED',
            finishReason: 'SERVER_SHUTDOWN',
            finishedAt: now,
            currentTurn: null,
            turnDeadline: null,
            lastActivityAt: now,
            version: { increment: 1 },
          },
        });
        summary.abandonedMatches += abandoned.count;
        const reservations = await tx.user.updateMany({
          where: { activeMatchId: { in: ids } },
          data: { activeMatchId: null },
        });
        summary.repairedReservations += reservations.count;
      });
    }

    // Close pending invitations whose match is no longer waiting. This covers
    // stale WAITING matches abandoned above as well as matches abandoned by an
    // earlier crash before the invitation could be updated.
    const orphaned = await this.prisma.invitation.findMany({
      where: { status: 'PENDING', match: { status: { not: 'WAITING' } } },
      select: { id: true },
      take: 1000,
    });
    if (orphaned.length > 0) {
      const expiredOrphans = await this.prisma.invitation.updateMany({
        where: { id: { in: orphaned.map((invitation) => invitation.id) }, status: 'PENDING' },
        data: { status: 'EXPIRED' },
      });
      summary.expiredInvitations += expiredOrphans.count;
    }

    const deleted = await this.prisma.invitation.deleteMany({
      where: {
        status: { in: ['CANCELLED', 'EXPIRED'] },
        createdAt: { lt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
      },
    });
    summary.deletedInvitations = deleted.count;

    const repaired = await this.prisma.$executeRaw`
      UPDATE "User" u
      SET "activeMatchId" = NULL
      WHERE u."activeMatchId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "Match" m
          WHERE m.id = u."activeMatchId" AND m.status::text IN ('ACTIVE', 'WAITING')
        )
    `;
    summary.repairedReservations += Number(repaired);

    return summary;
  }
}

class BusyRollback extends Error {
  constructor() {
    super('Acceptor became busy');
    this.name = 'BusyRollback';
  }
}

async function loadMatchOrThrow(db: Tx | PrismaClient, matchId: string): Promise<MatchEntity> {
  const match = await db.match.findUnique({ where: { id: matchId }, include: matchInclude });
  if (!match) throw new RepositoryConflictError('MATCH_NOT_FOUND', 'Match does not exist');
  return mapMatch(match);
}

async function applyFinalization(
  tx: Tx,
  match: MatchWithParticipants,
  finalization: FinalizationData,
): Promise<void> {
  for (const participant of match.participants) {
    const outcome: ParticipantOutcome =
      finalization.result === 'DRAW'
        ? 'DRAW'
        : participant.side === finalization.winnerSide
          ? 'WIN'
          : 'LOSS';
    const delta = finalization.countStats ? ratingDeltaFor(match.mode, outcome) : 0;
    await tx.matchParticipant.update({
      where: { id: participant.id },
      data: { outcome, ratingDelta: delta, leftAt: finalization.finishedAt },
    });

    if (participant.userId && finalization.countStats) {
      const stats = statsDeltaFor(match.mode, outcome);
      await tx.userStats.upsert({
        where: { userId: participant.userId },
        create: {
          userId: participant.userId,
          ...stats,
          rating: 1000 + delta,
        },
        update: {
          gamesPlayed: { increment: stats.gamesPlayed },
          wins: { increment: stats.wins },
          losses: { increment: stats.losses },
          draws: { increment: stats.draws },
          humanGames: { increment: stats.humanGames },
          aiGames: { increment: stats.aiGames },
          aiWins: { increment: stats.aiWins },
          aiLosses: { increment: stats.aiLosses },
          aiDraws: { increment: stats.aiDraws },
          ratingGames: { increment: stats.ratingGames },
          rating: { increment: delta },
        },
      });
    }
  }

  await tx.user.updateMany({
    where: { activeMatchId: match.id },
    data: { activeMatchId: null },
  });
}

async function expireInvitationWithinTx(
  tx: Tx,
  invitation: PrismaInvitation & { match?: PrismaMatch },
  now: Date,
): Promise<void> {
  const updated = await tx.invitation.updateMany({
    where: { id: invitation.id, status: 'PENDING' },
    data: { status: 'EXPIRED' },
  });
  if (updated.count !== 1) return;
  await tx.match.updateMany({
    where: { id: invitation.matchId, status: 'WAITING' },
    data: {
      status: 'ABANDONED',
      finishReason: 'CANCELLED',
      finishedAt: now,
      currentTurn: null,
      turnDeadline: null,
      lastActivityAt: now,
      version: { increment: 1 },
    },
  });
  await tx.user.updateMany({
    where: { activeMatchId: invitation.matchId },
    data: { activeMatchId: null },
  });
}

function mapUser(user: UserWithStats): UserEntity {
  return {
    id: user.id,
    telegramId: user.telegramId,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    photoUrl: user.photoUrl,
    languageCode: user.languageCode,
    autoAiFallback: user.autoAiFallback,
    activeMatchId: user.activeMatchId,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    stats: mapStats(user.stats),
  };
}

function mapStats(stats: PrismaUserStats | null): StatsEntity {
  if (!stats) {
    return {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      humanGames: 0,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      rating: 1000,
      ratingGames: 0,
    };
  }
  return {
    gamesPlayed: stats.gamesPlayed,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    humanGames: stats.humanGames,
    aiGames: stats.aiGames,
    aiWins: stats.aiWins,
    aiLosses: stats.aiLosses,
    aiDraws: stats.aiDraws,
    rating: stats.rating,
    ratingGames: stats.ratingGames,
  };
}

function mapUserLite(user: PrismaUser): UserLite {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
  };
}

function mapParticipant(participant: PrismaMatchParticipant): ParticipantEntity {
  return {
    id: participant.id,
    matchId: participant.matchId,
    userId: participant.userId,
    side: participant.side as Side,
    isAi: participant.isAi,
    aiDifficulty: participant.aiDifficulty as AiDifficulty | null,
    displayName: participant.displayName,
    username: participant.username,
    photoUrl: participant.photoUrl,
    outcome: participant.outcome as ParticipantOutcome | null,
    ratingDelta: participant.ratingDelta,
    joinedAt: participant.joinedAt,
    leftAt: participant.leftAt,
  };
}

function mapMatch(match: MatchWithParticipants): MatchEntity {
  return {
    id: match.id,
    mode: match.mode as MatchMode,
    status: match.status as MatchStatus,
    board: boardFromString(match.board),
    currentTurn: match.currentTurn as Side | null,
    turnNumber: match.turnNumber,
    winnerSide: match.winnerSide as Side | null,
    result: match.result as MatchResult | null,
    finishReason: match.finishReason as FinishReason | null,
    turnDeadline: match.turnDeadline,
    rematchOfId: match.rematchOfId,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
    lastActivityAt: match.lastActivityAt,
    version: match.version,
    createdAt: match.createdAt,
    participants: match.participants.map(mapParticipant),
  };
}

function mapInvitation(invitation: PrismaInvitation): InvitationEntity {
  return {
    id: invitation.id,
    tokenHash: invitation.tokenHash,
    inviterId: invitation.inviterId,
    matchId: invitation.matchId,
    status: invitation.status as InvitationStatus,
    expiresAt: invitation.expiresAt,
    acceptedById: invitation.acceptedById,
    acceptedAt: invitation.acceptedAt,
    createdAt: invitation.createdAt,
  };
}

function mapInvitationFull(invitation: InvitationFull): InvitationWithMatch {
  return {
    ...mapInvitation(invitation),
    match: mapMatch(invitation.match),
    inviter: mapUserLite(invitation.inviter),
  };
}

export function createPrismaClient(databaseUrl: string, isProduction: boolean): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: isProduction ? ['error'] : ['error', 'warn'],
  });
}
