import { AlertTriangle, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import type { AppConfigPayload } from '../../shared/game-types';
import type { BootPhase } from '../hooks/use-game-client';
import { openTelegramBot } from '../lib/telegram';
import { Button, Logo, Spinner } from '../components/ui';

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
            {authRequired ? 'Play inside Telegram' : 'The board is out of reach'}
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            {authRequired
              ? 'This Mini App verifies every player with Telegram. Open it from the bot to sign in securely — there are no passwords and no fake accounts.'
              : error ?? 'The game server could not be reached. Please try again.'}
          </p>

          {authRequired && code ? <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">{code.replaceAll('_', ' ')}</p> : null}

          <div className="mt-7 flex w-full max-w-xs flex-col gap-2">
            {authRequired && config?.botUsername ? (
              <Button
                size="lg"
                icon={ExternalLink}
                onClick={() => openTelegramBot(config.botUsername as string)}
              >
                Open in Telegram
              </Button>
            ) : null}
            <Button
              variant={authRequired && config?.botUsername ? 'secondary' : 'primary'}
              size="lg"
              icon={RefreshCw}
              onClick={onRetry}
            >
              Try again
            </Button>
          </div>

          {authRequired ? (
            <div className="mt-7 flex max-w-xs items-start gap-2 rounded-2xl border border-line bg-elevated/60 p-3 text-left">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
              <p className="text-[11px] leading-relaxed text-muted">
                Your Telegram login is validated on the server with the bot token. The token never reaches this
                device, and development sign-in is disabled in production.
              </p>
            </div>
          ) : (
            <div className="mt-7 flex max-w-xs items-start gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-left">
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
