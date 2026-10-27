import {
  type Board,
  type Side,
  COORD_STRIDE,
  decodeCell,
  encodeCell,
  isInBounds,
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

// Pre-computed direction vectors for the 4 win directions
export const DIRECTIONS = [
  [1, 0],   // horizontal →
  [0, 1],   // vertical ↓
  [1, 1],   // diagonal ↘
  [1, -1],  // anti-diagonal ↗
] as const;

/**
 * A boundless board can never be physically full, so games are capped by the
 * number of moves instead. This keeps draws reachable and bounds the board size
 * that is serialized to the database, sent to clients, and retained in memory.
 */
export const MAX_GAME_MOVES = 400;

// Pre-computed neighbor offsets: [dx, dy, encodedOffset]
// encodedOffset = encodeCell(x+dx, y+dy) - encodeCell(x, y)
// = (dy * COORD_STRIDE) + dx
const NEIGHBOR_OFFSETS = [
  [-1, -1, -COORD_STRIDE - 1],
  [-1,  0, -1],
  [-1,  1,  COORD_STRIDE - 1],
  [ 0, -1, -COORD_STRIDE],
  [ 0,  1,  COORD_STRIDE],
  [ 1, -1, -COORD_STRIDE + 1],
  [ 1,  0,  1],
  [ 1,  1,  COORD_STRIDE + 1],
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

/**
 * Full-board scan used when the last move is unknown (loading a stored board,
 * validating arbitrary input). Prefer {@link getWinnerAt} on the move hot path.
 */
export function getWinner(board: Board): WinResult | null {
  const entries = Object.entries(board) as [string, Side][];
  if (entries.length < 9) return null; // 5-in-a-row needs at least 9 total moves

  for (const [cellStr, side] of entries) {
    if (side !== 'X' && side !== 'O') continue;
    const cell = Number(cellStr);
    const { x, y } = decodeCell(cell);

    for (const [dx, dy] of DIRECTIONS) {
      // Only evaluate from the start of a line (previous cell is not same side)
      const prevX = x - dx;
      const prevY = y - dy;
      if (isInBounds(prevX, prevY) && board[encodeCell(prevX, prevY)] === side) continue;

      let count = 1;
      for (let step = 1; step < 5; step++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (!isInBounds(nx, ny)) break;
        if (board[encodeCell(nx, ny)] !== side) break;
        count++;
      }

      if (count >= 5) {
        // Reconstruct the winning line (max 5 cells)
        const line: number[] = [];
        for (let step = 0; step < 5; step++) {
          const lx = x + dx * step;
          const ly = y + dy * step;
          if (!isInBounds(lx, ly)) break;
          const c = encodeCell(lx, ly);
          if (board[c] !== side) break;
          line.push(c);
        }
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
    const line: number[] = [];

    // Scan backward (negative direction)
    for (let step = 1; step < 5; step++) {
      const nx = x - dx * step;
      const ny = y - dy * step;
      if (!isInBounds(nx, ny)) break;
      const cell = encodeCell(nx, ny);
      if (board[cell] !== side) break;
      line.unshift(cell);
    }

    // Center cell
    line.push(cellIndex);

    // Scan forward (positive direction)
    for (let step = 1; step < 5; step++) {
      const nx = x + dx * step;
      const ny = y + dy * step;
      if (!isInBounds(nx, ny)) break;
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

export function isBoardFull(board: Board): boolean {
  return Object.keys(board).length >= MAX_GAME_MOVES;
}

export function getGameStatus(board: Board): GameStatus {
  const winner = getWinner(board);
  if (winner) return { status: 'WON', winner: winner.side, line: winner.line };
  if (isBoardFull(board)) return { status: 'DRAW', winner: null, line: null };
  return { status: 'ACTIVE', winner: null, line: null };
}

/**
 * Returns candidate moves adjacent to existing stones.
 * Uses pre-computed offsets to avoid repeated encode/decode.
 */
export function getAvailableMoves(board: Board): number[] {
  const occupied = Object.keys(board);
  if (occupied.length === 0) return [encodeCell(0, 0)];

  // Pre-allocate with estimated capacity (8 neighbors per stone, but many overlap)
  const candidates = new Array<number>(occupied.length * 8);
  let candidateCount = 0;

  // Use a timestamp-based visited array instead of Set for speed
  const visited = new Map<number, number>();
  const visitToken = Date.now();

  for (const cellStr of occupied) {
    const cell = Number(cellStr);
    const { x, y } = decodeCell(cell);

    for (const [dx, dy, offset] of NEIGHBOR_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!isInBounds(nx, ny)) continue;

      const candidate = cell + offset;
      if (board[candidate] !== undefined) continue;
      if (visited.get(candidate) === visitToken) continue;

      visited.set(candidate, visitToken);
      candidates[candidateCount++] = candidate;
    }
  }

  if (candidateCount === 0) return [encodeCell(0, 0)];
  candidates.length = candidateCount;
  return candidates;
}

function validatePlacement(
  board: Board,
  cellIndex: number,
  checkFinished: boolean,
): MoveErrorCode | null {
  if (!Number.isInteger(cellIndex) || cellIndex < 0) return 'INVALID_CELL';
  const { x, y } = decodeCell(cellIndex);
  if (!isInBounds(x, y)) return 'INVALID_CELL';
  if (board[cellIndex] !== undefined) return 'OCCUPIED_CELL';
  if (checkFinished && (isBoardFull(board) || getWinner(board))) return 'GAME_FINISHED';
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
  if (winner) {
    return { ok: true, board: next, status: { status: 'WON', winner: winner.side, line: winner.line } };
  }
  if (isBoardFull(next)) {
    return { ok: true, board: next, status: { status: 'DRAW', winner: null, line: null } };
  }
  return { ok: true, board: next, status: { status: 'ACTIVE', winner: null, line: null } };
}

/**
 * Determines whose turn it is by counting moves.
 * O(n) where n = moves played. For hot paths, prefer passing turn explicitly.
 */
export function sideToMove(board: Board): Side {
  let xMoves = 0;
  let oMoves = 0;
  for (const side of Object.values(board)) {
    if (side === 'X') xMoves++;
    else oMoves++; // side === 'O' guaranteed by isValidBoard
  }
  return xMoves === oMoves ? 'X' : 'O';
}