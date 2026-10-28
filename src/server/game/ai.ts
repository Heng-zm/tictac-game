import type { AiDifficulty, Board, Side } from '../../shared/game-types';
import { decodeCell, encodeCell, isInBounds } from '../../shared/game-types';
import { DIRECTIONS, getAvailableMoves } from './rules';

export type RandomSource = () => number;

// Simple transposition table for AI evaluation caching
// Key: board hash + side, Value: score
const EVAL_CACHE = new Map<string, number>();
const MAX_CACHE_SIZE = 50000;

function boardHash(board: Board): string {
  // Fast hash: sort keys and join with values
  const keys = Object.keys(board);
  if (keys.length === 0) return 'empty';
  keys.sort((a, b) => Number(a) - Number(b));
  let hash = '';
  for (const k of keys) {
    hash += k + ':' + board[Number(k)] + ';';
  }
  return hash;
}

function getEvalCacheKey(board: Board, x: number, y: number, side: Side): string {
  return boardHash(board) + '|' + x + ',' + y + '|' + side;
}

function setEvalCache(key: string, value: number): void {
  if (EVAL_CACHE.size >= MAX_CACHE_SIZE) {
    // Simple eviction: clear half
    const keys = EVAL_CACHE.keys();
    for (let i = 0; i < MAX_CACHE_SIZE / 2; i++) {
      const k = keys.next().value;
      if (k) EVAL_CACHE.delete(k);
      else break;
    }
  }
  EVAL_CACHE.set(key, value);
}

function clearEvalCache(): void {
  EVAL_CACHE.clear();
}

/**
 * Reads a cell for evaluation. Coordinates outside the encoded grid act as a
 * wall, not as an empty cell, so lines cannot wrap across the boundary and
 * inflate the score.
 */
function probeCell(board: Board, x: number, y: number): Side | undefined | null {
  if (!isInBounds(x, y)) return null;
  return board[encodeCell(x, y)];
}

/**
 * Evaluates a single position for a given side.
 * Returns a heuristic score based on line patterns.
 * Uses caching to avoid redundant computations.
 */
function evaluateDirection(
  board: Board,
  x: number,
  y: number,
  side: Side,
): number {
  const cacheKey = getEvalCacheKey(board, x, y, side);
  const cached = EVAL_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  let score = 0;

  for (const [dx, dy] of DIRECTIONS) {
    let consecutive = 1;
    let openEnds = 0;

    // Scan positive direction
    let step = 1;
    while (consecutive < 5 && probeCell(board, x + dx * step, y + dy * step) === side) {
      consecutive++;
      step++;
    }
    if (probeCell(board, x + dx * step, y + dy * step) === undefined) {
      openEnds++;
    }

    // Scan negative direction
    step = 1;
    while (consecutive < 5 && probeCell(board, x - dx * step, y - dy * step) === side) {
      consecutive++;
      step++;
    }
    if (probeCell(board, x - dx * step, y - dy * step) === undefined) {
      openEnds++;
    }

    if (consecutive >= 5) {
      score += 1_000_000;
    } else if (consecutive === 4) {
      if (openEnds === 2) score += 200_000; // Open 4 (guaranteed win)
      else if (openEnds === 1) score += 40_000; // Blocked 4
    } else if (consecutive === 3) {
      if (openEnds === 2) score += 10_000; // Open 3
      else if (openEnds === 1) score += 1_500; // Blocked 3
    } else if (consecutive === 2) {
      if (openEnds === 2) score += 400; // Open 2
      else if (openEnds === 1) score += 80;
    }
  }

  setEvalCache(cacheKey, score);
  return score;
}

/**
 * Finds a move that completes five in a row for `side`. The service uses this
 * to detect blocked threats and unblockable double threats for bot taunts.
 */
export function findImmediateWin(board: Board, side: Side): number | null {
  for (const cell of getAvailableMoves(board)) {
    const { x, y } = decodeCell(cell);
    if (evaluateDirection(board, x, y, side) >= 1_000_000) return cell;
  }
  return null;
}

/**
 * Counts immediate winning moves for `side`, stopping at two. Two or more
 * winning cells means the opponent cannot block every threat.
 */
export function countImmediateWins(board: Board, side: Side): number {
  let wins = 0;
  for (const cell of getAvailableMoves(board)) {
    const { x, y } = decodeCell(cell);
    if (evaluateDirection(board, x, y, side) >= 1_000_000) {
      wins += 1;
      if (wins >= 2) return wins;
    }
  }
  return wins;
}

function isActive(): boolean {
  // MatchService guarantees ACTIVE state when calling chooseAiMove
  return true;
}

export function chooseAiMove(
  board: Board,
  aiSide: Side,
  difficulty: AiDifficulty,
  rng: RandomSource = Math.random,
): number | null {
  // Clear cache at the start of each AI turn to prevent stale evaluations
  // across different board states. Cache is per-turn.
  clearEvalCache();

  if (!isActive()) return null;

  const candidates = getAvailableMoves(board);
  if (candidates.length === 0) return null;
  if (candidates.length === 1 && Object.keys(board).length === 0) {
    return candidates[0] ?? encodeCell(0, 0);
  }

  const humanSide: Side = aiSide === 'X' ? 'O' : 'X';

  // Pre-allocate arrays to avoid reallocations
  const scoredMoves: Array<{ cell: number; attack: number; defense: number; total: number }> = 
    new Array(candidates.length);
  let scoredCount = 0;

  // Track best move for early exit
  let bestCell: number | null = null;
  let bestScore = -Infinity;
  let hasInstantWin = false;

  for (const cell of candidates) {
    const { x, y } = decodeCell(cell);
    
    // Evaluate attack (AI's perspective)
    const attack = evaluateDirection(board, x, y, aiSide);
    
    // Immediate win detection - highest priority
    if (attack >= 1_000_000) {
      hasInstantWin = true;
      bestCell = cell;
      bestScore = 10_000_000 + attack;
      // Store for sorting consistency
      scoredMoves[scoredCount++] = { cell, attack, defense: 0, total: bestScore };
      continue;
    }

    // Evaluate defense (blocking human)
    const defense = evaluateDirection(board, x, y, humanSide);
    
    const totalScore = defense >= 1_000_000
      ? 5_000_000 + defense  // Must block human's winning move
      : attack + defense * 1.2;

    scoredMoves[scoredCount++] = { cell, attack, defense, total: totalScore };

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestCell = cell;
    }
  }

  // Trim array to actual size
  scoredMoves.length = scoredCount;

  // If we found an instant win, return it immediately (no need to sort)
  if (hasInstantWin) {
    return bestCell;
  }

  // Sort by total score descending
  scoredMoves.sort((a, b) => b.total - a.total);

  if (difficulty === 'EASY') {
    // 50% chance to pick best, 50% random candidate
    if (rng() < 0.5) return scoredMoves[0]?.cell ?? null;
    const randomIndex = Math.floor(rng() * scoredMoves.length);
    return scoredMoves[randomIndex]?.cell ?? null;
  }

  if (difficulty === 'MEDIUM') {
    // Pick from top 3 moves (or fewer if not available)
    const poolSize = Math.min(3, scoredMoves.length);
    const randomIndex = Math.floor(rng() * poolSize);
    return scoredMoves[randomIndex]?.cell ?? null;
  }

  // HARD: Always pick top move
  return scoredMoves[0]?.cell ?? null;
}

// Export for testing
export { evaluateDirection, clearEvalCache, boardHash };