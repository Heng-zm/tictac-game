import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/events';
import type { UserEntity } from '../database/types';

export interface InterServerEvents {
  // Reserved for future Redis adapter events.
  heartbeat: () => void;
}

export interface SocketData {
  userId: string;
  user: UserEntity;
  /** Unix seconds at which the signed session used for the handshake expires. */
  sessionExpiresAt: number;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
export type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function matchRoom(matchId: string): string {
  return `match:${matchId}`;
}
