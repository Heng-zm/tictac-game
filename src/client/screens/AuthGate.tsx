import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Dices,
  ExternalLink,
  Gamepad2,
  Loader2,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Trophy,
  User,
  Zap,
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
import { isKhmer, normalizeLanguage, type SupportedLanguage } from '../lib/language';
import { Button, Logo, Spinner } from '../components/ui';
import { LanguageButton } from '../components/LanguageButton';

type BrowserLoginPhase = 'idle' | 'starting' | 'waiting' | 'expired' | 'failed';

const RANDOM_GUEST_NAMES = [
  'SpeedyFox',
  'Grandmaster',
  'SilentBlade',
  'AngkorHero',
  'TicTacPro',
  'LuckyStar',
  'CyberGhost',
  'SkyWalker',
  'ShadowStrike',
  'IronClaw',
];

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
  // The server rejects `/api/auth/dev` unless dev auth is enabled; `demoMode`
  // alone is not enough, so offer the button on the same condition.
  const guestAuthAvailable = authRequired && Boolean(config?.devAuthEnabled);

  const getInitialLanguage = (): SupportedLanguage => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('ttt_preferred_lang') : null;
      if (stored) return normalizeLanguage(stored);
    } catch {
      // Ignore
    }
    const tgLang = webApp?.initDataUnsafe?.user?.language_code;
    if (tgLang) return normalizeLanguage(tgLang);
    return typeof navigator !== 'undefined' && isKhmer(navigator.language) ? 'km' : 'en';
  };

  const [lang, setLang] = useState<SupportedLanguage>(getInitialLanguage);
  const isKm = lang === 'km';

  const [loginPhase, setLoginPhase] = useState<BrowserLoginPhase>('idle');
  const [loginUrl, setLoginUrl] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [guestBusy, setGuestBusy] = useState(false);
  const [showNameCustomizer, setShowNameCustomizer] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [copied, setCopied] = useState(false);
  const loginBusy = loginPhase === 'starting' || loginPhase === 'waiting';

  const handleLanguageChange = (nextLang: SupportedLanguage) => {
    setLang(nextLang);
    try {
      window.localStorage.setItem('ttt_preferred_lang', nextLang);
    } catch {
      // localStorage might not be available
    }
    document.documentElement.lang = nextLang;
    document.documentElement.setAttribute('data-lang', nextLang);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.setAttribute('data-lang', lang);
  }, [lang]);

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

  async function handleGuestLogin(customNameOverride?: string): Promise<void> {
    setGuestBusy(true);
    setLoginError(null);
    try {
      const name = (customNameOverride ?? guestName).trim();
      if (name) {
        await authenticateDev(getDeviceKey(), name, lang);
      } else {
        // No display name: the server derives a unique "Guest XXXX" per device,
        // so demo accounts stay distinguishable on the leaderboard.
        await authenticateDev(getDeviceKey());
      }
      onRetry();
    } catch (err) {
      setLoginError(errorMessage(err));
    } finally {
      setGuestBusy(false);
    }
  }

  function handleRandomName(): void {
    const random = RANDOM_GUEST_NAMES[Math.floor(Math.random() * RANDOM_GUEST_NAMES.length)]!;
    const suffix = Math.floor(100 + Math.random() * 900);
    setGuestName(`${random}${suffix}`);
  }

  async function handleCopyLink(): Promise<void> {
    if (!loginUrl) return;
    try {
      await navigator.clipboard.writeText(loginUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is unavailable
    }
  }

  function retry(): void {
    setLoginPhase('idle');
    setLoginError(null);
    setLoginUrl(null);
    onRetry();
  }

  return (
    <div className="relative flex min-h-[var(--app-vh)] flex-col items-center justify-center overflow-x-hidden px-4 py-8 text-center sm:px-6 sm:py-12">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute -top-28 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-accent/15 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-28 left-1/3 h-96 w-96 rounded-full bg-[#24A1DE]/15 blur-3xl" aria-hidden />

      {/* Decorative background floating pieces */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none opacity-10 dark:opacity-15" aria-hidden>
        <span className="absolute top-[12%] left-[8%] text-5xl font-black text-accent rotate-12">✕</span>
        <span className="absolute top-[18%] right-[10%] text-6xl font-black text-[#e11d48] -rotate-12">○</span>
        <span className="absolute bottom-[20%] left-[12%] text-6xl font-black text-[#e11d48] rotate-45">○</span>
        <span className="absolute bottom-[14%] right-[14%] text-5xl font-black text-accent -rotate-45">✕</span>
      </div>

      {/* Top Header Bar */}
      <header className="absolute top-4 inset-x-4 z-20 flex items-center justify-between sm:top-6 sm:inset-x-8 max-w-2xl mx-auto">
        <div className="flex items-center gap-2 rounded-full border border-line/60 bg-surface/70 px-3 py-1 backdrop-blur-md shadow-xs">
          <Gamepad2 className="h-3.5 w-3.5 text-accent" />
          <span className="text-[11px] font-bold tracking-wider text-muted uppercase">
            {isKm ? 'ការ៉ូ ARENA' : 'TIC TAC TOE'}
          </span>
        </div>

        <LanguageButton
          languageCode={lang}
          onLanguageChange={handleLanguageChange}
          variant="circle"
          size="md"
          className="shadow-md hover:scale-105 active:scale-95 transition-transform"
        />
      </header>

      {/* Hero Branding */}
      <div className="relative mb-6 mt-8 flex flex-col items-center">
        <div className="relative group">
          {/* Subtle glowing ring aura */}
          <div className="absolute -inset-3 rounded-3xl bg-gradient-to-r from-accent/30 via-[#24A1DE]/30 to-accent/30 blur-xl opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse" />
          <Logo size="lg" className="relative animate-pop-in drop-shadow-xl" />
          <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#24A1DE] text-white shadow-md ring-2 ring-surface animate-bounce duration-1000">
            <Send className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </div>

      {booting ? (
        <div className="relative z-10 w-full max-w-sm rounded-3xl border border-line/80 bg-surface/90 p-8 shadow-glass backdrop-blur-2xl animate-fade-in">
          <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Spinner className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-ink">
            {isKm ? 'កំពុងបើកដំណើរការក្តារហ្គេម' : 'Opening the board'}
          </h1>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {isKm ? 'កំពុងផ្ទៀងផ្ទាត់សម័យរបស់អ្នក និងរៀបចំបន្ទប់ប្រកួត…' : 'Verifying your session and synchronizing arena…'}
          </p>
        </div>
      ) : (
        <div className="relative z-10 w-full max-w-md animate-fade-up">
          {/* Main Title & Subtitle */}
          <div className="mb-5 text-center">
            <h1 className="text-2xl font-black leading-tight tracking-tight text-ink sm:text-[28px]">
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
            <p className="mt-2 text-xs leading-relaxed text-muted sm:text-sm max-w-sm mx-auto">
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
              <span className="mt-2.5 inline-block rounded-full bg-danger/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-danger">
                {code.replaceAll('_', ' ')}
              </span>
            ) : null}
          </div>

          {/* Browser Login Card */}
          {browserLoginAvailable ? (
            <div className="mb-4 rounded-3xl border border-line/80 bg-surface/90 p-5 text-left shadow-glass backdrop-blur-2xl">
              {loginBusy ? (
                <>
                  <div className="flex items-start gap-3.5">
                    <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#24A1DE]/15 text-[#24A1DE]">
                      <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                      <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface animate-ping" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-ink">
                          {loginPhase === 'starting'
                            ? isKm
                              ? 'កំពុងបើក Telegram…'
                              : 'Opening Telegram…'
                            : isKm
                              ? 'កំពុងរង់ចាំ Telegram'
                              : 'Waiting for Telegram'}
                        </p>
                        {loginPhase === 'waiting' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold text-emerald-600 dark:text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {isKm ? 'រង់ចាំការផ្ទៀងផ្ទាត់' : 'Awaiting Verify'}
                          </span>
                        ) : null}
                      </div>
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
                    <div className="mt-4 flex flex-col gap-2">
                      <a
                        href={loginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#24A1DE] to-[#2092cb] px-4 text-sm font-bold text-white shadow-md shadow-[#24A1DE]/25 transition hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden />
                        <span>{isKm ? 'បើក Telegram ម្តងទៀត' : 'Open Telegram again'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => void handleCopyLink()}
                        className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-line bg-elevated/70 px-3 text-xs font-semibold text-ink transition hover:bg-surface hover:border-line focus-visible:outline-none"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {isKm ? 'បានចម្លងតំណភ្ជាប់!' : 'Link copied!'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5 text-muted" aria-hidden />
                            <span>{isKm ? 'ចម្លងតំណភ្ជាប់' : 'Copy link'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ) : null}

                  {loginPhase === 'waiting' ? (
                    <button
                      type="button"
                      onClick={() => void startBrowserLogin()}
                      className="mt-3 w-full text-center text-[11px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline"
                    >
                      {isKm ? 'ប្រើគណនី Telegram ផ្សេង' : 'Use a different Telegram account'}
                    </button>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3.5">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#24A1DE]/15 text-[#24A1DE] shadow-xs">
                      <Send className="h-5 w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-ink">
                          {isKm ? 'ចុចមួយប៉ះក្នុង Telegram' : 'One tap in Telegram'}
                        </p>
                        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-extrabold tracking-wider text-accent">
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
                  <div className="mt-4 flex items-center justify-between rounded-2xl border border-line/60 bg-elevated/40 px-3.5 py-2.5 text-[11px] text-muted">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">1</span>
                      {isKm ? 'បើក Bot' : 'Open Bot'}
                    </span>
                    <span className="text-line text-sm">→</span>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 text-[10px] font-bold text-accent">2</span>
                      {isKm ? 'ចុច Verify' : 'Tap Verify'}
                    </span>
                    <span className="text-line text-sm">→</span>
                    <span className="flex items-center gap-1.5 text-ink font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-success" />
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
                    className="mt-4 w-full bg-gradient-to-r from-[#24A1DE] via-[#2092cb] to-[#1c84b8] text-white shadow-md shadow-[#24A1DE]/25 hover:brightness-105 active:scale-[0.99] font-bold"
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

          {/* Action Buttons & Guest Login Section */}
          <div className="flex w-full flex-col gap-2.5">
            {authRequired && insideTelegram && botUsername ? (
              <Button
                size="lg"
                icon={ExternalLink}
                onClick={() => openTelegramBot(botUsername)}
                className="w-full bg-[#24A1DE] text-white hover:bg-[#2092cb] font-bold shadow-md shadow-[#24A1DE]/25"
              >
                {isKm ? 'បើកក្នុង Telegram' : 'Open in Telegram'}
              </Button>
            ) : null}

            {guestAuthAvailable ? (
              <div className="w-full rounded-2xl border border-line/70 bg-surface/70 p-3 backdrop-blur-md text-left">
                {showNameCustomizer ? (
                  <div className="mb-2.5 rounded-xl border border-line bg-elevated/80 p-3 shadow-xs">
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="guest-name-input" className="text-xs font-semibold text-ink flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-accent" />
                        <span>{isKm ? 'ឈ្មោះភ្ញៀវរបស់អ្នក' : 'Your guest nickname'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleRandomName}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent hover:underline"
                        title={isKm ? 'ចៃដន្យ' : 'Randomize'}
                      >
                        <Dices className="h-3.5 w-3.5" />
                        <span>{isKm ? 'ចៃដន្យ' : 'Roll'}</span>
                      </button>
                    </div>
                    <input
                      id="guest-name-input"
                      type="text"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder={isKm ? 'ឧ. Sokha (ស្រេចចិត្ត)' : 'e.g. Alex (optional)'}
                      maxLength={32}
                      className="h-9 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
                    />
                  </div>
                ) : null}

                <Button
                  variant="secondary"
                  size="md"
                  icon={Sparkles}
                  loading={guestBusy}
                  disabled={loginBusy}
                  onClick={() => void handleGuestLogin()}
                  className="w-full border border-dashed border-accent/40 bg-accent/5 hover:bg-accent/10 font-bold"
                >
                  {guestBusy
                    ? isKm ? 'កំពុងចូលជាភ្ញៀវ…' : 'Entering demo…'
                    : isKm ? 'ចូលលេងជាភ្ញៀវសាកល្បង (Demo)' : 'Continue as Guest (Demo)'}
                </Button>

                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowNameCustomizer(!showNameCustomizer)}
                    className="text-[11px] font-medium text-muted hover:text-ink underline-offset-4 hover:underline"
                  >
                    {showNameCustomizer
                      ? isKm ? 'លាក់ការកំណត់ឈ្មោះ' : 'Hide nickname options'
                      : isKm ? 'កំណត់ឈ្មោះភ្ញៀវដោយខ្លួនឯង' : 'Customize nickname'}
                  </button>
                </div>
              </div>
            ) : null}

            <Button
              variant={browserLoginAvailable ? 'secondary' : 'primary'}
              size="lg"
              icon={RefreshCw}
              disabled={loginBusy || guestBusy}
              onClick={retry}
              className="w-full"
            >
              {isKm ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
            </Button>
          </div>

          {/* Features Highlight Pill Row */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-surface/60 px-2.5 py-1 text-[10.5px] font-medium text-muted backdrop-blur-xs">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>{isKm ? 'ប្រកួតផ្ទាល់ Real-Time' : 'Real-Time PvP'}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-surface/60 px-2.5 py-1 text-[10.5px] font-medium text-muted backdrop-blur-xs">
              <Radio className="h-3 w-3 text-sky-500" />
              <span>{isKm ? 'វិទ្យុទាក់ទង Walkie-Talkie' : 'Walkie-Talkie'}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-surface/60 px-2.5 py-1 text-[10.5px] font-medium text-muted backdrop-blur-xs">
              <Trophy className="h-3 w-3 text-amber-400" />
              <span>{isKm ? 'តារាងពិន្ទុសកល' : 'Global Ladder'}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line/60 bg-surface/60 px-2.5 py-1 text-[10.5px] font-medium text-muted backdrop-blur-xs">
              <Smile className="h-3 w-3 text-emerald-500" />
              <span>{isKm ? 'ស្ទីគ័រ Khmer & EN' : 'Live Stickers'}</span>
            </span>
          </div>

          {/* Trust and Security Footnote */}
          {authRequired ? (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-line/80 bg-surface/60 p-3.5 text-left backdrop-blur-md shadow-xs">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                {config?.demoMode
                  ? isKm
                    ? 'ការដាក់ពង្រាយនេះដំណើរការក្នុងរបៀបសាកល្បង។ ការចូលជាភ្ញៀវត្រូវបានបើក ហើយទិន្នន័យអាចត្រូវបានកំណត់ឡើងវិញគ្រប់ពេល។'
                    : 'This deployment runs in demo mode. Guest sign-in is enabled and data may be reset at any time.'
                  : isKm
                    ? 'ការចូល Telegram របស់អ្នកត្រូវបានផ្ទៀងផ្ទាត់ដោយម៉ាស៊ីនបម្រើហ្គេមតាមរយៈ Bot។ Bot token មិនដែលត្រូវបានផ្ញើមកឧបករណ៍នេះទេ ហើយការចូលរបស់អ្នកមានសុវត្ថិភាពខ្ពស់។'
                    : 'Your Telegram login is verified by the game server through the bot. The bot token never reaches this device, and development sign-in is disabled in production.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3.5 text-left">
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
