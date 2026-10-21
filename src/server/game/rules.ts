import {
  type Board,
  type Cell,
  type Side,
  WINNING_LINES,
} from '../../shared/game-types';

export type MoveErrorCode =
  | 'INVALID_CELL'
  | 'OCCUPIED_CELL'
  | 'GAME_FINISHED'
  | 'OUT_OF_TURN';

export interface WinResult {
  side: Side;
  line: readonly [number, number, number];
}

export type GameStatus =
  | { status: 'ACTIVE'; winner: null; line: null }
  | { status: 'WON'; winner: Side; line: readonly [number, number, number] }
  | { status: 'DRAW'; winner: null; line: null };

export type MoveResult =
  | { ok: true; board: Cell[] }
  | { ok: false; code: MoveErrorCode };

export function isValidBoard(board: Board): board is Cell[] {
  if (!Array.isArray(board) || board.length !== 9) return false;
  return board.every((cell) => cell === 'X' || cell === 'O' || cell === null);
}

export function validateBoard(board: Board): asserts board is Cell[] {
  if (!isValidBoard(board)) {
    throw new Error('Invalid board state');
  }
}

export function getWinner(board: Board): WinResult | null {
  validateBoard(board);
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const first = board[a];
    if (first && first === board[b] && first === board[c]) {
      return { side: first, line };
    }
  }
  return null;
}

export function isBoardFull(board: Board): boolean {
  validateBoard(board);
  return board.every((cell) => cell !== null);
}

export function getGameStatus(board: Board): GameStatus {
  const winner = getWinner(board);
  if (winner) return { status: 'WON', winner: winner.side, line: winner.line };
  if (isBoardFull(board)) return { status: 'DRAW', winner: null, line: null };
  return { status: 'ACTIVE', winner: null, line: null };
}

export function countEmptyCells(board: Board): number {
  validateBoard(board);
  return board.reduce((count, cell) => (cell === null ? count + 1 : count), 0);
}

export function getAvailableMoves(board: Board): number[] {
  validateBoard(board);
  const moves: number[] = [];
  board.forEach((cell, index) => {
    if (cell === null) moves.push(index);
  });
  return moves;
}

export function applyMove(board: Board, side: Side, cellIndex: number): MoveResult {
  validateBoard(board);
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex > 8) {
    return { ok: false, code: 'INVALID_CELL' };
  }
  if (board[cellIndex] !== null) {
    return { ok: false, code: 'OCCUPIED_CELL' };
  }
  if (getWinner(board)) {
    return { ok: false, code: 'GAME_FINISHED' };
  }
  if (isBoardFull(board)) {
    return { ok: false, code: 'GAME_FINISHED' };
  }
  const next = [...board];
  next[cellIndex] = side;
  return { ok: true, board: next };
}

/**
 * Derives whose turn it should be from the number of marks. The server still
 * stores currentTurn explicitly; this helper is used to validate persisted state.
 */
export function sideToMove(board: Board): Side {
  validateBoard(board);
  const xMoves = board.filter((cell) => cell === 'X').length;
  const oMoves = board.filter((cell) => cell === 'O').length;
  if (xMoves === oMoves) return 'X';
  if (xMoves === oMoves + 1) return 'O';
  throw new Error('Invalid move counts on board');
}
