// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthGate } from '../src/client/screens/AuthGate';
import type { AppConfigPayload, UserProfile } from '../src/shared/game-types';
import {
  fetchTelegramBotLoginStatus,
  startTelegramBotLogin,
} from '../src/client/lib/api';

vi.mock('../src/client/lib/api', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Sign-in failed'),
  fetchTelegramBotLoginStatus: vi.fn(),
  startTelegramBotLogin: vi.fn(),
}));

const CONFIG: AppConfigPayload = {
  protocol: 1,
  botUsername: 'test_bot',
  botAppName: null,
  miniAppUrl: 'https://example.com',
  devAuthEnabled: false,
  demoMode: false,
  environment: 'test',
  queueAiTimeoutMs: 10_000,
  queueMaxWaitMs: 30_000,
  matchStartCountdownMs: 5_000,
  turnTimeoutMs: 0,
  disconnectGraceMs: 30_000,
  inviteTtlMinutes: 60,
  aiFallbackDifficulty: 'MEDIUM',
};

const LOGIN_URL = `https://t.me/test_bot?start=login_${'a'.repeat(32)}`;
const EXPIRES_AT = '2026-10-27T12:10:00.000Z';

const USER: UserProfile = {
  id: 'user-1',
  firstName: 'Alice',
  lastName: null,
  username: 'alice',
  photoUrl: null,
  languageCode: 'en',
  autoAiFallback: true,
  turnNotifications: false,
  stats: {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    humanGames: 0,
    aiGames: 0,
    aiWins: 0,
    aiLosses: 0,
    aiDraws: 0,
    rating: 1200,
    ratingGames: 0,
    winRate: 0,
  },
};

const fetchStatus = vi.mocked(fetchTelegramBotLoginStatus);
const startLogin = vi.mocked(startTelegramBotLogin);

function renderGate(onRetry: () => void = () => undefined) {
  return render(
    <AuthGate
      phase="auth-required"
      error={null}
      code="AUTH_REQUIRED"
      config={CONFIG}
      onRetry={onRetry}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchStatus.mockResolvedValue({ status: 'invalid' });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as { Telegram?: unknown }).Telegram;
});

describe('AuthGate browser sign-in', () => {
  it('offers bot verification outside Telegram', async () => {
    renderGate();

    expect(screen.getByRole('heading', { name: 'Sign in with Telegram' })).toBeTruthy();
    expect(screen.getByText('One tap in Telegram')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue with Telegram' })).toBeTruthy();
    await waitFor(() => expect(fetchStatus).toHaveBeenCalledTimes(1));
  });

  it('resumes a pending sign-in after a refresh', async () => {
    fetchStatus.mockResolvedValue({ status: 'pending', url: LOGIN_URL, expiresAt: EXPIRES_AT });

    renderGate();

    expect(await screen.findByText('Waiting for Telegram')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Telegram again' }).getAttribute('href')).toBe(LOGIN_URL);
    expect(screen.getByText('Tap Verify in the Telegram chat, then come back to this tab.')).toBeTruthy();
  });

  it('starts a sign-in and opens the bot deep link in a popup', async () => {
    const popup = {
      opener: null as unknown,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    startLogin.mockResolvedValue({ url: LOGIN_URL, expiresAt: EXPIRES_AT });

    renderGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Telegram' }));

    expect(await screen.findByText('Waiting for Telegram')).toBeTruthy();
    expect(startLogin).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('', '_blank');
    await waitFor(() => expect(popup.location.replace).toHaveBeenCalledWith(LOGIN_URL));
    expect(screen.getByRole('link', { name: 'Open Telegram again' }).getAttribute('href')).toBe(LOGIN_URL);
  });

  it('finishes sign-in when the pending request was already verified', async () => {
    const onRetry = vi.fn();
    fetchStatus.mockResolvedValue({ status: 'verified', user: USER });

    renderGate(onRetry);

    await waitFor(() => expect(onRetry).toHaveBeenCalledTimes(1));
  });

  it('keeps the Mini App flow when Telegram initData is present', () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'auth_date=1' } };

    renderGate();

    expect(screen.getByRole('heading', { name: 'Play inside Telegram' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open in Telegram' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Continue with Telegram' })).toBeNull();
    expect(fetchStatus).not.toHaveBeenCalled();
  });
});
