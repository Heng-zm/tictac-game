import 'dotenv/config';
import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().optional(),
    DB_MODE: z.enum(['postgres', 'memory']).optional(),
    DEMO_MODE: booleanString.optional(),
    SESSION_SECRET: z.string().min(32).optional(),
    MINI_APP_URL: z.string().url().optional(),
    TELEGRAM_BOT_TOKEN: z
      .string()
      .regex(/^\d+:[A-Za-z0-9_-]{30,}$/, 'Malformed TELEGRAM_BOT_TOKEN')
      .optional(),
    TELEGRAM_BOT_USERNAME: z
      .string()
      .regex(/^@?[A-Za-z0-9_]{3,64}$/, 'Malformed TELEGRAM_BOT_USERNAME')
      .optional(),
    TELEGRAM_APP_NAME: z
      .string()
      .regex(/^[A-Za-z0-9_]{3,64}$/, 'Malformed TELEGRAM_APP_NAME')
      .optional(),
    TELEGRAM_WEBHOOK_URL: z.string().url().optional(),
    TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .transform((val) => val.replace(/=+$/, ''))
      .refine(
        (val) => val.length >= 16 && val.length <= 256 && /^[A-Za-z0-9_-]+$/.test(val),
        'TELEGRAM_WEBHOOK_SECRET must use only letters, digits, "_" and "-"',
      )
      .optional(),
    DEV_AUTH_ENABLED: booleanString.optional(),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    QUEUE_AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(10_000),
    QUEUE_MAX_WAIT_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(600_000),
    DISCONNECT_GRACE_MS: z.coerce.number().int().min(1_000).max(300_000).default(30_000),
    TURN_TIMEOUT_MS: z.coerce.number().int().min(0).max(600_000).default(0),
    INVITE_TTL_MINUTES: z.coerce.number().int().min(5).max(10_080).default(1_440),
    AUTH_MAX_AGE_SECONDS: z.coerce.number().int().min(60).max(86_400).default(86_400),
    AI_THINK_MIN_MS: z.coerce.number().int().min(0).max(5_000).default(350),
    AI_THINK_MAX_MS: z.coerce.number().int().min(0).max(5_000).default(850),
    AI_FALLBACK_DIFFICULTY: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    MAINTENANCE_INTERVAL_MS: z.coerce.number().int().min(60_000).max(86_400_000).default(3_600_000),
    MATCH_STALE_AFTER_MS: z.coerce.number().int().min(3_600_000).max(604_800_000).default(86_400_000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(0),
  })
  .superRefine((value, ctx) => {
    const isProduction = value.NODE_ENV === 'production';
    const demoMode = value.DEMO_MODE === true;

    if (!value.DATABASE_URL) {
      if (value.DB_MODE === 'postgres') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'Required when DB_MODE=postgres',
        });
      } else if (isProduction && value.DB_MODE !== 'memory' && !demoMode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['DATABASE_URL'],
          message: 'Required in production unless DB_MODE=memory or DEMO_MODE=true',
        });
      }
    }
    if (isProduction && !value.SESSION_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SESSION_SECRET'], message: 'Required in production' });
    }
    if (value.SESSION_SECRET && /change[-_ ]?me|example|placeholder|dev[-_ ]?only/i.test(value.SESSION_SECRET)) {
      if (isProduction) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SESSION_SECRET'],
          message: 'Placeholder secrets are not allowed in production',
        });
      }
    }
    if (isProduction && !value.MINI_APP_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['MINI_APP_URL'], message: 'Required in production' });
    }
    if (isProduction && !demoMode && !value.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_BOT_TOKEN'],
        message: 'Required in production unless DEMO_MODE=true',
      });
    }
    if (isProduction && !demoMode && !value.TELEGRAM_BOT_USERNAME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_BOT_USERNAME'],
        message: 'Required in production unless DEMO_MODE=true',
      });
    }
    if (value.DEV_AUTH_ENABLED && isProduction && !demoMode) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['DEV_AUTH_ENABLED'],
        message: 'Development authentication must be disabled in production unless DEMO_MODE=true',
      });
    }
    if (value.MINI_APP_URL && isProduction && !value.MINI_APP_URL.startsWith('https://')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MINI_APP_URL'],
        message: 'Telegram Mini App URLs must use HTTPS in production',
      });
    }
    if (value.TELEGRAM_WEBHOOK_URL && !value.TELEGRAM_WEBHOOK_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'Required when TELEGRAM_WEBHOOK_URL is set',
      });
    }
    if (value.TELEGRAM_WEBHOOK_SECRET && !value.TELEGRAM_BOT_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TELEGRAM_WEBHOOK_SECRET'],
        message: 'Requires TELEGRAM_BOT_TOKEN',
      });
    }
    if (value.AI_THINK_MAX_MS < value.AI_THINK_MIN_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AI_THINK_MAX_MS'],
        message: 'Must be greater than or equal to AI_THINK_MIN_MS',
      });
    }
    if (isProduction && value.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Wildcard CORS origins are not allowed in production',
      });
    }
  });

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  databaseUrl: string | null;
  databaseMode: 'postgres' | 'memory';
  demoMode: boolean;
  sessionSecret: string;
  miniAppUrl: string | null;
  telegramBotToken: string | null;
  telegramBotUsername: string | null;
  telegramAppName: string | null;
  telegramWebhookUrl: string | null;
  telegramWebhookSecret: string | null;
  devAuthEnabled: boolean;
  allowedOrigins: string[];
  queueAiTimeoutMs: number;
  queueMaxWaitMs: number;
  disconnectGraceMs: number;
  turnTimeoutMs: number;
  inviteTtlMinutes: number;
  authMaxAgeSeconds: number;
  aiThinkMinMs: number;
  aiThinkMaxMs: number;
  aiFallbackDifficulty: 'EASY' | 'MEDIUM' | 'HARD';
  maintenanceIntervalMs: number;
  matchStaleAfterMs: number;
  logLevel: string;
  trustProxy: number;
}

