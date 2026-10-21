import type {
  AiDifficulty,
  Board,
  MatchMode,
  PublicMatchState,
  PublicPlayer,
  Side,
} from '../../shared/game-types';
import { decodeCell, encodeCell, oppositeSide } from '../../shared/game-types';

const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
] as const;

export function findWinningLine(board: Board): number[] | null {
  const entries = Object.entries(board) as [string, Side][];
  if (entries.length < 9) return null;

  for (const [cellStr, side] of entries) {
    const cell = Number(cellStr);
    const { x, y } = decodeCell(cell);

    for (const [dx, dy] of DIRECTIONS) {
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
        return line;
      }
    }
  }
  return null;
}

export function opponentFor(match: PublicMatchState): PublicPlayer | null {
  return match.players[oppositeSide(match.youSide)] ?? null;
}

export function yourPlayer(match: PublicMatchState): PublicPlayer | null {
  return match.players[match.youSide] ?? null;
}

export function modeLabel(mode: MatchMode): string {
  if (mode === 'RANDOM') return 'Random match';
  if (mode === 'FRIEND') return 'Friend match';
  return 'Bot match';
}

export function difficultyLabel(difficulty: AiDifficulty | null): string {
  if (!difficulty) return 'Bot';
  return `${difficulty.charAt(0)}${difficulty.slice(1).toLowerCase()} bot`;
}

export function modeShortLabel(mode: MatchMode): string {
  if (mode === 'RANDOM') return 'Online';
  if (mode === 'FRIEND') return 'Friend';
  return 'Bot';
}

export function describeOutcome(match: PublicMatchState): 'win' | 'loss' | 'draw' {
  if (match.result === 'DRAW') return 'draw';
  return match.winnerSide === match.youSide ? 'win' : 'loss';
}

export function finishReasonCopy(match: PublicMatchState): string {
  const youWon = match.winnerSide === match.youSide;
  switch (match.finishReason) {
    case 'LINE':
      return youWon ? 'Five in a row! Beautifully played.' : 'Five in a row for your opponent.';
    case 'DRAW':
      return 'The board is full. Nobody gave an inch.';
    case 'DISCONNECT':
      return youWon ? 'Your opponent did not reconnect in time.' : 'You did not reconnect in time.';
    case 'TIMEOUT':
      return youWon ? 'Your opponent ran out of time.' : 'You ran out of time.';
    case 'FORFEIT':
      return youWon ? 'Your opponent resigned.' : 'You resigned this game.';
    case 'CANCELLED':
      return 'The invitation was cancelled before the game started.';
    case 'SERVER_SHUTDOWN':
      return 'The server restarted and this game could not continue.';
    case 'ABANDONED':
      return 'This game was abandoned.';
    default:
      return 'This game has ended.';
  }
}

export function isRatedMatch(match: PublicMatchState): boolean {
  return match.mode !== 'AI';
}

/**
 * Display-only estimate of the rating change for a finished human match.
 * The server remains authoritative; unfinished or abandoned games return null.
 */
export function ratingImpactFor(match: PublicMatchState): number | null {
  if (!isRatedMatch(match) || match.status !== 'FINISHED' || !match.result) return null;
  if (
    match.finishReason === 'CANCELLED' ||
    match.finishReason === 'SERVER_SHUTDOWN' ||
    match.finishReason === 'ABANDONED'
  ) {
    return null;
  }
  if (match.result === 'DRAW') return 5;
  return match.winnerSide === match.youSide ? 20 : -10;
}
