import type { RequestHandler } from 'express';
import {
  Bot,
  GrammyError,
  InlineKeyboard,
  webhookCallback,
  type CommandContext,
  type Context,
} from 'grammy';
import type { Logger } from 'pino';
import { normalizeDisplayName } from '../../shared/schemas/payloads';
import type { BrowserLoginIdentity, BrowserLoginStore } from '../auth/browser-login';
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
  /** Shared with the HTTP app so browser sign-ins can be verified here. */
  browserLogins: BrowserLoginStore;
  /** Optional Bot API root, used by integration tests and self-hosted Bot API servers. */
  apiRoot?: string;
}

/**
 * Builds the Telegram bot used for discovery, invitation links, and browser
 * sign-in verification. The bot token never leaves this module or the server
 * environment.
 */
export function createBotController(deps: BotControllerDependencies): BotController | null {
  const { config, logger, browserLogins } = deps;
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
    const loginId = parseLoginPayload(payload);
    if (loginId) {
      await handleBrowserLoginStart(context, loginId);
      return;
    }

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

  async function handleBrowserLoginStart(
    context: CommandContext<Context>,
    loginId: string,
  ): Promise<void> {
    const from = context.from;
    if (!from || from.is_bot) {
      await context.reply('This sign-in link can only be used by a Telegram account.');
      return;
    }

    const result = browserLogins.claim(loginId, BigInt(from.id));
    if (result.status === 'pending') {
      const keyboard = new InlineKeyboard().text('Verify sign-in', `login_verify:${loginId}`);
      await context.reply(
        [
          'Sign in to Tic Tac Toe',
          '',
          'Tap Verify to connect this Telegram account to the browser tab that requested sign-in.',
          'Only continue if you started this yourself.',
        ].join('\n'),
        {
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        },
      );
      return;
    }
    if (result.status === 'verified') {
      await context.reply('This sign-in is already verified. Return to your browser tab.');
      return;
    }
    if (result.status === 'claimed') {
      await context.reply('This sign-in link is already connected to another Telegram account.');
      return;
    }
    await context.reply('This sign-in link is invalid or has expired. Return to the game and request a new one.');
  }

  bot.callbackQuery(/^login_verify:[a-f0-9]{32}$/, async (context) => {
    const data = context.callbackQuery.data ?? '';
    const loginId = data.slice('login_verify:'.length);
    const identity = identityFromTelegramUser(context.from);
    const result = browserLogins.verify(loginId, identity.telegramId, identity);

    if (result.status === 'verified') {
      await answerCallback(context, 'Verified. Return to your browser tab.');
      try {
        await context.editMessageText('✅ Verified. Return to your browser tab and continue.', {
          reply_markup: { inline_keyboard: [] },
        });
      } catch {
        // The message may be too old to edit, but the sign-in is complete.
      }
      return;
    }
    if (result.status === 'already_verified') {
      await answerCallback(context, 'This sign-in is already verified.');
      return;
    }
    if (result.status === 'claimed_by_other') {
      await answerCallback(context, 'This sign-in link belongs to another Telegram account.');
      return;
    }
    await answerCallback(context, 'This sign-in link has expired. Request a new one from the browser.');
  });

  bot.on('callback_query', async (context) => {
    await answerCallback(context, 'This button is no longer active.');
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

const LOGIN_PAYLOAD_PATTERN = /^login_([a-f0-9]{32})$/;

function parseLoginPayload(payload: string): string | null {
  return LOGIN_PAYLOAD_PATTERN.exec(payload)?.[1] ?? null;
}

function identityFromTelegramUser(user: {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}): BrowserLoginIdentity {
  const lastName = normalizeDisplayName(user.last_name ?? '', '');
  return {
    telegramId: BigInt(user.id),
    firstName: normalizeDisplayName(user.first_name, 'Player'),
    lastName: lastName || null,
    username: user.username ?? null,
    languageCode: user.language_code ?? null,
  };
}

async function answerCallback(context: Context, text: string): Promise<void> {
  try {
    await context.answerCallbackQuery({ text });
  } catch {
    // Callback queries expire quickly; the browser poll still completes.
  }
}
