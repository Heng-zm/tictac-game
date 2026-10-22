import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createBotController,
  type BotController,
} from '../src/server/bot/bot';
import type { AppConfig } from '../src/server/config';
import { makeTestConfig, makeTestLogger, TEST_BOT_TOKEN } from './helpers';

interface TelegramCall {
  method: string;
  token: string;
  body: Record<string, unknown>;
}

interface FakeReply {
  status: number;
  body: unknown;
}

let server: Server | undefined;
let apiRoot = '';
let calls: TelegramCall[] = [];
let sendMessageResponse: FakeReply;
let failMetadata = false;
let failWebhook = false;

const BOT_USER = {
  id: 123456789,
  is_bot: true,
  first_name: 'Tic Tac Toe',
  username: 'tictac_bot',
  can_join_groups: true,
  can_read_all_group_messages: false,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

function reply(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function makeController(overrides: Partial<AppConfig> = {}): BotController {
  const controller = createBotController({
    config: makeTestConfig({
      telegramBotToken: TEST_BOT_TOKEN,
      telegramBotUsername: 'tictac_bot',
      miniAppUrl: 'https://game.example.com',
      ...overrides,
    }),
    logger: makeTestLogger(),
    apiRoot,
  });
  if (!controller) throw new Error('Expected a bot controller');
  return controller;
}

function commandUpdate(updateId: number, text: string): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId,
      date: 1_700_000_000,
      chat: { id: 42, type: 'private' },
      from: { id: 42, is_bot: false, first_name: 'Alice', language_code: 'en' },
      text,
      entities: [{ type: 'bot_command', offset: 0, length: text.split(' ')[0]!.length }],
    },
  };
}

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const match = /^\/bot([^/]+)\/([^/]+)$/.exec(url.pathname);
    if (!match) {
      reply(res, 404, { ok: false, error_code: 404, description: 'Not Found' });
      return;
    }

    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
    });
    req.on('end', () => {
      const token = match[1];
      const method = match[2];
      if (!token || !method) {
        reply(res, 404, { ok: false, error_code: 404, description: 'Not Found' });
        return;
      }
      let body: Record<string, unknown> = {};
      if (raw) {
        try {
          body = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          reply(res, 400, { ok: false, error_code: 400, description: 'Bad Request: invalid JSON' });
          return;
        }
      }
      calls.push({ method, token, body });

      if (method === 'sendMessage') {
        reply(res, sendMessageResponse.status, sendMessageResponse.body);
        return;
      }
      if (method === 'getMe') {
        reply(res, 200, { ok: true, result: BOT_USER });
        return;
      }
      if ((method === 'setMyCommands' || method === 'setChatMenuButton') && failMetadata) {
        reply(res, 500, { ok: false, error_code: 500, description: 'Internal Server Error' });
        return;
      }
      if (method === 'setWebhook' && failWebhook) {
        reply(res, 500, { ok: false, error_code: 500, description: 'Internal Server Error' });
        return;
      }
      reply(res, 200, { ok: true, result: true });
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address() as AddressInfo;
  apiRoot = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise<void>((resolve) => {
    server?.close(() => resolve());
  });
});

beforeEach(() => {
  calls = [];
  failMetadata = false;
  failWebhook = false;
  sendMessageResponse = {
    status: 200,
    body: {
      ok: true,
      result: {
        message_id: 1,
        date: 1_700_000_000,
        chat: { id: 42, type: 'private' },
        text: 'ok',
      },
    },
  };
});

