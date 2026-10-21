import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type {
  AiDifficulty,
  CreatedInvitation,
  FinishReason,
  InvitePreview,
  MatchResult,
  PublicMatchState,
  RematchStatus,
  Side,
} from '../../shared/game-types';
import { oppositeSide } from '../../shared/game-types';
import type { AppConfig } from '../config';
import type {
  FinalizationData,
  GameRepository,
  InvitationWithMatch,
  MatchEntity,
  ParticipantEntity,
  UserEntity,
} from '../database/types';
import { AppError } from '../errors';
import { chooseAiMove } from '../game/ai';
import { applyMove, getGameStatus } from '../game/rules';
import { buildInviteDeepLink, generateInvitationToken, hashInvitationToken } from '../services/invitations';
import { buildMatchView } from '../services/match-view';
import type { GameServer } from '../sockets/types';
import { matchRoom, userRoom } from '../sockets/types';

const REMATCH_WINDOW_MS = 2 * 60 * 1000;
const FINISHED_GAME_TTL_MS = 10 * 60 * 1000;
const RECENT_FINISHED_TTL_MS = 5 * 60 * 1000;

interface ActiveGame {
  match: MatchEntity;
  aiTimer: ReturnType<typeof setTimeout> | null;
  turnTimer: ReturnType<typeof setTimeout> | null;
  cleanupTimer: ReturnType<typeof setTimeout> | null;
  disconnectTimers: Map<string, ReturnType<typeof setTimeout>>;
  disconnectedUsers: Set<string>;
  processedActions: Set<string>;
}

interface RematchTracker {
  matchId: string;
  participants: string[];
  requests: Set<string>;
  expiresAt: Date;
  timer: ReturnType<typeof setTimeout> | null;
}

export interface MatchServiceDependencies {
  io: GameServer;
  repository: GameRepository;
  config: AppConfig;
  logger: Logger;
  now?: () => Date;
  random?: () => number;
}

export class MatchService {
  private readonly online = new Set<string>();
  private readonly games = new Map<string, ActiveGame>();
  private readonly userMatchIds = new Map<string, string>();
  private readonly loading = new Map<string, Promise<MatchEntity | null>>();
  private readonly rematches = new Map<string, RematchTracker>();
  private readonly recentFinished = new Map<string, { matchId: string; expiresAt: number }>();
  private readonly now: () => Date;
  private readonly random: () => number;
  private shuttingDown = false;

  constructor(private readonly deps: MatchServiceDependencies) {
    this.now = deps.now ?? (() => new Date());
    this.random = deps.random ?? Math.random;
  }

  async assertAvailable(userId: string): Promise<void> {
    const knownMatchId = this.userMatchIds.get(userId);
    if (knownMatchId) {
      const game = this.games.get(knownMatchId);
      if (game?.match.status === 'ACTIVE') {
        throw new AppError(409, 'PLAYER_BUSY', 'You are already in a game');
      }
    }

    const user = await this.deps.repository.getUserById(userId);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
    if (!user.activeMatchId) return;

    const match = await this.deps.repository.getMatchById(user.activeMatchId);
    if (match?.status === 'ACTIVE') {
      throw new AppError(409, 'PLAYER_BUSY', 'You are already in a game');
    }
    if (match?.status === 'WAITING') {
      const pending = await this.deps.repository.getPendingInvitationForUser(userId);
      if (pending) {
        throw new AppError(409, 'INVITATION_PENDING', 'Cancel your waiting invitation before starting another game');
      }
      const refreshed = await this.deps.repository.getUserById(userId);
      if (refreshed?.activeMatchId) {
        throw new AppError(409, 'PLAYER_BUSY', 'You already have a game in progress');
      }
      return;
    }
    if (user.activeMatchId) {
      throw new AppError(409, 'PLAYER_BUSY', 'You already have a game in progress');
    }
  }

  async handleConnected(user: UserEntity): Promise<void> {
    this.online.add(user.id);

    if (await this.resumeReservation(user)) return;

    const recent = this.recentFinished.get(user.id);
    if (recent && recent.expiresAt > this.now().getTime()) {
      const game = this.games.get(recent.matchId);
      if (game?.match.status === 'FINISHED') {
        this.joinMatchRooms(game.match);
        this.emitFinishedToUser(game.match, user.id);
      } else {
        const match = await this.deps.repository.getMatchById(recent.matchId);
        if (match?.status === 'FINISHED') {
          this.emitFinishedToUser(match, user.id);
        } else {
          this.recentFinished.delete(user.id);
        }
      }
    }
  }

  async handleDisconnected(userId: string): Promise<void> {
    this.online.delete(userId);
    const matchId = this.userMatchIds.get(userId);
    if (!matchId) return;
    const game = this.games.get(matchId);
    if (!game || game.match.status !== 'ACTIVE') return;

    if (game.match.mode === 'AI') {
      this.clearAiTimer(game);
      this.clearTurnTimer(game);
      return;
    }

    const userParticipant = game.match.participants.find((participant) => participant.userId === userId);
    if (!userParticipant) return;

    game.disconnectedUsers.add(userId);
    if (game.match.currentTurn === userParticipant.side) {
      this.clearTurnTimer(game);
      game.match.turnDeadline = null;
    }
    this.startDisconnectTimer(game, userId);
    this.emitState(game);
    this.emitOpponentDisconnected(game, userId);
  }

