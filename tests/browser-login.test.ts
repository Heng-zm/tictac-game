import { describe, expect, it } from 'vitest';
import {
  BrowserLoginStore,
  parseBrowserLoginCookie,
  serializeBrowserLoginCookie,
  type BrowserLoginIdentity,
} from '../src/server/auth/browser-login';
import { MutableClock } from './helpers';

const IDENTITY: BrowserLoginIdentity = {
  telegramId: 42n,
  firstName: 'Alice',
  lastName: null,
  username: 'alice',
  languageCode: 'en',
};

describe('BrowserLoginStore', () => {
  it('creates a request bound to the browser secret and consumes it once', () => {
    const clock = new MutableClock();
    const store = new BrowserLoginStore({ now: clock.now });
    const created = store.create();

    expect(store.lookup(created.id, created.secret)).toEqual({
      status: 'pending',
      expiresAt: created.expiresAt,
    });
    expect(store.lookup(created.id, 'A'.repeat(43))).toEqual({ status: 'invalid' });

    expect(store.claim(created.id, 42n)).toMatchObject({ status: 'pending' });
    expect(store.verify(created.id, 42n, IDENTITY)).toEqual({ status: 'verified', identity: IDENTITY });
    expect(store.lookup(created.id, created.secret)).toEqual({ status: 'verified', identity: IDENTITY });

    store.remove(created.id);
    expect(store.lookup(created.id, created.secret)).toEqual({ status: 'invalid' });
  });

  it('reports expired requests as expired instead of invalid', () => {
    const clock = new MutableClock();
    const store = new BrowserLoginStore({ now: clock.now });

    const lookupRequest = store.create();
    clock.advance(601_000);
    expect(store.lookup(lookupRequest.id, lookupRequest.secret)).toEqual({ status: 'expired' });

    const claimRequest = store.create();
    clock.advance(601_000);
    expect(store.claim(claimRequest.id, 42n)).toEqual({ status: 'expired' });

    const verifyRequest = store.create();
    clock.advance(601_000);
    expect(store.verify(verifyRequest.id, 42n, IDENTITY)).toEqual({ status: 'expired' });
  });

  it('binds a request to the first Telegram account that claims it', () => {
    const store = new BrowserLoginStore();

    const created = store.create();
    expect(store.claim(created.id, 42n)).toMatchObject({ status: 'pending' });
    expect(store.claim(created.id, 99n)).toEqual({ status: 'claimed' });
    expect(store.verify(created.id, 99n, { ...IDENTITY, telegramId: 99n })).toEqual({
      status: 'claimed_by_other',
    });
    expect(store.verify(created.id, 42n, IDENTITY)).toMatchObject({ status: 'verified' });
    expect(store.claim(created.id, 42n)).toEqual({ status: 'verified' });
    expect(store.verify(created.id, 42n, IDENTITY)).toEqual({ status: 'already_verified' });
  });

  it('bounds memory by evicting the oldest pending request', () => {
    const store = new BrowserLoginStore({ maxEntries: 2 });

    const first = store.create();
    const second = store.create();
    const third = store.create();

    expect(store.lookup(first.id, first.secret)).toEqual({ status: 'invalid' });
    expect(store.lookup(second.id, second.secret)).toMatchObject({ status: 'pending' });
    expect(store.lookup(third.id, third.secret)).toMatchObject({ status: 'pending' });
  });
});

describe('browser login cookie', () => {
  it('round-trips a valid id and secret', () => {
    const value = { id: 'a'.repeat(32), secret: 'A'.repeat(43) };
    expect(parseBrowserLoginCookie(serializeBrowserLoginCookie(value))).toEqual(value);
  });

  it('rejects malformed values', () => {
    expect(parseBrowserLoginCookie(undefined)).toBeNull();
    expect(parseBrowserLoginCookie('not-a-cookie')).toBeNull();
    expect(parseBrowserLoginCookie(`${'a'.repeat(32)}.short`)).toBeNull();
    expect(parseBrowserLoginCookie(`${'z'.repeat(32)}.${'A'.repeat(43)}`)).toBeNull();
  });
});
