import type { RequestHandler } from 'express';
import { Bot, GrammyError, InlineKeyboard, webhookCallback } from 'grammy';
import type { Logger } from 'pino';
import type { AppConfig } from '../config';
import type { TurnNotificationDelivery } from '../services/turn-notifier';

export const BOT_WEBHOOK_PATH = '/api/telegram/webhook';

export interface BotController {
  webhook: {
    path: string;
    handler: RequestHandler;
  };
  start: () => Promise<void>;
  stop: () => Promise<void>;
  sendTurnNotification: (
    telegramId: bigint,
    text: string,
    url: string,
  ) => Promise<TurnNotificationDelivery>;
}

interface BotControllerDependencies {
  config: AppConfig;
  logger: Logger;
  /** Optional Bot API root, used by integration tests and self-hosted Bot API servers. */
  apiRoot?: string;
}

/**
 * Builds the Telegram bot used for discovery and invitation links. The bot
 * token never leaves this module or the server environment.
 */
export function createBotController(deps: BotControllerDependencies): BotController | null {
  const { config, logger } = deps;
  if (!config.telegramBotToken) return null;

  const log = logger.child({ component: 'telegram-bot' });
  const apiRoot = deps.apiRoot?.replace(/\/+$/, '');
  const bot = new Bot(
    config.telegramBotToken,
    apiRoot ? { client: { apiRoot } } : undefined,
  );
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
      : 'Challenge a friend, play a random opponent, or take on the Hard bot.';

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
        'Tic Tac Toe is a 5-in-a-row game on an infinite grid inside Telegram.',
        'Connect five stones in any direction to win.',
        '',
        '• Random match — get paired with another player.',
        '• Invite a friend — share a private game link.',
        '• Play a bot — Easy, Medium, or Hard.',
        '• Turn reminders — opt in from Profile → Settings.',
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
        const webhookUrl = config.telegramWebhookUrl.endsWith(BOT_WEBHOOK_PATH)
          ? config.telegramWebhookUrl
          : `${config.telegramWebhookUrl.replace(/\/+$/, '')}${BOT_WEBHOOK_PATH}`;
        await bot.api.setWebhook(webhookUrl, {
          ...(config.telegramWebhookSecret ? { secret_token: config.telegramWebhookSecret } : {}),
          allowed_updates: ['message', 'callback_query'],
          drop_pending_updates: false,
        });
        log.info({ event: 'bot_webhook_registered', url: webhookUrl }, 'Telegram webhook registered');
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

  async function sendTurnNotification(
    telegramId: bigint,
    text: string,
    url: string,
  ): Promise<TurnNotificationDelivery> {
    try {
      const keyboard = new InlineKeyboard();
      if (isHttps) {
        keyboard.webApp('Open game', url);
      } else {
        keyboard.url('Open game', url);
      }
      await bot.api.sendMessage(telegramId.toString(), text, {
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
      return 'sent';
    } catch (error) {
      const permanent = isPermanentTelegramDeliveryError(error);
      log.warn(
        {
          event: 'turn_notification_send_failed',
          errorName: error instanceof Error ? error.name : 'unknown',
          errorCode: error instanceof GrammyError ? error.error_code : undefined,
          permanent,
        },
        'Telegram could not send a turn notification',
      );
      return permanent ? 'blocked' : 'failed';
    }
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
    sendTurnNotification,
  };
}

const PERMANENT_DELIVERY_ERROR =
  /bot was blocked by the user|chat not found|bot can't initiate conversation|user is deactivated/i;

export function isPermanentTelegramDeliveryError(error: unknown): boolean {
  if (!(error instanceof GrammyError)) return false;
  if (error.error_code === 403) return true;
  return error.error_code === 400 && PERMANENT_DELIVERY_ERROR.test(error.description);
}

function appendQuery(baseUrl: string, key: string, value: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set(key, value);
  return url.toString();
}
