import type {
  AiDifficulty,
  CreatedInvitation,
  HelloPayload,
  InvitePreview,
  PendingInvitation,
  PublicMatchState,
  QueueStatus,
  RematchStatus,
  Side,
  SocketAck,
  UserProfile,
} from './game-types';
import type { StickerId } from './stickers';

export const CHAT_MESSAGE_MAX_LENGTH = 200;

export const SOCKET_EVENTS = {
  // Client -> server
  QUEUE_JOIN: 'queue:join',
  QUEUE_CANCEL: 'queue:cancel',
  AI_START: 'ai:start',
  INVITE_CREATE: 'invite:create',
  INVITE_ACCEPT: 'invite:accept',
  INVITE_CANCEL: 'invite:cancel',
  MATCH_JOIN: 'match:join',
  MOVE_SUBMIT: 'move:submit',
  MATCH_REMATCH: 'match:rematch',
  MATCH_LEAVE: 'match:leave',
  MATCH_REACTION: 'match:reaction',
  MATCH_CHAT: 'match:chat',
  MATCH_VOICE: 'match:voice',
  // Server -> client
  SESSION_READY: 'session:ready',
  QUEUE_STATUS: 'queue:status',
  MATCH_FOUND: 'match:found',
  MATCH_STATE: 'match:state',
  MOVE_ACCEPTED: 'move:accepted',
  MOVE_REJECTED: 'move:rejected',
  MATCH_FINISHED: 'match:finished',
  OPPONENT_DISCONNECTED: 'opponent:disconnected',
  OPPONENT_RECONNECTED: 'opponent:reconnected',
  INVITE_WAITING: 'invite:waiting',
  INVITE_PENDING: 'invite:pending',
  REMATCH_STATUS: 'rematch:status',
  SERVER_ERROR: 'server:error',
  SERVER_SHUTDOWN: 'server:shutdown',
} as const;

export interface QueueJoinPayload {
  autoAiFallback?: boolean;
}

export interface QueueJoinResult {
  status: QueueStatus;
}

export interface AiStartPayload {
  difficulty: AiDifficulty;
  side: Side;
}

export interface AiStartResult {
  matchId: string;
}

export interface InviteAcceptPayload {
  token: string;
}

export interface InviteAcceptResult {
  matchId: string;
  preview?: InvitePreview;
}

export interface InviteCancelPayload {
  invitationId: string;
}

export interface InviteCreateResult {
  invitation: CreatedInvitation;
}

export interface MatchJoinPayload {
  matchId: string;
}

export interface MatchJoinResult {
  match: PublicMatchState;
}

export interface MoveSubmitPayload {
  matchId: string;
  cell: number;
  actionId: string;
}

export interface MoveSubmitResult {
  match: PublicMatchState;
}

export interface RematchPayload {
  matchId: string;
}

export interface RematchResult {
  matchId: string;
  rematch: RematchStatus;
}

export interface MatchLeavePayload {
  matchId: string;
}

export interface MatchLeaveResult {
  left: true;
}

export interface MoveAcceptedEvent {
  matchId: string;
  side: Side;
  cell: number;
  actionId: string;
  version: number;
}

export interface MoveRejectedEvent {
  matchId: string;
  actionId: string;
  code: string;
  message: string;
}

export interface OpponentDisconnectedEvent {
  matchId: string;
  graceEndsAt: string;
}

export interface OpponentReconnectedEvent {
  matchId: string;
}

export interface ServerErrorEvent {
  code: string;
  message: string;
  requestId?: string;
}

export interface RematchStatusEvent {
  matchId: string;
  rematch: RematchStatus;
}

export interface InviteWaitingEvent {
  invitation: PendingInvitation;
}

export interface MatchReactionPayload {
  matchId: string;
  stickerId: StickerId;
}

export interface MatchReactionResult {
  sent: true;
}

export interface MatchReactionEvent {
  matchId: string;
  senderSide: Side;
  stickerId: StickerId;
  timestamp: string;
  reactionId: string;
}

export interface MatchChatPayload {
  matchId: string;
  text: string;
}

export interface MatchChatResult {
  sent: true;
}

export interface MatchChatEvent {
  matchId: string;
  senderSide: Side;
  text: string;
  timestamp: string;
  messageId: string;
}

export interface MatchVoicePayload {
  matchId: string;
  audioData: string;
  durationMs: number;
  waveform?: number[];
}

export interface MatchVoiceResult {
  sent: true;
}

export interface MatchVoiceEvent {
  matchId: string;
  senderSide: Side;
  audioData: string;
  durationMs: number;
  waveform: number[];
  timestamp: string;
  voiceId: string;
}

export interface ClientToServerEvents {
  'queue:join': (payload: QueueJoinPayload, ack: (result: SocketAck<QueueJoinResult>) => void) => void;
  'queue:cancel': (ack: (result: SocketAck<{ cancelled: true }>) => void) => void;
  'ai:start': (payload: AiStartPayload, ack: (result: SocketAck<AiStartResult>) => void) => void;
  'invite:create': (ack: (result: SocketAck<InviteCreateResult>) => void) => void;
  'invite:accept': (
    payload: InviteAcceptPayload,
    ack: (result: SocketAck<InviteAcceptResult>) => void,
  ) => void;
  'invite:cancel': (
    payload: InviteCancelPayload,
    ack: (result: SocketAck<{ cancelled: true }>) => void,
  ) => void;
  'match:join': (payload: MatchJoinPayload, ack: (result: SocketAck<MatchJoinResult>) => void) => void;
  'move:submit': (payload: MoveSubmitPayload, ack: (result: SocketAck<MoveSubmitResult>) => void) => void;
  'match:rematch': (payload: RematchPayload, ack: (result: SocketAck<RematchResult>) => void) => void;
  'match:leave': (payload: MatchLeavePayload, ack: (result: SocketAck<MatchLeaveResult>) => void) => void;
  'match:reaction': (
    payload: MatchReactionPayload,
    ack: (result: SocketAck<MatchReactionResult>) => void,
  ) => void;
  'match:chat': (
    payload: MatchChatPayload,
    ack: (result: SocketAck<MatchChatResult>) => void,
  ) => void;
  'match:voice': (
    payload: MatchVoicePayload,
    ack: (result: SocketAck<MatchVoiceResult>) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'session:ready': (payload: HelloPayload) => void;
  'queue:status': (payload: QueueStatus) => void;
  'match:found': (payload: { match: PublicMatchState }) => void;
  'match:state': (payload: { match: PublicMatchState }) => void;
  'move:accepted': (payload: MoveAcceptedEvent) => void;
  'move:rejected': (payload: MoveRejectedEvent) => void;
  'match:finished': (payload: { match: PublicMatchState }) => void;
  'opponent:disconnected': (payload: OpponentDisconnectedEvent) => void;
  'opponent:reconnected': (payload: OpponentReconnectedEvent) => void;
  'invite:waiting': (payload: InviteWaitingEvent) => void;
  'invite:pending': (payload: { invitation: PendingInvitation }) => void;
  'rematch:status': (payload: RematchStatusEvent) => void;
  'match:reaction': (payload: MatchReactionEvent) => void;
  'match:chat': (payload: MatchChatEvent) => void;
  'match:voice': (payload: MatchVoiceEvent) => void;
  'server:error': (payload: ServerErrorEvent) => void;
  'server:shutdown': (payload: { message: string }) => void;
}

export type AckResult<T> = (result: SocketAck<T>) => void;

// Kept for consumers that need the authenticated profile alongside a socket.
export type SocketUser = UserProfile;
