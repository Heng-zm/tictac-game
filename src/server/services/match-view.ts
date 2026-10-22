import type { PublicMatchState, RematchStatus, Side } from '../../shared/game-types';
import { PROTOCOL_VERSION } from '../../shared/game-types';
import type { MatchEntity, ParticipantEntity } from '../database/types';

export interface MatchViewOptions {
  onlineUserIds: ReadonlySet<string>;
  rematch: RematchStatus;
  turnTimerPaused: boolean;
}

export function buildMatchView(match: MatchEntity, userId: string, options: MatchViewOptions): PublicMatchState {
  const you = match.participants.find((participant) => participant.userId === userId);
  if (!you) {
    throw new Error('Cannot view a match you do not belong to');
  }
  const x = match.participants.find((participant) => participant.side === 'X') ?? null;
  const o = match.participants.find((participant) => participant.side === 'O') ?? null;
  const opponent = match.participants.find((participant) => participant.side !== you.side) ?? null;

  return {
    protocol: PROTOCOL_VERSION,
    id: match.id,
    mode: match.mode,
    status: match.status,
    board: { ...match.board },
    currentTurn: match.currentTurn,
    turnNumber: match.turnNumber,
    lastMove: match.lastMove ? { ...match.lastMove } : null,
    version: match.version,
    youSide: you.side,
    players: {
      X: x ? playerView(x, userId, options.onlineUserIds) : null,
      O: o ? playerView(o, userId, options.onlineUserIds) : null,
    },
    winnerSide: match.winnerSide,
    result: match.result,
    finishReason: match.finishReason,
    startedAt: match.startedAt.toISOString(),
    finishedAt: match.finishedAt ? match.finishedAt.toISOString() : null,
    turnDeadline: match.turnDeadline ? match.turnDeadline.toISOString() : null,
    turnTimerPaused: options.turnTimerPaused,
    opponentConnection: opponentConnection(match, opponent, options.onlineUserIds),
    rematch: options.rematch,
  };
}

function playerView(participant: ParticipantEntity, viewerId: string, online: ReadonlySet<string>) {
  return {
    side: participant.side as Side,
    displayName: participant.displayName,
    username: participant.username,
    photoUrl: participant.photoUrl,
    isAi: participant.isAi,
    aiDifficulty: participant.aiDifficulty,
    isYou: participant.userId === viewerId,
    connected: participant.isAi || (participant.userId ? online.has(participant.userId) : false),
  };
}

function opponentConnection(
  match: MatchEntity,
  opponent: ParticipantEntity | null,
  online: ReadonlySet<string>,
): PublicMatchState['opponentConnection'] {
  if (!opponent) return 'left';
  if (opponent.isAi) return 'not_applicable';
  if (match.status === 'ABANDONED') return 'left';
  if (!opponent.userId) return 'left';
  return online.has(opponent.userId) ? 'connected' : 'disconnected';
}
