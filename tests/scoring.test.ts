import { describe, expect, it } from 'vitest';
import {
  emptyStatsDelta,
  isRatedMode,
  outcomeForSide,
  ratingDeltaFor,
  statsDeltaFor,
} from '../src/server/game/scoring';

describe('scoring', () => {
  it('marks rated modes', () => {
    expect(isRatedMode('RANDOM')).toBe(true);
    expect(isRatedMode('FRIEND')).toBe(true);
    expect(isRatedMode('AI')).toBe(false);
  });

  it('derives outcomes from the winner side', () => {
    expect(outcomeForSide('X', 'X')).toBe('WIN');
    expect(outcomeForSide('O', 'X')).toBe('LOSS');
    expect(outcomeForSide('O', null)).toBe('DRAW');
  });

  it('applies the documented rating ladder only to human games', () => {
    expect(ratingDeltaFor('RANDOM', 'WIN')).toBe(20);
    expect(ratingDeltaFor('FRIEND', 'WIN')).toBe(20);
    expect(ratingDeltaFor('RANDOM', 'DRAW')).toBe(5);
    expect(ratingDeltaFor('FRIEND', 'DRAW')).toBe(5);
    expect(ratingDeltaFor('RANDOM', 'LOSS')).toBe(-10);
    expect(ratingDeltaFor('AI', 'WIN')).toBe(0);
    expect(ratingDeltaFor('AI', 'LOSS')).toBe(0);
    expect(ratingDeltaFor('AI', 'DRAW')).toBe(0);
  });

  it('builds human statistics deltas', () => {
    expect(statsDeltaFor('RANDOM', 'WIN')).toEqual({
      gamesPlayed: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      humanGames: 1,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      ratingGames: 1,
    });
    expect(statsDeltaFor('FRIEND', 'DRAW')).toMatchObject({
      gamesPlayed: 1,
      draws: 1,
      humanGames: 1,
      ratingGames: 1,
    });
    expect(statsDeltaFor('RANDOM', 'LOSS')).toMatchObject({
      losses: 1,
      humanGames: 1,
      ratingGames: 1,
    });
  });

  it('builds AI statistics deltas without rating changes', () => {
    expect(statsDeltaFor('AI', 'WIN')).toMatchObject({
      gamesPlayed: 1,
      wins: 1,
      aiGames: 1,
      aiWins: 1,
      ratingGames: 0,
    });
    expect(statsDeltaFor('AI', 'LOSS')).toMatchObject({
      losses: 1,
      aiGames: 1,
      aiLosses: 1,
      ratingGames: 0,
    });
    expect(statsDeltaFor('AI', 'DRAW')).toMatchObject({
      draws: 1,
      aiGames: 1,
      aiDraws: 1,
      ratingGames: 0,
    });
  });

  it('provides an empty delta', () => {
    expect(Object.values(emptyStatsDelta()).every((value) => value === 0)).toBe(true);
  });
});
