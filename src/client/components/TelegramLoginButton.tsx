import { useEffect, useRef, useState } from 'react';
import {
  TELEGRAM_LOGIN_STATE_COOKIE,
  TELEGRAM_LOGIN_STATE_MAX_AGE_SECONDS,
  TELEGRAM_LOGIN_STATE_PATH,
} from '../../shared/telegram-login';
import { cn } from '../lib/cn';

/**
 * Creates a short-lived, client-readable state cookie and returns the matching
 * state value. The server only accepts a widget callback whose `state` matches
 * this cookie, binding the sign-in to this browser.
 */
function createLoginState(): string | null {
  try {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const state = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const secure = window.location.protocol === 'https:';
    const sameSite = secure ? 'None' : 'Lax';
    const secureAttribute = secure ? '; Secure' : '';
    document.cookie = `${TELEGRAM_LOGIN_STATE_COOKIE}=${state}; Path=${TELEGRAM_LOGIN_STATE_PATH}; Max-Age=${TELEGRAM_LOGIN_STATE_MAX_AGE_SECONDS}; SameSite=${sameSite}${secureAttribute}`;
    return state;
  } catch {
    return null;
  }
}

/**
 * Renders Telegram's official Login Widget. The widget redirects the browser
 * to our callback route with a signed payload, so no eval-based `data-onauth`
 * callback is needed and the Content Security Policy can stay strict.
 *
 * The deployment domain must be linked to the bot with BotFather `/setdomain`,
 * otherwise Telegram rejects the request inside the widget iframe.
 */
export function TelegramLoginButton({
  botUsername,
  className,
}: {
  botUsername: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setFailed(false);
    container.replaceChildren();

    const state = createLoginState();
    if (!state) {
      setFailed(true);
      return;
    }

    // Preserve the current screen (the app uses hash routes) across the
    // top-level redirect, but drop a stale sign-in error from the URL.
    const current = new URL(window.location.href);
    current.searchParams.delete('telegram_login');
    const returnTo = `${current.pathname}${current.search}${current.hash}`;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.dataset.telegramLogin = botUsername;
    script.dataset.size = 'large';
    script.dataset.radius = '10';
    script.dataset.requestAccess = 'write';
    script.dataset.authUrl = `/api/auth/telegram/widget/callback?next=${encodeURIComponent(returnTo)}&state=${state}`;
    script.onerror = () => setFailed(true);

    container.appendChild(script);

    return () => {
      container.replaceChildren();
    };
  }, [botUsername]);

  return (
    <div className={cn('flex min-h-11 flex-col items-center justify-center gap-2', className)}>
      <div ref={containerRef} className="flex min-h-11 items-center justify-center" />
      {failed ? (
        <p className="max-w-[17rem] text-[11px] leading-relaxed text-muted" role="alert">
          Telegram sign-in did not load. Check your connection, or open the game inside Telegram.
        </p>
      ) : null}
    </div>
  );
}
