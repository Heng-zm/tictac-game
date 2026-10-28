import { describe, expect, it } from 'vitest';
import { AI_TAUNTS, pickAiTaunt, type AiTauntMood } from '../src/server/game/ai-taunts';

const MOODS: AiTauntMood[] = ['greeting', 'reply', 'block', 'threat', 'win', 'lose', 'draw'];

describe('AI taunts', () => {
  it('keeps a non-empty line for every mood in both languages', () => {
    for (const mood of MOODS) {
      expect(AI_TAUNTS[mood].en.length).toBeGreaterThan(0);
      expect(AI_TAUNTS[mood].km.length).toBeGreaterThan(0);
    }
  });

  it('uses English by default', () => {
    expect(pickAiTaunt('win', 'en', () => 0)).toBe(AI_TAUNTS.win.en[0]);
    expect(pickAiTaunt('win', undefined, () => 0)).toBe(AI_TAUNTS.win.en[0]);
    expect(pickAiTaunt('win', 'fr', () => 0)).toBe(AI_TAUNTS.win.en[0]);
  });

  it('uses Khmer for Khmer-speaking players', () => {
    expect(pickAiTaunt('greeting', 'km', () => 0)).toBe(AI_TAUNTS.greeting.km[0]);
    expect(pickAiTaunt('greeting', 'km-KH', () => 0)).toBe(AI_TAUNTS.greeting.km[0]);
  });

  it('always returns a line even when the random source is out of range', () => {
    expect(pickAiTaunt('reply', 'en', () => 1)).toBe(
      AI_TAUNTS.reply.en[AI_TAUNTS.reply.en.length - 1],
    );
    expect(pickAiTaunt('reply', 'en', () => -1)).toBe(AI_TAUNTS.reply.en[0]);
  });
});
