import type {
  AiDifficulty,
  Board,
  FinishReason,
  InvitationStatus,
  MatchMode,
  MatchResult,
  MatchStatus,
  ParticipantOutcome,
  Side,
} from '../../shared/game-types';

export interface StatsEntity {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  humanGames: number;
  aiGames: number;
  aiWins: number;
  aiLosses: number;
  aiDraws: number;
  rating: number;
  ratingGames: number;
}

export interface UserEntity {
  id: string;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  photoUrl: string | null;
  languageCode: string | null;
  autoAiFallback: boolean;
  turnNotifications: boolean;
  activeMatchId: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  stats: StatsEntity;
}

export interface UserLite {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
}

export interface ParticipantEntity {
  id: string;
  matchId: string;
  userId: string | null;
  side: Side;
  isAi: boolean;
  aiDifficulty: AiDifficulty | null;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  outcome: ParticipantOutcome | null;
  ratingDelta: number;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface MatchEntity {
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  board: Board;
  currentTurn: Side | null;
  turnNumber: number;
  lastMove: { cell: number; side: Side } | null;
  winnerSide: Side | null;
  result: MatchResult | null;
  finishReason: FinishReason | null;
  turnDeadline: Date | null;
  rematchOfId: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  lastActivityAt: Date;
  version: number;
  createdAt: Date;
  participants: ParticipantEntity[];
}

export interface InvitationEntity {
  id: string;
  tokenHash: string;
  inviterId: string;
  matchId: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedById: string | null;
  acceptedAt: Date | null;
  createdAt: Date;
}

export interface InvitationWithMatch extends InvitationEntity {
  match: MatchEntity;
  inviter: UserLite;
}

export interface NewParticipant {
  userId: string | null;
  side: Side;
  isAi: boolean;
  aiDifficulty?: AiDifficulty | null;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
}

export interface CreateMatchInput {
  mode: MatchMode;
  status: 'ACTIVE' | 'WAITING';
  participants: NewParticipant[];
  currentTurn: Side | null;
  turnDeadline: Date | null;
  /** Service clock at match creation. Defaults to the repository clock. */
  startedAt?: Date;
  rematchOfId?: string | null;
}

export interface CreateInvitationInput {
  host: UserEntity;
  tokenHash: string;
  expiresAt: Date;
  displayName: string;
}

export interface RecordMoveInput {
  matchId: string;
  expectedVersion: number;
  side: Side;
  cell: number;
  actionId: string;
  boardAfter: Board;
  nextTurn: Side | null;
  moveNumber: number;
  turnDeadline: Date | null;
  lastActivityAt: Date;
  finalization?: FinalizationData | null;
}

export interface FinalizationData {
  winnerSide: Side | null;
  result: MatchResult;
  finishReason: FinishReason;
  finishedAt: Date;
  countStats: boolean;
}

export interface FinalizeMatchInput {
  matchId: string;
  expectedVersion: number;
  finalization: FinalizationData;
  lastActivityAt: Date;
}

export interface AbandonMatchInput {
  matchId: string;
  expectedVersion?: number;
  finishReason: FinishReason;
  finishedAt: Date;
  statuses?: Array<'WAITING' | 'ACTIVE'>;
}

export interface RepositoryMoveResult {
  status: 'applied' | 'duplicate' | 'conflict';
  match: MatchEntity;
}

export interface RepositoryFinalizeResult {
  status: 'applied' | 'conflict';
  match: MatchEntity;
}

export type AcceptInvitationStatus =
  | 'accepted'
  | 'not_found'
  | 'expired'
  | 'already_used'
  | 'self'
  | 'cancelled'
  | 'acceptor_busy';

export interface AcceptInvitationResult {
  status: AcceptInvitationStatus;
  match?: MatchEntity;
}

export type CancelInvitationStatus = 'cancelled' | 'not_found' | 'forbidden' | 'not_pending';

export interface CancelInvitationResult {
  status: CancelInvitationStatus;
}

export interface TelegramProfileInput {
  telegramId: bigint;
  firstName: string;
  lastName?: string | null;
  username?: string | null;
  photoUrl?: string | null;
  languageCode?: string | null;
}

export interface RecentMatchPage {
  matches: MatchEntity[];
  nextCursor: string | null;
}

export interface LeaderboardRow {
  user: UserLite;
  stats: StatsEntity;
}

export interface MaintenanceSummary {
  expiredInvitations: number;
  abandonedMatches: number;
  deletedInvitations: number;
  repairedReservations: number;
}

export interface GameRepository {
  ready(): Promise<boolean>;
  close(): Promise<void>;

  upsertTelegramUser(profile: TelegramProfileInput): Promise<UserEntity>;
  getUserById(id: string): Promise<UserEntity | null>;
  setAutoAiFallback(userId: string, value: boolean): Promise<UserEntity>;
  setTurnNotifications(userId: string, value: boolean): Promise<UserEntity>;
  touchUser(userId: string): Promise<void>;
  clearUserReservation(userId: string, matchId?: string): Promise<void>;

  createMatch(input: CreateMatchInput): Promise<MatchEntity>;
  createInvitationMatch(input: CreateInvitationInput): Promise<{ match: MatchEntity; invitation: InvitationEntity }>;
  getMatchById(matchId: string): Promise<MatchEntity | null>;
  getReservationMatch(userId: string): Promise<MatchEntity | null>;
  recordMove(input: RecordMoveInput): Promise<RepositoryMoveResult>;
  hasProcessedAction(matchId: string, actionId: string): Promise<boolean>;
  finalizeMatch(input: FinalizeMatchInput): Promise<RepositoryFinalizeResult>;
  abandonMatch(input: AbandonMatchInput): Promise<MatchEntity | null>;

  getInvitationByTokenHash(tokenHash: string): Promise<InvitationWithMatch | null>;
  getInvitationById(invitationId: string): Promise<InvitationWithMatch | null>;
  getPendingInvitationForUser(userId: string): Promise<InvitationWithMatch | null>;
  acceptInvitation(tokenHash: string, acceptor: UserEntity, turnDeadline: Date | null): Promise<AcceptInvitationResult>;
  cancelInvitation(invitationId: string, inviterId: string): Promise<CancelInvitationResult>;
  expireInvitation(invitationId: string): Promise<void>;

  getRecentMatches(userId: string, limit: number, cursor?: string): Promise<RecentMatchPage>;
  getLeaderboard(limit: number): Promise<LeaderboardRow[]>;
  getUserRank(userId: string): Promise<number | null>;

  runMaintenance(now: Date, staleAfterMs: number): Promise<MaintenanceSummary>;
}
