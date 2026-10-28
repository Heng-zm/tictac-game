// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameClient } from '../src/client/hooks/use-game-client';
import { GameScreen } from '../src/client/screens/GameScreen';
import type {
  AppConfigPayload,
  MatchMode,
  PublicMatchState,
  PublicPlayer,
  UserProfile,
} from '../src/shared/game-types';

const MATCH_ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = '2026-10-28T12:00:00.000Z';

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

const CONFIG: AppConfigPayload = {
  protocol: 1,
  botUsername: null,
  botAppName: null,
  miniAppUrl: null,
  devAuthEnabled: false,
  demoMode: false,
  environment: 'test',
  queueAiTimeoutMs: 10_000,
  queueMaxWaitMs: 600_000,
  matchStartCountdownMs: 5_000,
  turnTimeoutMs: 90_000,
  disconnectGraceMs: 30_000,
  inviteTtlMinutes: 1_440,
  aiFallbackDifficulty: 'MEDIUM',
};

function makeMatch(
  startedAt: string,
  overrides: Partial<PublicMatchState> = {},
): PublicMatchState {
  return {
    protocol: 1,
    id: MATCH_ID,
    mode: 'RANDOM',
    status: 'ACTIVE',
    board: {},
    currentTurn: 'X',
    turnNumber: 0,
    lastMove: null,
    version: 0,
    youSide: 'X',
    players: { X: you, O: opponent },
    winnerSide: null,
    result: null,
    finishReason: null,
    startedAt,
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

function makeClient(
  mode: MatchMode,
  startedAt: string,
  overrides: Partial<GameClient> = {},
): GameClient {
  return {
    connection: 'online',
    clockOffsetMs: 0,
    match: makeMatch(startedAt, { mode }),
    config: CONFIG,
    profile: makeProfile(),
    lastRejection: null,
    lastMove: null,
    opponentGraceEndsAt: null,
    reactions: [],
    chatMessages: [],
    incomingVoice: null,
    joinMatch: vi.fn().mockResolvedValue(makeMatch(startedAt)),
    submitMove: vi.fn().mockResolvedValue(makeMatch(startedAt)),
    sendReaction: vi.fn().mockResolvedValue({ sent: true }),
    sendChat: vi.fn().mockResolvedValue({ sent: true }),
    sendVoice: vi.fn().mockResolvedValue({ sent: true }),
    pushToast: vi.fn(),
    reconnect: vi.fn(),
    requestRematch: vi.fn().mockResolvedValue({ matchId: MATCH_ID }),
    leaveMatch: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as GameClient;
}

function renderGame(client: GameClient): void {
  render(<GameScreen client={client} navigate={vi.fn()} matchId={MATCH_ID} />);
}

describe('GameScreen match-start countdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('shows a synced 5-second countdown for a fresh online match', () => {
    renderGame(makeClient('RANDOM', NOW));

    expect(screen.getByText('Match found')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(/Get ready/).textContent).toContain('you play X');

    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText('4')).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByText('Match found')).toBeNull();
  });

  it('does not replay the countdown when resuming an older match', () => {
    renderGame(makeClient('RANDOM', '2026-10-28T11:59:40.000Z'));
    expect(screen.queryByText('Match found')).toBeNull();
  });

  it('starts bot practice immediately without a countdown', () => {
    renderGame(makeClient('AI', NOW));
    expect(screen.queryByText('Match found')).toBeNull();
  });

  it('uses the server clock instead of a skewed device clock', () => {
    // The device is three seconds behind the server, so only two seconds
    // should remain even though Date.now() says the match just started.
    renderGame(makeClient('RANDOM', NOW, { clockOffsetMs: 3_000 }));

    expect(screen.getByText('Match found')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.queryByText('5')).toBeNull();
  });

  it('does not show a countdown when the server disables it', () => {
    renderGame(
      makeClient('RANDOM', NOW, {
        config: { ...CONFIG, matchStartCountdownMs: 0 },
      }),
    );
    expect(screen.queryByText('Match found')).toBeNull();
  });

  it('never displays more countdown seconds than the configured duration', () => {
    // A stale/incorrect offset must not turn a 5-second ready phase into a
    // 15-second one.
    renderGame(makeClient('RANDOM', NOW, { clockOffsetMs: -10_000 }));
    expect(screen.getByText('5')).toBeTruthy();
  });
});
