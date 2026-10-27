import { describe, expect, it } from 'vitest';
import { sanitizeRequestUrl } from '../src/server/logger';

describe('log URL sanitization', () => {
  it('redacts invitation path tokens and sensitive query parameters', () => {
    const invite = 'a'.repeat(43);
    expect(
      sanitizeRequestUrl(
        `/api/invites/invite_${invite}?token=super-secret&initData=abc&limit=10`,
      ),
    ).toBe('/api/invites/[redacted]?token=redacted&initData=redacted&limit=10');
  });

  it('redacts invite tokens embedded in arbitrary paths and absolute URLs', () => {
    const invite = 'b'.repeat(43);
    expect(sanitizeRequestUrl(`https://game.example.com/start/invite_${invite}?start=${invite}`)).toBe(
      '/start/invite_[redacted]?start=redacted',
    );
  });

  it('handles malformed URLs without throwing', () => {
    expect(sanitizeRequestUrl('http://[invalid')).toBe('[invalid-url]');
  });
});
