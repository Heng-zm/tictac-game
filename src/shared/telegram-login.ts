import type { UserProfile } from './game-types';

/**
 * Browser sign-in is delegated to the Telegram bot:
 *
 * 1. The browser asks the server for a short-lived, one-time sign-in request.
 * 2. The server redirects the user to `https://t.me/<bot>?start=login_<id>`.
 * 3. The bot replies with a Verify button. Tapping it binds the Telegram
 *    account to the pending request.
 * 4. The browser polls the status endpoint and receives the normal session
 *    cookie once the request is verified.
 *
 * This avoids the Telegram Login Widget, which requires an exact BotFather
 * `/setdomain` match and is unavailable on many deployments.
 */
export const TELEGRAM_LOGIN_START_PREFIX = 'login_';

export interface TelegramLoginStartResponse {
  /** Deep link that opens the bot with the pending sign-in payload. */
  url: string;
  /** ISO timestamp after which the pending sign-in can no longer be verified. */
  expiresAt: string;
}

export type TelegramLoginStatusResponse =
  | {
      status: 'pending';
      /** Reopened by the browser if the user closed the Telegram tab. */
      url: string;
      expiresAt: string;
    }
  | { status: 'verified'; user: UserProfile }
  | { status: 'expired' }
  | { status: 'invalid' };
