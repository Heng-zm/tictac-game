import { describe, expect, it } from 'vitest';
import type { LeaderboardRow, StatsEntity } from '../src/server/database/types';
import { toLeaderboardResponse } from '../src/server/services/profile';

function stats(overrides: Partial<StatsEntity> = {}): StatsEntity {
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
    ...overrides,
  };
}

function row(id: string, overrides: Partial<StatsEntity> = {}): LeaderboardRow {
  return {
    user: {
      id,
      firstName: id,
      lastName: null,
      username: null,
      photoUrl: null,
    },
    stats: stats(overrides),
  };
}

describe('leaderboard response', () => {
  it('gives tied players the same rank and skips the next position', () => {
    const rows = [
      row('a', { rating: 1020, wins: 3, ratingGames: 5 }),
      row('b', { rating: 1020, wins: 3, ratingGames: 5 }),
      row('c', { rating: 1000, wins: 1, ratingGames: 2 }),
    ];

    const response = toLeaderboardResponse(rows, 'b', 1);

    expect(response.entries.map((entry) => entry.rank)).toEqual([1, 1, 3]);
    expect(response.entries[1]?.isYou).toBe(true);
    expect(response.currentUserRank).toBe(1);
  });

  it('reports human-only records so bot games cannot pad the ladder', () => {
    const rows = [
      row('a', {
        rating: 1020,
        ratingGames: 9,
        wins: 9,
        losses: 4,
        draws: 2,
        aiWins: 4,
        aiLosses: 1,
        aiDraws: 1,
        humanGames: 9,
      }),
    ];

    const entry = toLeaderboardResponse(rows, 'a', 1).entries[0]!;

    expect(entry).toMatchObject({
      humanWins: 5,
      humanLosses: 3,
      humanDraws: 1,
      ratedGames: 9,
    });
  });
});
