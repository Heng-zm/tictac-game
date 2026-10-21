import { randomUUID } from 'node:crypto';
import { createEmptyBoard, type Side } from '../../shared/game-types';
import { RepositoryConflictError } from '../errors';
import { ratingDeltaFor, statsDeltaFor } from '../game/scoring';
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

interface MoveRecord {
  actionId: string;
  cell: number;
  side: Side;
  moveNumber: number;
}

export class MemoryGameRepository implements GameRepository {
  private readonly users = new Map<string, UserEntity>();
  private readonly usersByTelegramId = new Map<string, string>();
  private readonly matches = new Map<string, MatchEntity>();
  private readonly invitations = new Map<string, InvitationEntity>();
  private readonly invitationByHash = new Map<string, string>();
  private readonly moves = new Map<string, Map<string, MoveRecord>>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  async ready(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {
    return undefined;
  }

  async upsertTelegramUser(profile: TelegramProfileInput): Promise<UserEntity> {
    const telegramKey = profile.telegramId.toString();
    const existingId = this.usersByTelegramId.get(telegramKey);
    const now = this.clock();
    if (existingId) {
      const existing = this.users.get(existingId);
      if (!existing) throw new Error('Memory user index is inconsistent');
      existing.firstName = profile.firstName;
      existing.lastName = profile.lastName ?? null;
      existing.username = profile.username ?? null;
      existing.photoUrl = profile.photoUrl ?? null;
      existing.languageCode = profile.languageCode ?? null;
      existing.lastSeenAt = now;
      return cloneUser(existing);
    }

    const user: UserEntity = {
      id: randomUUID(),
      telegramId: profile.telegramId,
      username: profile.username ?? null,
      firstName: profile.firstName,
      lastName: profile.lastName ?? null,
      photoUrl: profile.photoUrl ?? null,
      languageCode: profile.languageCode ?? null,
      autoAiFallback: false,
      activeMatchId: null,
      createdAt: now,
      lastSeenAt: now,
      stats: emptyStats(),
    };
    this.users.set(user.id, user);
    this.usersByTelegramId.set(telegramKey, user.id);
    return cloneUser(user);
  }

  async getUserById(id: string): Promise<UserEntity | null> {
    const user = this.users.get(id);
    return user ? cloneUser(user) : null;
  }

  async setAutoAiFallback(userId: string, value: boolean): Promise<UserEntity> {
    const user = this.requireUser(userId);
    user.autoAiFallback = value;
    return cloneUser(user);
  }

  async touchUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.lastSeenAt = this.clock();
  }

  async clearUserReservation(userId: string, matchId?: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    if (!matchId || user.activeMatchId === matchId) {
      user.activeMatchId = null;
    }
  }

  async createMatch(input: CreateMatchInput): Promise<MatchEntity> {
    const humanIds = input.participants
      .map((participant) => participant.userId)
      .filter((id): id is string => Boolean(id));
    if (new Set(input.participants.map((participant) => participant.side)).size !== input.participants.length) {
      throw new RepositoryConflictError('INVALID_PLAYERS', 'A side can only have one participant');
    }
    if (new Set(humanIds).size !== humanIds.length) {
      throw new RepositoryConflictError('INVALID_PLAYERS', 'A player cannot occupy both sides');
    }
    for (const userId of humanIds) {
      const user = this.requireUser(userId);
      if (user.activeMatchId !== null) {
        throw new RepositoryConflictError('PLAYER_BUSY', 'A player is already in another match');
      }
    }

    const now = this.clock();
    const id = randomUUID();
    const participants: ParticipantEntity[] = input.participants.map((participant) => ({
      id: randomUUID(),
      matchId: id,
      userId: participant.userId,
      side: participant.side,
      isAi: participant.isAi,
      aiDifficulty: participant.aiDifficulty ?? null,
      displayName: participant.displayName,
      username: participant.username,
      photoUrl: participant.photoUrl,
      outcome: null,
      ratingDelta: 0,
      joinedAt: now,
      leftAt: null,
    }));
    const match: MatchEntity = {
      id,
      mode: input.mode,
      status: input.status,
      board: createEmptyBoard(),
      currentTurn: input.currentTurn,
      turnNumber: 0,
      winnerSide: null,
      result: null,
      finishReason: null,
      turnDeadline: input.turnDeadline,
      rematchOfId: input.rematchOfId ?? null,
      startedAt: now,
      finishedAt: null,
      lastActivityAt: now,
      version: 0,
      createdAt: now,
      participants,
    };
    this.matches.set(id, match);
    this.moves.set(id, new Map());
    for (const userId of humanIds) {
      this.requireUser(userId).activeMatchId = id;
    }
    return cloneMatch(match);
  }

