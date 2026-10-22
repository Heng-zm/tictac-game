import { describe, expect, it, vi } from 'vitest';
import { MemoryGameRepository } from '../src/server/database/memory-repository';
import type { MatchEntity } from '../src/server/database/types';
import { buildGameLaunchUrl } from '../src/server/services/invitations';
import { TurnNotifier } from '../src/server/services/turn-notifier';
import { createTestUser, makeTestConfig, makeTestLogger, participant } from './helpers';

async function humanMatch(repo: MemoryGameRepository): Promise<{ match: MatchEntity; aliceId: string }> {
  const alice = await createTestUser(repo, 3001n, 'Alice');
  const bob = await createTestUser(repo, 3002n, 'Bob');
  const match = await repo.createMatch({
    mode: 'RANDOM',
    status: 'ACTIVE',
    participants: [participant(alice, 'X'), participant(bob, 'O')],
    currentTurn: 'X',
    turnDeadline: null,
  });
  return { match, aliceId: alice.id };
}

describe('TurnNotifier', () => {
  it('sends a deep-linked message to an opted-in player', async () => {
    const repo = new MemoryGameRepository();
    const { match, aliceId } = await humanMatch(repo);
    const alice = await repo.getUserById(aliceId);
    if (!alice) throw new Error('Missing test user');
    await repo.setTurnNotifications(alice.id, true);

    const config = makeTestConfig({ miniAppUrl: 'https://game.example.com' });
    const sender = { sendTurnNotification: vi.fn(async () => true) };
    const notifier = new TurnNotifier({
      repository: repo,
      config,
      logger: makeTestLogger(),
      sender,
    });

    await notifier.notifyTurn(match, alice.id);

    expect(sender.sendTurnNotification).toHaveBeenCalledWith(
      alice.telegramId,
      expect.stringContaining('Your turn vs Bob'),
      buildGameLaunchUrl(config, match.id),
    );
  });

  it('does not send when the player has not opted in', async () => {
    const repo = new MemoryGameRepository();
    const { match, aliceId } = await humanMatch(repo);
    const sender = { sendTurnNotification: vi.fn(async () => true) };
    const notifier = new TurnNotifier({
      repository: repo,
      config: makeTestConfig(),
      logger: makeTestLogger(),
      sender,
    });

    await notifier.notifyTurn(match, aliceId);

    expect(sender.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('never notifies AI matches', async () => {
    const repo = new MemoryGameRepository();
    const alice = await createTestUser(repo, 3003n, 'Alice');
    await repo.setTurnNotifications(alice.id, true);
    const match = await repo.createMatch({
      mode: 'AI',
      status: 'ACTIVE',
      participants: [
        participant(alice, 'X'),
        {
          userId: null,
          side: 'O',
          isAi: true,
          aiDifficulty: 'MEDIUM',
          displayName: 'Tic Tac Bot',
          username: null,
          photoUrl: null,
        },
      ],
      currentTurn: 'X',
      turnDeadline: null,
    });
    const sender = { sendTurnNotification: vi.fn(async () => true) };
    const notifier = new TurnNotifier({
      repository: repo,
      config: makeTestConfig(),
      logger: makeTestLogger(),
      sender,
    });

    await notifier.notifyTurn(match, alice.id);

    expect(sender.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('does not notify after the game has finished', async () => {
    const repo = new MemoryGameRepository();
    const { match, aliceId } = await humanMatch(repo);
    await repo.setTurnNotifications(aliceId, true);
    const sender = { sendTurnNotification: vi.fn(async () => true) };
    const notifier = new TurnNotifier({
      repository: repo,
      config: makeTestConfig(),
      logger: makeTestLogger(),
      sender,
    });
    const finished: MatchEntity = { ...match, status: 'FINISHED' };

    await notifier.notifyTurn(finished, aliceId);

    expect(sender.sendTurnNotification).not.toHaveBeenCalled();
  });

  it('swallows delivery failures so a move is never blocked', async () => {
    const repo = new MemoryGameRepository();
    const { match, aliceId } = await humanMatch(repo);
    await repo.setTurnNotifications(aliceId, true);
    const sender = { sendTurnNotification: vi.fn(async () => false) };
    const notifier = new TurnNotifier({
      repository: repo,
      config: makeTestConfig(),
      logger: makeTestLogger(),
      sender,
    });

    await expect(notifier.notifyTurn(match, aliceId)).resolves.toBeUndefined();
    expect(sender.sendTurnNotification).toHaveBeenCalledOnce();
  });
});
