import {
  type Board,
  type Side,
  COORD_OFFSET,
  decodeCell,
  encodeCell,
} from '../../shared/game-types';

export type MoveErrorCode =
  | 'INVALID_CELL'
  | 'OCCUPIED_CELL'
  | 'GAME_FINISHED'
  | 'OUT_OF_TURN';

export interface WinResult {
  side: Side;
  line: number[];
}

export type GameStatus =
  | { status: 'ACTIVE'; winner: null; line: null }
  | { status: 'WON'; winner: Side; line: number[] }
  | { status: 'DRAW'; winner: null; line: null };

export type MoveResult =
  | { ok: true; board: Board }
  | { ok: false; code: MoveErrorCode };

export const DIRECTIONS = [
  [1, 0],  // horizontal →
  [0, 1],  // vertical ↓
  [1, 1],  // diagonal ↘
  [1, -1], // anti-diagonal ↗
] as const;

export function isValidBoard(board: unknown): board is Board {
  if (!board || typeof board !== 'object' || Array.isArray(board)) return false;
  return Object.values(board).every((cell) => cell === 'X' || cell === 'O');
}

export function validateBoard(board: Board): void {
  if (!isValidBoard(board)) {
    throw new Error('Invalid board state');
  }
}

export function getWinner(board: Board): WinResult | null {
  const entries = Object.entries(board) as [string, Side][];
  if (entries.length < 9) return null; // In 5-in-a-row, need at least 9 total moves to win

  for (const [cellStr, side] of entries) {
    const cell = Number(cellStr);
    const { x, y } = decodeCell(cell);

    for (const [dx, dy] of DIRECTIONS) {
      // Avoid redundant line checks: only evaluate if previous cell is NOT the same side
      const prevCell = encodeCell(x - dx, y - dy);
      if (board[prevCell] === side) continue;

      const line = [cell];
      for (let step = 1; step < 5; step++) {
        const nextCell = encodeCell(x + dx * step, y + dy * step);
        if (board[nextCell] === side) {
          line.push(nextCell);
        } else {
          break;
        }
      }

      if (line.length >= 5) {
        return { side, line };
      }
    }
  }
  return null;
}

export function isBoardFull(_board: Board): boolean {
  // Infinite grid never fills up; games play until a 5-in-a-row win
  return false;
}

export function getGameStatus(board: Board): GameStatus {
  const winner = getWinner(board);
  if (winner) return { status: 'WON', winner: winner.side, line: winner.line };
  return { status: 'ACTIVE', winner: null, line: null };
}

export function getAvailableMoves(board: Board): number[] {
  // Candidate moves around existing stones
  const occupied = Object.keys(board).map(Number);
  if (occupied.length === 0) return [encodeCell(0, 0)];

  const seen = new Set<number>();
  const candidates: number[] = [];

  for (const cell of occupied) {
    const { x, y } = decodeCell(cell);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const candidate = encodeCell(x + dx, y + dy);
        if (board[candidate] === undefined && !seen.has(candidate)) {
          seen.add(candidate);
          candidates.push(candidate);
        }
      }
    }
  }

  return candidates.length > 0 ? candidates : [encodeCell(0, 0)];
}

export function applyMove(board: Board, side: Side, cellIndex: number): MoveResult {
  if (!Number.isInteger(cellIndex) || cellIndex < 0) {
    return { ok: false, code: 'INVALID_CELL' };
  }
  const { x, y } = decodeCell(cellIndex);
  if (Math.abs(x) > COORD_OFFSET || Math.abs(y) > COORD_OFFSET) {
    return { ok: false, code: 'INVALID_CELL' };
  }
  if (board[cellIndex] !== undefined) {
    return { ok: false, code: 'OCCUPIED_CELL' };
  }
  if (getWinner(board)) {
    return { ok: false, code: 'GAME_FINISHED' };
  }

  const next: Board = { ...board, [cellIndex]: side };
  return { ok: true, board: next };
}

export function sideToMove(board: Board): Side {
  let xMoves = 0;
  let oMoves = 0;
  for (const side of Object.values(board)) {
    if (side === 'X') xMoves++;
    else if (side === 'O') oMoves++;
  }
  if (xMoves === oMoves) return 'X';
  if (xMoves === oMoves + 1) return 'O';
  throw new Error('Invalid move counts on board');
}
