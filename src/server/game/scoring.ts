import type { MatchMode, ParticipantOutcome, Side, UserStats } from '../../shared/game-types';

export type StatsDelta = Pick<
  UserStats,
  | 'gamesPlayed'
  | 'wins'
  | 'losses'
  | 'draws'
  | 'humanGames'
  | 'aiGames'
  | 'aiWins'
  | 'aiLosses'
  | 'aiDraws'
  | 'ratingGames'
>;

export function outcomeForSide(side: Side, winnerSide: Side | null): ParticipantOutcome | null {
  if (winnerSide === null) {
    return 'DRAW';
  }
  return side === winnerSide ? 'WIN' : 'LOSS';
}

export function isRatedMode(mode: MatchMode): boolean {
  return mode === 'RANDOM' || mode === 'FRIEND';
}

/**
 * Elo-independent ladder: rated human wins +20, losses -20, and draws 0.
 * The signs are symmetric so a rated game is zero-sum between the two players.
 * AI games never alter rating; incomplete games never reach this function.
 */
export function ratingDeltaFor(mode: MatchMode, outcome: ParticipantOutcome): number {
  if (!isRatedMode(mode)) return 0;
  return outcome === 'WIN' ? 20 : outcome === 'DRAW' ? 0 : -20;
}

// Pre-computed stat deltas for each (mode, outcome) combination
// Index: mode (0=RANDOM, 1=FRIEND, 2=AI) * 3 + outcome (0=WIN, 1=LOSS, 2=DRAW)
// Note: AI games track both general (wins/losses/draws) and AI-specific stats
const STAT_DELTAS: ReadonlyArray<StatsDelta> = [
  // RANDOM WIN
  { gamesPlayed: 1, wins: 1, losses: 0, draws: 0, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // RANDOM LOSS
  { gamesPlayed: 1, wins: 0, losses: 1, draws: 0, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // RANDOM DRAW
  { gamesPlayed: 1, wins: 0, losses: 0, draws: 1, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // FRIEND WIN
  { gamesPlayed: 1, wins: 1, losses: 0, draws: 0, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // FRIEND LOSS
  { gamesPlayed: 1, wins: 0, losses: 1, draws: 0, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // FRIEND DRAW
  { gamesPlayed: 1, wins: 0, losses: 0, draws: 1, humanGames: 1, aiGames: 0, aiWins: 0, aiLosses: 0, aiDraws: 0, ratingGames: 1 },
  // AI WIN - has both general wins and AI-specific wins
  { gamesPlayed: 1, wins: 1, losses: 0, draws: 0, humanGames: 0, aiGames: 1, aiWins: 1, aiLosses: 0, aiDraws: 0, ratingGames: 0 },
  // AI LOSS - has both general losses and AI-specific losses
  { gamesPlayed: 1, wins: 0, losses: 1, draws: 0, humanGames: 0, aiGames: 1, aiWins: 0, aiLosses: 1, aiDraws: 0, ratingGames: 0 },
  // AI DRAW - has both general draws and AI-specific draws
  { gamesPlayed: 1, wins: 0, losses: 0, draws: 1, humanGames: 0, aiGames: 1, aiWins: 0, aiLosses: 0, aiDraws: 1, ratingGames: 0 },
];

function modeIndex(mode: MatchMode): number {
  return mode === 'RANDOM' ? 0 : mode === 'FRIEND' ? 1 : 2;
}

function outcomeIndex(outcome: ParticipantOutcome): number {
  return outcome === 'WIN' ? 0 : outcome === 'LOSS' ? 1 : 2;
}

export function emptyStatsDelta(): StatsDelta {
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
    ratingGames: 0,
  };
}

export function statsDeltaFor(mode: MatchMode, outcome: ParticipantOutcome): StatsDelta {
  const delta = STAT_DELTAS[modeIndex(mode) * 3 + outcomeIndex(outcome)];
  // Indices are guaranteed valid by MatchMode and ParticipantOutcome types
  return delta!;
}