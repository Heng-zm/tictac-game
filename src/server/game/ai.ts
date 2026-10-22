import type { AiDifficulty, Board, Side } from '../../shared/game-types';
import { decodeCell, encodeCell } from '../../shared/game-types';
import { DIRECTIONS, getAvailableMoves, getGameStatus } from './rules';

export type RandomSource = () => number;

function isActive(board: Board): boolean {
  return getGameStatus(board).status === 'ACTIVE';
}

function evaluateDirection(
  board: Board,
  x: number,
  y: number,
  side: Side,
): number {
  let score = 0;

  for (const [dx, dy] of DIRECTIONS) {
    let consecutive = 1;
    let openEnds = 0;

    // Five or more in a row is already the maximum score, so there is no
    // need to walk arbitrarily long runs.
    let step = 1;
    while (consecutive < 5 && board[encodeCell(x + dx * step, y + dy * step)] === side) {
      consecutive++;
      step++;
    }
    if (board[encodeCell(x + dx * step, y + dy * step)] === undefined) {
      openEnds++;
    }

    step = 1;
    while (consecutive < 5 && board[encodeCell(x - dx * step, y - dy * step)] === side) {
      consecutive++;
      step++;
    }
    if (board[encodeCell(x - dx * step, y - dy * step)] === undefined) {
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

  return score;
}

export function chooseAiMove(
  board: Board,
  aiSide: Side,
  difficulty: AiDifficulty,
  rng: RandomSource = Math.random,
): number | null {
  if (!isActive(board)) return null;

  const candidates = getAvailableMoves(board);
  if (candidates.length === 0) return null;
  if (candidates.length === 1 && Object.keys(board).length === 0) {
    return candidates[0] ?? encodeCell(0, 0);
  }

  const humanSide: Side = aiSide === 'X' ? 'O' : 'X';
  const scoredMoves: Array<{ cell: number; score: number }> = [];

  for (const cell of candidates) {
    const { x, y } = decodeCell(cell);
    const attack = evaluateDirection(board, x, y, aiSide);
    // Immediate win is highest priority; skip the defender scan entirely.
    if (attack >= 1_000_000) {
      scoredMoves.push({ cell, score: 10_000_000 + attack });
      continue;
    }
    const defense = evaluateDirection(board, x, y, humanSide);
    const totalScore =
      defense >= 1_000_000
        ? 5_000_000 + defense
        : attack + defense * 1.2;
    scoredMoves.push({ cell, score: totalScore });
  }

  scoredMoves.sort((a, b) => b.score - a.score);

  if (difficulty === 'EASY') {
    // 50% chance to pick best, 50% random candidate
    if (rng() < 0.5) return scoredMoves[0]?.cell ?? null;
    const randomIndex = Math.floor(rng() * scoredMoves.length);
    return scoredMoves[randomIndex]?.cell ?? null;
  }

  if (difficulty === 'MEDIUM') {
    // Pick from top 3 moves
    const pool = scoredMoves.slice(0, 3);
    const randomIndex = Math.floor(rng() * pool.length);
    return pool[randomIndex]?.cell ?? null;
  }

  // HARD: Always pick top move
  return scoredMoves[0]?.cell ?? null;
}
