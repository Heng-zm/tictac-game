import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AppConfigPayload } from '../../shared/game-types';
import type { BootPhase } from '../hooks/use-game-client';
import {
  authenticateDev,
  errorMessage,
  fetchTelegramBotLoginStatus,
  getDeviceKey,
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
  const webApp = getWebApp();
  const insideTelegram = Boolean(webApp?.initData);
  const botUsername = config?.botUsername ?? null;
  const browserLoginAvailable = authRequired && !insideTelegram && Boolean(botUsername);
  const guestAuthAvailable = authRequired && Boolean(config?.devAuthEnabled || config?.demoMode);

  const [loginPhase, setLoginPhase] = useState<BrowserLoginPhase>('idle');
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);
  const loginBusy = loginPhase === 'starting' || loginPhase === 'waiting';

  // Determine user language (English default, Khmer if telegram/browser language starts with km)
  const userLang = (webApp?.initDataUnsafe?.user?.language_code ?? (typeof navigator !== 'undefined' ? navigator.language : ''))
    .toLowerCase();
  const isKm = userLang.startsWith('km');

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
          setLoginError(
            isKm
              ? 'ការចូលតាម Telegram នេះបានផុតកំណត់ហើយ។ សូមចាប់ផ្តើមឡើងវិញដើម្បីទទួលបានតំណភ្ជាប់ថ្មី។'
              : 'This Telegram sign-in expired. Start again to get a new link.',
          );
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
  }, [browserLoginAvailable, isKm, loginPhase, onRetry]);

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

  async function handleGuestLogin(): Promise<void> {
    setGuestBusy(true);
    setLoginError(null);
    try {
      await authenticateDev(getDeviceKey(), 'Demo Player');
      onRetry();
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setGuestBusy(false);
    }
  }

  function retry(): void {
    setLoginPhase('idle');
    setLoginError(null);
    setLoginUrl(null);
    onRetry();
  }

  return (
    <div className="relative flex min-h-[var(--app-vh)] flex-col items-center justify-center overflow-hidden px-4 py-8 text-center sm:px-6 sm:py-12">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#24A1DE]/10 blur-3xl" aria-hidden />

      {/* App Branding */}
      <div className="relative mb-6 flex flex-col items-center">
        <div className="relative">
          <Logo size="lg" className="animate-pop-in drop-shadow-md" />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#24A1DE] text-white shadow-sm ring-2 ring-surface">
            <Send className="h-2.5 w-2.5" aria-hidden />
          </span>
        </div>
      </div>

      {booting ? (
        <div className="relative z-10 max-w-sm rounded-3xl border border-line/70 bg-surface/80 p-6 shadow-soft backdrop-blur-md">
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {isKm ? 'កំពុងបើកដំណើរការក្តារហ្គេម' : 'Opening the board'}
          </h1>
          <p className="mt-2.5 flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4 text-accent" />
            <span>{isKm ? 'កំពុងផ្ទៀងផ្ទាត់សម័យរបស់អ្នក…' : 'Verifying your session…'}</span>
          </p>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-sm">
          {/* Main Title & Subtitle */}
          <div className="mb-4">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink sm:text-[26px]">
              {authRequired
                ? insideTelegram
                  ? isKm
                    ? 'លេងក្នុង Telegram'
                    : 'Play inside Telegram'
                  : isKm
                    ? 'ចូលលេងតាម Telegram'
                    : 'Sign in with Telegram'
                : isKm
                  ? 'មិនអាចភ្ជាប់ទៅកាន់ក្តារហ្គេមបានទេ'
                  : 'The board is out of reach'}
            </h1>
            <p className="mt-2.5 text-xs leading-relaxed text-muted sm:text-sm">
              {authRequired
                ? error ??
                  (insideTelegram
                    ? isKm
                      ? 'កម្មវិធី Mini App នេះផ្ទៀងផ្ទាត់អ្នកលេងគ្រប់រូបជាមួយ Telegram ដោយសុវត្ថិភាព។ សូមបើកវាឡើងវិញពី Bot ដើម្បីចូលលេង។'
                      : 'This Mini App verifies every player with Telegram. Reopen it from the bot to sign in securely — there are no passwords and no fake accounts.'
                    : isKm
                      ? 'បើក Telegram Bot របស់យើង ហើយចុច Verify។ ទំព័រនេះនឹងបញ្ចប់ការចូលដោយស្វ័យប្រវត្តិ។'
                      : 'Open our Telegram bot and tap Verify. This page finishes signing in automatically — no password and no website domain setup.')
                : error ?? (isKm ? 'មិនអាចទាក់ទងម៉ាស៊ីនបម្រើហ្គេមបានទេ។ សូមព្យាយាមម្តងទៀត។' : 'The game server could not be reached. Please try again.')}
            </p>

            {authRequired && code && !loginBusy ? (
              <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted/80">
                {code.replaceAll('_', ' ')}
              </p>
            ) : null}
          </div>

          {/* Browser Login Card */}
          {browserLoginAvailable ? (
            <div className="mb-4 rounded-3xl border border-line bg-surface/90 p-4.5 text-left shadow-soft backdrop-blur-md">
              {loginBusy ? (
                <>
                  <div className="flex items-start gap-3">
                    <span className="relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#24A1DE]/15 text-[#24A1DE]">
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface animate-pulse" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-ink">
                        {loginPhase === 'starting'
                          ? isKm
                            ? 'កំពុងបើក Telegram…'
                            : 'Opening Telegram…'
                          : isKm
                            ? 'កំពុងរង់ចាំ Telegram'
                            : 'Waiting for Telegram'}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {loginPhase === 'starting'
                          ? isKm
                            ? 'កំពុងបង្កើតតំណភ្ជាប់ចូលដែលប្រើបានតែម្តងដោយសុវត្ថិភាព។'
                            : 'Creating a secure, one-time sign-in link.'
                          : isKm
                            ? 'ចុច Verify ក្នុង Telegram chat រួចត្រឡប់មកផ្ទាំងនេះវិញ។'
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
                      <span>{isKm ? 'បើក Telegram ម្តងទៀត' : 'Open Telegram again'}</span>
                    </a>
                  ) : null}

                  {loginPhase === 'waiting' ? (
                    <button
                      type="button"
                      onClick={() => void startBrowserLogin()}
                      className="mt-2.5 w-full text-center text-[11px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      {isKm ? 'ប្រើគណនី Telegram ផ្សេង' : 'Use a different Telegram account'}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#24A1DE]/15 text-[#24A1DE]">
                      <Send className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-ink">
                          {isKm ? 'ចុចមួយប៉ះក្នុង Telegram' : 'One tap in Telegram'}
                        </p>
                        <span className="rounded-full bg-accent/10 px-1.5 py-0.2 text-[9.5px] font-bold text-accent">
                          FAST
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted">
                        {isKm
                          ? 'យើងបើក Bot ក្នុងផ្ទាំងថ្មី។ ចុចប៊ូតុង Verify ដែល Bot ផ្ញើ រួចត្រឡប់មកទីនេះវិញ។'
                          : 'We open the game bot in a new tab. Tap the Verify button it sends, then return here.'}
                      </p>
                    </div>
                  </div>

                  {/* 3 Step Visual Flow */}
                  <div className="mt-3.5 flex items-center justify-between rounded-xl border border-line/60 bg-elevated/40 px-3 py-2 text-[10.5px] text-muted">
                    <span className="flex items-center gap-1">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-accent/20 text-[9px] font-bold text-accent">1</span>
                      {isKm ? 'បើក Bot' : 'Open Bot'}
                    </span>
                    <span className="text-line">→</span>
                    <span className="flex items-center gap-1">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-accent/20 text-[9px] font-bold text-accent">2</span>
                      {isKm ? 'ចុច Verify' : 'Tap Verify'}
                    </span>
                    <span className="text-line">→</span>
                    <span className="flex items-center gap-1 text-ink font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      {isKm ? 'លេងភ្លាមៗ' : 'Instant Play'}
                    </span>
                  </div>

                  {loginError ? (
                    <p
                      role="alert"
                      className="mt-3 flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/5 p-2.5 text-[11px] leading-relaxed text-danger"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>{loginError}</span>
                    </p>
                  ) : null}

                  <Button
                    size="lg"
                    icon={ExternalLink}
                    className="mt-4 w-full bg-[#24A1DE] text-white hover:bg-[#2092cb]"
                    onClick={() => void startBrowserLogin()}
                  >
                    {loginPhase === 'expired' || loginPhase === 'failed'
                      ? isKm
                        ? 'ព្យាយាមម្តងទៀតជាមួយ Telegram'
                        : 'Try again with Telegram'
                      : isKm
                        ? 'បន្តជាមួយ Telegram'
                        : 'Continue with Telegram'}
                  </Button>
                  <p className="mt-2 text-center text-[10.5px] leading-relaxed text-muted">
                    {isKm
                      ? 'Telegram នឹងបង្ហាញគណនី និងប៊ូតុង Verify។ គ្មានព័ត៌មានសម្ងាត់ណាមួយត្រូវបានផ្ញើមកទំព័រនេះឡើយ។'
                      : 'Telegram will show the account and a Verify button. Nothing is sent to this page until you tap it.'}
                  </p>
                </>
              )}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex w-full flex-col gap-2">
            {authRequired && insideTelegram && botUsername ? (
              <Button size="lg" icon={ExternalLink} onClick={() => openTelegramBot(botUsername)}>
                {isKm ? 'បើកក្នុង Telegram' : 'Open in Telegram'}
              </Button>
            ) : null}

            {guestAuthAvailable ? (
              <Button
                variant="secondary"
                size="md"
                icon={guestBusy ? Loader2 : Sparkles}
                disabled={guestBusy}
                onClick={() => void handleGuestLogin()}
                className="w-full border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10"
              >
                {guestBusy
                  ? isKm ? 'កំពុងចូលជាភ្ញៀវ…' : 'Entering demo…'
                  : isKm ? 'ចូលលេងជាភ្ញៀវសាកល្បង (Demo)' : 'Continue as Guest (Demo)'}
              </Button>
            ) : null}

            <Button
              variant={browserLoginAvailable ? 'secondary' : 'primary'}
              size="lg"
              icon={RefreshCw}
              onClick={retry}
            >
              {isKm ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
            </Button>
          </div>

          {/* Trust and Security Footnote */}
          {authRequired ? (
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line/80 bg-surface/60 p-3.5 text-left backdrop-blur-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                {isKm
                  ? 'ការចូល Telegram របស់អ្នកត្រូវបានផ្ទៀងផ្ទាត់ដោយម៉ាស៊ីនបម្រើហ្គេមតាមរយៈ Bot។ Bot token មិនដែលត្រូវបានផ្ញើមកឧបករណ៍នេះទេ ហើយការចូលរបស់អ្នកមានសុវត្ថិភាពខ្ពស់។'
                  : 'Your Telegram login is verified by the game server through the bot. The bot token never reaches this device, and development sign-in is disabled in production.'}
              </p>
            </div>
          ) : (
            <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-left">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                {error ?? (isKm ? 'ប្រសិនបើបញ្ហានេះនៅតែបន្តកើតមាន សូមពិនិត្យការតភ្ជាប់របស់អ្នក ឬបើកកម្មវិធីឡើងវិញពី Telegram។' : 'If this keeps happening, check your connection or reopen the app from Telegram.')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
