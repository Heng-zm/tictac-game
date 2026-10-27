/**
 * Shared constants for the Telegram Login Widget redirect. The state cookie
 * binds a signed widget response to the browser that started the sign-in,
 * which prevents another site from replaying a valid callback into a
 * victim's browser (login CSRF).
 */
export const TELEGRAM_LOGIN_STATE_COOKIE = 'ttt_login_state';
export const TELEGRAM_LOGIN_STATE_PATH = '/api/auth/telegram/widget';
export const TELEGRAM_LOGIN_STATE_MAX_AGE_SECONDS = 600;

/** A signed Login Widget response is accepted for at most ten minutes. */
export const TELEGRAM_LOGIN_MAX_AGE_SECONDS = 600;

export function isTelegramLoginState(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{32}$/.test(value);
}
