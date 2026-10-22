// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameClient } from '../src/client/hooks/use-game-client';
import type {
  MatchMode,
  PublicMatchState,
  PublicPlayer,
  QueueStatus,
} from '../src/shared/game-types';
import { MatchmakingScreen } from '../src/client/screens/MatchmakingScreen';
import { InviteWaitingScreen } from '../src/client/screens/InviteScreens';

const searchingQueue: QueueStatus = {
  state: 'searching',
  mode: 'RANDOM',
  elapsedMs: 1_000,
  fallbackAt: null,
  fallbackAvailable: false,
  autoFallback: false,
  waitingPlayers: 1,
};

function player(side: 'X' | 'O', displayName: string, isAi = false): PublicPlayer {
  return {
    side,
    displayName,
    username: null,
    photoUrl: null,
    isAi,
    aiDifficulty: isAi ? 'MEDIUM' : null,
    isYou: side === 'X',
    connected: true,
  };
}

function matchFor(mode: MatchMode): PublicMatchState {
  return {
    protocol: 1,
    id: '123e4567-e89b-42d3-a456-426614174000',
    mode,
    status: 'ACTIVE',
    board: {},
    currentTurn: 'X',
    turnNumber: 1,
    lastMove: null,
    version: 1,
    youSide: 'X',
    players: {
      X: player('X', 'You'),
      O: player('O', mode === 'AI' ? 'Tic Tac Bot' : 'Alex', mode === 'AI'),
    },
    winnerSide: null,
    result: null,
    finishReason: null,
    startedAt: '2026-10-22T11:59:00.000Z',
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
  };
}

function makeClient(overrides: Partial<GameClient> = {}): GameClient {
  return {
    phase: 'ready',
    bootError: null,
    bootErrorCode: null,
    config: null,
    profile: null,
    connection: 'online',
    match: null,
    queue: null,
    createdInvite: null,
    pendingInvite: null,
    lastMove: null,
    lastRejection: null,
    opponentGraceEndsAt: null,
    initialInviteToken: null,
    initialGameMatchId: null,
    toasts: [],
    retryBoot: vi.fn(),
    joinQueue: vi.fn(),
    cancelQueue: vi.fn(),
    startAi: vi.fn(),
    createInvite: vi.fn(),
    cancelInvite: vi.fn(),
    acceptInvite: vi.fn(),
    joinMatch: vi.fn(),
    submitMove: vi.fn(),
    requestRematch: vi.fn(),
    leaveMatch: vi.fn(),
    refreshProfile: vi.fn(),
    setAutoAiFallback: vi.fn(),
    setTurnNotifications: vi.fn(),
    sendTestNotification: vi.fn(),
    clearPendingInvite: vi.fn(),
    clearCreatedInvite: vi.fn(),
    reconnect: vi.fn(),
    pushToast: vi.fn(),
    dismissToast: vi.fn(),
    ...overrides,
  };
}

afterEach(cleanup);

describe('invite flow UI', () => {
  it('leaves matchmaking before opening the invite screen', () => {
    const cancelQueue = vi.fn(async () => undefined);
    const navigate = vi.fn();
    const client = makeClient({ queue: searchingQueue, cancelQueue });

    render(<MatchmakingScreen client={client} navigate={navigate} />);
    fireEvent.click(screen.getByRole('button', { name: 'Invite friend' }));

    expect(cancelQueue).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/invite/waiting');
    const cancelOrder = cancelQueue.mock.invocationCallOrder[0] ?? 0;
    const navigateOrder = navigate.mock.invocationCallOrder[0] ?? 0;
    expect(cancelOrder).toBeLessThan(navigateOrder);
  });

  it('does not claim a friend joined when a bot game is active', () => {
    const navigate = vi.fn();
    render(<InviteWaitingScreen client={makeClient({ match: matchFor('AI') })} navigate={navigate} />);

    expect(screen.getByText('You already have a game')).toBeTruthy();
    expect(screen.getByText(/Only one game can be active at a time/)).toBeTruthy();
    expect(screen.queryByText('Your friend already joined')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Resume game' }));
    expect(navigate).toHaveBeenCalledWith(`/game/${matchFor('AI').id}`);
  });

  it('uses the accepted-invite copy for an active friend game', () => {
    render(<InviteWaitingScreen client={makeClient({ match: matchFor('FRIEND') })} navigate={() => undefined} />);

    expect(screen.getByText('Your friend already joined')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open game' })).toBeTruthy();
  });
});
