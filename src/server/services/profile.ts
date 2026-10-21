import {
  computeWinRate,
  type HistoryItem,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type UserProfile,
  type UserStats,
} from '../../shared/game-types';
import type { LeaderboardRow, MatchEntity, StatsEntity, UserEntity } from '../database/types';

export function toUserProfile(user: UserEntity): UserProfile {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    photoUrl: user.photoUrl,
    autoAiFallback: user.autoAiFallback,
    stats: withWinRate(user.stats),
  };
}

export function withWinRate(stats: StatsEntity): UserStats {
  const shared = {
    ...stats,
    winRate: computeWinRate(stats),
  };
  return shared;
}

export function toHistoryItem(match: MatchEntity, userId: string): HistoryItem {
  const you = match.participants.find((participant) => participant.userId === userId);
  if (!you) {
    throw new Error('Cannot build history for a non-participant');
  }
  const opponent = match.participants.find((participant) => participant.side !== you.side);
  if (!opponent) {
    throw new Error('Match is missing an opponent');
  }
  return {
    matchId: match.id,
    mode: match.mode,
    opponent: {
      displayName: opponent.displayName,
      username: opponent.username,
      photoUrl: opponent.photoUrl,
      isAi: opponent.isAi,
      aiDifficulty: opponent.aiDifficulty,
    },
    outcome: you.outcome ?? 'ABANDONED',
    matchResult: match.result,
    finishReason: match.finishReason,
    playedAt: (match.finishedAt ?? match.lastActivityAt).toISOString(),
  };
}

export function toLeaderboardResponse(
  rows: LeaderboardRow[],
  currentUserId: string,
  currentUserRank: number | null,
): LeaderboardResponse {
  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    userId: row.user.id,
    displayName: row.user.firstName,
    username: row.user.username,
    photoUrl: row.user.photoUrl,
    rating: row.stats.rating,
    ratedGames: row.stats.ratingGames,
    wins: row.stats.wins,
    losses: row.stats.losses,
    draws: row.stats.draws,
    gamesPlayed: row.stats.gamesPlayed,
    isYou: row.user.id === currentUserId,
  }));
  return { entries, currentUserRank };
}
