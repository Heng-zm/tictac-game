import { randomBytes } from 'node:crypto';

export interface RenderDefaultsResult {
  applied: boolean;
  generatedSessionSecret: boolean;
  demoMode: boolean;
  memoryMode: boolean;
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
 *
 * A real production deployment should set its own SESSION_SECRET,
 * TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, and DATABASE_URL. Setting
 * DEMO_MODE=false disables the automatic guest fallback.
 */
export function applyRenderDefaults(env: NodeJS.ProcessEnv = process.env): RenderDefaultsResult {
  const isRender = env.RENDER === 'true' || Boolean(env.RENDER_EXTERNAL_URL);
  if (!isRender) {
    return { applied: false, generatedSessionSecret: false, demoMode: false, memoryMode: false };
  }

  const externalUrl = env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, '');
  if (externalUrl) {
    env.MINI_APP_URL ??= externalUrl;
    env.CORS_ORIGINS ??= externalUrl;
  }
  env.TRUST_PROXY ??= '1';

  let generatedSessionSecret = false;
  if (!env.SESSION_SECRET?.trim()) {
    env.SESSION_SECRET = randomBytes(48).toString('base64url');
    generatedSessionSecret = true;
  }

  let memoryMode = false;
  if (!env.DATABASE_URL?.trim()) {
    if (!env.DB_MODE) {
      env.DB_MODE = 'memory';
      memoryMode = true;
    } else {
      memoryMode = env.DB_MODE === 'memory';
    }
  }

  const demoDisabled = env.DEMO_MODE === 'false' || env.DEMO_MODE === '0';
  if (!env.TELEGRAM_BOT_TOKEN?.trim() && !env.DATABASE_URL?.trim() && !demoDisabled) {
    env.DEMO_MODE ??= 'true';
    env.DEV_AUTH_ENABLED ??= 'true';
  }

  return {
    applied: true,
    generatedSessionSecret,
    demoMode: env.DEMO_MODE === 'true' || env.DEMO_MODE === '1',
    memoryMode,
  };
}