const DEV_SESSION_SECRET = 'dev-only-session-secret-not-for-production-4d8f1c2a';

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  // Hosting dashboards commonly store empty strings for "unset" variables.
  // Normalize them before Zod applies defaults, otherwise NODE_ENV='' and
  // numeric/boolean values fail parsing instead of falling back.
  const cleanedEnv: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    cleanedEnv[key] = emptyToUndefined(value);
  }

  const isRender = cleanedEnv.RENDER === 'true' || Boolean(cleanedEnv.RENDER_EXTERNAL_URL);
  const nodeEnv = cleanedEnv.NODE_ENV ?? (isRender ? 'production' : 'development');
  const rawDemoMode = cleanedEnv.DEMO_MODE === 'true' || cleanedEnv.DEMO_MODE === '1';
  const defaultDevAuth =
    rawDemoMode || (nodeEnv !== 'production' && nodeEnv !== 'test') ? 'true' : 'false';
  const result = envSchema.safeParse({
    ...cleanedEnv,
    NODE_ENV: nodeEnv,
    DEV_AUTH_ENABLED: cleanedEnv.DEV_AUTH_ENABLED ?? defaultDevAuth,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  const parsed = result.data;
  const isProduction = parsed.NODE_ENV === 'production';
  const sessionSecret = parsed.SESSION_SECRET ?? DEV_SESSION_SECRET;
  if (!isProduction && !parsed.SESSION_SECRET) {
    // Safe for local development only; production validation above requires an explicit secret.
    process.stderr.write('[config] SESSION_SECRET is not set; using an insecure development-only secret.\n');
  }
  if (!isProduction && parsed.DEV_AUTH_ENABLED) {
    process.stderr.write('[config] Development authentication is enabled. Never enable it in production.\n');
  }

  const databaseMode = parsed.DB_MODE ?? (parsed.DATABASE_URL ? 'postgres' : 'memory');

  const origins = parsed.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return {
    nodeEnv: parsed.NODE_ENV,
    isProduction,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL ?? null,
    databaseMode,
    demoMode: parsed.DEMO_MODE === true,
    sessionSecret,
    miniAppUrl: (parsed.MINI_APP_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    telegramBotToken: parsed.TELEGRAM_BOT_TOKEN ?? null,
    telegramBotUsername: parsed.TELEGRAM_BOT_USERNAME?.replace(/^@/, '') ?? null,
    telegramAppName: parsed.TELEGRAM_APP_NAME?.replace(/^\//, '') ?? null,
    telegramWebhookUrl: parsed.TELEGRAM_WEBHOOK_URL ?? null,
    telegramWebhookSecret: parsed.TELEGRAM_WEBHOOK_SECRET ?? null,
    devAuthEnabled: Boolean(parsed.DEV_AUTH_ENABLED) && (!isProduction || parsed.DEMO_MODE === true),
    allowedOrigins: origins,
    queueAiTimeoutMs: parsed.QUEUE_AI_TIMEOUT_MS,
    queueMaxWaitMs: parsed.QUEUE_MAX_WAIT_MS,
    disconnectGraceMs: parsed.DISCONNECT_GRACE_MS,
    turnTimeoutMs: parsed.TURN_TIMEOUT_MS,
    inviteTtlMinutes: parsed.INVITE_TTL_MINUTES,
    authMaxAgeSeconds: parsed.AUTH_MAX_AGE_SECONDS,
    aiThinkMinMs: parsed.AI_THINK_MIN_MS,
    aiThinkMaxMs: parsed.AI_THINK_MAX_MS,
    aiFallbackDifficulty: parsed.AI_FALLBACK_DIFFICULTY,
    maintenanceIntervalMs: parsed.MAINTENANCE_INTERVAL_MS,
    matchStaleAfterMs: parsed.MATCH_STALE_AFTER_MS,
    logLevel: parsed.LOG_LEVEL,
    trustProxy: parsed.TRUST_PROXY,
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function getMiniAppOrigin(config: AppConfig): string | null {
  if (!config.miniAppUrl) return null;
  try {
    return new URL(config.miniAppUrl).origin;
  } catch {
    return null;
  }
}

/** Origins allowed to call the API and open an authenticated Socket.IO connection. */
export function getAllowedOrigins(config: AppConfig): Set<string> {
  const allowed = new Set<string>();
  for (const origin of config.allowedOrigins) {
    try {
      allowed.add(new URL(origin).origin);
    } catch {
      // Malformed origins are ignored here; production validation covers wildcard misuse.
    }
  }
  const miniOrigin = getMiniAppOrigin(config);
  if (miniOrigin) allowed.add(miniOrigin);
  return allowed;
}
