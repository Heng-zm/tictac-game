// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameResult } from '../src/client/components/GameResult';
import type { PublicMatchState, PublicPlayer } from '../src/shared/game-types';
import { encodeCell } from '../src/shared/game-types';

const playerYou: PublicPlayer = {
  side: 'X',
  displayName: 'DarthVader',
  username: 'vader',
  photoUrl: null,
  isAi: false,
  aiDifficulty: null,
  isYou: true,
  connected: true,
};

const playerOpponent: PublicPlayer = {
  side: 'O',
  displayName: 'LukeSkywalker',
  username: 'luke',
  photoUrl: null,
  isAi: false,
  aiDifficulty: null,
  isYou: false,
  connected: true,
};

function createSampleMatch(overrides: Partial<PublicMatchState> = {}): PublicMatchState {
  const winningLine = [0, 1, 2, 3, 4].map((x) => encodeCell(x, 0));
  const [w0, w1, w2, w3, w4] = winningLine;
  const board: Record<number, 'X' | 'O'> = {
    [w0 as number]: 'X',
    [w1 as number]: 'X',
    [w2 as number]: 'X',
    [w3 as number]: 'X',
    [w4 as number]: 'X',
    [encodeCell(0, 1)]: 'O',
    [encodeCell(1, 1)]: 'O',
    [encodeCell(2, 1)]: 'O',
    [encodeCell(3, 1)]: 'O',
  };

  return {
    protocol: 1,
    id: 'test-match-123',
    mode: 'RANDOM',
    status: 'FINISHED',
    board,
    currentTurn: null,
    turnNumber: 9,
    lastMove: { cell: w4 as number, side: 'X' },
    version: 9,
    youSide: 'X',
    players: { X: playerYou, O: playerOpponent },
    winnerSide: 'X',
    result: 'X_WINS',
    finishReason: 'LINE',
    startedAt: '2026-11-16T05:00:00.000Z',
    finishedAt: '2026-11-16T05:02:15.000Z',
    turnDeadline: null,
    turnTimerPaused: false,
    opponentConnection: 'connected',
    rematch: {
      available: true,
      requestedByYou: false,
      requestedByOpponent: false,
      expiresAt: null,
    },
    ...overrides,
  };
}

describe('GameResult Component', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders victory screen with winner headline, matchup card, and stats', () => {
    const match = createSampleMatch();
    render(
      <GameResult
        match={match}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(screen.getByRole('dialog', { name: 'Game result' })).toBeTruthy();
    expect(screen.getByText('You win!')).toBeTruthy();
    expect(screen.getByText(/Five in a row! Beautifully played\./i)).toBeTruthy();

    // Matchup card
    expect(screen.getByText('DarthVader')).toBeTruthy();
    expect(screen.getByText('LukeSkywalker')).toBeTruthy();
    expect(screen.getByText('Playing X')).toBeTruthy();
    expect(screen.getByText('Playing O')).toBeTruthy();

    // Rating pill
    expect(screen.getByText(/Rating \+20/i)).toBeTruthy();
  });

  it('renders defeat screen properly for lost game', () => {
    const match = createSampleMatch({
      winnerSide: 'O',
      result: 'O_WINS',
    });

    render(
      <GameResult
        match={match}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(screen.getByText('You lost')).toBeTruthy();
    expect(screen.getByText(/Five in a row for your opponent\./i)).toBeTruthy();
  });

  it('celebrates a win with confetti and the winning card animation', () => {
    render(
      <GameResult
        match={createSampleMatch()}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(document.querySelector('.result-card--win')).toBeTruthy();
    expect(document.querySelector('.result-card--defeat')).toBeNull();
    expect(document.querySelectorAll('.result-confetti__piece')).toHaveLength(26);
  });

  it('plays the defeat jolt and ring on a loss', () => {
    render(
      <GameResult
        match={createSampleMatch({ winnerSide: 'O', result: 'O_WINS' })}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(document.querySelector('.result-card--defeat')).toBeTruthy();
    expect(document.querySelector('.result-defeat-ring')).toBeTruthy();
    expect(document.querySelector('.result-defeat-mark')).toBeTruthy();
    expect(document.querySelector('.result-confetti')).toBeNull();
  });

  it('keeps a draw neutral', () => {
    render(
      <GameResult
        match={createSampleMatch({ result: 'DRAW', winnerSide: null, finishReason: 'DRAW' })}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    expect(screen.getByText('Draw')).toBeTruthy();
    expect(document.querySelector('.result-card--win')).toBeNull();
    expect(document.querySelector('.result-card--defeat')).toBeNull();
    expect(document.querySelector('.result-confetti')).toBeNull();
  });

  it('renders deciding area mini-board with winning line highlighted', () => {
    const match = createSampleMatch();
    render(
      <GameResult
        match={match}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
      />,
    );

    expect(screen.queryByText('Moves')).toBeNull();
    expect(screen.queryByText('Duration')).toBeNull();
    const miniBoard = screen.getByRole('img', { name: 'Final board around the deciding area' });
    expect(miniBoard).toBeTruthy();
    expect(screen.getByText('Deciding 5×5 area')).toBeTruthy();
    expect(screen.getByText('5 in a row')).toBeTruthy();
  });

  it('handles Review Board minimize and reopen interaction', () => {
    const match = createSampleMatch();
    render(
      <GameResult
        match={match}
        open={true}
        rematchBusy={false}
        onRematch={vi.fn()}
        onHome={vi.fn()}
        onHistory={vi.fn()}
      />,
    );

    // Initial state: dialog is visible
    expect(screen.getByRole('dialog', { name: 'Game result' })).toBeTruthy();

    // Click "Review Board"
    const reviewBtn = screen.getByRole('button', { name: /Review Board/i });
    fireEvent.click(reviewBtn);

    // Modal dialog is dismissed, floating summary bar appears
    expect(screen.queryByRole('dialog', { name: 'Game result' })).toBeNull();
    const floatingBar = screen.getByRole('region', { name: 'Match outcome summary' });
    expect(floatingBar).toBeTruthy();

    // Click "Result" to reopen the full modal
    const resultBtn = screen.getByRole('button', { name: 'Result' });
    fireEvent.click(resultBtn);
    expect(screen.getByRole('dialog', { name: 'Game result' })).toBeTruthy();
  });

  it('triggers onRematch and onHome handlers and confirms Share and History are removed', () => {
    const onRematch = vi.fn();
    const onHome = vi.fn();

    const match = createSampleMatch();
    render(
      <GameResult
        match={match}
        open={true}
        rematchBusy={false}
        onRematch={onRematch}
        onHome={onHome}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Play again/i }));
    expect(onRematch).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(onHome).toHaveBeenCalledOnce();

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
  });
});