  async createInvitationMatch(input: CreateInvitationInput): Promise<{ match: MatchEntity; invitation: InvitationEntity }> {
    const host = this.requireUser(input.host.id);
    if (host.activeMatchId !== null) {
      throw new RepositoryConflictError('PLAYER_BUSY', 'You already have a game or invitation in progress');
    }
    const now = this.clock();
    const matchId = randomUUID();
    const match: MatchEntity = {
      id: matchId,
      mode: 'FRIEND',
      status: 'WAITING',
      board: createEmptyBoard(),
      currentTurn: 'X',
      turnNumber: 0,
      winnerSide: null,
      result: null,
      finishReason: null,
      turnDeadline: null,
      rematchOfId: null,
      startedAt: now,
      finishedAt: null,
      lastActivityAt: now,
      version: 0,
      createdAt: now,
      participants: [
        {
          id: randomUUID(),
          matchId,
          userId: host.id,
          side: 'X',
          isAi: false,
          aiDifficulty: null,
          displayName: input.displayName,
          username: host.username,
          photoUrl: host.photoUrl,
          outcome: null,
          ratingDelta: 0,
          joinedAt: now,
      leftAt: null,
        },
      ],
    };
    const invitation: InvitationEntity = {
      id: randomUUID(),
      tokenHash: input.tokenHash,
      inviterId: host.id,
      matchId,
      status: 'PENDING',
      expiresAt: input.expiresAt,
      acceptedById: null,
      acceptedAt: null,
      createdAt: now,
    };
    host.activeMatchId = matchId;
    this.matches.set(matchId, match);
    this.moves.set(matchId, new Map());
    this.invitations.set(invitation.id, invitation);
    this.invitationByHash.set(invitation.tokenHash, invitation.id);
    return { match: cloneMatch(match), invitation: cloneInvitation(invitation) };
  }

  async getMatchById(matchId: string): Promise<MatchEntity | null> {
    const match = this.matches.get(matchId);
    return match ? cloneMatch(match) : null;
  }

  async getReservationMatch(userId: string): Promise<MatchEntity | null> {
    const user = this.users.get(userId);
    if (!user?.activeMatchId) return null;
    return this.getMatchById(user.activeMatchId);
  }

  async hasProcessedAction(matchId: string, actionId: string): Promise<boolean> {
    return this.moves.get(matchId)?.has(actionId) ?? false;
  }

  async recordMove(input: RecordMoveInput): Promise<RepositoryMoveResult> {
    const match = this.matches.get(input.matchId);
    if (!match) throw new RepositoryConflictError('MATCH_NOT_FOUND', 'Match does not exist');
    const matchMoves = this.moves.get(input.matchId) ?? new Map<string, MoveRecord>();
    if (matchMoves.has(input.actionId)) {
      return { status: 'duplicate', match: cloneMatch(match) };
    }
    if (match.status !== 'ACTIVE' || match.version !== input.expectedVersion) {
      return { status: 'conflict', match: cloneMatch(match) };
    }

    match.board = { ...input.boardAfter };
    match.currentTurn = input.finalization ? null : input.nextTurn;
    match.turnNumber = input.moveNumber;
    match.turnDeadline = input.finalization ? null : input.turnDeadline;
    match.lastActivityAt = input.lastActivityAt;
    match.version += 1;
    matchMoves.set(input.actionId, {
      actionId: input.actionId,
      cell: input.cell,
      side: input.side,
      moveNumber: input.moveNumber,
    });
    this.moves.set(input.matchId, matchMoves);

    if (input.finalization) {
      match.status = 'FINISHED';
      match.result = input.finalization.result;
      match.winnerSide = input.finalization.winnerSide;
      match.finishReason = input.finalization.finishReason;
      match.finishedAt = input.finalization.finishedAt;
      this.applyFinalization(match, input.finalization);
    }

    return { status: 'applied', match: cloneMatch(match) };
  }

