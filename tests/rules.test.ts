import { describe, expect, it } from 'vitest';
import {
  applyMove,
  applyMoveWithStatus,
  getGameStatus,
  getWinner,
  getWinnerAt,
  isBoardFull,
  isValidBoard,
  MAX_GAME_MOVES,
  sideToMove,
} from '../src/server/game/rules';
import {
  COORD_OFFSET,
  createEmptyBoard,
  decodeCell,
  encodeCell,
  isInBounds,
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
    // 4 moves for X, deliberately not a winning line
    for (let i = 0; i < 4; i++) board[encodeCell(i, 5)] = 'X';
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

  it('detects a win through the last placed stone without scanning the whole board', () => {
    const board: Board = createEmptyBoard();
    for (let i = 0; i < 5; i++) board[encodeCell(i, 2)] = 'X';
    for (let i = 0; i < 4; i++) board[encodeCell(i, -2)] = 'O';

    const winner = getWinnerAt(board, encodeCell(2, 2));
    expect(winner).toEqual({ side: 'X', line: [0, 1, 2, 3, 4].map((x) => encodeCell(x, 2)) });

    // A stone that is not part of a winning line must not report a win.
    expect(getWinnerAt(board, encodeCell(2, -2))).toBeNull();
  });

  it('does not wrap winning lines across the board edge', () => {
    const board: Board = createEmptyBoard();
    // Encoding is stride-based. Before the bounds check, stepping past x=10000
    // aliased the next row at x=-10000 and produced a false five-in-a-row.
    board[encodeCell(COORD_OFFSET - 1, 0)] = 'X';
    for (let i = 0; i < 4; i++) board[encodeCell(-COORD_OFFSET + i, 1)] = 'X';
    for (let i = 0; i < 4; i++) board[encodeCell(i, 5)] = 'O';

    expect(getWinner(board)).toBeNull();
    expect(getWinnerAt(board, encodeCell(COORD_OFFSET - 1, 0))).toBeNull();
  });

  it('uses a half-open coordinate range so edge cells cannot alias', () => {
    expect(encodeCell(COORD_OFFSET, 0)).toBe(encodeCell(-COORD_OFFSET, 1));

    expect(isInBounds(-COORD_OFFSET, -COORD_OFFSET)).toBe(true);
    expect(isInBounds(COORD_OFFSET - 1, COORD_OFFSET - 1)).toBe(true);
    expect(isInBounds(COORD_OFFSET, 0)).toBe(false);
    expect(isInBounds(0, COORD_OFFSET)).toBe(false);
    expect(isInBounds(-COORD_OFFSET - 1, 0)).toBe(false);
    expect(isInBounds(0, -COORD_OFFSET - 1)).toBe(false);

    const empty = createEmptyBoard();
    // A cell index is canonical: the aliased index is the valid cell at
    // (-COORD_OFFSET, 1), not a way to reach the out-of-range (COORD_OFFSET, 0).
    const aliasCell = encodeCell(COORD_OFFSET, 0);
    expect(decodeCell(aliasCell)).toEqual({ x: -COORD_OFFSET, y: 1 });
    expect(applyMove(empty, 'X', aliasCell)).toMatchObject({ ok: true });
    expect(applyMove(empty, 'X', encodeCell(0, COORD_OFFSET))).toEqual({
      ok: false,
      code: 'INVALID_CELL',
    });

    const minCell = encodeCell(-COORD_OFFSET, -COORD_OFFSET);
    expect(minCell).toBe(0);
    expect(decodeCell(minCell)).toEqual({ x: -COORD_OFFSET, y: -COORD_OFFSET });
    expect(applyMove(empty, 'X', minCell)).toMatchObject({ ok: true });
  });

  it('does not complete five in a row through an aliased edge cell', () => {
    const board: Board = createEmptyBoard();
    for (let x = COORD_OFFSET - 4; x < COORD_OFFSET; x++) {
      board[encodeCell(x, 0)] = 'X';
    }
    // This shares its encoded index with the out-of-range (COORD_OFFSET, 0),
    // which used to complete a false five-in-a-row at the boundary.
    board[encodeCell(-COORD_OFFSET, 1)] = 'X';
    for (let x = 0; x < 4; x++) board[encodeCell(x, 5)] = 'O';

    expect(board[encodeCell(COORD_OFFSET, 0)]).toBe('X');
    expect(getWinner(board)).toBeNull();
    expect(getWinnerAt(board, encodeCell(COORD_OFFSET - 4, 0))).toBeNull();
  });

  it('applies a move and returns its status in one pass', () => {
    const board: Board = createEmptyBoard();
    for (let x = 0; x < 4; x++) board[encodeCell(x, 0)] = 'X';
    for (let x = 0; x < 4; x++) board[encodeCell(x, 1)] = 'O';

    const applied = applyMoveWithStatus(board, 'X', encodeCell(4, 0));
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.board[encodeCell(4, 0)]).toBe('X');
    expect(applied.status).toMatchObject({ status: 'WON', winner: 'X' });
    expect(applyMove(board, 'X', encodeCell(4, 0))).toMatchObject({
      ok: true,
      board: applied.board,
    });
  });

  it('reports active game when fewer than 5 in a row', () => {
    const board: Board = createEmptyBoard();
    board[encodeCell(0, 0)] = 'X';
    board[encodeCell(1, 0)] = 'O';
    expect(getWinner(board)).toBeNull();
    expect(getGameStatus(board)).toEqual({ status: 'ACTIVE', winner: null, line: null });
  });

  it('ends in a draw when the game-move cap is reached', () => {
    const board: Board = createEmptyBoard();
    // Stones separated by one empty cell cannot form a winning line.
    for (let index = 0; index < MAX_GAME_MOVES; index += 1) {
      board[encodeCell(index * 2, 0)] = index % 2 === 0 ? 'X' : 'O';
    }

    expect(isBoardFull(board)).toBe(true);
    expect(getGameStatus(board)).toEqual({ status: 'DRAW', winner: null, line: null });
    expect(applyMove(board, 'X', encodeCell(1, 0))).toEqual({ ok: false, code: 'GAME_FINISHED' });
  });

  it('reports a draw for the move that reaches the cap', () => {
    const board: Board = createEmptyBoard();
    for (let index = 0; index < MAX_GAME_MOVES - 1; index += 1) {
      board[encodeCell(index * 2, 0)] = index % 2 === 0 ? 'X' : 'O';
    }

    const applied = applyMoveWithStatus(board, 'X', encodeCell(1_000, 0));
    expect(applied.ok).toBe(true);
    if (!applied.ok) throw new Error('unreachable');
    expect(applied.status).toEqual({ status: 'DRAW', winner: null, line: null });
  });

  it('keeps small boards active', () => {
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
