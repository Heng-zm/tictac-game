// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  playDefeatSound,
  playStoneSound,
  playTurnSound,
  playVictorySound,
} from '../src/client/lib/sound';
import { PROTOCOL_VERSION, type PublicMatchState } from '../src/shared/game-types';
import { useGameClient } from '../src/client/hooks/use-game-client';

/**
 * Delivery notes for these tests: the server emits `move:accepted` and then
 * `match:state` for the same move in one tick (match-service.ts). Both packets
 * reach the client before React re-renders, which is exactly the case that used
 * to double up the turn chime. `serverEmits` dispatches them inside a single
 * `act` so the tests keep that behavior honest.
 */

const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, Array<(payload: unknown) => void>>();
  const socket = {
    connected: true,
    id: 'socket-test',
    on(event: string, handler: (payload: unknown) => void) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return socket;
    },
    connect() {
      return socket;
    },
    disconnect() {
      return socket;
    },
    removeAllListeners() {
      handlers.clear();
      return socket;
    },
    emit() {
      return socket;
    },
  };
  return { handlers, socket };
});

vi.mock('../src/client/lib/socket', () => ({
  createGameSocket: () => socketHarness.socket,
  request: () => Promise.resolve(undefined),
  SocketRequestError: class SocketRequestError extends Error {},
}));

