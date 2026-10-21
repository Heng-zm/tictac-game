import { describe, expect, it } from 'vitest';
import { getAllowedOrigins, getMiniAppOrigin, loadConfig } from '../src/server/config';
import { TEST_BOT_TOKEN, TEST_SESSION_SECRET } from './helpers';

const PRODUCTION_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://tictactoe:secret@db.example.com:5432/tictactoe?schema=public',
  SESSION_SECRET: TEST_SESSION_SECRET,
  MINI_APP_URL: 'https://game.example.com',
  TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
  TELEGRAM_BOT_USERNAME: '@tictactoe_bot',
  DEV_AUTH_ENABLED: 'false',
};

describe('configuration', () => {
  it('parses a valid production environment', () => {
    const config = loadConfig(PRODUCTION_ENV);
    expect(config.isProduction).toBe(true);
    expect(config.devAuthEnabled).toBe(false);
    expect(config.miniAppUrl).toBe('https://game.example.com');
    expect(config.telegramBotUsername).toBe('tictactoe_bot');
    expect(config.telegramBotToken).toBe(TEST_BOT_TOKEN);
  });

  it('disables development auth by default outside development', () => {
    const testConfig = loadConfig({ NODE_ENV: 'test' });
    expect(testConfig.devAuthEnabled).toBe(false);
    const devConfig = loadConfig({ NODE_ENV: 'development' });
    expect(devConfig.devAuthEnabled).toBe(true);
  });

  it('requires database, secret, app URL and bot credentials in production', () => {
    const requiredKeys = [
      'DATABASE_URL',
      'SESSION_SECRET',
      'MINI_APP_URL',
      'TELEGRAM_BOT_TOKEN',
      'TELEGRAM_BOT_USERNAME',
    ] as const;
    for (const key of requiredKeys) {
      const env = { ...PRODUCTION_ENV };
      delete env[key];
      expect(() => loadConfig(env)).toThrow(/Invalid environment configuration/);
    }
  });

  it('allows an explicit in-memory database in production but still requires Telegram auth', () => {
    const env = { ...PRODUCTION_ENV, DB_MODE: 'memory' };
    delete env.DATABASE_URL;
    const config = loadConfig(env);
    expect(config.databaseMode).toBe('memory');
    expect(config.databaseUrl).toBeNull();

    const withoutBotToken = { ...env };
    delete withoutBotToken.TELEGRAM_BOT_TOKEN;
    expect(() => loadConfig(withoutBotToken)).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('allows guest demo mode in production without Telegram credentials', () => {
    const env = {
      ...PRODUCTION_ENV,
      DEMO_MODE: 'true',
      DB_MODE: 'memory',
      DEV_AUTH_ENABLED: 'true',
    };
    delete env.DATABASE_URL;
    delete env.TELEGRAM_BOT_TOKEN;
    delete env.TELEGRAM_BOT_USERNAME;
    const config = loadConfig(env);
    expect(config.demoMode).toBe(true);
    expect(config.devAuthEnabled).toBe(true);
    expect(config.databaseMode).toBe('memory');
    expect(config.telegramBotToken).toBeNull();
  });

  it('requires DATABASE_URL when DB_MODE=postgres', () => {
    expect(() =>
      loadConfig({ NODE_ENV: 'development', DB_MODE: 'postgres' }),
    ).toThrow(/Required when DB_MODE=postgres/);
  });

  it('rejects development authentication and placeholder secrets in production', () => {
    expect(() => loadConfig({ ...PRODUCTION_ENV, DEV_AUTH_ENABLED: 'true' })).toThrow(
      /must be disabled in production/,
    );
    expect(() =>
      loadConfig({ ...PRODUCTION_ENV, SESSION_SECRET: 'change-me-change-me-change-me-change-me' }),
    ).toThrow(/Placeholder secrets are not allowed/);
  });

  it('requires HTTPS Mini App URLs and a webhook secret in production', () => {
    expect(() => loadConfig({ ...PRODUCTION_ENV, MINI_APP_URL: 'http://game.example.com' })).toThrow(
      /must use HTTPS/,
    );
    expect(() =>
      loadConfig({
        ...PRODUCTION_ENV,
        TELEGRAM_WEBHOOK_URL: 'https://game.example.com/api/telegram/webhook',
      }),
    ).toThrow(/TELEGRAM_WEBHOOK_SECRET/);
    const withoutBotToken = { ...PRODUCTION_ENV, TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32) };
    delete withoutBotToken.TELEGRAM_BOT_TOKEN;
    expect(() => loadConfig(withoutBotToken)).toThrow(/Requires TELEGRAM_BOT_TOKEN/);
  });

  it('rejects wildcard CORS and invalid timing values', () => {
    expect(() => loadConfig({ ...PRODUCTION_ENV, CORS_ORIGINS: '*' })).toThrow(
      /Wildcard CORS origins are not allowed/,
    );
    expect(() =>
      loadConfig({ ...PRODUCTION_ENV, AI_THINK_MIN_MS: '900', AI_THINK_MAX_MS: '100' }),
    ).toThrow(/AI_THINK_MAX_MS/);
    expect(() => loadConfig({ ...PRODUCTION_ENV, PORT: '70000' })).toThrow(/PORT/);
  });

  it('normalizes allowed origins and Mini App origins', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      CORS_ORIGINS: 'http://localhost:5173/, https://example.com',
      MINI_APP_URL: 'https://game.example.com/',
    });
    expect(config.allowedOrigins).toEqual(['http://localhost:5173', 'https://example.com']);
    expect(getMiniAppOrigin(config)).toBe('https://game.example.com');
    expect(getAllowedOrigins(config)).toEqual(
      new Set(['http://localhost:5173', 'https://example.com', 'https://game.example.com']),
    );
  });

  it('ignores malformed origins when building the allow-list', () => {
    const config = loadConfig({ NODE_ENV: 'test', CORS_ORIGINS: 'not-a-url, http://localhost:3000' });
    expect(getAllowedOrigins(config)).toEqual(
      new Set(['http://localhost:3000', 'http://localhost:5173']),
    );
  });

  it('accepts boolean variants', () => {
    expect(loadConfig({ NODE_ENV: 'development', DEV_AUTH_ENABLED: '0' }).devAuthEnabled).toBe(false);
    expect(loadConfig({ NODE_ENV: 'development', DEV_AUTH_ENABLED: '1' }).devAuthEnabled).toBe(true);
    expect(() => loadConfig({ NODE_ENV: 'development', DEV_AUTH_ENABLED: 'yes' })).toThrow();
  });
});
