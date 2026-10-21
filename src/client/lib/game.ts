import type {
  AiDifficulty,
  MatchMode,
  PublicMatchState,
  PublicPlayer,
  Side,
} from '../../shared/game-types';
import { WINNING_LINES, oppositeSide } from '../../shared/game-types';

export function findWinningLine(board: readonly (Side | null)[]): readonly [number, number, number] | null {
  for (const line of WINNING_LINES) {
    const [a, b, c] = line;
    const first = board[a];
    if (first && first === board[b] && first === board[c]) return line;
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
      return youWon ? 'Three in a row. Beautifully played.' : 'Three in a row for your opponent.';
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
