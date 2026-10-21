import { createHash, randomBytes } from 'node:crypto';

export interface RenderDefaultsResult {
  applied: boolean;
  generatedSessionSecret: boolean;
  derivedWebhookSecret: boolean;
  normalizedWebhookSecret: boolean;
  demoMode: boolean;
  memoryMode: boolean;
}

const TELEGRAM_WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

function hashWebhookSecret(value: string): string {
  return createHash('sha256').update('telegram-webhook-secret:').update(value).digest('hex');
}

/**
 * Render sets NODE_ENV=production and exposes RENDER_EXTERNAL_URL. To make a
 * first deployment work without a dashboard configuration, fill in the values
 * that can be derived safely:
 *
 * - Mini App URL and CORS origin from the Render URL.
 * - A random session secret (sessions reset on restart; set SESSION_SECRET for
 *   stable sessions).
 * - In-memory mode when no database is configured (explicit, logged warning).
 * - Guest demo mode when neither a database nor a Telegram bot is configured.
 * - A Telegram webhook URL derived from the public Render URL when a bot token
 *   is present. A Telegram-safe webhook secret is derived from SESSION_SECRET
 *   if one was not supplied (Render's generated secrets are base64, which
 *   Telegram rejects for webhook secret tokens).
 *
 * A real production deployment should set its own SESSION_SECRET,
 * TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and DATABASE_URL. Setting
 * DEMO_MODE=false disables the automatic guest fallback.
 */
export function applyRenderDefaults(env: NodeJS.ProcessEnv = process.env): RenderDefaultsResult {
  const isRender = env.RENDER === 'true' || Boolean(env.RENDER_EXTERNAL_URL);
  if (!isRender) {
    return {
      applied: false,
      generatedSessionSecret: false,
      derivedWebhookSecret: false,
      normalizedWebhookSecret: false,
      demoMode: false,
      memoryMode: false,
    };
  }

  // Render may inject an empty NODE_ENV for an existing service. Treat an empty
  // value as unset and default to production on the platform.
  if (!env.NODE_ENV?.trim()) env.NODE_ENV = 'production';

  const externalUrl = env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, '');
  if (externalUrl) {
    if (!env.MINI_APP_URL?.trim()) env.MINI_APP_URL = externalUrl;
    if (!env.CORS_ORIGINS?.trim()) env.CORS_ORIGINS = externalUrl;
  }
  if (!env.TRUST_PROXY?.trim()) env.TRUST_PROXY = '1';

  // Render's generateValue produces base64 by default. Telegram only accepts
  // webhook secret tokens made of [A-Za-z0-9_-], so deterministically hash any
  // incompatible value instead of failing startup.
  let normalizedWebhookSecret = false;
  const providedWebhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (providedWebhookSecret && !TELEGRAM_WEBHOOK_SECRET_PATTERN.test(providedWebhookSecret)) {
    env.TELEGRAM_WEBHOOK_SECRET = hashWebhookSecret(providedWebhookSecret);
    normalizedWebhookSecret = true;
  }

  let generatedSessionSecret = false;
  if (!env.SESSION_SECRET?.trim()) {
    env.SESSION_SECRET = randomBytes(48).toString('base64url');
    generatedSessionSecret = true;
  }

  let memoryMode = false;
  if (!env.DATABASE_URL?.trim()) {
    if (!env.DB_MODE?.trim()) {
      env.DB_MODE = 'memory';
      memoryMode = true;
    } else {
      memoryMode = env.DB_MODE.trim() === 'memory';
    }
  }

  const demoDisabled = env.DEMO_MODE?.trim() === 'false' || env.DEMO_MODE?.trim() === '0';
  if (!env.TELEGRAM_BOT_TOKEN?.trim() && !env.DATABASE_URL?.trim() && !demoDisabled) {
    if (!env.DEMO_MODE?.trim()) env.DEMO_MODE = 'true';
    if (!env.DEV_AUTH_ENABLED?.trim()) env.DEV_AUTH_ENABLED = 'true';
  }

  // A webhook is preferable in production: Telegram wakes the service instead
  // of relying on a long-polling connection. Use the custom Mini App origin if
  // one was configured, otherwise the Render URL.
  let derivedWebhookSecret = false;
  const publicUrl = env.MINI_APP_URL?.trim() || externalUrl;
  if (env.TELEGRAM_BOT_TOKEN?.trim() && publicUrl && !env.TELEGRAM_WEBHOOK_URL?.trim()) {
    try {
      env.TELEGRAM_WEBHOOK_URL = new URL('/api/telegram/webhook', publicUrl).toString();
      if (!env.TELEGRAM_WEBHOOK_SECRET?.trim() && env.SESSION_SECRET?.trim()) {
        env.TELEGRAM_WEBHOOK_SECRET = hashWebhookSecret(env.SESSION_SECRET);
        derivedWebhookSecret = true;
      }
    } catch {
      // Leave it unset; loadConfig will report the invalid public URL.
    }
  }

  return {
    applied: true,
    generatedSessionSecret,
    derivedWebhookSecret,
    normalizedWebhookSecret,
    demoMode: env.DEMO_MODE?.trim() === 'true' || env.DEMO_MODE?.trim() === '1',
    memoryMode,
  };
}
