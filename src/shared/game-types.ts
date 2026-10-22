export const PROTOCOL_VERSION = 1 as const;

export const SIDES = ['X', 'O'] as const;
export type Side = (typeof SIDES)[number];
export type Cell = Side | null;
export type Board = Record<number, Side>;

export type MatchMode = 'RANDOM' | 'FRIEND' | 'AI';
export type MatchStatus = 'WAITING' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type MatchResult = 'X_WINS' | 'O_WINS' | 'DRAW';
export type FinishReason =
  | 'LINE'
  | 'DRAW'
  | 'FORFEIT'
  | 'DISCONNECT'
  | 'TIMEOUT'
  | 'SERVER_SHUTDOWN'
  | 'CANCELLED'
  | 'ABANDONED';
export type AiDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type ParticipantOutcome = 'WIN' | 'LOSS' | 'DRAW';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';

export const COORD_OFFSET = 10_000;
export const COORD_STRIDE = 20_000;

export function encodeCell(x: number, y: number): number {
  return (y + COORD_OFFSET) * COORD_STRIDE + (x + COORD_OFFSET);
}

export function decodeCell(cell: number): { x: number; y: number } {
  const x = (cell % COORD_STRIDE) - COORD_OFFSET;
  const y = Math.floor(cell / COORD_STRIDE) - COORD_OFFSET;
  return { x, y };
}

/**
 * The encoded grid is the half-open square [-COORD_OFFSET, COORD_OFFSET) on
 * both axes. Using the same bound on the positive and negative sides would
 * make `encodeCell(COORD_OFFSET, y)` alias `encodeCell(-COORD_OFFSET, y + 1)`,
 * so coordinate scans could wrap to the opposite edge.
 */
export function isInBounds(x: number, y: number): boolean {
  return x >= -COORD_OFFSET && x < COORD_OFFSET && y >= -COORD_OFFSET && y < COORD_OFFSET;
}

export function createEmptyBoard(): Board {
  return {};
}

export function boardToString(board: Board): string {
  return JSON.stringify(board);
}

export function boardFromString(value: string): Board {
  if (!value || value === '{}' || value === '.........') return {};
  if (value.startsWith('{')) {
    try {
      return JSON.parse(value) as Board;
    } catch {
      return {};
    }
  }
  // Backward compatibility with legacy 9-character 3x3 boards
  const board: Board = {};
  for (let i = 0; i < Math.min(value.length, 9); i++) {
    const ch = value[i];
    if (ch === 'X' || ch === 'O') {
      const x = (i % 3) - 1;
      const y = Math.floor(i / 3) - 1;
      board[encodeCell(x, y)] = ch as Side;
    }
  }
  return board;
}

export function oppositeSide(side: Side): Side {
  return side === 'X' ? 'O' : 'X';
}

export function otherPlayerName(name: string): string {
  return name.trim().slice(0, 64) || 'Player';
}

export interface PublicPlayer {
  side: Side;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  isAi: boolean;
  aiDifficulty: AiDifficulty | null;
  isYou: boolean;
  connected: boolean;
}

export interface RematchStatus {
  available: boolean;
  requestedByYou: boolean;
  requestedByOpponent: boolean;
  expiresAt: string | null;
}

export interface PublicMatchState {
  protocol: typeof PROTOCOL_VERSION;
  id: string;
  mode: MatchMode;
  status: MatchStatus;
  board: Board;
  currentTurn: Side | null;
  turnNumber: number;
  lastMove: { cell: number; side: Side } | null;
  version: number;
  youSide: Side;
  players: Record<Side, PublicPlayer | null>;
  winnerSide: Side | null;
  result: MatchResult | null;
  finishReason: FinishReason | null;
  startedAt: string;
  finishedAt: string | null;
  turnDeadline: string | null;
  turnTimerPaused: boolean;
  opponentConnection: 'connected' | 'disconnected' | 'left' | 'not_applicable';
  rematch: RematchStatus;
}

export type QueueStateName = 'searching' | 'matched' | 'cancelled' | 'expired' | 'error';

export interface QueueStatus {
  state: QueueStateName;
  mode: MatchMode;
  elapsedMs: number;
  fallbackAt: string | null;
  fallbackAvailable: boolean;
  autoFallback: boolean;
  waitingPlayers: number;
  message?: string;
}

export interface InvitePreview {
  status: InvitationStatus;
  inviter: {
    displayName: string;
    username: string | null;
    photoUrl: string | null;
  };
  expiresAt: string;
  youAreInviter: boolean;
  yourSide: Side;
  matchId: string;
  matchStatus: MatchStatus;
}

export interface CreatedInvitation {
  id: string;
  deepLink: string;
  expiresAt: string;
  matchId: string;
}

export interface PendingInvitation {
  id: string;
  matchId: string;
  expiresAt: string;
  status: InvitationStatus;
}

export interface UserStats {
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
  winRate: number;
}

export interface UserProfile {
  id: string;
  firstName: string;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  autoAiFallback: boolean;
  turnNotifications: boolean;
  stats: UserStats;
}

export interface HistoryItem {
  matchId: string;
  mode: MatchMode;
  opponent: {
    displayName: string;
    username: string | null;
    photoUrl: string | null;
    isAi: boolean;
    aiDifficulty: AiDifficulty | null;
  };
  outcome: ParticipantOutcome | 'ABANDONED';
  matchResult: MatchResult | null;
  finishReason: FinishReason | null;
  playedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  username: string | null;
  photoUrl: string | null;
  rating: number;
  ratedGames: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
  isYou: boolean;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  currentUserRank: number | null;
}

export interface AppConfigPayload {
  protocol: typeof PROTOCOL_VERSION;
  botUsername: string | null;
  botAppName?: string | null;
  miniAppUrl: string | null;
  devAuthEnabled: boolean;
  demoMode: boolean;
  environment: 'development' | 'test' | 'production';
  queueAiTimeoutMs: number;
  queueMaxWaitMs: number;
  turnTimeoutMs: number;
  disconnectGraceMs: number;
  inviteTtlMinutes: number;
  aiFallbackDifficulty: AiDifficulty;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
}

export interface SocketAckError {
  code: string;
  message: string;
  requestId?: string;
}

export type SocketAck<T> = { ok: true; data: T } | { ok: false; error: SocketAckError };

export interface HelloPayload {
  protocol: typeof PROTOCOL_VERSION;
  serverTime: string;
  user: UserProfile;
}

export function computeWinRate(stats: Pick<UserStats, 'wins' | 'gamesPlayed'>): number {
  if (stats.gamesPlayed <= 0) return 0;
  return Math.round((stats.wins / stats.gamesPlayed) * 1000) / 10;
}
