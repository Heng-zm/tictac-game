// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameClient } from '../src/client/hooks/use-game-client';
import { GameScreen } from '../src/client/screens/GameScreen';
import type { PublicMatchState, PublicPlayer, UserProfile } from '../src/shared/game-types';

const MATCH_ID = '123e4567-e89b-42d3-a456-426614174000';

const you: PublicPlayer = {
  side: 'X',
  displayName: 'You',
  username: null,
  photoUrl: null,
  isAi: false,
  aiDifficulty: null,
  isYou: true,
  connected: true,
};

const opponent: PublicPlayer = {
  side: 'O',
  displayName: 'Alex',
  username: 'alex',
  photoUrl: null,
  isAi: false,
  aiDifficulty: null,
  isYou: false,
  connected: true,
};

function makeMatch(overrides: Partial<PublicMatchState> = {}): PublicMatchState {
  return {
    protocol: 1,
    id: MATCH_ID,
    mode: 'RANDOM',
    status: 'ACTIVE',
    board: {},
    currentTurn: 'X',
    turnNumber: 1,
    lastMove: null,
    version: 1,
    youSide: 'X',
    players: { X: you, O: opponent },
    winnerSide: null,
    result: null,
    finishReason: null,
    startedAt: '2026-10-27T10:00:00.000Z',
    finishedAt: null,
    turnDeadline: null,
    turnTimerPaused: false,
    opponentConnection: 'connected',
    rematch: {
      available: false,
      requestedByYou: false,
      requestedByOpponent: false,
      expiresAt: null,
    },
    ...overrides,
  };
}

function makeProfile(): UserProfile {
  return {
    id: 'user-1',
    firstName: 'You',
    lastName: null,
    username: null,
    photoUrl: null,
    languageCode: 'en',
    autoAiFallback: true,
    turnNotifications: true,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      humanGames: 0,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      rating: 1200,
      ratingGames: 0,
      winRate: 0,
    },
  };
}

function makeClient(overrides: Partial<GameClient> = {}): GameClient {
  return {
    connection: 'online',
    match: makeMatch(),
    config: null,
    profile: makeProfile(),
    lastRejection: null,
    lastMove: null,
    opponentGraceEndsAt: null,
    reactions: [],
    incomingVoice: null,
    joinMatch: vi.fn().mockResolvedValue(makeMatch()),
    submitMove: vi.fn().mockResolvedValue(makeMatch()),
    sendReaction: vi.fn().mockResolvedValue({ sent: true }),
    sendVoice: vi.fn().mockResolvedValue({ sent: true }),
    pushToast: vi.fn(),
    reconnect: vi.fn(),
    requestRematch: vi.fn().mockResolvedValue({ matchId: MATCH_ID }),
    leaveMatch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as GameClient;
}

function renderGame(client: GameClient) {
  render(<GameScreen client={client} navigate={vi.fn()} matchId={MATCH_ID} />);
}

describe('GameScreen sticker reactions and quick chat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens the reaction tray from the in-game action dock', () => {
    renderGame(makeClient());

    const trigger = screen.getByRole('button', { name: /open sticker reactions and quick chat/i });
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(trigger);

    expect(screen.getByRole('dialog', { name: /choose sticker reaction/i })).toBeTruthy();
    expect(screen.getByText('Sticker Reactions & Quick Chat')).toBeTruthy();
  });

  it('sends the picked sticker and closes the tray', async () => {
    const client = makeClient();
    renderGame(client);

    fireEvent.click(screen.getByRole('button', { name: /open sticker reactions and quick chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /good game!/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(client.sendReaction).toHaveBeenCalledWith(MATCH_ID, 'good_game');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports a failed sticker transmission and still closes the tray', async () => {
    const pushToast = vi.fn();
    const client = makeClient({
      sendReaction: vi.fn().mockRejectedValue(new Error('Socket closed')),
      pushToast,
    });
    renderGame(client);

    fireEvent.click(screen.getByRole('button', { name: /open sticker reactions and quick chat/i }));
    fireEvent.click(screen.getByRole('button', { name: /good game!/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(pushToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Reaction not sent',
      message: 'Socket closed',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('disables the reaction trigger while offline', () => {
    renderGame(makeClient({ connection: 'offline' }));

    const trigger = screen.getByRole('button', { name: /open sticker reactions and quick chat/i });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
  });
});
