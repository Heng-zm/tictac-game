export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class SocketError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SocketError';
  }
}

export class RepositoryConflictError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryConflictError';
  }
}

export class InvitationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'InvitationError';
  }
}

export const ErrorCodes = {
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  AUTH_INVALID: 'AUTH_INVALID',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  AUTH_RATE_LIMITED: 'AUTH_RATE_LIMITED',
  INIT_DATA_INVALID: 'INIT_DATA_INVALID',
  INIT_DATA_EXPIRED: 'INIT_DATA_EXPIRED',
  DEV_AUTH_DISABLED: 'DEV_AUTH_DISABLED',
  TELEGRAM_AUTH_UNAVAILABLE: 'TELEGRAM_AUTH_UNAVAILABLE',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  MATCH_NOT_FOUND: 'MATCH_NOT_FOUND',
  MATCH_FORBIDDEN: 'MATCH_FORBIDDEN',
  MATCH_NOT_ACTIVE: 'MATCH_NOT_ACTIVE',
  MATCH_ALREADY_FINISHED: 'MATCH_ALREADY_FINISHED',
  PLAYER_BUSY: 'PLAYER_BUSY',
  INVITATION_PENDING: 'INVITATION_PENDING',
  INVITATION_INVALID: 'INVITATION_INVALID',
  INVITATION_EXPIRED: 'INVITATION_EXPIRED',
  INVITATION_USED: 'INVITATION_USED',
  INVITATION_OWN: 'INVITATION_OWN',
  INVITATION_CANCELLED: 'INVITATION_CANCELLED',
  INVITATION_FORBIDDEN: 'INVITATION_FORBIDDEN',
  QUEUE_FULL: 'QUEUE_FULL',
  NOT_IN_QUEUE: 'NOT_IN_QUEUE',
  ALREADY_IN_QUEUE: 'ALREADY_IN_QUEUE',
  OUT_OF_TURN: 'OUT_OF_TURN',
  OCCUPIED_CELL: 'OCCUPIED_CELL',
  INVALID_CELL: 'INVALID_CELL',
  GAME_FINISHED: 'GAME_FINISHED',
  GAME_NOT_ACTIVE: 'GAME_NOT_ACTIVE',
  STALE_STATE: 'STALE_STATE',
  DUPLICATE_MOVE: 'DUPLICATE_MOVE',
  REMATCH_NOT_AVAILABLE: 'REMATCH_NOT_AVAILABLE',
  REPOSITORY_ERROR: 'REPOSITORY_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INVALID_JSON: 'INVALID_JSON',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
