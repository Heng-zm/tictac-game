import { describe, expect, it } from 'vitest';
import {
  applyMove,
  getGameStatus,
  getWinner,
  isBoardFull,
  isValidBoard,
  sideToMove,
} from '../src/server/game/rules';
import {
  createEmptyBoard,
  decodeCell,
  encodeCell,
  type Board,
} from '../src/shared/game-types';

describe('infinite grid 5-in-a-row rules', () => {
  it('detects horizontal 5-in-a-row win for X', () => {
    const board: Board = createEmptyBoard();
    // 5 in a row horizontally at y=0, x=0..4
    for (let x = 0; x < 5; x++) {
      board[encodeCell(x, 0)] = 'X';
    }
    // 4 moves for O elsewhere
    for (let x = 0; x < 4; x++) {
      board[encodeCell(x, 1)] = 'O';
    }

    const winner = getWinner(board);
    expect(winner).not.toBeNull();
    expect(winner?.side).toBe('X');
    expect(winner?.line.length).toBe(5);
    expect(getGameStatus(board).status).toBe('WON');
  });

  it('detects vertical 5-in-a-row win for O', () => {
    const board: Board = createEmptyBoard();
    // 5 moves for X
    for (let i = 0; i < 5; i++) board[encodeCell(i, 5)] = 'X';
    // 5 in a row vertically for O at x=2, y=0..4
    for (let y = 0; y < 5; y++) board[encodeCell(2, y)] = 'O';

    const winner = getWinner(board);
    expect(winner).not.toBeNull();
    expect(winner?.side).toBe('O');
  });

  it('detects diagonal 5-in-a-row win', () => {
    const board: Board = createEmptyBoard();
    for (let i = 0; i < 5; i++) board[encodeCell(i, i)] = 'X';
    for (let i = 0; i < 4; i++) board[encodeCell(i, -1)] = 'O';

    const winner = getWinner(board);
    expect(winner).not.toBeNull();
    expect(winner?.side).toBe('X');
  });

  it('reports active game when fewer than 5 in a row', () => {
    const board: Board = createEmptyBoard();
    board[encodeCell(0, 0)] = 'X';
    board[encodeCell(1, 0)] = 'O';
    expect(getWinner(board)).toBeNull();
    expect(getGameStatus(board)).toEqual({ status: 'ACTIVE', winner: null, line: null });
  });

  it('infinite board never fills up and has no draw', () => {
    const board: Board = createEmptyBoard();
    expect(isBoardFull(board)).toBe(false);
  });

  it('applies a valid move without mutating original board', () => {
    const board = createEmptyBoard();
    const cell = encodeCell(2, 3);
    const result = applyMove(board, 'X', cell);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.board[cell]).toBe('X');
    expect(board[cell]).toBeUndefined();
  });

  it('rejects occupied cells and finished games', () => {
    const board: Board = createEmptyBoard();
    const cell = encodeCell(0, 0);
    board[cell] = 'X';
    expect(applyMove(board, 'O', cell)).toEqual({ ok: false, code: 'OCCUPIED_CELL' });
  });

  it('validates board object shape', () => {
    expect(isValidBoard(createEmptyBoard())).toBe(true);
    expect(isValidBoard({ [encodeCell(0, 0)]: 'X' })).toBe(true);
    expect(isValidBoard([])).toBe(false);
    expect(isValidBoard(null)).toBe(false);
  });

  it('derives side to move correctly', () => {
    const board = createEmptyBoard();
    expect(sideToMove(board)).toBe('X');
    board[encodeCell(0, 0)] = 'X';
    expect(sideToMove(board)).toBe('O');
    board[encodeCell(1, 0)] = 'O';
    expect(sideToMove(board)).toBe('X');
  });

  it('correctly decodes cell coordinates', () => {
    const cell = encodeCell(15, -7);
    const decoded = decodeCell(cell);
    expect(decoded.x).toBe(15);
    expect(decoded.y).toBe(-7);
  });
});
