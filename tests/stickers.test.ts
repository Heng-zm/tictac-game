import { describe, expect, it } from 'vitest';
import {
  STICKER_IDS,
  STICKER_LIST,
  STICKER_REGISTRY,
  getSticker,
  getStickerLabel,
  isValidStickerId,
  type StickerId,
} from '../src/shared/stickers';
import { matchChatSchema, matchReactionSchema } from '../src/shared/schemas/payloads';
import { CHAT_MESSAGE_MAX_LENGTH } from '../src/shared/events';

describe('Sticker Registry & Metadata', () => {
  it('contains exactly the 12 requested animated character reactions', () => {
    expect(STICKER_IDS).toHaveLength(12);
    expect(STICKER_LIST).toHaveLength(12);
    const expectedIds: StickerId[] = [
      'victory',
      'greeting',
      'laughing',
      'shocked',
      'crying',
      'frustrated',
      'thinking',
      'clapping',
      'respect',
      'teasing',
      'good_game',
      'rematch_invite',
    ];
    expect([...STICKER_IDS].sort()).toEqual([...expectedIds].sort());
  });

  it('guarantees no emoji characters or surrogate pairs are used in sticker IDs', () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;
    for (const id of STICKER_IDS) {
      expect(emojiRegex.test(id)).toBe(false);
      const sticker = getSticker(id);
      expect(emojiRegex.test(sticker.name)).toBe(false);
    }
  });

  it('provides complete metadata for every sticker with EN and KM quick chat translations', () => {
    for (const id of STICKER_IDS) {
      const sticker = STICKER_REGISTRY[id];
      expect(sticker).toBeDefined();
      expect(sticker.id).toBe(id);
      expect(sticker.name.trim().length).toBeGreaterThan(0);
      expect(['chat', 'emotion', 'tactics']).toContain(sticker.category);
      expect(sticker.durationMs).toBeGreaterThan(1000);

      // Check localization
      expect(sticker.label.en.trim().length).toBeGreaterThan(0);
      expect(sticker.label.km.trim().length).toBeGreaterThan(0);

      // Test helper functions
      expect(getStickerLabel(id, 'en')).toBe(sticker.label.en);
      expect(getStickerLabel(id, 'km')).toBe(sticker.label.km);
      expect(getStickerLabel(id, 'km-KH')).toBe(sticker.label.km);
      expect(getStickerLabel(id, undefined)).toBe(sticker.label.en);
    }
  });

  it('correctly validates sticker IDs with isValidStickerId', () => {
    expect(isValidStickerId('victory')).toBe(true);
    expect(isValidStickerId('greeting')).toBe(true);
    expect(isValidStickerId('good_game')).toBe(true);

    expect(isValidStickerId('random_emoji')).toBe(false);
    expect(isValidStickerId('')).toBe(false);
    expect(isValidStickerId(null)).toBe(false);
    expect(isValidStickerId(123)).toBe(false);
  });

  it('validates matchReactionSchema correctly with Zod', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const valid = matchReactionSchema.safeParse({
      matchId: validUuid,
      stickerId: 'victory',
    });
    expect(valid.success).toBe(true);

    const invalidSticker = matchReactionSchema.safeParse({
      matchId: validUuid,
      stickerId: 'invalid_sticker_id',
    });
    expect(invalidSticker.success).toBe(false);

    const invalidUuid = matchReactionSchema.safeParse({
      matchId: 'not-a-uuid',
      stickerId: 'greeting',
    });
    expect(invalidUuid.success).toBe(false);
  });

  it('validates and trims custom chat messages with matchChatSchema', () => {
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const parsed = matchChatSchema.safeParse({
      matchId: validUuid,
      text: '  Nice move!  ',
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.text).toBe('Nice move!');

    expect(matchChatSchema.safeParse({ matchId: validUuid, text: '' }).success).toBe(false);
    expect(matchChatSchema.safeParse({ matchId: validUuid, text: '   ' }).success).toBe(false);
    expect(
      matchChatSchema.safeParse({
        matchId: validUuid,
        text: 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH),
      }).success,
    ).toBe(true);
    expect(
      matchChatSchema.safeParse({
        matchId: validUuid,
        text: 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
    expect(
      matchChatSchema.safeParse({ matchId: validUuid, text: 'Hello', extra: true }).success,
    ).toBe(false);
  });
});
