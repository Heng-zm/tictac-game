// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicMatchState, PublicPlayer } from '../src/shared/game-types';
import { ActiveGameBar } from '../src/client/components/ActiveGameBar';

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

const alex: PublicPlayer = {
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
    id: '123e4567-e89b-42d3-a456-426614174000',
    mode: 'RANDOM',
    status: 'ACTIVE',
    board: {},
    currentTurn: 'X',
    turnNumber: 1,
    lastMove: null,
    version: 1,
    youSide: 'X',
    players: { X: you, O: alex },
    winnerSide: null,
    result: null,
    finishReason: null,
    startedAt: '2026-10-22T11:59:00.000Z',
    finishedAt: null,
    turnDeadline: '2026-10-22T12:00:25.000Z',
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

describe('ActiveGameBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('shows the live clock and returns to the board on your turn', () => {
    const onResume = vi.fn();
    render(<ActiveGameBar match={makeMatch()} connection="online" onResume={onResume} />);

    expect(screen.getByText('Your turn')).toBeTruthy();
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('0:25')).toBeTruthy();

    const button = screen.getByRole('button', {
      name: /Resume active game\. Your turn, 0:25 remaining\. Playing Alex\./i,
    });
    fireEvent.click(button);
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('describes the opponent turn without showing your clock', () => {
    render(
      <ActiveGameBar
        match={makeMatch({ currentTurn: 'O', turnDeadline: null })}
        connection="online"
        onResume={() => undefined}
      />,
    );

    expect(screen.getByText('Alex is thinking')).toBeTruthy();
    expect(screen.queryByText('Your turn')).toBeNull();
    expect(screen.queryByText('0:25')).toBeNull();
  });

  it('shows paused state while an opponent is disconnected', () => {
    render(
      <ActiveGameBar
        match={makeMatch({ currentTurn: 'O', turnTimerPaused: true, opponentConnection: 'disconnected' })}
        connection="online"
        onResume={() => undefined}
      />,
    );

    expect(screen.getByText('Game paused')).toBeTruthy();
  });

  it('prioritizes the reconnect state and handles bot opponents', () => {
    const bot: PublicPlayer = {
      ...alex,
      displayName: 'Tic Tac Bot',
      username: null,
      isAi: true,
      aiDifficulty: 'MEDIUM',
    };

    const { rerender } = render(
      <ActiveGameBar
        match={makeMatch({ players: { X: you, O: bot }, currentTurn: 'O' })}
        connection="online"
        onResume={() => undefined}
      />,
    );

    expect(screen.getByText('Bot is thinking')).toBeTruthy();

    rerender(
      <ActiveGameBar
        match={makeMatch({ players: { X: you, O: bot }, currentTurn: 'O' })}
        connection="reconnecting"
        onResume={() => undefined}
      />,
    );

    expect(screen.getByText('Reconnecting')).toBeTruthy();
    expect(screen.queryByText('Bot is thinking')).toBeNull();
  });
});
