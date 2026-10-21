import { describe, expect, it } from 'vitest';
import { chooseAiMove, chooseOptimalMove } from '../src/server/game/ai';
import { getAvailableMoves, getGameStatus } from '../src/server/game/rules';
import {
  createEmptyBoard,
  oppositeSide,
  type Board,
  type Cell,
  type Side,
} from '../src/shared/game-types';

function withMarks(marks: Record<number, Side>): Cell[] {
  const board = createEmptyBoard();
  for (const [index, side] of Object.entries(marks)) board[Number(index)] = side;
  return board;
}

function playFrom(board: Cell[], aiSide: Side): void {
  const humanSide = oppositeSide(aiSide);
  const visit = (current: Board, turn: Side): void => {
    const status = getGameStatus(current);
    if (status.status === 'WON') {
      expect(status.winner).not.toBe(humanSide);
      return;
    }
    if (status.status === 'DRAW') return;

    if (turn === humanSide) {
      for (const cell of getAvailableMoves(current)) {
        const next = [...current];
        next[cell] = humanSide;
        visit(next, aiSide);
      }
      return;
    }

    const move = chooseAiMove(current, aiSide, 'HARD');
    expect(move).not.toBeNull();
    if (move === null) return;
    expect(current[move]).toBeNull();
    const next = [...current];
    next[move] = aiSide;
    visit(next, humanSide);
  };

  visit(board, 'X');
}

describe('AI', () => {
  it('Hard takes an immediate winning move', () => {
    const board = withMarks({ 0: 'X', 1: 'X', 3: 'O', 4: 'O' });
    expect(chooseOptimalMove(board, 'X')).toBe(2);
  });

  it('Hard blocks an immediate human win', () => {
    const board = withMarks({ 0: 'X', 1: 'X', 4: 'O' });
    expect(chooseOptimalMove(board, 'O')).toBe(2);
  });

  it('Hard prefers winning now over blocking the opponent', () => {
    const board = withMarks({ 0: 'X', 1: 'X', 3: 'O', 4: 'O' });
    expect(chooseOptimalMove(board, 'O')).toBe(5);
  });

  it('Hard as O never loses to any sequence of human moves', () => {
    playFrom(createEmptyBoard(), 'O');
  });

  it('Hard as X never loses to any sequence of human moves', () => {
    playFrom(createEmptyBoard(), 'X');
  });

  it('returns null when the board is finished or full', () => {
    const won: Cell[] = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    const draw: Cell[] = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];
    expect(chooseAiMove(won, 'O', 'HARD')).toBeNull();
    expect(chooseAiMove(draw, 'X', 'HARD')).toBeNull();
  });

  it.each(['EASY', 'MEDIUM', 'HARD'] as const)('%s always returns a legal move', (difficulty) => {
    const boards: Cell[][] = [
      createEmptyBoard(),
      withMarks({ 4: 'X' }),
      withMarks({ 0: 'X', 4: 'O', 8: 'X' }),
      withMarks({ 0: 'X', 1: 'O', 2: 'X', 3: 'X', 4: 'O' }),
      withMarks({ 0: 'X', 1: 'O', 2: 'X', 3: 'X', 4: 'O', 5: 'O', 6: 'O', 7: 'X' }),
    ];
    for (const board of boards) {
      for (const randomValue of [0, 0.01, 0.25, 0.5, 0.75, 0.999]) {
        const side: Side = getAvailableMoves(board).length % 2 === 0 ? 'X' : 'O';
        if (getGameStatus(board).status !== 'ACTIVE') continue;
        const move = chooseAiMove(board, side, difficulty, () => randomValue);
        expect(move).not.toBeNull();
        if (move !== null) expect(board[move]).toBeNull();
      }
    }
  });

  it('Easy can overlook an immediate win', () => {
    const board = withMarks({ 0: 'X', 1: 'X' });
    // random() >= 0.22 means "play randomly"; 0.999 selects the last empty cell.
    const move = chooseAiMove(board, 'X', 'EASY', () => 0.999);
    expect(move).not.toBe(2);
    expect(move).not.toBeNull();
    if (move !== null) expect(board[move]).toBeNull();
  });

  it('Medium usually plays the optimal move when strategic', () => {
    const board = withMarks({ 0: 'X', 1: 'X', 4: 'O' });
    // random() < 0.72 selects the strategic branch; the best move is unique.
    const move = chooseAiMove(board, 'O', 'MEDIUM', () => 0);
    expect(move).toBe(2);
  });
});
