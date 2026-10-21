export type RankTier = 'rookie' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master';

export interface RankStep {
  tier: RankTier;
  name: string;
  minRating: number;
}

export interface RankInfo extends RankStep {
  nextRank: RankStep | null;
  progress: number;
  pointsToNext: number;
}

const RANKS: readonly RankStep[] = [
  { tier: 'rookie', name: 'Rookie', minRating: 0 },
  { tier: 'bronze', name: 'Bronze', minRating: 1000 },
  { tier: 'silver', name: 'Silver', minRating: 1100 },
  { tier: 'gold', name: 'Gold', minRating: 1200 },
  { tier: 'platinum', name: 'Platinum', minRating: 1350 },
  { tier: 'diamond', name: 'Diamond', minRating: 1500 },
  { tier: 'master', name: 'Master', minRating: 1750 },
];

/**
 * Derives the ladder tier from the public rating. This is display-only; the
 * server remains the source of truth for the rating itself.
 */
export function rankForRating(rating: number): RankInfo {
  const safeRating = Number.isFinite(rating) ? Math.max(0, Math.round(rating)) : 0;
  let index = 0;

  for (let candidate = 1; candidate < RANKS.length; candidate += 1) {
    const step = RANKS[candidate];
    if (!step || safeRating < step.minRating) break;
    index = candidate;
  }

  const rank = RANKS[index] ?? RANKS[0]!;
  const nextRank = RANKS[index + 1] ?? null;

  if (!nextRank) {
    return { ...rank, nextRank, progress: 1, pointsToNext: 0 };
  }

  const span = nextRank.minRating - rank.minRating;
  const progress = Math.min(1, Math.max(0, (safeRating - rank.minRating) / span));

  return {
    ...rank,
    nextRank,
    progress,
    pointsToNext: Math.max(0, nextRank.minRating - safeRating),
  };
}