  async finalizeMatch(input: FinalizeMatchInput): Promise<RepositoryFinalizeResult> {
    const match = this.matches.get(input.matchId);
    if (!match) throw new RepositoryConflictError('MATCH_NOT_FOUND', 'Match does not exist');
    if (match.status !== 'ACTIVE' || match.version !== input.expectedVersion) {
      return { status: 'conflict', match: cloneMatch(match) };
    }
    match.status = 'FINISHED';
    match.result = input.finalization.result;
    match.winnerSide = input.finalization.winnerSide;
    match.finishReason = input.finalization.finishReason;
    match.finishedAt = input.finalization.finishedAt;
    match.currentTurn = null;
    match.turnDeadline = null;
    match.lastActivityAt = input.lastActivityAt;
    match.version += 1;
    this.applyFinalization(match, input.finalization);
    return { status: 'applied', match: cloneMatch(match) };
  }

  async abandonMatch(input: AbandonMatchInput): Promise<MatchEntity | null> {
    const match = this.matches.get(input.matchId);
    if (!match) return null;
    const statuses = input.statuses ?? ['WAITING', 'ACTIVE'];
    if (!statuses.includes(match.status as 'WAITING' | 'ACTIVE')) return cloneMatch(match);
    if (input.expectedVersion !== undefined && match.version !== input.expectedVersion) return cloneMatch(match);
    match.status = 'ABANDONED';
    match.finishReason = input.finishReason;
    match.finishedAt = input.finishedAt;
    match.currentTurn = null;
    match.turnDeadline = null;
    match.lastActivityAt = input.finishedAt;
    match.version += 1;
    for (const participant of match.participants) {
      participant.leftAt = input.finishedAt;
      if (participant.userId) {
        const user = this.users.get(participant.userId);
        if (user?.activeMatchId === match.id) user.activeMatchId = null;
      }
    }
    return cloneMatch(match);
  }

  async getInvitationByTokenHash(tokenHash: string): Promise<InvitationWithMatch | null> {
    const id = this.invitationByHash.get(tokenHash);
    if (!id) return null;
    return this.invitationWithMatch(id);
  }

  async getInvitationById(invitationId: string): Promise<InvitationWithMatch | null> {
    return this.invitationWithMatch(invitationId);
  }

  async getPendingInvitationForUser(userId: string): Promise<InvitationWithMatch | null> {
    const pending = [...this.invitations.values()]
      .filter((invitation) => invitation.inviterId === userId && invitation.status === 'PENDING')
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    if (!pending) return null;
    if (pending.expiresAt.getTime() <= this.clock().getTime()) {
      await this.expireInvitation(pending.id);
      return null;
    }
    return this.invitationWithMatch(pending.id);
  }

  async acceptInvitation(
    tokenHash: string,
    acceptor: UserEntity,
    turnDeadline: Date | null,
  ): Promise<AcceptInvitationResult> {
    const invitationId = this.invitationByHash.get(tokenHash);
    if (!invitationId) return { status: 'not_found' };
    const invitation = this.invitations.get(invitationId);
    const match = invitation ? this.matches.get(invitation.matchId) : undefined;
    if (!invitation || !match) return { status: 'not_found' };
    const now = this.clock();

    if (invitation.inviterId === acceptor.id) return { status: 'self' };
    if (invitation.status === 'EXPIRED' || invitation.expiresAt.getTime() <= now.getTime()) {
      await this.expireInvitation(invitation.id);
      return { status: 'expired' };
    }
    if (invitation.status === 'ACCEPTED') return { status: 'already_used' };
    if (invitation.status === 'CANCELLED') return { status: 'cancelled' };
    if (match.status !== 'WAITING') return { status: 'cancelled' };

    const acceptorRecord = this.requireUser(acceptor.id);
    if (acceptorRecord.activeMatchId !== null) return { status: 'acceptor_busy' };

    invitation.status = 'ACCEPTED';
    invitation.acceptedById = acceptor.id;
    invitation.acceptedAt = now;
    acceptorRecord.activeMatchId = match.id;

    match.status = 'ACTIVE';
    match.startedAt = now;
    match.lastActivityAt = now;
    match.currentTurn = 'X';
    match.turnDeadline = turnDeadline;
    match.participants.push({
      id: randomUUID(),
      matchId: match.id,
      userId: acceptor.id,
      side: 'O',
      isAi: false,
      aiDifficulty: null,
      displayName: acceptor.firstName,
      username: acceptor.username,
      photoUrl: acceptor.photoUrl,
      outcome: null,
      ratingDelta: 0,
      joinedAt: now,
      leftAt: null,
    });
    return { status: 'accepted', match: cloneMatch(match) };
  }

