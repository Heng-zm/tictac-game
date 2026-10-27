// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameClient } from '../src/client/hooks/use-game-client';
import type {
  CreatedInvitation,
  MatchMode,
  PublicMatchState,
  PublicPlayer,
  QueueStatus,
  UserProfile,
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

function matchFor(mode: MatchMode, status: PublicMatchState['status'] = 'ACTIVE'): PublicMatchState {
  return {
    protocol: 1,
    id: '123e4567-e89b-42d3-a456-426614174000',
    mode,
    status,
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

const profile: UserProfile = {
  id: 'user-1',
  firstName: 'You',
  lastName: null,
  username: null,
  photoUrl: null,
  autoAiFallback: false,
  turnNotifications: false,
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
    rating: 1000,
    ratingGames: 0,
    winRate: 0,
  },
};

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
    reactions: [],
    incomingVoice: null,
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
    sendReaction: vi.fn(),
    sendVoice: vi.fn(),
    clearIncomingVoice: vi.fn(),
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

const freshInvitation: CreatedInvitation = {
  id: 'fresh-invite',
  deepLink: 'https://t.me/test_bot?start=invite_fresh',
  expiresAt: '2099-01-01T00:00:00.000Z',
  matchId: 'fresh-match',
};

/**
 * Mirrors how useGameClient owns invite state: clearing a stale invite causes
 * a render without it, which lets the screen request a replacement link.
 */
function renderInviteScenario(overrides: Partial<GameClient> = {}) {
  const navigate = vi.fn();
  const clearPendingInvite = vi.fn();
  const clearCreatedInvite = vi.fn();
  const createInvite = vi.fn(async () => freshInvitation);
  const base = makeClient({
    ...overrides,
    clearPendingInvite,
    clearCreatedInvite,
    createInvite,
  });

  function Harness() {
    const [pendingInvite, setPendingInvite] = useState(base.pendingInvite);
    const [createdInvite, setCreatedInvite] = useState(base.createdInvite);

    const client: GameClient = {
      ...base,
      pendingInvite,
      createdInvite,
      clearPendingInvite: () => {
        clearPendingInvite();
        setPendingInvite(null);
      },
      clearCreatedInvite: () => {
        clearCreatedInvite();
        setCreatedInvite(null);
      },
      cancelInvite: async (invitationId) => {
        await base.cancelInvite(invitationId);
        setPendingInvite(null);
        setCreatedInvite(null);
      },
      createInvite: async () => {
        const invitation = await createInvite();
        setCreatedInvite(invitation);
        setPendingInvite({
          id: invitation.id,
          matchId: invitation.matchId,
          expiresAt: invitation.expiresAt,
          status: 'PENDING',
        });
        return invitation;
      },
    };

    return <InviteWaitingScreen client={client} navigate={navigate} />;
  }

  render(<Harness />);
  return { clearPendingInvite, clearCreatedInvite, createInvite, navigate };
}

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

  it('creates a fresh invitation when the old link has expired', async () => {
    const staleLink = 'https://t.me/test_bot?start=invite_stale';
    const expiry = '2020-01-01T00:00:00.000Z';
    const { clearPendingInvite, clearCreatedInvite, createInvite } = renderInviteScenario({
      pendingInvite: { id: 'stale-invite', matchId: 'stale-match', expiresAt: expiry, status: 'PENDING' },
      createdInvite: { id: 'stale-invite', deepLink: staleLink, expiresAt: expiry, matchId: 'stale-match' },
    });

    await waitFor(() => expect(createInvite).toHaveBeenCalledOnce());
    expect(clearPendingInvite).toHaveBeenCalled();
    expect(clearCreatedInvite).toHaveBeenCalled();
    expect(await screen.findByText(freshInvitation.deepLink)).toBeTruthy();
    expect(screen.queryByText(staleLink)).toBeNull();
  });

  it('creates a fresh invitation after a friend game has finished', async () => {
    const finished = matchFor('FRIEND', 'FINISHED');
    const staleLink = 'https://t.me/test_bot?start=invite_used';
    const expiresAt = '2099-01-01T00:00:00.000Z';
    const { clearPendingInvite, clearCreatedInvite, createInvite } = renderInviteScenario({
      match: finished,
      pendingInvite: { id: 'used-invite', matchId: finished.id, expiresAt, status: 'PENDING' },
      createdInvite: { id: 'used-invite', deepLink: staleLink, expiresAt, matchId: finished.id },
    });

    await waitFor(() => expect(createInvite).toHaveBeenCalledOnce());
    expect(clearPendingInvite).toHaveBeenCalled();
    expect(clearCreatedInvite).toHaveBeenCalled();
    expect(await screen.findByText(freshInvitation.deepLink)).toBeTruthy();
    expect(screen.queryByText(staleLink)).toBeNull();
  });

  it('drops a used link without creating another while the friend game is active', async () => {
    const active = matchFor('FRIEND');
    const { clearPendingInvite, clearCreatedInvite, createInvite } = renderInviteScenario({
      match: active,
      pendingInvite: {
        id: 'used-invite',
        matchId: active.id,
        expiresAt: '2099-01-01T00:00:00.000Z',
        status: 'PENDING',
      },
    });

    await waitFor(() => expect(clearPendingInvite).toHaveBeenCalled());
    expect(clearCreatedInvite).toHaveBeenCalled();
    expect(createInvite).not.toHaveBeenCalled();
    expect(screen.getByText('Your friend already joined')).toBeTruthy();
  });

  it('does not replace an invitation the player cancels', async () => {
    const expiresAt = '2099-01-01T00:00:00.000Z';
    const { createInvite, navigate } = renderInviteScenario({
      pendingInvite: { id: 'pending-invite', matchId: 'pending-match', expiresAt, status: 'PENDING' },
      createdInvite: {
        id: 'pending-invite',
        deepLink: 'https://t.me/test_bot?start=invite_pending',
        expiresAt,
        matchId: 'pending-match',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel invitation' }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/'));
    expect(createInvite).not.toHaveBeenCalled();
  });
});

describe('matchmaking preference UI', () => {
  it('rolls back an unsaved auto-fallback preference without re-queueing', async () => {
    const setAutoAiFallback = vi.fn(async () => {
      throw new Error('offline');
    });
    const joinQueue = vi.fn(async () => searchingQueue);
    const pushToast = vi.fn();
    const client = makeClient({
      queue: searchingQueue,
      profile,
      setAutoAiFallback,
      joinQueue,
      pushToast,
    });

    render(<MatchmakingScreen client={client} navigate={() => undefined} />);
    const toggle = screen.getByRole('switch', {
      name: 'Automatically play a bot if no human is found',
    });
    expect(toggle.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    await waitFor(() => expect(toggle.getAttribute('aria-checked')).toBe('false'));
    expect(setAutoAiFallback).toHaveBeenCalledWith(true);
    // Re-queueing here would silently apply the preference the server rejected.
    expect(joinQueue).not.toHaveBeenCalled();
    expect(pushToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'warning', title: 'Preference not saved' }),
    );
  });
});
