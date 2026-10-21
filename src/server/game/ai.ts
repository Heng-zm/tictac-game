import type { Board, Side, AiDifficulty } from '../../shared/game-types';
import { getAvailableMoves, getGameStatus, getWinner, validateBoard } from './rules';

export type RandomSource = () => number;

/** Prefer centre, then corners, then edges when scores tie. */
const MOVE_ORDER = [4, 0, 2, 6, 8, 1, 3, 5, 7] as const;

interface ScoredMove {
  index: number;
  score: number;
}

function isActive(board: Board): boolean {
  return getGameStatus(board).status === 'ACTIVE';
}

function minimax(board: CellBoard, aiSide: Side, humanSide: Side, depth: number, alpha: number, beta: number, maximizing: boolean): number {
  const winner = getWinner(board);
  if (winner) {
    return winner.side === aiSide ? 10 - depth : depth - 10;
  }
  const available = getAvailableMoves(board);
  if (available.length === 0) return 0;

  if (maximizing) {
    let best = -Infinity;
    let a = alpha;
    for (const index of MOVE_ORDER) {
      if (board[index] !== null) continue;
      board[index] = aiSide;
      const score = minimax(board, aiSide, humanSide, depth + 1, a, beta, false);
      board[index] = null;
      best = Math.max(best, score);
      a = Math.max(a, score);
      if (beta <= a) break;
    }
    return best;
  }

  let best = Infinity;
  let b = beta;
  for (const index of MOVE_ORDER) {
    if (board[index] !== null) continue;
    board[index] = humanSide;
    const score = minimax(board, aiSide, humanSide, depth + 1, alpha, b, true);
    board[index] = null;
    best = Math.min(best, score);
    b = Math.min(b, score);
    if (b <= alpha) break;
  }
  return best;
}

type CellBoard = (Side | null)[];

function scoreMoves(board: Board, aiSide: Side): ScoredMove[] {
  const humanSide: Side = aiSide === 'X' ? 'O' : 'X';
  const working = [...board] as CellBoard;
  const moves: ScoredMove[] = [];
  for (const index of MOVE_ORDER) {
    if (working[index] !== null) continue;
    working[index] = aiSide;
    const score = minimax(working, aiSide, humanSide, 0, -Infinity, Infinity, false);
    working[index] = null;
    moves.push({ index, score });
  }
  return moves;
}

function bestMoves(board: Board, aiSide: Side): ScoredMove[] {
  const scored = scoreMoves(board, aiSide);
  const bestScore = Math.max(...scored.map((move) => move.score));
  const best = scored.filter((move) => move.score === bestScore);
  // Keep deterministic order but start from the preferred move order.
  return MOVE_ORDER.flatMap((index) => best.filter((move) => move.index === index));
}

function pickRandom<T>(items: T[], rng: RandomSource): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  return items[index] as T;
}

/**
 * Chooses an AI move from the server's authoritative board.
 * Hard uses alpha-beta minimax and is unbeatable. Medium and easy deliberately
 * make mistakes, but every returned move is always legal.
 */
export function chooseAiMove(
  board: Board,
  aiSide: Side,
  difficulty: AiDifficulty,
  rng: RandomSource = Math.random,
): number | null {
  validateBoard(board);
  if (!isActive(board)) return null;
  const available = getAvailableMoves(board);
  if (available.length === 0) return null;

  if (difficulty === 'HARD') {
    return bestMoves(board, aiSide)[0]?.index ?? null;
  }

  const strategicChance = difficulty === 'MEDIUM' ? 0.72 : 0.22;
  const useStrategic = rng() < strategicChance;
  if (useStrategic) {
    const best = bestMoves(board, aiSide);
    // Easy occasionally overlooks its very best move even when "strategic".
    if (difficulty === 'EASY' && best.length > 1 && rng() < 0.5) {
      return pickRandom(best.slice(1), rng).index;
    }
    return best[0]?.index ?? null;
  }

  return pickRandom(available, rng);
}

/** Used only by tests and diagnostics. */
export function chooseOptimalMove(board: Board, aiSide: Side): number | null {
  return chooseAiMove(board, aiSide, 'HARD', () => 0);
}