vi.mock('../src/client/lib/api', () => ({
  ApiRequestError: class ApiRequestError extends Error {
    status = 500;
    code = 'UNKNOWN';
  },
  authenticateDev: vi.fn(),
  authenticateTelegram: vi.fn(),
  errorMessage: (error: unknown) => String(error),
  fetchConfig: async () => ({
    protocol: 1,
    botUsername: null,
    miniAppUrl: null,
    devAuthEnabled: false,
    demoMode: false,
    environment: 'test',
    queueAiTimeoutMs: 10_000,
    queueMaxWaitMs: 600_000,
    matchStartCountdownMs: 0,
    turnTimeoutMs: 0,
    disconnectGraceMs: 30_000,
    inviteTtlMinutes: 1_440,
  }),
  fetchMe: async () => ({
    user: {
      id: 'user-1',
      telegramId: '1',
      displayName: 'You',
      username: null,
      photoUrl: null,
      languageCode: 'en',
    },
  }),
  getDeviceKey: () => 'device-1',
  logout: vi.fn(),
  sendTestNotification: vi.fn(),
  updatePreferences: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('../src/client/lib/telegram', () => ({
  getWebApp: () => null,
  hapticImpact: vi.fn(),
  hapticNotify: vi.fn(),
  initTelegram: vi.fn(),
  parseGameMatchId: () => null,
  parseInviteToken: () => null,
  readStartParam: () => null,
  requestTelegramWriteAccess: vi.fn(),
  updateViewportHeight: vi.fn(),
  watchTheme: () => ({ cleanup: () => undefined }),
}));

vi.mock('../src/client/lib/sound', () => ({
  isSoundMuted: () => false,
  setSoundMuted: vi.fn(),
  toggleSound: () => false,
  playChatSound: vi.fn(),
  playDefeatSound: vi.fn(),
  playIllegalMoveSound: vi.fn(),
  playReactionSound: vi.fn(),
  playStoneSound: vi.fn(),
  playTurnSound: vi.fn(),
  playUrgentCountdownSound: vi.fn(),
  playVictorySound: vi.fn(),
}));

function matchState(overrides: Partial<PublicMatchState> = {}): PublicMatchState {
  return {
    protocol: PROTOCOL_VERSION,
    id: 'match-1',
    mode: 'RANDOM',
    status: 'ACTIVE',
    board: {},
    currentTurn: 'X',
    turnNumber: 1,
    lastMove: null,
    version: 1,
    youSide: 'X',
    players: { X: null, O: null },
    winnerSide: null,
    result: null,
    finishReason: null,
    startedAt: '2026-11-16T09:00:00.000Z',
    finishedAt: null,
    turnDeadline: null,
    turnTimerPaused: false,
    opponentConnection: 'connected',
    rematch: { available: false, requestedByYou: false, requestedByOpponent: false, expiresAt: null },
    ...overrides,
  };
}

function serverEmits(...events: Array<[string, unknown]>): void {
  act(() => {
    for (const [event, payload] of events) {
      for (const handler of socketHarness.handlers.get(event) ?? []) handler(payload);
    }
  });
}

async function mountClient(): Promise<void> {
  function Harness() {
    const client = useGameClient({ onMatchFound: vi.fn() });
    return <span data-testid="phase">{client.phase}</span>;
  }

  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId('phase').textContent).toBe('ready'));
  await waitFor(() => expect(socketHarness.handlers.has('move:accepted')).toBe(true));
}

function clearSoundMocks(): void {
  vi.mocked(playStoneSound).mockClear();
  vi.mocked(playTurnSound).mockClear();
  vi.mocked(playVictorySound).mockClear();
  vi.mocked(playDefeatSound).mockClear();
}

describe('match audio cues', () => {
  beforeEach(() => {
    clearSoundMocks();
  });

  afterEach(() => {
    cleanup();
    socketHarness.handlers.clear();
    vi.clearAllMocks();
  });

  it('plays one stone sound and one turn chime for an opponent move', async () => {
    await mountClient();
    serverEmits(['match:found', { match: matchState({ currentTurn: 'O' }) }]);
    clearSoundMocks();

    serverEmits(
      ['move:accepted', { matchId: 'match-1', side: 'O', cell: 1, actionId: 'a1', version: 2 }],
      [
        'match:state',
        {
          match: matchState({
            board: { 1: 'O' },
            currentTurn: 'X',
            turnNumber: 2,
            version: 2,
            lastMove: { cell: 1, side: 'O' },
          }),
        },
      ],
    );

    expect(playStoneSound).toHaveBeenCalledTimes(1);
    expect(playStoneSound).toHaveBeenCalledWith('O');
    expect(playTurnSound).toHaveBeenCalledTimes(1);
  });

  it('does not replay the stone sound for the local player own move', async () => {
    await mountClient();
    serverEmits(['match:found', { match: matchState({ currentTurn: 'X' }) }]);
    clearSoundMocks();

    serverEmits(
      ['move:accepted', { matchId: 'match-1', side: 'X', cell: 0, actionId: 'a2', version: 2 }],
      [
        'match:state',
        {
          match: matchState({
            board: { 0: 'X' },
            currentTurn: 'O',
            turnNumber: 2,
            version: 2,
            lastMove: { cell: 0, side: 'X' },
          }),
        },
      ],
    );

    // The tap already played the optimistic stone sound and the chime only
    // belongs to the player whose turn just started.
    expect(playStoneSound).not.toHaveBeenCalled();
    expect(playTurnSound).not.toHaveBeenCalled();
  });

  it('ignores moved events from another match and replayed cells', async () => {
    await mountClient();
    serverEmits(['match:found', { match: matchState({ id: 'match-2', board: { 4: 'O' }, currentTurn: 'X' }) }]);
    clearSoundMocks();

    serverEmits(['move:accepted', { matchId: 'match-1', side: 'O', cell: 1, actionId: 'old', version: 2 }]);
    serverEmits(['move:accepted', { matchId: 'match-2', side: 'O', cell: 4, actionId: 'replay', version: 2 }]);

    expect(playStoneSound).not.toHaveBeenCalled();
  });

  it('plays the defeat sound when the player loses', async () => {
    await mountClient();
    serverEmits(['match:found', { match: matchState({ currentTurn: 'X' }) }]);
    clearSoundMocks();

    serverEmits([
      'match:finished',
      {
        match: matchState({
          status: 'FINISHED',
          currentTurn: null,
          winnerSide: 'O',
          result: 'O_WINS',
          finishReason: 'LINE',
          finishedAt: '2026-11-16T09:05:00.000Z',
        }),
      },
    ]);

    expect(playDefeatSound).toHaveBeenCalledTimes(1);
    expect(playVictorySound).not.toHaveBeenCalled();
  });

  it('plays the victory sound when the player wins and stays quiet on a draw', async () => {
    await mountClient();
    serverEmits(['match:found', { match: matchState({ currentTurn: 'X' }) }]);
    clearSoundMocks();

    serverEmits([
      'match:finished',
      {
        match: matchState({
          status: 'FINISHED',
          currentTurn: null,
          winnerSide: 'X',
          result: 'X_WINS',
          finishReason: 'LINE',
          finishedAt: '2026-11-16T09:05:00.000Z',
        }),
      },
    ]);

    expect(playVictorySound).toHaveBeenCalledTimes(1);
    expect(playDefeatSound).not.toHaveBeenCalled();

    clearSoundMocks();
    serverEmits([
      'match:finished',
      {
        match: matchState({
          status: 'FINISHED',
          currentTurn: null,
          winnerSide: null,
          result: 'DRAW',
          finishReason: 'DRAW',
          finishedAt: '2026-11-16T09:06:00.000Z',
        }),
      },
    ]);

    expect(playVictorySound).not.toHaveBeenCalled();
    expect(playDefeatSound).not.toHaveBeenCalled();
  });
});
