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
    // A draw is represented by a null winner; callers only use this for completed draws.
    return 'DRAW';
  }
  return side === winnerSide ? 'WIN' : 'LOSS';
}

export function isRatedMode(mode: MatchMode): boolean {
  return mode === 'RANDOM' || mode === 'FRIEND';
}

/**
 * Elo-independent ladder: rated human wins +20, draws +5, losses -10.
 * AI games never alter rating; incomplete games never reach this function.
 */
export function ratingDeltaFor(mode: MatchMode, outcome: ParticipantOutcome): number {
  if (!isRatedMode(mode)) return 0;
  if (outcome === 'WIN') return 20;
  if (outcome === 'DRAW') return 5;
  return -10;
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
  const delta = emptyStatsDelta();
  delta.gamesPlayed = 1;
  if (outcome === 'WIN') delta.wins = 1;
  else if (outcome === 'LOSS') delta.losses = 1;
  else delta.draws = 1;

  if (isRatedMode(mode)) {
    delta.humanGames = 1;
    delta.ratingGames = 1;
  } else {
    delta.aiGames = 1;
    if (outcome === 'WIN') delta.aiWins = 1;
    else if (outcome === 'LOSS') delta.aiLosses = 1;
    else delta.aiDraws = 1;
  }
  return delta;
}