  async joinMatch(userId: string, matchId: string): Promise<PublicMatchState> {
    const match = await this.loadMatch(matchId);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'That game could not be found');
    const participant = match.participants.find((item) => item.userId === userId);
    if (!participant) throw new AppError(403, 'MATCH_FORBIDDEN', 'You are not part of this game');
    if (match.status === 'WAITING') {
      throw new AppError(409, 'GAME_NOT_ACTIVE', 'This invitation has not been accepted yet');
    }
    if (match.status === 'ACTIVE') {
      const game = this.installActive(match);
      this.joinMatchRooms(match);
      this.scheduleTimers(game);
      this.emitState(game);
      return this.stateFor(game.match, userId);
    }
    return this.stateFor(match, userId);
  }

  async createRandomMatch(firstUserId: string, secondUserId: string): Promise<MatchEntity> {
    if (firstUserId === secondUserId) {
      throw new AppError(409, 'PLAYER_BUSY', 'You cannot be matched with yourself');
    }
    const [first, second] = await Promise.all([
      this.deps.repository.getUserById(firstUserId),
      this.deps.repository.getUserById(secondUserId),
    ]);
    if (!first || !second) {
      throw new AppError(404, 'MATCH_NOT_FOUND', 'One of the players is no longer available');
    }

    const firstSide: Side = this.random() < 0.5 ? 'X' : 'O';
    const secondSide: Side = oppositeSide(firstSide);
    const participants = [
      participantFromUser(first, firstSide),
      participantFromUser(second, secondSide),
    ];
    const now = this.now();
    const turnDeadline = this.deadlineForTurn('RANDOM', participants, 'X', now);
    const match = await this.deps.repository.createMatch({
      mode: 'RANDOM',
      status: 'ACTIVE',
      participants,
      currentTurn: 'X',
      turnDeadline,
    });
    this.launchNewMatch(match);
    return match;
  }

  async startAi(userId: string, difficulty: AiDifficulty, side: Side): Promise<MatchEntity> {
    const user = await this.deps.repository.getUserById(userId);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
    await this.assertAvailable(userId);
    return this.createAiMatch(user, difficulty, side);
  }

  async startAiFallback(userId: string): Promise<MatchEntity> {
    const user = await this.deps.repository.getUserById(userId);
    if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
    await this.assertAvailable(userId);
    return this.createAiMatch(user, this.deps.config.aiFallbackDifficulty, 'X');
  }

  async createInvitation(user: UserEntity): Promise<CreatedInvitation> {
    await this.assertAvailable(user.id);
    const pending = await this.deps.repository.getPendingInvitationForUser(user.id);
    if (pending) {
      throw new AppError(409, 'INVITATION_PENDING', 'Cancel your existing invitation before creating another');
    }
    const { token, tokenHash } = generateInvitationToken();
    const expiresAt = new Date(this.now().getTime() + this.deps.config.inviteTtlMinutes * 60_000);
    const { invitation } = await this.deps.repository.createInvitationMatch({
      host: user,
      tokenHash,
      expiresAt,
      displayName: user.firstName,
    });
    const deepLink = buildInviteDeepLink(this.deps.config, token);
    this.deps.io.to(userRoom(user.id)).emit('invite:waiting', {
      invitation: {
        id: invitation.id,
        matchId: invitation.matchId,
        expiresAt: invitation.expiresAt.toISOString(),
        status: invitation.status,
      },
    });
    return {
      id: invitation.id,
      deepLink,
      expiresAt: invitation.expiresAt.toISOString(),
      matchId: invitation.matchId,
    };
  }

  async cancelInvitation(userId: string, invitationId: string): Promise<void> {
    const result = await this.deps.repository.cancelInvitation(invitationId, userId);
    if (result.status === 'not_found') {
      throw new AppError(404, 'INVITATION_INVALID', 'That invitation no longer exists');
    }
    if (result.status === 'forbidden') {
      throw new AppError(403, 'INVITATION_FORBIDDEN', 'Only the host can cancel this invitation');
    }
    if (result.status === 'not_pending') {
      throw new AppError(409, 'INVITATION_USED', 'That invitation is no longer pending');
    }
  }

  async getInvitePreview(userId: string, token: string): Promise<InvitePreview> {
    const tokenHash = hashInvitationToken(token);
    let invitation = await this.deps.repository.getInvitationByTokenHash(tokenHash);
    if (!invitation) {
      throw new AppError(404, 'INVITATION_INVALID', 'This invitation link is invalid');
    }
    if (invitation.status === 'PENDING' && invitation.expiresAt.getTime() <= this.now().getTime()) {
      await this.deps.repository.expireInvitation(invitation.id);
      invitation = (await this.deps.repository.getInvitationByTokenHash(tokenHash)) ?? invitation;
    }
    return this.toInvitePreview(invitation, userId);
  }

  async acceptInvitation(user: UserEntity, token: string): Promise<{ match: MatchEntity }> {
    const tokenHash = hashInvitationToken(token);
    const freshUser = await this.deps.repository.getUserById(user.id);
    if (!freshUser) throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
    const result = await this.deps.repository.acceptInvitation(tokenHash, freshUser, null);
    switch (result.status) {
      case 'accepted':
        break;
      case 'not_found':
        throw new AppError(404, 'INVITATION_INVALID', 'This invitation link is invalid');
      case 'expired':
        throw new AppError(410, 'INVITATION_EXPIRED', 'This invitation has expired');
      case 'already_used':
        throw new AppError(409, 'INVITATION_USED', 'Someone has already accepted this invitation');
      case 'self':
        throw new AppError(403, 'INVITATION_OWN', 'You cannot accept your own invitation');
      case 'cancelled':
        throw new AppError(410, 'INVITATION_CANCELLED', 'This invitation was cancelled');
      case 'acceptor_busy':
        throw new AppError(409, 'PLAYER_BUSY', 'You already have another game or invitation in progress');
    }
    if (!result.match) {
      throw new AppError(500, 'INTERNAL_ERROR', 'The game could not be started');
    }
    const game = this.installActive(result.match);
    this.scheduleTimers(game);
    this.launchExistingMatch(result.match, 'match:found');
    return { match: result.match };
  }

  async submitMove(
    userId: string,
    matchId: string,
    cell: number,
    actionId: string,
  ): Promise<PublicMatchState> {
    const match = await this.loadMatch(matchId);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'That game could not be found');
    const player = match.participants.find((participant) => participant.userId === userId);
    if (!player) throw new AppError(403, 'MATCH_FORBIDDEN', 'You are not part of this game');

    // Retries of an already-processed action are idempotent, including a retry
    // of the move that finished the game. The client may not have received the
    // final state before its connection dropped.
    const game = this.games.get(matchId);
    if (game?.processedActions.has(actionId)) {
      return this.stateFor(match, userId);
    }
    if (match.status !== 'ACTIVE') throw new AppError(409, 'GAME_FINISHED', 'This game has ended');
    const activeGame = game ?? this.installActive(match);
    if (match.currentTurn !== player.side) {
      throw new AppError(409, 'OUT_OF_TURN', 'It is not your turn');
    }

    const applied = applyMove(match.board, player.side, cell);
    if (!applied.ok) {
      const code = applied.code === 'OCCUPIED_CELL' ? 'OCCUPIED_CELL' : applied.code;
      const message =
        applied.code === 'OCCUPIED_CELL'
          ? 'That square is already taken'
          : applied.code === 'INVALID_CELL'
            ? 'That square is not valid'
            : 'This game has already ended';
      throw new AppError(409, code, message);
    }

    const status = getGameStatus(applied.board);
    let finalization: FinalizationData | null = null;
    let winnerSide: Side | null = null;
    let result: MatchResult | null = null;
    let finishReason: FinishReason | null = null;
    if (status.status === 'WON') {
      winnerSide = status.winner;
      result = winnerSide === 'X' ? 'X_WINS' : 'O_WINS';
      finishReason = 'LINE';
    } else if (status.status === 'DRAW') {
      result = 'DRAW';
      finishReason = 'DRAW';
    }
    const now = this.now();
    if (result && finishReason) {
      finalization = {
        winnerSide,
        result,
        finishReason,
        finishedAt: now,
        countStats: true,
      };
    }
    const nextTurn = finalization ? null : oppositeSide(player.side);
    const turnDeadline = finalization
      ? null
      : this.deadlineForTurn(match.mode, match.participants, nextTurn, now);

    const repoResult = await this.deps.repository.recordMove({
      matchId,
      expectedVersion: match.version,
      side: player.side,
      cell,
      actionId,
      boardAfter: applied.board,
      nextTurn,
      moveNumber: match.turnNumber + 1,
      turnDeadline,
      lastActivityAt: now,
      finalization,
    });

    activeGame.match = repoResult.match;

    if (repoResult.status === 'duplicate') {
      return this.stateFor(repoResult.match, userId);
    }
    if (repoResult.status === 'conflict') {
      this.emitState(activeGame);
      throw new AppError(409, 'STALE_STATE', 'The game changed. The board has been refreshed.');
    }

    activeGame.processedActions.add(actionId);
    this.deps.io.to(matchRoom(matchId)).emit('move:accepted', {
      matchId,
      side: player.side,
      cell,
      actionId,
      version: repoResult.match.version,
    });

    if (repoResult.match.status === 'FINISHED') {
      this.finishUi(activeGame);
    } else {
      this.scheduleTimers(activeGame);
      this.emitState(activeGame);
    }
    return this.stateFor(activeGame.match, userId);
  }

  async requestRematch(userId: string, matchId: string): Promise<{ matchId: string; rematch: RematchStatus }> {
    const match = (await this.loadMatch(matchId)) ?? null;
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'That game could not be found');
    const player = match.participants.find((participant) => participant.userId === userId);
    if (!player) throw new AppError(403, 'MATCH_FORBIDDEN', 'You are not part of this game');
    if (match.status !== 'FINISHED') {
      throw new AppError(409, 'REMATCH_NOT_AVAILABLE', 'A rematch is only available after the game ends');
    }

    if (match.mode === 'AI') {
      const ai = match.participants.find((participant) => participant.isAi);
      const difficulty = ai?.aiDifficulty ?? 'MEDIUM';
      const user = await this.deps.repository.getUserById(userId);
      if (!user) throw new AppError(401, 'AUTH_REQUIRED', 'Please open the game from Telegram');
      await this.assertAvailable(userId);
      const newMatch = await this.createAiMatch(user, difficulty, player.side);
      return {
        matchId: newMatch.id,
        rematch: this.getRematchStatus(newMatch, userId),
      };
    }

    const humanIds = match.participants
      .map((participant) => participant.userId)
      .filter((id): id is string => Boolean(id));
    if (humanIds.length !== 2 || !match.finishedAt) {
      throw new AppError(409, 'REMATCH_NOT_AVAILABLE', 'A rematch is not available for this game');
    }
    const windowEnd = match.finishedAt.getTime() + REMATCH_WINDOW_MS;
    if (this.now().getTime() > windowEnd) {
      throw new AppError(409, 'REMATCH_NOT_AVAILABLE', 'The rematch window has expired');
    }

    let tracker = this.rematches.get(matchId);
    if (!tracker || tracker.expiresAt.getTime() <= this.now().getTime()) {
      if (tracker) this.deleteRematchTracker(tracker);
      tracker = {
        matchId,
        participants: humanIds,
        requests: new Set<string>(),
        expiresAt: new Date(windowEnd),
        timer: null,
      };
      this.rematches.set(matchId, tracker);
      tracker.timer = setTimeout(() => this.expireRematchTracker(matchId), Math.max(0, windowEnd - this.now().getTime()));
      tracker.timer.unref?.();
    }
    tracker.requests.add(userId);
    this.emitRematchStatus(match, tracker);

    if (tracker.requests.size < tracker.participants.length) {
      return { matchId, rematch: this.getRematchStatus(match, userId) };
    }

    this.deleteRematchTracker(tracker);
    const xPlayer = match.participants.find((participant) => participant.side === 'X');
    const oPlayer = match.participants.find((participant) => participant.side === 'O');
    if (!xPlayer?.userId || !oPlayer?.userId) {
      throw new AppError(409, 'REMATCH_NOT_AVAILABLE', 'A rematch is not available for this game');
    }
    const now = this.now();
    const participants = [
      { ...participantFromUser(await this.requireUser(oPlayer.userId), 'X') },
      { ...participantFromUser(await this.requireUser(xPlayer.userId), 'O') },
    ];
    try {
      const newMatch = await this.deps.repository.createMatch({
        mode: match.mode,
        status: 'ACTIVE',
        participants,
        currentTurn: 'X',
        turnDeadline: this.deadlineForTurn(match.mode, participants, 'X', now),
        rematchOfId: match.id,
      });
      this.launchNewMatch(newMatch);
      return { matchId: newMatch.id, rematch: this.getRematchStatus(newMatch, userId) };
    } catch (error) {
      this.deps.logger.warn(
        { event: 'rematch_failed', matchId, code: error instanceof AppError ? error.code : 'UNKNOWN' },
        'Rematch could not be created',
      );
      throw new AppError(409, 'PLAYER_BUSY', 'A rematch could not be started. One player may have started another game.');
    }
  }

  async leaveMatch(userId: string, matchId: string): Promise<void> {
    const match = await this.loadMatch(matchId);
    if (!match) throw new AppError(404, 'MATCH_NOT_FOUND', 'That game could not be found');
    const participant = match.participants.find((item) => item.userId === userId);
    if (!participant) throw new AppError(403, 'MATCH_FORBIDDEN', 'You are not part of this game');

    const game = this.games.get(matchId);
    if (match.status === 'ACTIVE' && game) {
      if (match.mode === 'AI') {
        const abandoned = await this.deps.repository.abandonMatch({
          matchId,
          expectedVersion: match.version,
          finishReason: 'ABANDONED',
          finishedAt: this.now(),
          statuses: ['ACTIVE'],
        });
        if (abandoned) game.match = abandoned;
        this.clearAllGameTimers(game);
        this.removeUserMatch(game.match);
        this.games.delete(matchId);
      } else {
        const opponent = match.participants.find((item) => item.side !== participant.side);
        if (opponent) {
          await this.finishGameWithWinner(game, opponent.side, 'FORFEIT');
        }
      }
    } else if (match.status === 'WAITING') {
      throw new AppError(409, 'GAME_NOT_ACTIVE', 'The invitation has not been accepted yet');
    }

    this.recentFinished.delete(userId);
    const tracker = this.rematches.get(matchId);
    if (tracker) {
      tracker.requests.delete(userId);
      this.emitRematchStatus(match, tracker);
    }
    this.deps.io.in(userRoom(userId)).socketsLeave(matchRoom(matchId));
  }

  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    for (const game of this.games.values()) {
      this.clearAllGameTimers(game);
    }
    for (const tracker of this.rematches.values()) {
      if (tracker.timer) clearTimeout(tracker.timer);
    }
    this.rematches.clear();
  }

  private async resumeReservation(user: UserEntity): Promise<boolean> {
    const reservation = await this.deps.repository.getReservationMatch(user.id);
    if (!reservation) return false;
    if (reservation.status === 'WAITING') {
      const pending = await this.deps.repository.getPendingInvitationForUser(user.id);
      if (pending) {
        this.deps.io.to(userRoom(user.id)).emit('invite:pending', {
          invitation: {
            id: pending.id,
            matchId: pending.matchId,
            expiresAt: pending.expiresAt.toISOString(),
            status: pending.status,
          },
        });
      }
      return true;
    }
    if (reservation.status !== 'ACTIVE') return true;

    const game = this.installActive(reservation);
    if (
      game.match.turnDeadline &&
      game.match.turnDeadline.getTime() <= this.now().getTime()
    ) {
      game.match.turnDeadline = this.deadlineForTurn(
        game.match.mode,
        game.match.participants,
        game.match.currentTurn,
        this.now(),
      );
    }
    this.joinMatchRooms(game.match);
    const wasDisconnected = game.disconnectedUsers.has(user.id);
    if (wasDisconnected) {
      game.disconnectedUsers.delete(user.id);
      const timer = game.disconnectTimers.get(user.id);
      if (timer) clearTimeout(timer);
      game.disconnectTimers.delete(user.id);
      game.match.turnDeadline =
        game.match.currentTurn === game.match.participants.find((p) => p.userId === user.id)?.side
          ? this.deadlineForTurn(game.match.mode, game.match.participants, game.match.currentTurn, this.now())
          : game.match.turnDeadline;
      this.emitOpponentReconnected(game, user.id);
    }
    this.scheduleTimers(game);
    this.emitState(game);
    return true;
  }

  private async createAiMatch(user: UserEntity, difficulty: AiDifficulty, playerSide: Side): Promise<MatchEntity> {
    const aiSide = oppositeSide(playerSide);
    const participants = [
      participantFromUser(user, playerSide),
      {
        userId: null,
        side: aiSide,
        isAi: true,
        aiDifficulty: difficulty,
        displayName: 'Tic Tac Bot',
        username: null,
        photoUrl: null,
      },
    ];
    const now = this.now();
    const match = await this.deps.repository.createMatch({
      mode: 'AI',
      status: 'ACTIVE',
      participants,
      currentTurn: 'X',
      turnDeadline: this.deadlineForTurn('AI', participants, 'X', now),
    });
    this.launchNewMatch(match);
    return match;
  }

  private async loadMatch(matchId: string): Promise<MatchEntity | null> {
    const existing = this.games.get(matchId);
    if (existing) return existing.match;
    const loading = this.loading.get(matchId);
    if (loading) return loading;
    const promise = this.deps.repository
      .getMatchById(matchId)
      .then((match) => {
        if (match && match.status === 'ACTIVE') this.installActive(match);
        return match;
      })
      .finally(() => {
        this.loading.delete(matchId);
      });
    this.loading.set(matchId, promise);
    return promise;
  }

  private installActive(match: MatchEntity): ActiveGame {
    const existing = this.games.get(match.id);
    if (existing) {
      existing.match = match;
      for (const participant of match.participants) {
        if (participant.userId) this.userMatchIds.set(participant.userId, match.id);
      }
      return existing;
    }
    const game: ActiveGame = {
      match,
      aiTimer: null,
      turnTimer: null,
      cleanupTimer: null,
      disconnectTimers: new Map(),
      disconnectedUsers: new Set(),
      processedActions: new Set(),
    };
    this.games.set(match.id, game);
    for (const participant of match.participants) {
      if (participant.userId) {
        this.userMatchIds.set(participant.userId, match.id);
      }
    }
    this.joinMatchRooms(match);
    return game;
  }

  private launchNewMatch(match: MatchEntity): void {
    const game = this.installActive(match);
    this.scheduleTimers(game);
    this.emitToParticipants(match, 'match:found');
  }

  private launchExistingMatch(match: MatchEntity, event: 'match:found'): void {
    this.installActive(match);
    this.emitToParticipants(match, event);
  }

  private joinMatchRooms(match: MatchEntity): void {
    for (const participant of match.participants) {
      if (!participant.userId) continue;
      this.deps.io.in(userRoom(participant.userId)).socketsJoin(matchRoom(match.id));
    }
  }

  private stateFor(match: MatchEntity, userId: string): PublicMatchState {
    return buildMatchView(match, userId, {
      onlineUserIds: this.online,
      rematch: this.getRematchStatus(match, userId),
      turnTimerPaused: this.isTurnTimerPaused(match),
    });
  }

  private emitState(game: ActiveGame): void {
    this.emitToParticipants(game.match, 'match:state');
  }

  private emitToParticipants(match: MatchEntity, event: 'match:state' | 'match:found' | 'match:finished'): void {
    for (const participant of match.participants) {
      if (!participant.userId) continue;
      const state = this.stateFor(match, participant.userId);
      this.deps.io.to(userRoom(participant.userId)).emit(event, { match: state });
      if (event === 'match:finished') {
        this.recentFinished.set(participant.userId, {
          matchId: match.id,
          expiresAt: this.now().getTime() + RECENT_FINISHED_TTL_MS,
        });
      }
    }
  }

  private emitFinishedToUser(match: MatchEntity, userId: string): void {
    this.deps.io.to(userRoom(userId)).emit('match:finished', { match: this.stateFor(match, userId) });
  }

  private emitOpponentDisconnected(game: ActiveGame, userId: string): void {
    const graceEndsAt = new Date(this.now().getTime() + this.deps.config.disconnectGraceMs).toISOString();
    for (const participant of game.match.participants) {
      if (!participant.userId || participant.userId === userId) continue;
      this.deps.io.to(userRoom(participant.userId)).emit('opponent:disconnected', {
        matchId: game.match.id,
        graceEndsAt,
      });
    }
  }

  private emitOpponentReconnected(game: ActiveGame, userId: string): void {
    for (const participant of game.match.participants) {
      if (!participant.userId || participant.userId === userId) continue;
      this.deps.io.to(userRoom(participant.userId)).emit('opponent:reconnected', {
        matchId: game.match.id,
      });
    }
  }

  private startDisconnectTimer(game: ActiveGame, userId: string): void {
    const existing = game.disconnectTimers.get(userId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      void this.handleDisconnectExpiry(game.match.id, userId);
    }, this.deps.config.disconnectGraceMs);
    timer.unref?.();
    game.disconnectTimers.set(userId, timer);
  }

  private async handleDisconnectExpiry(matchId: string, userId: string): Promise<void> {
    const game = this.games.get(matchId);
    if (!game || game.match.status !== 'ACTIVE') return;
    if (this.online.has(userId)) {
      const timer = game.disconnectTimers.get(userId);
      if (timer) clearTimeout(timer);
      game.disconnectTimers.delete(userId);
      return;
    }
    const disconnected = game.match.participants.find((participant) => participant.userId === userId);
    const opponent = game.match.participants.find(
      (participant) => !participant.isAi && participant.userId !== userId,
    );
    if (!disconnected || !opponent) return;

    if (opponent.userId && this.online.has(opponent.userId)) {
      await this.finishGameWithWinner(game, opponent.side, 'DISCONNECT');
    } else {
      await this.abandonGame(game, 'ABANDONED');
    }
  }

  private scheduleTimers(game: ActiveGame): void {
    if (this.shuttingDown) return;
    this.clearAiTimer(game);
    this.clearTurnTimer(game);
    if (game.match.status !== 'ACTIVE') return;

    const current = game.match.participants.find((participant) => participant.side === game.match.currentTurn);
    if (!current) return;

    if (current.isAi) {
      game.match.turnDeadline = null;
      const human = game.match.participants.find((participant) => !participant.isAi && participant.userId);
      if (!human?.userId || !this.online.has(human.userId)) return;
      const min = Math.min(this.deps.config.aiThinkMinMs, this.deps.config.aiThinkMaxMs);
      const max = Math.max(this.deps.config.aiThinkMinMs, this.deps.config.aiThinkMaxMs);
      const delay = min + Math.floor(this.random() * Math.max(1, max - min));
      game.aiTimer = setTimeout(() => {
        void this.makeAiMove(game.match.id);
      }, delay);
      game.aiTimer.unref?.();
      return;
    }

    if (!current.userId || !this.online.has(current.userId)) {
      game.match.turnDeadline = null;
      return;
    }
    if (this.deps.config.turnTimeoutMs <= 0) {
      game.match.turnDeadline = null;
      return;
    }
    const now = this.now();
    if (!game.match.turnDeadline) {
      game.match.turnDeadline = new Date(now.getTime() + this.deps.config.turnTimeoutMs);
    }
    const remaining = game.match.turnDeadline.getTime() - now.getTime();
    if (remaining <= 0) {
      const side = current.side;
      game.turnTimer = setTimeout(() => this.handleTurnTimeout(game.match.id, side), 0);
    } else {
      const side = current.side;
      game.turnTimer = setTimeout(() => this.handleTurnTimeout(game.match.id, side), remaining);
    }
    game.turnTimer?.unref?.();
  }

  private handleTurnTimeout(matchId: string, side: Side): void {
    const game = this.games.get(matchId);
    if (!game || game.match.status !== 'ACTIVE' || game.match.currentTurn !== side) return;
    const participant = game.match.participants.find((item) => item.side === side);
    if (!participant || participant.isAi) return;
    if (participant.userId && !this.online.has(participant.userId)) return;
    void this.finishGameWithWinner(game, oppositeSide(side), 'TIMEOUT');
  }

  private async makeAiMove(matchId: string): Promise<void> {
    const game = this.games.get(matchId);
    if (!game || game.match.status !== 'ACTIVE') return;
    const ai = game.match.participants.find(
      (participant) => participant.isAi && participant.side === game.match.currentTurn,
    );
    if (!ai || !ai.isAi) return;
    const human = game.match.participants.find((participant) => !participant.isAi && participant.userId);
    if (human?.userId && !this.online.has(human.userId)) return;
    if (this.shuttingDown) return;

    const cell = chooseAiMove(game.match.board, ai.side, ai.aiDifficulty ?? 'MEDIUM', this.random);
    if (cell === null) return;
    const actionId = randomUUID();
    const applied = applyMove(game.match.board, ai.side, cell);
    if (!applied.ok) return;
    const status = getGameStatus(applied.board);
    let finalization: FinalizationData | null = null;
    let winnerSide: Side | null = null;
    let result: MatchResult | null = null;
    let finishReason: FinishReason | null = null;
    if (status.status === 'WON') {
      winnerSide = status.winner;
      result = winnerSide === 'X' ? 'X_WINS' : 'O_WINS';
      finishReason = 'LINE';
    } else if (status.status === 'DRAW') {
      result = 'DRAW';
      finishReason = 'DRAW';
    }
    const now = this.now();
    if (result && finishReason) {
      finalization = { winnerSide, result, finishReason, finishedAt: now, countStats: true };
    }
    const repoResult = await this.deps.repository.recordMove({
      matchId,
      expectedVersion: game.match.version,
      side: ai.side,
      cell,
      actionId,
      boardAfter: applied.board,
      nextTurn: finalization ? null : oppositeSide(ai.side),
      moveNumber: game.match.turnNumber + 1,
      turnDeadline: finalization
        ? null
        : this.deadlineForTurn(game.match.mode, game.match.participants, oppositeSide(ai.side), now),
      lastActivityAt: now,
      finalization,
    });
    game.match = repoResult.match;
    if (repoResult.status === 'applied') {
      game.processedActions.add(actionId);
      this.deps.io.to(matchRoom(matchId)).emit('move:accepted', {
        matchId,
        side: ai.side,
        cell,
        actionId,
        version: repoResult.match.version,
      });
      if (repoResult.match.status === 'FINISHED') {
        this.finishUi(game);
      } else {
        this.scheduleTimers(game);
        this.emitState(game);
      }
    } else if (repoResult.status === 'conflict') {
      this.emitState(game);
    }
  }

  private async finishGameWithWinner(game: ActiveGame, winnerSide: Side, reason: FinishReason): Promise<void> {
    const result: MatchResult = winnerSide === 'X' ? 'X_WINS' : 'O_WINS';
    const finalization: FinalizationData = {
      winnerSide,
      result,
      finishReason: reason,
      finishedAt: this.now(),
      countStats: true,
    };
    const repoResult = await this.deps.repository.finalizeMatch({
      matchId: game.match.id,
      expectedVersion: game.match.version,
      finalization,
      lastActivityAt: finalization.finishedAt,
    });
    if (repoResult.status === 'applied') {
      game.match = repoResult.match;
      this.finishUi(game);
    } else {
      game.match = repoResult.match;
      if (game.match.status === 'FINISHED') {
        this.finishUi(game);
      } else {
        this.emitState(game);
      }
    }
  }

  private async abandonGame(game: ActiveGame, reason: FinishReason): Promise<void> {
    const abandoned = await this.deps.repository.abandonMatch({
      matchId: game.match.id,
      expectedVersion: game.match.version,
      finishReason: reason,
      finishedAt: this.now(),
      statuses: ['ACTIVE'],
    });
    if (abandoned) game.match = abandoned;
    this.clearAllGameTimers(game);
    this.removeUserMatch(game.match);
    this.emitToParticipants(game.match, 'match:state');
  }

  private finishUi(game: ActiveGame): void {
    this.clearAllGameTimers(game);
    this.removeUserMatch(game.match);
    this.emitToParticipants(game.match, 'match:finished');
    this.deps.logger.info(
      {
        event: 'game_finished',
        matchId: game.match.id,
        mode: game.match.mode,
        result: game.match.result,
        reason: game.match.finishReason,
      },
      'Game finished',
    );
    game.cleanupTimer = setTimeout(() => {
      if (this.games.get(game.match.id) === game) {
        this.games.delete(game.match.id);
      }
      const tracker = this.rematches.get(game.match.id);
      if (tracker) this.deleteRematchTracker(tracker);
    }, FINISHED_GAME_TTL_MS);
    game.cleanupTimer.unref?.();
  }

  private removeUserMatch(match: MatchEntity): void {
    for (const participant of match.participants) {
      if (!participant.userId) continue;
      if (this.userMatchIds.get(participant.userId) === match.id) {
        this.userMatchIds.delete(participant.userId);
      }
    }
  }

  private isTurnTimerPaused(match: MatchEntity): boolean {
    if (match.status !== 'ACTIVE' || this.deps.config.turnTimeoutMs <= 0 || !match.currentTurn) return false;
    const current = match.participants.find((participant) => participant.side === match.currentTurn);
    if (!current || current.isAi || !current.userId) return false;
    return !this.online.has(current.userId);
  }

  private deadlineForTurn(
    mode: MatchEntity['mode'],
    participants: Array<Pick<ParticipantEntity, 'side' | 'isAi' | 'userId'>>,
    turn: Side | null,
    now: Date,
  ): Date | null {
    if (!turn || this.deps.config.turnTimeoutMs <= 0) return null;
    const participant = participants.find((item) => item.side === turn);
    if (!participant || participant.isAi || !participant.userId) return null;
    if (!this.online.has(participant.userId)) return null;
    if (mode === 'AI' && participant.isAi) return null;
    return new Date(now.getTime() + this.deps.config.turnTimeoutMs);
  }

  private getRematchStatus(match: MatchEntity, userId: string): RematchStatus {
    if (match.status !== 'FINISHED') {
      return {
        available: false,
        requestedByYou: false,
        requestedByOpponent: false,
        expiresAt: null,
      };
    }
    if (match.mode === 'AI') {
      return {
        available: true,
        requestedByYou: false,
        requestedByOpponent: false,
        expiresAt: null,
      };
    }
    const finishedAt = match.finishedAt?.getTime();
    if (!finishedAt) {
      return { available: false, requestedByYou: false, requestedByOpponent: false, expiresAt: null };
    }
    const tracker = this.rematches.get(match.id);
    const expiresAt = new Date(finishedAt + REMATCH_WINDOW_MS);
    const withinWindow = this.now().getTime() <= expiresAt.getTime();
    const participantIds = match.participants
      .map((participant) => participant.userId)
      .filter((id): id is string => Boolean(id));
    const requestedByYou = Boolean(tracker?.requests.has(userId));
    const requestedByOpponent = participantIds.some(
      (id) => id !== userId && Boolean(tracker?.requests.has(id)),
    );
    return {
      available: withinWindow && participantIds.length === 2,
      requestedByYou,
      requestedByOpponent,
      expiresAt: withinWindow ? expiresAt.toISOString() : null,
    };
  }

  private emitRematchStatus(match: MatchEntity, tracker: RematchTracker): void {
    for (const participant of match.participants) {
      if (!participant.userId) continue;
      this.deps.io.to(userRoom(participant.userId)).emit('rematch:status', {
        matchId: match.id,
        rematch: {
          available: this.now().getTime() <= tracker.expiresAt.getTime(),
          requestedByYou: tracker.requests.has(participant.userId),
          requestedByOpponent: tracker.requests.size > 0 && !tracker.requests.has(participant.userId),
          expiresAt: tracker.expiresAt.toISOString(),
        },
      });
    }
  }

  private expireRematchTracker(matchId: string): void {
    const tracker = this.rematches.get(matchId);
    if (!tracker) return;
    this.rematches.delete(matchId);
    const game = this.games.get(matchId);
    if (!game) return;
    for (const participant of game.match.participants) {
      if (!participant.userId) continue;
      this.deps.io.to(userRoom(participant.userId)).emit('rematch:status', {
        matchId,
        rematch: {
          available: false,
          requestedByYou: tracker.requests.has(participant.userId),
          requestedByOpponent: tracker.requests.size > 0 && !tracker.requests.has(participant.userId),
          expiresAt: null,
        },
      });
    }
  }

  private deleteRematchTracker(tracker: RematchTracker): void {
    if (tracker.timer) clearTimeout(tracker.timer);
    this.rematches.delete(tracker.matchId);
  }

  private clearAiTimer(game: ActiveGame): void {
    if (game.aiTimer) clearTimeout(game.aiTimer);
    game.aiTimer = null;
  }

  private clearTurnTimer(game: ActiveGame): void {
    if (game.turnTimer) clearTimeout(game.turnTimer);
    game.turnTimer = null;
  }

  private clearAllGameTimers(game: ActiveGame): void {
    this.clearAiTimer(game);
    this.clearTurnTimer(game);
    for (const timer of game.disconnectTimers.values()) clearTimeout(timer);
    game.disconnectTimers.clear();
    if (game.cleanupTimer) clearTimeout(game.cleanupTimer);
    game.cleanupTimer = null;
  }

  private toInvitePreview(invitation: InvitationWithMatch, userId: string): InvitePreview {
    const youAreInviter = invitation.inviterId === userId;
    return {
      status: invitation.status,
      inviter: {
        displayName: invitation.inviter.firstName,
        username: invitation.inviter.username,
        photoUrl: invitation.inviter.photoUrl,
      },
      expiresAt: invitation.expiresAt.toISOString(),
      youAreInviter,
      yourSide: youAreInviter ? 'X' : 'O',
      matchId: invitation.matchId,
      matchStatus: invitation.match.status,
    };
  }

  private async requireUser(userId: string): Promise<UserEntity> {
    const user = await this.deps.repository.getUserById(userId);
    if (!user) throw new AppError(404, 'NOT_FOUND', 'Player not found');
    return user;
  }
}

function participantFromUser(user: UserEntity, side: Side) {
  return {
    userId: user.id,
    side,
    isAi: false,
    aiDifficulty: null,
    displayName: user.firstName,
    username: user.username,
    photoUrl: user.photoUrl,
  };
}