  async cancelInvitation(invitationId: string, inviterId: string): Promise<CancelInvitationResult> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation) return { status: 'not_found' };
    if (invitation.inviterId !== inviterId) return { status: 'forbidden' };
    if (invitation.status !== 'PENDING') return { status: 'not_pending' };
    const now = this.clock();
    invitation.status = 'CANCELLED';
    const match = this.matches.get(invitation.matchId);
    if (match) {
      match.status = 'ABANDONED';
      match.finishReason = 'CANCELLED';
      match.finishedAt = now;
      match.currentTurn = null;
      match.turnDeadline = null;
      match.lastActivityAt = now;
      match.version += 1;
    }
    const host = this.users.get(inviterId);
    if (host?.activeMatchId === invitation.matchId) host.activeMatchId = null;
    return { status: 'cancelled' };
  }

  async expireInvitation(invitationId: string): Promise<void> {
    const invitation = this.invitations.get(invitationId);
    if (!invitation || invitation.status !== 'PENDING') return;
    const now = this.clock();
    invitation.status = 'EXPIRED';
    const match = this.matches.get(invitation.matchId);
    if (match && match.status === 'WAITING') {
      match.status = 'ABANDONED';
      match.finishReason = 'CANCELLED';
      match.finishedAt = now;
      match.currentTurn = null;
      match.turnDeadline = null;
      match.lastActivityAt = now;
      match.version += 1;
    }
    const host = this.users.get(invitation.inviterId);
    if (host?.activeMatchId === invitation.matchId) host.activeMatchId = null;
  }

  async getRecentMatches(userId: string, limit: number, cursor?: string): Promise<RecentMatchPage> {
    const relevant = [...this.matches.values()]
      .filter(
        (match) =>
          (match.status === 'FINISHED' || match.status === 'ABANDONED') &&
          match.finishedAt !== null &&
          match.participants.some((participant) => participant.userId === userId) &&
          // Cancelled or expired invitations abandon a WAITING match that only
          // ever had the host. They are not games and cannot produce a history
          // entry (there is no opponent).
          match.participants.length >= 2,
      )
      .sort((a, b) => {
        const diff = (b.finishedAt?.getTime() ?? 0) - (a.finishedAt?.getTime() ?? 0);
        return diff !== 0 ? diff : b.id.localeCompare(a.id);
      });
    let start = 0;
    if (cursor) {
      const index = relevant.findIndex((match) => match.id === cursor);
      if (index >= 0) start = index + 1;
    }
    const page = relevant.slice(start, start + limit);
    const hasMore = relevant.length > start + limit;
    return {
      matches: page.map(cloneMatch),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async getLeaderboard(limit: number): Promise<LeaderboardRow[]> {
    return [...this.users.values()]
      .filter((user) => user.stats.ratingGames > 0)
      .sort(
        (a, b) =>
          b.stats.rating - a.stats.rating ||
          b.stats.wins - a.stats.wins ||
          b.stats.ratingGames - a.stats.ratingGames,
      )
      .slice(0, limit)
      .map((user) => ({ user: mapUserLite(user), stats: { ...user.stats } }));
  }

  async getUserRank(userId: string): Promise<number | null> {
    const user = this.users.get(userId);
    if (!user || user.stats.ratingGames <= 0) return null;
    let better = 0;
    for (const other of this.users.values()) {
      if (other.id === userId || other.stats.ratingGames <= 0) continue;
      if (
        other.stats.rating > user.stats.rating ||
        (other.stats.rating === user.stats.rating && other.stats.wins > user.stats.wins) ||
        (other.stats.rating === user.stats.rating &&
          other.stats.wins === user.stats.wins &&
          other.stats.ratingGames > user.stats.ratingGames)
      ) {
        better += 1;
      }
    }
    return better + 1;
  }

  async runMaintenance(now: Date, staleAfterMs: number): Promise<MaintenanceSummary> {
    const summary: MaintenanceSummary = {
      expiredInvitations: 0,
      abandonedMatches: 0,
      deletedInvitations: 0,
      repairedReservations: 0,
    };

    for (const invitation of this.invitations.values()) {
      if (invitation.status === 'PENDING' && invitation.expiresAt.getTime() <= now.getTime()) {
        await this.expireInvitation(invitation.id);
        summary.expiredInvitations += 1;
        summary.abandonedMatches += 1;
      }
    }

    const cutoff = now.getTime() - staleAfterMs;
    for (const match of this.matches.values()) {
      if ((match.status === 'ACTIVE' || match.status === 'WAITING') && match.lastActivityAt.getTime() < cutoff) {
        await this.abandonMatch({ matchId: match.id, finishReason: 'SERVER_SHUTDOWN', finishedAt: now });
        summary.abandonedMatches += 1;
      }
    }

    // Close pending invitations whose match is no longer waiting, including
    // stale waiting matches abandoned just above.
    for (const invitation of this.invitations.values()) {
      if (invitation.status !== 'PENDING') continue;
      const match = this.matches.get(invitation.matchId);
      if (!match || match.status !== 'WAITING') {
        invitation.status = 'EXPIRED';
        summary.expiredInvitations += 1;
      }
    }

    for (const [id, invitation] of this.invitations.entries()) {
      const age = now.getTime() - invitation.createdAt.getTime();
      if (
        (invitation.status === 'CANCELLED' || invitation.status === 'EXPIRED') &&
        age > 30 * 24 * 60 * 60 * 1000
      ) {
        this.invitations.delete(id);
        this.invitationByHash.delete(invitation.tokenHash);
        summary.deletedInvitations += 1;
      }
    }

    for (const user of this.users.values()) {
      if (user.activeMatchId === null) continue;
      const match = this.matches.get(user.activeMatchId);
      if (!match || (match.status !== 'ACTIVE' && match.status !== 'WAITING')) {
        user.activeMatchId = null;
        summary.repairedReservations += 1;
      }
    }
    return summary;
  }

  private applyFinalization(match: MatchEntity, finalization: FinalizationData): void {
    for (const participant of match.participants) {
      const outcome =
        finalization.result === 'DRAW'
          ? 'DRAW'
          : participant.side === finalization.winnerSide
            ? 'WIN'
            : 'LOSS';
      const delta = finalization.countStats ? ratingDeltaFor(match.mode, outcome) : 0;
      participant.outcome = outcome;
      participant.ratingDelta = delta;
      participant.leftAt = finalization.finishedAt;
      if (participant.userId && finalization.countStats) {
        const user = this.users.get(participant.userId);
        if (user) {
          const stats = user.stats;
          const increment = statsDeltaFor(match.mode, outcome);
          stats.gamesPlayed += increment.gamesPlayed;
          stats.wins += increment.wins;
          stats.losses += increment.losses;
          stats.draws += increment.draws;
          stats.humanGames += increment.humanGames;
          stats.aiGames += increment.aiGames;
          stats.aiWins += increment.aiWins;
          stats.aiLosses += increment.aiLosses;
          stats.aiDraws += increment.aiDraws;
          stats.ratingGames += increment.ratingGames;
          stats.rating += delta;
        }
      }
    }
    for (const user of this.users.values()) {
      if (user.activeMatchId === match.id) user.activeMatchId = null;
    }
  }

  private invitationWithMatch(id: string): InvitationWithMatch | null {
    const invitation = this.invitations.get(id);
    if (!invitation) return null;
    const match = this.matches.get(invitation.matchId);
    const inviter = this.users.get(invitation.inviterId);
    if (!match || !inviter) return null;
    return {
      ...cloneInvitation(invitation),
      match: cloneMatch(match),
      inviter: mapUserLite(inviter),
    };
  }

  private requireUser(id: string): UserEntity {
    const user = this.users.get(id);
    if (!user) throw new Error(`Unknown memory user ${id}`);
    return user;
  }
}

function emptyStats(): StatsEntity {
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

function cloneUser(user: UserEntity): UserEntity {
  return { ...user, stats: { ...user.stats } };
}

function cloneMatch(match: MatchEntity): MatchEntity {
  return {
    ...match,
    board: { ...match.board },
    participants: match.participants.map((participant) => ({ ...participant })),
  };
}

function cloneInvitation(invitation: InvitationEntity): InvitationEntity {
  return { ...invitation };
}

function mapUserLite(user: UserEntity): UserLite {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
  };
}
