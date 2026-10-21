import { io, type Socket } from 'socket.io-client';
import type { SocketAck } from '../../shared/game-types';
import type { ClientToServerEvents, ServerToClientEvents } from '../../shared/events';

export type GameClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export class SocketRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SocketRequestError';
  }
}

export function createGameSocket(): GameClientSocket {
  return io('/', {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 600,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.4,
    timeout: 12_000,
  });
}

export function request<T>(
  send: (ack: (result: SocketAck<T>) => void) => void,
  timeoutMs = 15_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new SocketRequestError('TIMEOUT', 'The game server did not respond. Please try again.'));
    }, timeoutMs);

    const finish = (result: SocketAck<T>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (result.ok) resolve(result.data);
      else reject(new SocketRequestError(result.error.code, result.error.message));
    };

    try {
      send(finish);
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new SocketRequestError('CONNECTION_LOST', 'The connection was lost. Reconnecting…'));
      }
    }
  });
}

export function socketErrorMessage(error: unknown): string {
  if (error instanceof SocketRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