describe('Telegram bot controller', () => {
  it('does not create a controller without a bot token', () => {
    const controller = createBotController({
      config: makeTestConfig(),
      logger: makeTestLogger(),
      apiRoot,
    });
    expect(controller).toBeNull();
  });

  it('sends a turn notification with a Mini App button and no link preview', async () => {
    const controller = makeController();
    const url = 'https://game.example.com/#/game/match-123';

    await expect(controller.sendTurnNotification(42n, 'Your turn', url)).resolves.toBe('sent');

    const call = calls.find((item) => item.method === 'sendMessage');
    expect(call?.token).toBe(TEST_BOT_TOKEN);
    expect(call?.body).toMatchObject({
      chat_id: '42',
      text: 'Your turn',
      link_preview_options: { is_disabled: true },
    });
    const markup = call?.body.reply_markup as {
      inline_keyboard: Array<Array<{ web_app?: { url: string }; url?: string }>>;
    };
    expect(markup.inline_keyboard[0]?.[0]?.web_app?.url).toBe(url);
    expect(markup.inline_keyboard[0]?.[0]?.url).toBeUndefined();
  });

  it('uses a plain URL button when the Mini App is not HTTPS', async () => {
    const controller = makeController({ miniAppUrl: 'http://localhost:5173' });
    const url = 'http://localhost:5173/#/game/match-123';

    await expect(controller.sendTurnNotification(42n, 'Your turn', url)).resolves.toBe('sent');

    const call = calls.find((item) => item.method === 'sendMessage');
    const markup = call?.body.reply_markup as {
      inline_keyboard: Array<Array<{ web_app?: { url: string }; url?: string }>>;
    };
    expect(markup.inline_keyboard[0]?.[0]?.url).toBe(url);
    expect(markup.inline_keyboard[0]?.[0]?.web_app).toBeUndefined();
  });

  it('maps permanent and transient Bot API failures to delivery results', async () => {
    const controller = makeController();

    sendMessageResponse = {
      status: 403,
      body: { ok: false, error_code: 403, description: 'Forbidden: bot was blocked by the user' },
    };
    await expect(controller.sendTurnNotification(42n, 'Your turn', 'https://game.example.com')).resolves.toBe(
      'blocked',
    );

    sendMessageResponse = {
      status: 500,
      body: { ok: false, error_code: 500, description: 'Internal Server Error' },
    };
    await expect(controller.sendTurnNotification(42n, 'Your turn', 'https://game.example.com')).resolves.toBe(
      'failed',
    );
  });

  it('registers commands, the menu button and the webhook on startup', async () => {
    const controller = makeController({
      telegramWebhookUrl: 'https://game.example.com',
      telegramWebhookSecret: 'webhook-secret',
    });

    await controller.start();

    const commands = calls.find((item) => item.method === 'setMyCommands');
    expect(commands?.body.commands).toEqual([
      { command: 'play', description: 'Open Tic Tac Toe' },
      { command: 'start', description: 'Start the game' },
      { command: 'help', description: 'How to play' },
    ]);

    const menu = calls.find((item) => item.method === 'setChatMenuButton');
    expect(menu?.body).toMatchObject({
      menu_button: {
        type: 'web_app',
        text: 'Play',
        web_app: { url: 'https://game.example.com' },
      },
    });

    const webhook = calls.find((item) => item.method === 'setWebhook');
    expect(webhook?.body).toMatchObject({
      url: 'https://game.example.com/api/telegram/webhook',
      secret_token: 'webhook-secret',
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });

    await controller.stop();
  });

  it('still finishes startup when Telegram metadata or webhook registration fails', async () => {
    failMetadata = true;
    failWebhook = true;
    const controller = makeController({
      telegramWebhookUrl: 'https://game.example.com',
      telegramWebhookSecret: 'webhook-secret',
    });

    await expect(controller.start()).resolves.toBeUndefined();

    expect(calls.some((item) => item.method === 'setMyCommands')).toBe(true);
    expect(calls.some((item) => item.method === 'setWebhook')).toBe(true);
  });

  it('rejects unsigned webhook updates and dispatches signed commands', async () => {
    const controller = makeController({
      telegramWebhookUrl: 'https://game.example.com',
      telegramWebhookSecret: 'webhook-secret',
    });
    const app = express();
    app.use(express.json());
    app.post(controller.webhook.path, controller.webhook.handler);

    const unauthorized = await request(app)
      .post(controller.webhook.path)
      .send(commandUpdate(1, '/help'));
    expect(unauthorized.status).toBe(401);

    const help = await request(app)
      .post(controller.webhook.path)
      .set('x-telegram-bot-api-secret-token', 'webhook-secret')
      .send(commandUpdate(2, '/help'));
    expect(help.status).toBe(200);

    const helpReply = calls.filter((item) => item.method === 'sendMessage').at(-1);
    expect(helpReply?.body).toMatchObject({ chat_id: 42 });
    expect(helpReply?.body.text).toContain('Connect five stones');

    const start = await request(app)
      .post(controller.webhook.path)
      .set('x-telegram-bot-api-secret-token', 'webhook-secret')
      .send(commandUpdate(3, '/start invite_abc'));
    expect(start.status).toBe(200);

    const startReply = calls.filter((item) => item.method === 'sendMessage').at(-1);
    expect(startReply?.body.text).toContain('invitation');
    const markup = startReply?.body.reply_markup as {
      inline_keyboard: Array<Array<{ web_app?: { url: string } }>>;
    };
    const buttonUrl = markup.inline_keyboard[0]?.[0]?.web_app?.url;
    expect(buttonUrl).toBeDefined();
    expect(new URL(buttonUrl!).searchParams.get('startapp')).toBe('invite_abc');
  });
});
