import { describe, expect, it } from 'vitest';
import {
  applyMove,
  countEmptyCells,
  getAvailableMoves,
  getGameStatus,
  getWinner,
  isBoardFull,
  isValidBoard,
  sideToMove,
  validateBoard,
} from '../src/server/game/rules';
import {
  WINNING_LINES,
  createEmptyBoard,
  type Board,
  type Cell,
} from '../src/shared/game-types';

const DRAW_BOARD: Cell[] = ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];

function boardWithXLine(line: readonly [number, number, number]): Cell[] {
  const board = createEmptyBoard();
  for (const index of line) board[index] = 'X';
  return board;
}

describe('game rules', () => {
  it.each(WINNING_LINES.map((line) => [line.join('-'), line] as const))(
    'detects winning line %s',
    (_label, line) => {
      const board = boardWithXLine(line);
      expect(getWinner(board)).toEqual({ side: 'X', line });
      expect(getGameStatus(board)).toEqual({ status: 'WON', winner: 'X', line });
      expect(isBoardFull(board)).toBe(false);
    },
  );

  it('detects O wins and draws', () => {
    const board: Cell[] = [null, null, null, 'O', 'O', 'O', null, null, null];
    expect(getWinner(board)).toEqual({ side: 'O', line: [3, 4, 5] });
    expect(getWinner(DRAW_BOARD)).toBeNull();
    expect(getGameStatus(DRAW_BOARD)).toEqual({ status: 'DRAW', winner: null, line: null });
    expect(isBoardFull(DRAW_BOARD)).toBe(true);
    expect(countEmptyCells(DRAW_BOARD)).toBe(0);
  });

  it('reports an active game and available moves', () => {
    const board: Cell[] = ['X', null, 'O', null, 'X', null, null, null, null];
    expect(getGameStatus(board)).toEqual({ status: 'ACTIVE', winner: null, line: null });
    expect(getAvailableMoves(board)).toEqual([1, 3, 5, 6, 7, 8]);
    expect(countEmptyCells(board)).toBe(6);
  });

  it('applies a valid move without mutating the source board', () => {
    const board = createEmptyBoard();
    const result = applyMove(board, 'X', 4);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.board[4]).toBe('X');
    expect(board[4]).toBeNull();
  });

  it('rejects invalid, occupied and finished boards', () => {
    expect(applyMove(createEmptyBoard(), 'X', -1)).toEqual({ ok: false, code: 'INVALID_CELL' });
    expect(applyMove(createEmptyBoard(), 'X', 9)).toEqual({ ok: false, code: 'INVALID_CELL' });
    expect(applyMove(createEmptyBoard(), 'X', 1.5)).toEqual({ ok: false, code: 'INVALID_CELL' });
    expect(applyMove(createEmptyBoard(), 'X', Number.NaN)).toEqual({ ok: false, code: 'INVALID_CELL' });

    const occupied: Cell[] = [null, 'O', null, null, null, null, null, null, null];
    expect(applyMove(occupied, 'X', 1)).toEqual({ ok: false, code: 'OCCUPIED_CELL' });

    const won: Cell[] = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    expect(applyMove(won, 'O', 5)).toEqual({ ok: false, code: 'GAME_FINISHED' });
    // A full board has no empty cell, so the occupancy check wins over the
    // finished check for any attempted move.
    expect(applyMove(DRAW_BOARD, 'X', 0)).toEqual({ ok: false, code: 'OCCUPIED_CELL' });
  });

  it('validates board shapes', () => {
    expect(isValidBoard(DRAW_BOARD)).toBe(true);
    expect(isValidBoard(createEmptyBoard())).toBe(true);
    expect(isValidBoard([])).toBe(false);
    expect(isValidBoard(['X', 'O'])).toBe(false);
    expect(isValidBoard(['X', 'O', 'X', 'O', 'X', 'O', 'X', 'O', 'Z'])).toBe(false);
    expect(() => validateBoard(['X'] as unknown as Board)).toThrow('Invalid board state');
  });

  it('derives the side to move from mark counts', () => {
    expect(sideToMove(createEmptyBoard())).toBe('X');
    expect(sideToMove(['X', null, null, null, null, null, null, null, null])).toBe('O');
    expect(sideToMove(['X', 'O', 'X', null, null, null, null, null, null])).toBe('O');
    expect(() => sideToMove(['O', null, null, null, null, null, null, null, null])).toThrow(
      'Invalid move counts on board',
    );
  });
});
