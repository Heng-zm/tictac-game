// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TelegramLoginButton } from '../src/client/components/TelegramLoginButton';
import { AuthGate } from '../src/client/screens/AuthGate';
import type { AppConfigPayload } from '../src/shared/game-types';

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
  turnTimeoutMs: 0,
  disconnectGraceMs: 30_000,
  inviteTtlMinutes: 60,
  aiFallbackDifficulty: 'MEDIUM',
};

function readLoginState(): string {
  const match = document.cookie.match(/(?:^|;\s*)ttt_login_state=([a-f0-9]{32})/);
  return String(match?.[1] ?? '');
}

afterEach(() => {
  cleanup();
  document.cookie = 'ttt_login_state=; Path=/api/auth/telegram/widget; Max-Age=0';
  window.history.replaceState(null, '', '/');
  delete (window as { Telegram?: unknown }).Telegram;
});

describe('TelegramLoginButton', () => {
  it('injects the official widget with a state-bound callback URL', () => {
    // The state cookie is scoped to the callback path, so read it from a
    // document under that path (browsers hide cookies for other paths).
    window.history.replaceState(null, '', '/api/auth/telegram/widget');
    const { container } = render(<TelegramLoginButton botUsername="test_bot" />);
    const script = container.querySelector<HTMLScriptElement>('script[data-telegram-login]');

    expect(script).not.toBeNull();
    expect(script?.src).toBe('https://telegram.org/js/telegram-widget.js?22');
    expect(script?.dataset.telegramLogin).toBe('test_bot');

    const state = readLoginState();
    expect(state).toMatch(/^[a-f0-9]{32}$/);
    const authUrl = script?.dataset.authUrl ?? '';
    expect(authUrl).toContain('/api/auth/telegram/widget/callback?next=');
    expect(authUrl).toContain(`&state=${state}`);
  });
});

describe('AuthGate browser sign-in', () => {
  it('offers the Telegram Login Widget outside Telegram', () => {
    render(
      <AuthGate phase="auth-required" error={null} code="AUTH_REQUIRED" config={CONFIG} onRetry={() => {}} />,
    );

    expect(screen.getByRole('heading', { name: 'Sign in with Telegram' })).toBeTruthy();
    expect(screen.getByText('A secure Telegram window will confirm your account.')).toBeTruthy();
    expect(document.querySelector('script[data-telegram-login="test_bot"]')).not.toBeNull();
  });

  it('keeps the Mini App flow when Telegram initData is present', () => {
    (window as { Telegram?: unknown }).Telegram = { WebApp: { initData: 'auth_date=1' } };

    render(
      <AuthGate phase="auth-required" error={null} code="AUTH_REQUIRED" config={CONFIG} onRetry={() => {}} />,
    );

    expect(screen.getByRole('heading', { name: 'Play inside Telegram' })).toBeTruthy();
    expect(document.querySelector('script[data-telegram-login]')).toBeNull();
  });
});
