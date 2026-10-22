import type { Logger } from 'pino';
import { otherPlayerName } from '../../shared/game-types';
import type { AppConfig } from '../config';
import type { GameRepository, MatchEntity, UserEntity } from '../database/types';
import { buildGameLaunchUrl } from './invitations';

export type TurnNotificationDelivery = 'sent' | 'blocked' | 'failed';

export interface TurnNotificationSender {
  sendTurnNotification: (
    telegramId: bigint,
    text: string,
    url: string,
  ) => Promise<TurnNotificationDelivery>;
}

export interface TurnNotificationService {
  notifyTurn: (match: MatchEntity, userId: string) => Promise<void>;
}

export interface TurnNotificationTestService {
  sendTestNotification: (user: UserEntity) => Promise<TurnNotificationDelivery>;
}

interface TurnNotifierDependencies {
  repository: Pick<GameRepository, 'getUserById' | 'setTurnNotifications'>;
  config: AppConfig;
  logger: Logger;
  sender: TurnNotificationSender;
}

/**
 * Sends a single opt-in Telegram message when a human player's turn starts.
 * The caller is responsible for only invoking this for offline recipients.
 */
export class TurnNotifier implements TurnNotificationService, TurnNotificationTestService {
  constructor(private readonly deps: TurnNotifierDependencies) {}

  async notifyTurn(match: MatchEntity, userId: string): Promise<void> {
    if (match.status !== 'ACTIVE' || match.mode === 'AI' || !match.currentTurn) return;

    const recipient = match.participants.find(
      (participant) => participant.userId === userId && !participant.isAi && participant.side === match.currentTurn,
    );
    if (!recipient) return;

    const user = await this.deps.repository.getUserById(userId);
    if (!user?.turnNotifications) return;

    const opponent = match.participants.find((participant) => participant.side !== recipient.side);
    const opponentName = otherPlayerName(opponent?.displayName ?? 'your opponent');
    const text = `Your turn vs ${opponentName}.\nTap below to continue the game.`;
    const url = buildGameLaunchUrl(this.deps.config, match.id);

    await this.deliver(user, text, url, match.id);
  }

  async sendTestNotification(user: UserEntity): Promise<TurnNotificationDelivery> {
    const url = this.deps.config.miniAppUrl ?? 'http://localhost:5173';
    const text = 'Test notification from Tic Tac Toe.\nTurn reminders are working.';
    return this.deliver(user, text, url);
  }

  private async deliver(
    user: UserEntity,
    text: string,
    url: string,
    matchId?: string,
  ): Promise<TurnNotificationDelivery> {
    const context = matchId ? 'turn' : 'test';
    try {
      const delivery = await this.deps.sender.sendTurnNotification(user.telegramId, text, url);
      if (delivery === 'blocked') {
        await this.disableTurnNotifications(user.id, matchId);
      } else if (delivery === 'failed') {
        this.deps.logger.warn(
          {
            event: 'turn_notification_failed',
            userId: user.id,
            context,
            ...(matchId ? { matchId } : {}),
          },
          'Telegram notification could not be delivered',
        );
      }
      return delivery;
    } catch (error) {
      this.deps.logger.warn(
        {
          event: 'turn_notification_failed',
          userId: user.id,
          context,
          ...(matchId ? { matchId } : {}),
          errorName: error instanceof Error ? error.name : 'unknown',
        },
        'Telegram notification could not be delivered',
      );
      return 'failed';
    }
  }

  private async disableTurnNotifications(userId: string, matchId?: string): Promise<void> {
    try {
      await this.deps.repository.setTurnNotifications(userId, false);
      this.deps.logger.warn(
        {
          event: 'turn_notifications_disabled',
          matchId,
          userId,
          reason: 'telegram_unreachable',
        },
        'Turn notifications disabled because Telegram rejected delivery',
      );
    } catch (error) {
      this.deps.logger.warn(
        {
          event: 'turn_notification_disable_failed',
          matchId,
          userId,
          errorName: error instanceof Error ? error.name : 'unknown',
        },
        'Could not disable turn notifications after Telegram rejected delivery',
      );
    }
  }
}
