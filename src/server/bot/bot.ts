import type { RequestHandler } from 'express';
import { Bot, InlineKeyboard, webhookCallback } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';

export const BOT_WEBHOOK_PATH = '/api/telegram/webhook';

export interface BotController {
  webhook: {
    path: string;
    handler: RequestHandler;
  };
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

interface BotControllerDependencies {
  config: AppConfig;
  logger: Logger;
}

/**
 * Builds the Telegram bot used for discovery and invitation links. The bot
 * token never leaves this module or the server environment.
 */
export function createBotController(deps: BotControllerDependencies): BotController | null {
  const { config, logger } = deps;
  if (!config.telegramBotToken) return null;

  const log = logger.child({ component: 'telegram-bot' });
  const bot = new Bot(config.telegramBotToken);
  const miniAppUrl = config.miniAppUrl ?? 'http://localhost:5173';
  const isHttps = miniAppUrl.startsWith('https://');
  const botUsername = config.telegramBotUsername;

  bot.catch((error) => {
    log.error(
      {
        event: 'bot_update_failed',
        errorName: error.error instanceof Error ? error.error.name : 'unknown',
      },
      'Telegram bot update failed',
    );
  });

  bot.command('start', async (context) => {
    const payload = context.match?.trim() ?? '';
    const invitePayload = payload.startsWith('invite_') ? payload : null;
    const keyboard = new InlineKeyboard();
    const targetUrl = invitePayload ? appendQuery(miniAppUrl, 'startapp', invitePayload) : miniAppUrl;

    if (isHttps && targetUrl) {
      keyboard.webApp('Open Tic Tac Toe', targetUrl);
    } else if (targetUrl) {
      keyboard.url('Open Tic Tac Toe', targetUrl);
    }
    if (!invitePayload) {
      keyboard.row().url('How to play', 'https://core.telegram.org/bots/webapps');
    }

    const greeting = invitePayload
      ? `You have a Tic Tac Toe invitation${botUsername ? ` from a friend` : ''}. Tap below to accept it.`
      : 'Challenge a friend, play a random opponent, or take on the unbeatable Hard bot.';

    await context.reply(greeting, {
      reply_markup: keyboard,
      link_preview_options: { is_disabled: true },
    });
  });

  bot.command('play', async (context) => {
    const keyboard = new InlineKeyboard();
    if (isHttps) {
      keyboard.webApp('Play now', miniAppUrl);
    } else {
      keyboard.url('Play now', miniAppUrl);
    }
    await context.reply('Ready when you are.', { reply_markup: keyboard });
  });

  bot.command('help', async (context) => {
    await context.reply(
      [
        'Tic Tac Toe is a classic three-in-a-row game inside Telegram.',
        '',
        '• Random match — get paired with another player.',
        '• Invite a friend — share a private game link.',
        '• Play a bot — Easy, Medium, or Hard (Hard cannot be beaten).',
        '',
        'Every move is checked by the server. Unfinished games are not rated.',
      ].join('\n'),
      { link_preview_options: { is_disabled: true } },
    );
  });

  bot.on('message:text', async (context) => {
    await context.reply('Use /play to open the game or /help for the rules.');
  });

  let pollingPromise: Promise<void> | null = null;

  async function start(): Promise<void> {
    try {
      await bot.api.setMyCommands([
        { command: 'play', description: 'Open Tic Tac Toe' },
        { command: 'start', description: 'Start the game' },
        { command: 'help', description: 'How to play' },
      ]);
      if (isHttps) {
        await bot.api.setChatMenuButton({
          menu_button: {
            type: 'web_app',
            text: 'Play',
            web_app: { url: miniAppUrl },
          },
        });
      }
    } catch (error) {
      log.warn(
        { event: 'bot_metadata_failed', errorName: error instanceof Error ? error.name : 'unknown' },
        'Could not update bot commands or menu button',
      );
    }

    if (config.telegramWebhookUrl) {
      try {
        await bot.api.setWebhook(config.telegramWebhookUrl, {
          ...(config.telegramWebhookSecret ? { secret_token: config.telegramWebhookSecret } : {}),
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        });
        log.info({ event: 'bot_webhook_registered' }, 'Telegram webhook registered');
      } catch (error) {
        // The game server must still boot if Telegram is briefly unavailable.
        // The previous webhook remains registered and will retry delivery.
        log.error(
          { event: 'bot_webhook_registration_failed', errorName: error instanceof Error ? error.name : 'unknown' },
          'Could not register the Telegram webhook',
        );
      }
      return;
    }

    if (config.isProduction) {
      log.warn(
        { event: 'bot_polling_in_production' },
        'TELEGRAM_WEBHOOK_URL is not set; falling back to long polling in production',
      );
    }
    pollingPromise = bot.start({
      drop_pending_updates: false,
      onStart: (info) => {
        log.info({ event: 'bot_polling_started', username: info.username }, 'Telegram bot polling started');
      },
    });
    void pollingPromise.catch((error: unknown) => {
      log.error(
        { event: 'bot_polling_stopped', errorName: error instanceof Error ? error.name : 'unknown' },
        'Telegram bot polling stopped unexpectedly',
      );
    });
  }

  async function stop(): Promise<void> {
    if (config.telegramWebhookUrl) return;
    try {
      await bot.stop();
    } catch (error) {
      log.warn(
        { event: 'bot_stop_failed', errorName: error instanceof Error ? error.name : 'unknown' },
        'Telegram bot could not be stopped cleanly',
      );
    }
  }

  const handler = webhookCallback(bot, 'express', {
    onTimeout: 'return',
    timeoutMilliseconds: 10_000,
    ...(config.telegramWebhookSecret ? { secretToken: config.telegramWebhookSecret } : {}),
  }) as RequestHandler;

  return {
    webhook: { path: BOT_WEBHOOK_PATH, handler },
    start,
    stop,
  };
}

function appendQuery(baseUrl: string, key: string, value: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(key, value);
  return url.toString();
}
