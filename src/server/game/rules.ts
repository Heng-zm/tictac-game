import {
  type Board,
  type Side,
  COORD_OFFSET,
  COORD_STRIDE,
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

export type MoveApplicationResult =
  | { ok: true; board: Board; status: GameStatus }
  | { ok: false; code: MoveErrorCode };

export const DIRECTIONS = [
  [1, 0],  // horizontal →
  [0, 1],  // vertical ↓
  [1, 1],  // diagonal ↘
  [1, -1], // anti-diagonal ↗
] as const;

const NEIGHBOR_OFFSETS = [
  [-1, -1, -COORD_STRIDE - 1],
  [-1, 0, -1],
  [-1, 1, COORD_STRIDE - 1],
  [0, -1, -COORD_STRIDE],
  [0, 1, COORD_STRIDE],
  [1, -1, -COORD_STRIDE + 1],
  [1, 0, 1],
  [1, 1, COORD_STRIDE + 1],
] as const;

function inBounds(x: number, y: number): boolean {
  return Math.abs(x) <= COORD_OFFSET && Math.abs(y) <= COORD_OFFSET;
}

export function isValidBoard(board: unknown): board is Board {
  if (!board || typeof board !== 'object' || Array.isArray(board)) return false;
  return Object.values(board).every((cell) => cell === 'X' || cell === 'O');
}

export function validateBoard(board: Board): void {
  if (!isValidBoard(board)) {
    throw new Error('Invalid board state');
  }
}

/**
 * Full-board scan used when the last move is unknown (loading a stored board,
 * validating arbitrary input). Prefer {@link getWinnerAt} on the move hot path.
 */
export function getWinner(board: Board): WinResult | null {
  const entries = Object.entries(board) as [string, Side][];
  if (entries.length < 9) return null; // In 5-in-a-row, need at least 9 total moves to win

  for (const [cellStr, side] of entries) {
    if (side !== 'X' && side !== 'O') continue;
    const cell = Number(cellStr);
    const { x, y } = decodeCell(cell);

    for (const [dx, dy] of DIRECTIONS) {
      // Avoid redundant line checks: only evaluate if previous cell is NOT the same side
      if (inBounds(x - dx, y - dy) && board[encodeCell(x - dx, y - dy)] === side) continue;

      const line = [cell];
      for (let step = 1; step < 5; step++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (!inBounds(nx, ny)) break;
        const nextCell = encodeCell(nx, ny);
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

/**
 * Detects a win that includes `cellIndex`. Only the four lines through the
 * placed stone are inspected, making this O(1) regardless of board size.
 * This is valid for the move hot path because every new line must include the
 * stone that was just placed.
 */
export function getWinnerAt(board: Board, cellIndex: number): WinResult | null {
  const side = board[cellIndex];
  if (side !== 'X' && side !== 'O') return null;

  const { x, y } = decodeCell(cellIndex);
  for (const [dx, dy] of DIRECTIONS) {
    const line = [cellIndex];

    for (let step = 1; step < 5; step++) {
      const nx = x - dx * step;
      const ny = y - dy * step;
      if (!inBounds(nx, ny)) break;
      const cell = encodeCell(nx, ny);
      if (board[cell] !== side) break;
      line.unshift(cell);
    }

    for (let step = 1; step < 5; step++) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (!inBounds(nx, ny)) break;
      const cell = encodeCell(nx, ny);
      if (board[cell] !== side) break;
      line.push(cell);
    }

    if (line.length >= 5) {
      return { side, line: line.slice(0, 5) };
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
    for (const [dx, dy, offset] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const candidate = cell + offset;
      if (board[candidate] === undefined && !seen.has(candidate)) {
        seen.add(candidate);
        candidates.push(candidate);
      }
    }
  }

  return candidates.length > 0 ? candidates : [encodeCell(0, 0)];
}

function validatePlacement(
  board: Board,
  cellIndex: number,
  checkFinished: boolean,
): MoveErrorCode | null {
  if (!Number.isInteger(cellIndex) || cellIndex < 0) return 'INVALID_CELL';
  const { x, y } = decodeCell(cellIndex);
  if (!inBounds(x, y)) return 'INVALID_CELL';
  if (board[cellIndex] !== undefined) return 'OCCUPIED_CELL';
  if (checkFinished && getWinner(board)) return 'GAME_FINISHED';
  return null;
}

export function applyMove(board: Board, side: Side, cellIndex: number): MoveResult {
  const error = validatePlacement(board, cellIndex, true);
  if (error) return { ok: false, code: error };
  return { ok: true, board: { ...board, [cellIndex]: side } };
}

export interface ApplyMoveOptions {
  /**
   * Trusted server path for a persisted ACTIVE match: the service has already
   * checked match status, so a full pre-move winner scan is redundant.
   */
  assumeActive?: boolean;
}

/**
 * Validates and applies a move in one pass, returning the resulting game
 * status without rescanning the full board. This is the server hot path.
 */
export function applyMoveWithStatus(
  board: Board,
  side: Side,
  cellIndex: number,
  options: ApplyMoveOptions = {},
): MoveApplicationResult {
  const error = validatePlacement(board, cellIndex, !options.assumeActive);
  if (error) return { ok: false, code: error };

  const next: Board = { ...board, [cellIndex]: side };
  const winner = getWinnerAt(next, cellIndex);
  return {
    ok: true,
    board: next,
    status: winner
      ? { status: 'WON', winner: winner.side, line: winner.line }
      : { status: 'ACTIVE', winner: null, line: null },
  };
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
