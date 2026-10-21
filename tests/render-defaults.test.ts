import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/server/config';
import { applyRenderDefaults } from '../src/server/config/render-defaults';
import { TEST_BOT_TOKEN } from './helpers';

describe('Render defaults', () => {
  it('does nothing outside Render', () => {
    const env: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
    const result = applyRenderDefaults(env);
    expect(result.applied).toBe(false);
    expect(env.SESSION_SECRET).toBeUndefined();
    expect(env.DB_MODE).toBeUndefined();
  });

  it('bootstraps a zero-config guest demo on Render', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://tictactoe-demo.onrender.com/',
    };
    const result = applyRenderDefaults(env);

    expect(result).toMatchObject({
      applied: true,
      generatedSessionSecret: true,
      demoMode: true,
      memoryMode: true,
    });
    expect(env.MINI_APP_URL).toBe('https://tictactoe-demo.onrender.com');
    expect(env.CORS_ORIGINS).toBe('https://tictactoe-demo.onrender.com');
    expect(env.TRUST_PROXY).toBe('1');
    expect(env.DB_MODE).toBe('memory');
    expect(env.DEMO_MODE).toBe('true');
    expect(env.DEV_AUTH_ENABLED).toBe('true');
    expect(env.SESSION_SECRET).toHaveLength(64);

    const config = loadConfig(env);
    expect(config.demoMode).toBe(true);
    expect(config.devAuthEnabled).toBe(true);
    expect(config.databaseMode).toBe('memory');
    expect(config.miniAppUrl).toBe('https://tictactoe-demo.onrender.com');
  });

  it('uses Telegram auth with in-memory data when a bot token is configured', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://tictactoe-demo.onrender.com',
      TELEGRAM_BOT_TOKEN: TEST_BOT_TOKEN,
      TELEGRAM_BOT_USERNAME: 'tictactoe_demo_bot',
    };
    const result = applyRenderDefaults(env);

    expect(result.demoMode).toBe(false);
    expect(env.DB_MODE).toBe('memory');
    expect(env.DEMO_MODE).toBeUndefined();

    const config = loadConfig(env);
    expect(config.demoMode).toBe(false);
    expect(config.devAuthEnabled).toBe(false);
    expect(config.telegramBotToken).toBe(TEST_BOT_TOKEN);
    expect(config.databaseMode).toBe('memory');
  });

  it('can explicitly disable the guest demo fallback', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://tictactoe-demo.onrender.com',
      DEMO_MODE: 'false',
    };
    const result = applyRenderDefaults(env);

    expect(result.demoMode).toBe(false);
    expect(env.DEMO_MODE).toBe('false');
    expect(() => loadConfig(env)).toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('keeps explicit values instead of overwriting them', () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: 'production',
      RENDER: 'true',
      RENDER_EXTERNAL_URL: 'https://tictactoe-demo.onrender.com',
      SESSION_SECRET: 'explicit-session-secret-with-more-than-32-characters',
      MINI_APP_URL: 'https://game.example.com',
      CORS_ORIGINS: 'https://game.example.com',
      TRUST_PROXY: '2',
      DB_MODE: 'memory',
      DEMO_MODE: 'true',
      DEV_AUTH_ENABLED: 'true',
    };
    const result = applyRenderDefaults(env);

    expect(result.generatedSessionSecret).toBe(false);
    expect(env.SESSION_SECRET).toBe('explicit-session-secret-with-more-than-32-characters');
    expect(env.MINI_APP_URL).toBe('https://game.example.com');
    expect(env.CORS_ORIGINS).toBe('https://game.example.com');
    expect(env.TRUST_PROXY).toBe('2');
  });
});
