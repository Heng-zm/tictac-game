import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { Express } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/server/app';
import { createSessionToken } from '../src/server/auth/session';
import { buildTelegramInitDataForTest, buildTelegramLoginDataForTest } from '../src/server/auth/telegram';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import type { UserProfile } from '../src/shared/game-types';
import { MatchService } from '../src/server/services/match-service';
import type { TurnNotificationTestService } from '../src/server/services/turn-notifier';
import {
  FakeIo,
  TEST_BOT_TOKEN,
  makeTestConfig,
  makeTestLogger,
  participant,
} from './helpers';
import type { AppConfig } from '../src/server/config';
import type { GameRepository } from '../src/server/database/types';

interface TestApp {
  app: Express;
  repo: MemoryGameRepository;
  service: MatchService;
  config: AppConfig;
}

interface AuthSession {
  agent: ReturnType<typeof request.agent>;
  user: UserProfile;
  cookie: string;
}

describe('HTTP API', () => {
  let current: TestApp;

  beforeEach(() => {
    current = buildTestApp();
  });

  afterEach(() => {
    current.service.shutdown();
  });

  function buildTestApp(
    overrides: Partial<AppConfig> = {},
    turnNotificationTester?: TurnNotificationTestService,
    disableRateLimits = true,
  ): TestApp {
    const config = makeTestConfig(overrides);
    const repo = new MemoryGameRepository();
    const io = new FakeIo();
    const service = new MatchService({
      io: io.asGameServer(),
      repository: repo,
      config,
      logger: makeTestLogger(),
    });
    const app = createApp({
      config,
      repository: repo,
      logger: makeTestLogger(),
      matchService: service,
      ...(turnNotificationTester ? { turnNotificationTester } : {}),
      disableRateLimits,
    });
    return { app, repo, service, config };
  }

  async function authenticate(
    app: Express,
    deviceKey: string,
    displayName = 'Test Player',
  ): Promise<AuthSession> {
    const agent = request.agent(app);
    const response = await agent.post('/api/auth/dev').send({ deviceKey, displayName });
    expect(response.status).toBe(200);
    const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
    expect(cookies?.[0]).toContain('ttt_session=');
    expect(cookies?.[0]).toContain('HttpOnly');
    expect(cookies?.[0]).toContain('SameSite=Lax');
    const cookie = cookies![0]!.split(';')[0]!;
    return { agent, user: response.body.user as UserProfile, cookie };
  }

  async function finishMatch(
    repo: GameRepository,
    firstUserId: string,
    secondUserId: string,
  ): Promise<string> {
    const first = await repo.getUserById(firstUserId);
    const second = await repo.getUserById(secondUserId);
    if (!first || !second) throw new Error('Missing test users');
    const match = await repo.createMatch({
      mode: 'RANDOM',
      status: 'ACTIVE',
      participants: [participant(first, 'X'), participant(second, 'O')],
      currentTurn: 'X',
      turnDeadline: null,
    });
    const now = new Date();
    await repo.recordMove({
      matchId: match.id,
      expectedVersion: 0,
      side: 'X',
      cell: 0,
      actionId: randomUUID(),
      boardAfter: { 0: 'X', 1: 'X', 2: 'X', 3: 'O', 4: 'O' },
      nextTurn: null,
      moveNumber: 1,
      turnDeadline: null,
      lastActivityAt: now,
      finalization: {
        winnerSide: 'X',
        result: 'X_WINS',
        finishReason: 'LINE',
        finishedAt: now,
        countStats: true,
      },
    });
    return match.id;
  }

  it('allows guest login in production demo mode with a secure cookie', async () => {
    const demo = buildTestApp({
      nodeEnv: 'production',
      isProduction: true,
      demoMode: true,
      devAuthEnabled: true,
      databaseMode: 'memory',
    });
    const response = await request(demo.app)
      .post('/api/auth/dev')
      .send({ deviceKey: 'demo-device', displayName: 'Demo Player' });
    expect(response.status).toBe(200);
    const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=None');
    demo.service.shutdown();
  });

  it('serves health, readiness and public configuration', async () => {
    const health = await request(current.app).get('/health');
    expect(health.status).toBe(200);
    expect(health.body).toMatchObject({ status: 'ok', version: '1.0.0' });
    expect(health.headers['cache-control']).toBe('no-store');

    const ready = await request(current.app).get('/ready');
    expect(ready.status).toBe(200);
    expect(ready.body).toEqual({ status: 'ready', checks: { database: 'ok' } });

    const config = await request(current.app).get('/api/config');
    expect(config.status).toBe(200);
    expect(config.body).toMatchObject({
      protocol: 1,
      devAuthEnabled: true,
      environment: 'test',
      queueAiTimeoutMs: 10_000,
      turnTimeoutMs: 0,
    });
    expect(config.headers['cache-control']).toBe('no-store');
    expect(config.body).not.toHaveProperty('telegramBotToken');
  });

  it('sets security headers without hiding the app from Telegram', async () => {
    const response = await request(current.app).get('/health');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeUndefined();
    expect(response.headers['content-security-policy']).toContain('frame-ancestors');
    expect(response.headers['content-security-policy']).toContain('https://web.telegram.org');
    expect(response.headers['content-security-policy']).toContain('frame-src');
    expect(response.headers['content-security-policy']).toContain('https://oauth.telegram.org');
    // HSTS is only sent in production; localhost development must not pin HTTPS.
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  it('authenticates development users and keeps the session in an HttpOnly cookie', async () => {
    const session = await authenticate(current.app, 'device-key-alpha', 'Alice');
    expect(session.user).toMatchObject({
      firstName: 'Alice',
      autoAiFallback: false,
      turnNotifications: false,
      stats: { gamesPlayed: 0, rating: 1000, winRate: 0 },
    });
    expect(session.user).not.toHaveProperty('telegramId');

    const me = await session.agent.get('/api/me');
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(session.user.id);

    const sameDevice = await authenticate(current.app, 'device-key-alpha', 'Alice Again');
    expect(sameDevice.user.id).toBe(session.user.id);

    const otherDevice = await authenticate(current.app, 'device-key-beta', 'Bob');
    expect(otherDevice.user.id).not.toBe(session.user.id);
  });

  it('rejects missing, malformed, tampered and stale sessions', async () => {
    const anonymous = await request(current.app).get('/api/me');
    expect(anonymous.status).toBe(401);
    expect(anonymous.body.error.code).toBe('AUTH_REQUIRED');

    const malformed = await request(current.app)
      .get('/api/me')
      .set('Cookie', 'ttt_session=not-a-token');
    expect(malformed.status).toBe(401);

    const session = await authenticate(current.app, 'device-key-gamma');
    const [cookieName, cookieValue] = session.cookie.split('=');
    const tamperedValue = `${cookieValue!.slice(0, -1)}${cookieValue!.endsWith('A') ? 'B' : 'A'}`;
    const tampered = await request(current.app)
      .get('/api/me')
      .set('Cookie', `${cookieName}=${tamperedValue}`);
    expect(tampered.status).toBe(401);

    const missingUser = createSessionToken(
      { id: randomUUID(), telegramId: 999n },
      current.config.sessionSecret,
    );
    const stale = await request(current.app)
      .get('/api/me')
      .set('Cookie', `ttt_session=${missingUser}`);
    expect(stale.status).toBe(401);
    expect(stale.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('logs out by clearing the session cookie', async () => {
    const session = await authenticate(current.app, 'device-key-logout');
    const logout = await session.agent.post('/api/auth/logout');
    expect(logout.status).toBe(204);
    expect(logout.headers['set-cookie']?.[0]).toContain('ttt_session=;');

    const me = await session.agent.get('/api/me');
    expect(me.status).toBe(401);
  });

  it('validates authentication payloads and JSON bodies', async () => {
    const shortKey = await request(current.app)
      .post('/api/auth/dev')
      .send({ deviceKey: 'short' });
    expect(shortKey.status).toBe(400);
    expect(shortKey.body.error.code).toBe('VALIDATION_ERROR');

    const extraField = await request(current.app)
      .post('/api/auth/dev')
      .send({ deviceKey: 'device-key-extra', unexpected: true });
    expect(extraField.status).toBe(400);

    const invalidJson = await request(current.app)
      .post('/api/auth/dev')
      .set('Content-Type', 'application/json')
      .send('{not-json');
    expect(invalidJson.status).toBe(400);
    expect(invalidJson.body.error.code).toBe('INVALID_JSON');
  });

  it('updates player preferences independently', async () => {
    const session = await authenticate(current.app, 'device-key-prefs');
    const response = await session.agent
      .patch('/api/me/preferences')
      .send({ autoAiFallback: true });
    expect(response.status).toBe(200);
    expect(response.body.user.autoAiFallback).toBe(true);
    expect(response.body.user.turnNotifications).toBe(false);

    const notifications = await session.agent
      .patch('/api/me/preferences')
      .send({ turnNotifications: true });
    expect(notifications.status).toBe(200);
    expect(notifications.body.user.turnNotifications).toBe(true);
    expect(notifications.body.user.autoAiFallback).toBe(true);

    const me = await session.agent.get('/api/me');
    expect(me.body.user).toMatchObject({ autoAiFallback: true, turnNotifications: true });

    const empty = await session.agent.patch('/api/me/preferences').send({});
    expect(empty.status).toBe(400);

    const invalid = await session.agent.patch('/api/me/preferences').send({ autoAiFallback: 'yes' });
    expect(invalid.status).toBe(400);
  });

  it('sends test notifications only when configured and enabled', async () => {
    const unauthenticated = await request(current.app).post('/api/me/notifications/test');
    expect(unauthenticated.status).toBe(401);

    const unavailableSession = await authenticate(current.app, 'device-key-notify-unavailable');
    await unavailableSession.agent.patch('/api/me/preferences').send({ turnNotifications: true });
    const unavailable = await unavailableSession.agent.post('/api/me/notifications/test');
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe('NOTIFICATIONS_UNAVAILABLE');

    const sendTestNotification = vi.fn(async () => 'sent' as const);
    const tester: TurnNotificationTestService = { sendTestNotification };
    const testApp = buildTestApp({}, tester);
    const session = await authenticate(testApp.app, 'device-key-notify-enabled');
    const disabled = await session.agent.post('/api/me/notifications/test');
    expect(disabled.status).toBe(409);
    expect(disabled.body.error.code).toBe('NOTIFICATIONS_DISABLED');

    await session.agent.patch('/api/me/preferences').send({ turnNotifications: true });
    const sent = await session.agent.post('/api/me/notifications/test');
    expect(sent.status).toBe(200);
    expect(sent.body).toEqual({ status: 'sent' });
    expect(sendTestNotification).toHaveBeenCalledWith(
      expect.objectContaining({ id: session.user.id, turnNotifications: true }),
    );
    testApp.service.shutdown();
  });

  it('maps blocked and transient test notification failures to distinct errors', async () => {
    const tester: TurnNotificationTestService = {
      sendTestNotification: vi
        .fn()
        .mockResolvedValueOnce('blocked' as const)
        .mockResolvedValueOnce('failed' as const),
    };
    const testApp = buildTestApp({}, tester);
    const session = await authenticate(testApp.app, 'device-key-notify-failures');
    await session.agent.patch('/api/me/preferences').send({ turnNotifications: true });

    const blocked = await session.agent.post('/api/me/notifications/test');
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('NOTIFICATIONS_DISABLED');

    const failed = await session.agent.post('/api/me/notifications/test');
    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe('NOTIFICATION_DELIVERY_FAILED');
    testApp.service.shutdown();
  });

  it('rate-limits test notifications per user', async () => {
    const tester: TurnNotificationTestService = {
      sendTestNotification: vi.fn(async () => 'sent' as const),
    };
    const testApp = buildTestApp({}, tester, false);
    const session = await authenticate(testApp.app, 'device-key-notify-rate-limit');
    await session.agent.patch('/api/me/preferences').send({ turnNotifications: true });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await session.agent.post('/api/me/notifications/test');
      expect(response.status).toBe(200);
    }
    const limited = await session.agent.post('/api/me/notifications/test');
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('NOTIFICATION_RATE_LIMITED');
    testApp.service.shutdown();
  });

  it('returns history, stats and leaderboard for completed games', async () => {
    const alice = await authenticate(current.app, 'device-key-history-a', 'Alice');
    const bob = await authenticate(current.app, 'device-key-history-b', 'Bob');
    await finishMatch(current.repo, alice.user.id, bob.user.id);

    const history = await alice.agent.get('/api/history?limit=10');
    expect(history.status).toBe(200);
    expect(history.body.items).toHaveLength(1);
    expect(history.body.items[0]).toMatchObject({
      mode: 'RANDOM',
      outcome: 'WIN',
      matchResult: 'X_WINS',
      finishReason: 'LINE',
      opponent: { displayName: 'Bob', isAi: false },
    });
    expect(history.body.nextCursor).toBeNull();

    const stats = await alice.agent.get('/api/me/stats');
    expect(stats.body.stats).toMatchObject({ wins: 1, gamesPlayed: 1, rating: 1020, winRate: 100 });

    const leaderboard = await alice.agent.get('/api/leaderboard?limit=10');
    expect(leaderboard.status).toBe(200);
    expect(leaderboard.body.entries).toHaveLength(2);
    expect(leaderboard.body.entries[0]).toMatchObject({
      rank: 1,
      userId: alice.user.id,
      rating: 1020,
      isYou: true,
    });
    expect(leaderboard.body.entries[1]).toMatchObject({ rank: 2, userId: bob.user.id, isYou: false });
    expect(leaderboard.body.currentUserRank).toBe(1);

    const bobBoard = await bob.agent.get('/api/leaderboard');
    expect(bobBoard.body.currentUserRank).toBe(2);
    expect(bobBoard.body.entries.find((entry: { userId: string }) => entry.userId === bob.user.id).isYou).toBe(
      true,
    );
  });

  it('keeps cancelled invitations out of match history', async () => {
    const alice = await authenticate(current.app, 'device-key-history-invite', 'Alice');
    const aliceEntity = await current.repo.getUserById(alice.user.id);
    if (!aliceEntity) throw new Error('Missing Alice');
    const invitation = await current.service.createInvitation(aliceEntity);
    await current.service.cancelInvitation(alice.user.id, invitation.id);

    const history = await alice.agent.get('/api/history?limit=10');
    expect(history.status).toBe(200);
    expect(history.body.items).toEqual([]);
    expect(history.body.nextCursor).toBeNull();
  });

  it('validates history and leaderboard query parameters', async () => {
    const session = await authenticate(current.app, 'device-key-query');
    expect((await session.agent.get('/api/history?limit=0')).status).toBe(400);
    expect((await session.agent.get('/api/history?limit=51')).status).toBe(400);
    expect((await session.agent.get('/api/history?cursor=nope')).status).toBe(400);
    expect((await session.agent.get('/api/leaderboard?limit=0')).status).toBe(400);
    expect((await session.agent.get('/api/leaderboard?limit=51')).status).toBe(400);
  });

  it('supports invitation preview, acceptance and cancellation over HTTP', async () => {
    const alice = await authenticate(current.app, 'device-key-invite-a', 'Alice');
    const bob = await authenticate(current.app, 'device-key-invite-b', 'Bob');
    const charlie = await authenticate(current.app, 'device-key-invite-c', 'Charlie');
    const aliceEntity = await current.repo.getUserById(alice.user.id);
    if (!aliceEntity) throw new Error('Missing Alice');
    const invitation = await current.service.createInvitation(aliceEntity);
    const startParam = new URL(invitation.deepLink).searchParams.get('startapp');
    const token = startParam!.slice('invite_'.length);

    const preview = await bob.agent.get(`/api/invites/${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invite).toMatchObject({
      status: 'PENDING',
      youAreInviter: false,
      yourSide: 'O',
      matchId: invitation.matchId,
      inviter: { displayName: 'Alice' },
    });

    const own = await alice.agent.post(`/api/invites/${token}/accept`);
    expect(own.status).toBe(403);
    expect(own.body.error.code).toBe('INVITATION_OWN');

    const accepted = await bob.agent.post(`/api/invites/${token}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.matchId).toBe(invitation.matchId);

    const replay = await charlie.agent.post(`/api/invites/${token}/accept`);
    expect(replay.status).toBe(409);
    expect(replay.body.error.code).toBe('INVITATION_USED');

    const acceptedPreview = await bob.agent.get(`/api/invites/${token}`);
    expect(acceptedPreview.body.invite.status).toBe('ACCEPTED');

    const charlieEntity = await current.repo.getUserById(charlie.user.id);
    if (!charlieEntity) throw new Error('Missing Charlie');
    const secondInvite = await current.service.createInvitation(charlieEntity);
    const secondToken = new URL(secondInvite.deepLink).searchParams.get('startapp')!.slice('invite_'.length);

    const forbiddenCancel = await bob.agent.post(`/api/invites/${secondToken}/cancel`);
    expect(forbiddenCancel.status).toBe(403);
    expect(forbiddenCancel.body.error.code).toBe('INVITATION_FORBIDDEN');

    const cancelled = await charlie.agent.post(`/api/invites/${secondToken}/cancel`);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.cancelled).toBe(true);

    const cancelledPreview = await bob.agent.get(`/api/invites/${secondToken}`);
    expect(cancelledPreview.body.invite.status).toBe('CANCELLED');

    const invalidToken = await bob.agent.get('/api/invites/not-a-valid-token');
    expect(invalidToken.status).toBe(400);
    const unknownToken = await bob.agent.get(`/api/invites/${'a'.repeat(43)}`);
    expect(unknownToken.status).toBe(404);
    expect(unknownToken.body.error.code).toBe('INVITATION_INVALID');
  });

  it('verifies Telegram initData and rejects invalid or expired data', async () => {
    const telegramApp = buildTestApp({
      telegramBotToken: TEST_BOT_TOKEN,
      authMaxAgeSeconds: 300,
      devAuthEnabled: false,
    });
    try {
      const authDate = Math.floor(Date.now() / 1000) - 10;
      const initData = buildTelegramInitDataForTest(
        TEST_BOT_TOKEN,
        { id: 5550001, first_name: 'Telegram Alice', username: 'tg_alice' },
        authDate,
      );
      const response = await request(telegramApp.app)
        .post('/api/auth/telegram')
        .send({ initData });
      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({ firstName: 'Telegram Alice', username: 'tg_alice' });
      expect(response.headers['set-cookie']?.[0]).toContain('ttt_session=');

      const tampered = await request(telegramApp.app)
        .post('/api/auth/telegram')
        .send({ initData: initData.replace('tg_alice', 'tg_mallory') });
      expect(tampered.status).toBe(401);
      expect(tampered.body.error.code).toBe('INIT_DATA_INVALID');

      const expiredInitData = buildTelegramInitDataForTest(
        TEST_BOT_TOKEN,
        { id: 5550002, first_name: 'Old Alice' },
        Math.floor(Date.now() / 1000) - 600,
      );
      const expired = await request(telegramApp.app)
        .post('/api/auth/telegram')
        .send({ initData: expiredInitData });
      expect(expired.status).toBe(401);
      expect(expired.body.error.code).toBe('INIT_DATA_EXPIRED');

      const missing = await request(telegramApp.app).post('/api/auth/telegram').send({});
      expect(missing.status).toBe(400);
    } finally {
      telegramApp.service.shutdown();
    }
  });

  it('returns 503 when Telegram authentication is not configured', async () => {
    const response = await request(current.app)
      .post('/api/auth/telegram')
      .send({ initData: 'auth_date=1&user=%7B%7D&hash='.concat('a'.repeat(64)) });
    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('TELEGRAM_AUTH_UNAVAILABLE');
  });

  it('signs browser users in through the Telegram Login Widget redirect', async () => {
    const telegramApp = buildTestApp({
      telegramBotToken: TEST_BOT_TOKEN,
      authMaxAgeSeconds: 300,
      devAuthEnabled: false,
    });
    try {
      const authDate = Math.floor(Date.now() / 1000) - 10;
      const loginState = 'a'.repeat(32);
      const data = buildTelegramLoginDataForTest(
        TEST_BOT_TOKEN,
        { id: 5550101, first_name: 'Browser Alice', username: 'browser_alice' },
        authDate,
      );
      const agent = request.agent(telegramApp.app);
      const response = await agent
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', `ttt_login_state=${loginState}`)
        .query({ ...data, state: loginState, next: '/#/profile' });

      expect(response.status).toBe(303);
      expect(response.headers.location).toBe('/#/profile');
      const setCookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(setCookies?.some((cookie) => cookie.includes('ttt_session='))).toBe(true);

      const me = await agent.get('/api/me');
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({
        firstName: 'Browser Alice',
        username: 'browser_alice',
      });
    } finally {
      telegramApp.service.shutdown();
    }
  });

  it('rejects invalid widget logins and unsafe return paths', async () => {
    const telegramApp = buildTestApp({
      telegramBotToken: TEST_BOT_TOKEN,
      authMaxAgeSeconds: 300,
      devAuthEnabled: false,
    });
    try {
      const authDate = Math.floor(Date.now() / 1000) - 10;
      const loginState = 'a'.repeat(32);
      const stateCookie = `ttt_login_state=${loginState}`;
      const data = buildTelegramLoginDataForTest(
        TEST_BOT_TOKEN,
        { id: 5550102, first_name: 'Browser Bob', username: 'browser_bob' },
        authDate,
      );

      const tampered = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', stateCookie)
        .query({ ...data, state: loginState, first_name: 'Mallory' });
      expect(tampered.status).toBe(303);
      expect(tampered.headers.location).toBe('/?telegram_login=invalid');
      const tamperedCookies = tampered.headers['set-cookie'] as unknown as string[] | undefined;
      expect(tamperedCookies?.some((cookie) => cookie.includes('ttt_session='))).toBe(false);

      const expired = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', stateCookie)
        .query({
          ...buildTelegramLoginDataForTest(
            TEST_BOT_TOKEN,
            { id: 5550103, first_name: 'Old Browser Alice' },
            Math.floor(Date.now() / 1000) - 600,
          ),
          state: loginState,
        });
      expect(expired.status).toBe(303);
      expect(expired.headers.location).toBe('/?telegram_login=expired');

      const wrongState = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', `ttt_login_state=${'b'.repeat(32)}`)
        .query({ ...data, state: loginState });
      expect(wrongState.status).toBe(303);
      expect(wrongState.headers.location).toBe('/?telegram_login=invalid');

      const missingState = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .query(data);
      expect(missingState.status).toBe(303);
      expect(missingState.headers.location).toBe('/?telegram_login=invalid');

      const unsafe = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', stateCookie)
        .query({ ...data, state: loginState, next: 'https://evil.example/phish' });
      expect(unsafe.status).toBe(303);
      expect(unsafe.headers.location).toBe('/');

      const protocolRelative = await request(telegramApp.app)
        .get('/api/auth/telegram/widget/callback')
        .set('Cookie', stateCookie)
        .query({ ...data, state: loginState, next: '//evil.example/phish' });
      expect(protocolRelative.status).toBe(303);
      expect(protocolRelative.headers.location).toBe('/');
    } finally {
      telegramApp.service.shutdown();
    }

    const unavailable = await request(current.app)
      .get('/api/auth/telegram/widget/callback')
      .query({ id: 1, first_name: 'No Bot', auth_date: 1, hash: 'a'.repeat(64) });
    expect(unavailable.status).toBe(303);
    expect(unavailable.headers.location).toBe('/?telegram_login=unavailable');
  });

  it('rejects cross-origin mutations but allows configured origins', async () => {
    const allowedOrigin = current.config.allowedOrigins[0]!;
    const blocked = await request(current.app)
      .post('/api/auth/dev')
      .set('Origin', 'https://evil.example')
      .send({ deviceKey: 'device-key-origin' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('ORIGIN_NOT_ALLOWED');

    const allowed = await request(current.app)
      .post('/api/auth/dev')
      .set('Origin', allowedOrigin)
      .send({ deviceKey: 'device-key-origin' });
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(allowedOrigin);

    const preflight = await request(current.app)
      .options('/api/me/preferences')
      .set('Origin', allowedOrigin)
      .set('Access-Control-Request-Method', 'PATCH');
    expect(preflight.status).toBe(204);
  });

  it('allows same-host requests from a LAN or custom domain origin', async () => {
    const response = await request(current.app)
      .get('/api/config')
      .set('Host', '192.168.18.11:3000')
      .set('Origin', 'http://192.168.18.11:3000');
    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('http://192.168.18.11:3000');
  });

  it('disables development authentication in production', async () => {
    const productionApp = buildTestApp({
      nodeEnv: 'production',
      isProduction: true,
      devAuthEnabled: false,
      sessionSecret: 'production-test-session-secret-with-enough-length',
    });
    try {
      const response = await request(productionApp.app)
        .post('/api/auth/dev')
        .send({ deviceKey: 'device-key-production' });
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('DEV_AUTH_DISABLED');
    } finally {
      productionApp.service.shutdown();
    }
  });

  it('returns structured errors with request IDs for unknown endpoints', async () => {
    const notFound = await request(current.app).get('/api/unknown');
    expect(notFound.status).toBe(404);
    expect(notFound.body.error).toMatchObject({ code: 'NOT_FOUND' });
    expect(notFound.body.error.requestId).toEqual(expect.any(String));
    expect(notFound.headers['x-request-id']).toBe(notFound.body.error.requestId);
  });
});
