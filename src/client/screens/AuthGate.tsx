import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import type { AppConfigPayload } from '../../shared/game-types';
import type { BootPhase } from '../hooks/use-game-client';
import {
  errorMessage,
  fetchTelegramBotLoginStatus,
  startTelegramBotLogin,
} from '../lib/api';
import { getWebApp, openTelegramBot } from '../lib/telegram';
import { Button, Logo, Spinner } from '../components/ui';

type BrowserLoginPhase = 'idle' | 'starting' | 'waiting' | 'expired' | 'failed';

export function AuthGate({
  phase,
  error,
  code,
  config,
  onRetry,
}: {
  phase: BootPhase;
  error: string | null;
  code: string | null;
  config: AppConfigPayload | null;
  onRetry: () => void;
}) {
  const booting = phase === 'booting';
  const authRequired = phase === 'auth-required';
  // `initData` only exists when Telegram launched the page as a Mini App.
  // A regular browser tab signs in through the bot.
  const insideTelegram = Boolean(getWebApp()?.initData);
  const botUsername = config?.botUsername ?? null;
  const browserLoginAvailable = authRequired && !insideTelegram && Boolean(botUsername);
  const [loginPhase, setLoginPhase] = useState<BrowserLoginPhase>('idle');
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const loginBusy = loginPhase === 'starting' || loginPhase === 'waiting';

  // Resuming after a page refresh: a pending cookie may already be waiting for
  // the user to tap Verify in Telegram.
  useEffect(() => {
    if (!browserLoginAvailable) return;
    let cancelled = false;
    void fetchTelegramBotLoginStatus()
      .then((status) => {
        if (cancelled) return;
        if (status.status === 'pending') {
          setLoginUrl(status.url);
          setLoginPhase('waiting');
          return;
        }
        if (status.status === 'verified') {
          onRetry();
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [browserLoginAvailable, onRetry]);

  // Poll while the user is in Telegram. The status endpoint issues the session
  // cookie once the bot callback has verified this browser's request.
  useEffect(() => {
    if (!browserLoginAvailable || loginPhase !== 'waiting') return;
    let cancelled = false;
    let timer: number | null = null;

    const poll = async (): Promise<void> => {
      if (cancelled) return;
      try {
        const status = await fetchTelegramBotLoginStatus();
        if (cancelled) return;
        if (status.status === 'verified') {
          setLoginPhase('idle');
          onRetry();
          return;
        }
        if (status.status === 'expired' || status.status === 'invalid') {
          setLoginPhase('expired');
          setLoginError('This Telegram sign-in expired. Start again to get a new link.');
          return;
        }
        if (status.status === 'pending') {
          setLoginUrl(status.url);
        }
      } catch {
        // Transient network failures are expected while the user is in
        // Telegram; keep polling until the request succeeds or expires.
      }
      if (!cancelled) {
        timer = window.setTimeout(() => void poll(), 2_500);
      }
    };

    timer = window.setTimeout(() => void poll(), 1_200);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [browserLoginAvailable, loginPhase, onRetry]);

  async function startBrowserLogin(): Promise<void> {
    setLoginError(null);
    setLoginPhase('starting');

    // Open the tab from the click handler so the browser keeps the user
    // gesture. The blank tab is navigated right after the server responds.
    let popup: Window | null = null;
    try {
      popup = window.open('', '_blank');
    } catch {
      popup = null;
    }

    try {
      const login = await startTelegramBotLogin();
      setLoginUrl(login.url);
      setLoginPhase('waiting');
      if (popup) {
        try {
          popup.opener = null;
          popup.location.replace(login.url);
        } catch {
          // The "Open Telegram" link below remains available.
        }
      }
    } catch (loginStartError) {
      try {
        popup?.close();
      } catch {
        // Ignore popup cleanup failures.
      }
      setLoginUrl(null);
      setLoginError(errorMessage(loginStartError));
      setLoginPhase('failed');
    }
  }

  function retry(): void {
    setLoginPhase('idle');
    setLoginError(null);
    setLoginUrl(null);
    onRetry();
  }

  return (
    <div className="flex min-h-[var(--app-vh)] flex-col items-center justify-center px-6 py-10 text-center">
      <Logo size="lg" className="mb-5 animate-pop-in" />

      {booting ? (
        <>
          <h1 className="text-xl font-bold tracking-tight text-ink">Opening the board</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> Verifying your session…
          </p>
        </>
      ) : (
        <>
          <h1 className="max-w-sm text-2xl font-bold leading-tight tracking-tight text-ink">
            {authRequired
              ? insideTelegram
                ? 'Play inside Telegram'
                : 'Sign in with Telegram'
              : 'The board is out of reach'}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {authRequired
              ? error ??
                (insideTelegram
                  ? 'This Mini App verifies every player with Telegram. Reopen it from the bot to sign in securely — there are no passwords and no fake accounts.'
                  : 'Open our Telegram bot and tap Verify. This page finishes signing in automatically — no password and no website domain setup.')
              : error ?? 'The game server could not be reached. Please try again.'}
          </p>

          {authRequired && code && !loginBusy ? (
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
              {code.replaceAll('_', ' ')}
            </p>
          ) : null}

          {browserLoginAvailable ? (
            <div className="mt-6 w-full max-w-sm rounded-2xl border border-line bg-surface p-4 text-left shadow-soft">
              {loginBusy ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">
                        {loginPhase === 'starting' ? 'Opening Telegram…' : 'Waiting for Telegram'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {loginPhase === 'starting'
                          ? 'Creating a secure, one-time sign-in link.'
                          : 'Tap Verify in the Telegram chat, then come back to this tab.'}
                      </p>
                    </div>
                  </div>

                  {loginPhase === 'waiting' && loginUrl ? (
                    <a
                      href={loginUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-line bg-elevated px-4 text-sm font-semibold text-ink transition hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden />
                      Open Telegram again
                    </a>
                  ) : null}

                  {loginPhase === 'waiting' ? (
                    <button
                      type="button"
                      onClick={() => void startBrowserLogin()}
                      className="mt-2 w-full text-center text-[11px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      Use a different Telegram account
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
                      <ExternalLink className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-ink">One tap in Telegram</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        We open the game bot in a new tab. Tap the Verify button it sends, then return here.
                      </p>
                    </div>
                  </div>

                  {loginError ? (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-2.5 text-[11px] leading-relaxed text-danger"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      {loginError}
                    </p>
                  ) : null}

                  <Button
                    size="lg"
                    icon={ExternalLink}
                    className="mt-4 w-full"
                    onClick={() => void startBrowserLogin()}
                  >
                    {loginPhase === 'expired' || loginPhase === 'failed'
                      ? 'Try again with Telegram'
                      : 'Continue with Telegram'}
                  </Button>
                  <p className="mt-2 text-center text-[11px] leading-relaxed text-muted">
                    Telegram will show the account and a Verify button. Nothing is sent to this page until you tap it.
                  </p>
                </>
              )}
            </div>
          ) : null}

          <div className="mt-4 flex w-full max-w-sm flex-col gap-2">
            {authRequired && insideTelegram && botUsername ? (
              <Button size="lg" icon={ExternalLink} onClick={() => openTelegramBot(botUsername)}>
                Open in Telegram
              </Button>
            ) : null}
            <Button
              variant={browserLoginAvailable ? 'secondary' : 'primary'}
              size="lg"
              icon={RefreshCw}
              onClick={retry}
            >
              Try again
            </Button>
          </div>

          {authRequired ? (
            <div className="mt-7 flex max-w-sm items-start gap-2 rounded-2xl border border-line bg-elevated/60 p-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                Your Telegram login is verified by the game server through the bot. The bot token never reaches this
                device, and development sign-in is disabled in production.
              </p>
            </div>
          ) : (
            <div className="mt-7 flex max-w-sm items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                {error ?? 'If this keeps happening, check your connection or reopen the app from Telegram.'}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
