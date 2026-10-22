import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AiDifficulty,
  CreatedInvitation,
  PendingInvitation,
  PublicMatchState,
  QueueStatus,
  Side,
  UserProfile,
} from '../../shared/game-types';
import type {
  MatchJoinResult,
  MatchReactionResult,
  MatchVoiceEvent,
  MatchVoiceResult,
  MoveSubmitResult,
  QueueJoinResult,
  RematchResult,
} from '../../shared/events';
import type { StickerId } from '../../shared/stickers';

export interface DisplayReaction {
  reactionId: string;
  senderSide: Side;
  isYou: boolean;
  stickerId: StickerId;
  timestamp: string;
}
import {
  ApiRequestError,
  authenticateDev,
  authenticateTelegram,
  errorMessage,
  fetchConfig,
  fetchMe,
  getDeviceKey,
  sendTestNotification as requestTestNotification,
  updatePreferences,
} from '../lib/api';
import { createGameSocket, request, SocketRequestError, type GameClientSocket } from '../lib/socket';
import {
  getWebApp,
  hapticImpact,
  hapticNotify,
  initTelegram,
  parseGameMatchId,
  parseInviteToken,
  readStartParam,
  requestTelegramWriteAccess,
  updateViewportHeight,
  watchTheme,
} from '../lib/telegram';

export type BootPhase = 'booting' | 'ready' | 'auth-required' | 'error';
export type ConnectionStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'shutdown';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  source?: 'match-result';
}

export interface LastMove {
  cell: number;
  side: Side;
  actionId: string;
  at: number;
}

export interface MoveRejection {
  actionId: string;
  code: string;
  message: string;
  at: number;
}

interface UseGameClientOptions {
  onMatchFound: (matchId: string) => void;
}

export interface GameClient {
  phase: BootPhase;
  bootError: string | null;
  bootErrorCode: string | null;
  config: Awaited<ReturnType<typeof fetchConfig>> | null;
  profile: UserProfile | null;
  connection: ConnectionStatus;
  match: PublicMatchState | null;
  queue: QueueStatus | null;
  createdInvite: CreatedInvitation | null;
  pendingInvite: PendingInvitation | null;
  lastMove: LastMove | null;
  lastRejection: MoveRejection | null;
  opponentGraceEndsAt: string | null;
  initialInviteToken: string | null;
  initialGameMatchId: string | null;
  toasts: ToastMessage[];
  retryBoot: () => void;
  joinQueue: (autoAiFallback: boolean) => Promise<QueueStatus>;
  cancelQueue: () => Promise<void>;
  startAi: (difficulty: AiDifficulty, side: Side) => Promise<string>;
  createInvite: () => Promise<CreatedInvitation>;
  cancelInvite: (invitationId: string) => Promise<void>;
  acceptInvite: (token: string) => Promise<{ matchId: string }>;
  joinMatch: (matchId: string) => Promise<PublicMatchState>;
  submitMove: (matchId: string, cell: number, actionId: string) => Promise<PublicMatchState>;
  requestRematch: (matchId: string) => Promise<RematchResult>;
  leaveMatch: (matchId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  setAutoAiFallback: (value: boolean) => Promise<void>;
  setTurnNotifications: (value: boolean) => Promise<void>;
  sendTestNotification: () => Promise<void>;
  reactions: DisplayReaction[];
  sendReaction: (matchId: string, stickerId: StickerId) => Promise<MatchReactionResult>;
  incomingVoice: MatchVoiceEvent | null;
  sendVoice: (matchId: string, audioData: string, durationMs: number, waveform?: number[]) => Promise<MatchVoiceResult>;
  clearIncomingVoice: () => void;
  clearPendingInvite: () => void;
  clearCreatedInvite: () => void;
  reconnect: () => void;
  pushToast: (toast: Omit<ToastMessage, 'id'>) => void;
  dismissToast: (id: string) => void;
}

const INVITE_LINK_PREFIX = 'ttt:invite-link:';

export function inviteLinkStorageKey(invitationId: string): string {
  return `${INVITE_LINK_PREFIX}${invitationId}`;
}

export function useGameClient({ onMatchFound }: UseGameClientOptions): GameClient {
  const [phase, setPhase] = useState<BootPhase>('booting');
  const [bootError, setBootError] = useState<string | null>(null);
  const [bootErrorCode, setBootErrorCode] = useState<string | null>(null);
  const [config, setConfig] = useState<GameClient['config']>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [connection, setConnection] = useState<ConnectionStatus>('idle');
  const [match, setMatch] = useState<PublicMatchState | null>(null);
  const [queue, setQueue] = useState<QueueStatus | null>(null);
  const [createdInvite, setCreatedInvite] = useState<CreatedInvitation | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingInvitation | null>(null);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [lastRejection, setLastRejection] = useState<MoveRejection | null>(null);
  const [opponentGraceEndsAt, setOpponentGraceEndsAt] = useState<string | null>(null);
  const [initialInviteToken, setInitialInviteToken] = useState<string | null>(null);
  const [initialGameMatchId, setInitialGameMatchId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [reactions, setReactions] = useState<DisplayReaction[]>([]);
  const [incomingVoice, setIncomingVoice] = useState<MatchVoiceEvent | null>(null);
  const [bootAttempt, setBootAttempt] = useState(0);

  const socketRef = useRef<GameClientSocket | null>(null);
  const onMatchFoundRef = useRef(onMatchFound);
  onMatchFoundRef.current = onMatchFound;
  const toastTimers = useRef(new Map<string, number>());
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const matchRef = useRef(match);
  matchRef.current = match;

  const dismissToast = useCallback((id: string) => {
    const timer = toastTimers.current.get(id);
    if (timer) window.clearTimeout(timer);
    toastTimers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastMessage, 'id'>) => {
      const id =
        typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      const timer = window.setTimeout(() => dismissToast(id), toast.type === 'error' ? 6000 : 4200);
      toastTimers.current.set(id, timer);
    },
    [dismissToast],
  );

  useEffect(() => {
    const timers = toastTimers.current;
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer);
      timers.clear();
    };
  }, []);

  useEffect(() => {
    initTelegram();
    const themeWatcher = watchTheme();
    updateViewportHeight();
    return () => themeWatcher.cleanup();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPhase('booting');
    setBootError(null);
    setBootErrorCode(null);
    const startParam = readStartParam();
    const inviteToken = parseInviteToken(startParam);
    if (inviteToken) setInitialInviteToken(inviteToken);
    const gameMatchId = parseGameMatchId(startParam);
    if (gameMatchId) setInitialGameMatchId(gameMatchId);

    void (async () => {
      let loadedConfig;
      try {
        loadedConfig = await fetchConfig();
      } catch (error) {
        if (!cancelled) {
          setBootError(errorMessage(error));
          setBootErrorCode(error instanceof ApiRequestError ? error.code : 'NETWORK_ERROR');
          setPhase('error');
        }
        return;
      }
      if (cancelled) return;
      setConfig(loadedConfig);

      let user: UserProfile | null = null;
      const initData = getWebApp()?.initData;
      try {
        const me = await fetchMe();
        user = me.user;

        // Refresh the stored name, username, and avatar from the verified
        // initData on every launch. A valid existing session remains usable
        // when this best-effort refresh fails (for example, stale initData).
        if (initData) {
          try {
            const auth = await authenticateTelegram(initData);
            user = auth.user;
          } catch {
            // Keep the session profile; the next launch can try again.
          }
        }
      } catch (error) {
        if (cancelled) return;
        if (!(error instanceof ApiRequestError) || error.status !== 401) {
          setBootError(errorMessage(error));
          setBootErrorCode(error instanceof ApiRequestError ? error.code : 'NETWORK_ERROR');
          setPhase('error');
          return;
        }
        try {
          if (initData) {
            try {
              const auth = await authenticateTelegram(initData);
              user = auth.user;
            } catch (telegramError) {
              // Development and demo deployments may run without a Telegram
              // bot token. Keep those usable inside Telegram by falling back
              // to the guest session when guest auth is enabled.
              if (!loadedConfig.devAuthEnabled) throw telegramError;
              const auth = await authenticateDev(getDeviceKey());
              user = auth.user;
            }
          } else if (loadedConfig.devAuthEnabled) {
            const auth = await authenticateDev(getDeviceKey());
            user = auth.user;
          } else {
            setBootError('Open this game inside Telegram to sign in.');
            setBootErrorCode('AUTH_REQUIRED');
            setPhase('auth-required');
            return;
          }
        } catch (authError) {
          if (cancelled) return;
          setBootError(errorMessage(authError));
          setBootErrorCode(authError instanceof ApiRequestError ? authError.code : 'AUTH_INVALID');
          setPhase('auth-required');
          return;
        }
      }

      if (cancelled || !user) return;
      setProfile(user);
      setPhase('ready');
    })();

    return () => {
      cancelled = true;
    };
  }, [bootAttempt]);

  useEffect(() => {
    if (phase !== 'ready' || !profile?.id) return;
    const socket = createGameSocket();
    socketRef.current = socket;
    let active = true;
    setConnection('connecting');

    socket.on('connect', () => {
      if (!active) return;
      setConnection('connecting');
    });

    socket.on('session:ready', (payload) => {
      if (!active) return;
      setProfile(payload.user);
      setConnection('online');
    });

    socket.on('disconnect', (reason) => {
      if (!active) return;
      setQueue(null);
      setOpponentGraceEndsAt(null);
      if (reason === 'io server disconnect') {
        setConnection('offline');
      } else {
        setConnection('reconnecting');
      }
    });

    socket.on('connect_error', (error) => {
      if (!active) return;
      setConnection('reconnecting');
      const data = (error as Error & { data?: { code?: string } }).data;
      if (data?.code === 'AUTH_REQUIRED' || data?.code === 'AUTH_INVALID') {
        setProfile(null);
        setMatch(null);
        setBootError('Your session expired. Reopen the game from Telegram.');
        setBootErrorCode('AUTH_REQUIRED');
        setPhase('auth-required');
        socket.disconnect();
      }
    });

    socket.on('queue:status', (status) => {
      if (!active) return;
      if (status.state === 'matched') {
        setQueue(null);
        hapticNotify('success');
        return;
      }
      setQueue(status);
      if (status.state === 'error') {
        pushToast({ type: 'error', title: 'Matchmaking stopped', message: status.message });
      }
      if (status.state === 'expired') {
        pushToast({
          type: 'warning',
          title: 'No opponent found',
          message: 'You can try again or play against the bot.',
        });
      }
    });

    socket.on('match:found', ({ match: found }) => {
      if (!active) return;
      setMatch(found);
      setQueue(null);
      setPendingInvite(null);
      setLastMove(null);
      setLastRejection(null);
      setOpponentGraceEndsAt(null);
      setReactions([]);
      hapticNotify('success');
      onMatchFoundRef.current(found.id);
    });

    socket.on('match:state', ({ match: next }) => {
      if (!active) return;
      setMatch(next);
      if (next.opponentConnection === 'connected') setOpponentGraceEndsAt(null);
    });

    socket.on('move:accepted', (event) => {
      if (!active) return;
      setLastMove({ cell: event.cell, side: event.side, actionId: event.actionId, at: Date.now() });
      setMatch((current) => {
        if (!current || current.id !== event.matchId || current.board[event.cell] !== undefined) return current;
        const board = { ...current.board, [event.cell]: event.side };
        return {
          ...current,
          board,
          version: Math.max(current.version, event.version),
          turnNumber: current.turnNumber + 1,
          lastMove: { cell: event.cell, side: event.side },
          currentTurn: event.side === 'X' ? 'O' : 'X',
        };
      });
      hapticImpact('light');
    });

    socket.on('move:rejected', (event) => {
      if (!active) return;
      setLastRejection({
        actionId: event.actionId,
        code: event.code,
        message: event.message,
        at: Date.now(),
      });
      pushToast({ type: 'warning', title: 'Move not accepted', message: event.message });
    });

    socket.on('match:finished', ({ match: finished }) => {
      if (!active) return;
      setMatch(finished);
      setOpponentGraceEndsAt(null);
      const title = resultHeadline(finished);
      hapticNotify(title === 'You win!' ? 'success' : title === 'Draw' ? 'warning' : 'error');
      pushToast({
        type: title === 'You win!' ? 'success' : title === 'Draw' ? 'info' : 'error',
        title,
        message: finishReasonText(finished.finishReason),
        source: 'match-result',
      });
      window.setTimeout(() => {
        if (active) {
          void fetchMe()
            .then((payload) => setProfile(payload.user))
            .catch(() => undefined);
        }
      }, 500);
    });

    socket.on('opponent:disconnected', (event) => {
      if (!active) return;
      setOpponentGraceEndsAt(event.graceEndsAt);
      setMatch((current) =>
        current && current.id === event.matchId ? { ...current, opponentConnection: 'disconnected' } : current,
      );
      pushToast({
        type: 'warning',
        title: 'Opponent disconnected',
        message: 'The game is paused while they reconnect.',
      });
    });

    socket.on('opponent:reconnected', (event) => {
      if (!active) return;
      setOpponentGraceEndsAt(null);
      setMatch((current) =>
        current && current.id === event.matchId ? { ...current, opponentConnection: 'connected' } : current,
      );
      pushToast({ type: 'success', title: 'Opponent is back' });
    });

    socket.on('invite:waiting', ({ invitation }) => {
      if (!active) return;
      setPendingInvite(invitation);
    });

    socket.on('invite:pending', ({ invitation }) => {
      if (!active) return;
      setPendingInvite(invitation);
    });

    socket.on('rematch:status', (event) => {
      if (!active) return;
      setMatch((current) =>
        current && current.id === event.matchId ? { ...current, rematch: event.rematch } : current,
      );
    });

    socket.on('match:reaction', (event) => {
      if (!active) return;
      const currentMatch = matchRef.current;
      if (!currentMatch || currentMatch.id !== event.matchId) return;
      const isYou = currentMatch.youSide === event.senderSide;
      const newReaction: DisplayReaction = {
        reactionId: event.reactionId,
        senderSide: event.senderSide,
        isYou,
        stickerId: event.stickerId,
        timestamp: event.timestamp,
      };

      setReactions((prev) => [...prev.slice(-3), newReaction]);
      hapticImpact('light');

      window.setTimeout(() => {
        if (active) {
          setReactions((prev) => prev.filter((r) => r.reactionId !== event.reactionId));
        }
      }, 3200);
    });

    socket.on('match:voice', (event) => {
      if (!active) return;
      const currentMatch = matchRef.current;
      if (!currentMatch || currentMatch.id !== event.matchId) return;
      setIncomingVoice(event);
      hapticImpact('light');
    });

    socket.on('server:shutdown', ({ message }) => {
      if (!active) return;
      setConnection('shutdown');
      setQueue(null);
      pushToast({ type: 'warning', title: 'Server restarting', message });
    });

    socket.on('server:error', (event) => {
      if (!active) return;
      pushToast({ type: 'error', title: 'Something went wrong', message: event.message });
    });

    socket.connect();

    return () => {
      active = false;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setConnection('idle');
    };
  }, [phase, profile?.id, pushToast]);

  const requireSocket = useCallback((): GameClientSocket => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      throw new SocketRequestError('CONNECTION_LOST', 'You are offline. Reconnecting…');
    }
    return socket;
  }, []);

  const joinQueue = useCallback(async (autoAiFallback: boolean): Promise<QueueStatus> => {
    const socket = requireSocket();
    const result = await request<QueueJoinResult>((ack) => {
      socket.emit('queue:join', { autoAiFallback }, ack);
    });
    if (result.status.state !== 'matched') {
      setQueue(result.status);
    }
    return result.status;
  }, [requireSocket]);

  const cancelQueue = useCallback(async (): Promise<void> => {
    const socket = socketRef.current;
    setQueue(null);
    if (!socket?.connected) return;
    try {
      await request<{ cancelled: true }>((ack) => socket.emit('queue:cancel', ack), 5000);
    } catch {
      // Cancelling is best-effort; the server also drops queued players on disconnect.
    }
  }, []);

  const startAi = useCallback(
    async (difficulty: AiDifficulty, side: Side): Promise<string> => {
      const socket = requireSocket();
      const result = await request<{ matchId: string }>((ack) => {
        socket.emit('ai:start', { difficulty, side }, ack);
      });
      setQueue(null);
      return result.matchId;
    },
    [requireSocket],
  );

  const createInvite = useCallback(async (): Promise<CreatedInvitation> => {
    const socket = requireSocket();
    const result = await request<{ invitation: CreatedInvitation }>((ack) => {
      socket.emit('invite:create', ack);
    });
    // The server leaves matchmaking as part of creating an invitation and does
    // not emit a queue status event, so clear the local queue as well.
    setQueue(null);
    setCreatedInvite(result.invitation);
    setPendingInvite({
      id: result.invitation.id,
      matchId: result.invitation.matchId,
      expiresAt: result.invitation.expiresAt,
      status: 'PENDING',
    });
    try {
      window.localStorage.setItem(inviteLinkStorageKey(result.invitation.id), result.invitation.deepLink);
    } catch {
      // Private browsing may reject local storage.
    }
    return result.invitation;
  }, [requireSocket]);

  const cancelInvite = useCallback(async (invitationId: string): Promise<void> => {
    const socket = requireSocket();
    await request<{ cancelled: true }>((ack) => {
      socket.emit('invite:cancel', { invitationId }, ack);
    });
    setPendingInvite(null);
    setCreatedInvite(null);
    try {
      window.localStorage.removeItem(inviteLinkStorageKey(invitationId));
    } catch {
      // Ignore storage errors.
    }
  }, [requireSocket]);

  const acceptInvite = useCallback(
    async (token: string): Promise<{ matchId: string }> => {
      const socket = requireSocket();
      const result = await request<{ matchId: string }>((ack) => {
        socket.emit('invite:accept', { token }, ack);
      });
      // Accepting also removes the player from matchmaking on the server.
      setQueue(null);
      setPendingInvite(null);
      return result;
    },
    [requireSocket],
  );

  const joinMatch = useCallback(async (matchId: string): Promise<PublicMatchState> => {
    const socket = requireSocket();
    const result = await request<MatchJoinResult>((ack) => {
      socket.emit('match:join', { matchId }, ack);
    });
    setMatch(result.match);
    return result.match;
  }, [requireSocket]);

  const submitMove = useCallback(
    async (matchId: string, cell: number, actionId: string): Promise<PublicMatchState> => {
      const socket = requireSocket();
      const result = await request<MoveSubmitResult>((ack) => {
        socket.emit('move:submit', { matchId, cell, actionId }, ack);
      });
      setMatch(result.match);
      return result.match;
    },
    [requireSocket],
  );

  const requestRematch = useCallback(
    async (matchId: string): Promise<RematchResult> => {
      const socket = requireSocket();
      return request<RematchResult>((ack) => {
        socket.emit('match:rematch', { matchId }, ack);
      });
    },
    [requireSocket],
  );

  const leaveMatch = useCallback(
    async (matchId: string): Promise<void> => {
      const socket = requireSocket();
      await request<{ left: true }>((ack) => {
        socket.emit('match:leave', { matchId }, ack);
      });
      setMatch((current) => (current?.id === matchId ? null : current));
      setOpponentGraceEndsAt(null);
    },
    [requireSocket],
  );

  const sendReaction = useCallback(
    async (matchId: string, stickerId: StickerId): Promise<MatchReactionResult> => {
      const socket = requireSocket();
      return request<MatchReactionResult>((ack) => {
        socket.emit('match:reaction', { matchId, stickerId }, ack);
      });
    },
    [requireSocket],
  );

  const sendVoice = useCallback(
    async (
      matchId: string,
      audioData: string,
      durationMs: number,
      waveform?: number[],
    ): Promise<MatchVoiceResult> => {
      const socket = requireSocket();
      return request<MatchVoiceResult>((ack) => {
        socket.emit('match:voice', { matchId, audioData, durationMs, waveform }, ack);
      });
    },
    [requireSocket],
  );

  const clearIncomingVoice = useCallback(() => {
    setIncomingVoice(null);
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    try {
      const payload = await fetchMe();
      setProfile(payload.user);
    } catch {
      // The socket may be reconnecting; the next session:ready refreshes the profile.
    }
  }, []);

  const setAutoAiFallback = useCallback(async (value: boolean): Promise<void> => {
    try {
      const payload = await updatePreferences({ autoAiFallback: value });
      setProfile(payload.user);
    } catch (error) {
      throw new ApiRequestError(
        error instanceof ApiRequestError ? error.code : 'UPDATE_FAILED',
        errorMessage(error),
        error instanceof ApiRequestError ? error.status : 0,
      );
    }
  }, []);

  const setTurnNotifications = useCallback(async (value: boolean): Promise<void> => {
    if (value) {
      const access = await requestTelegramWriteAccess();
      if (access === 'unsupported') {
        throw new ApiRequestError(
          'WRITE_ACCESS_UNSUPPORTED',
          'Update Telegram to enable turn notifications.',
          0,
        );
      }
      if (access === 'denied') {
        throw new ApiRequestError(
          'WRITE_ACCESS_DENIED',
          'Telegram did not grant permission for the bot to message you.',
          0,
        );
      }
    }

    try {
      const payload = await updatePreferences({ turnNotifications: value });
      setProfile(payload.user);
    } catch (error) {
      throw new ApiRequestError(
        error instanceof ApiRequestError ? error.code : 'UPDATE_FAILED',
        errorMessage(error),
        error instanceof ApiRequestError ? error.status : 0,
      );
    }
  }, []);

  const sendTestNotification = useCallback(async (): Promise<void> => {
    try {
      await requestTestNotification();
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 409) {
        await refreshProfile();
      }
      throw new ApiRequestError(
        error instanceof ApiRequestError ? error.code : 'NOTIFICATION_TEST_FAILED',
        errorMessage(error),
        error instanceof ApiRequestError ? error.status : 0,
      );
    }
  }, [refreshProfile]);

  const retryBoot = useCallback(() => {
    setBootAttempt((attempt) => attempt + 1);
  }, []);

  const reconnect = useCallback(() => {
    const socket = socketRef.current;
    if (socket) {
      socket.connect();
      return;
    }
    retryBoot();
  }, [retryBoot]);

  const clearPendingInvite = useCallback(() => setPendingInvite(null), []);
  const clearCreatedInvite = useCallback(() => setCreatedInvite(null), []);

  return {
    phase,
    bootError,
    bootErrorCode,
    config,
    profile,
    connection,
    match,
    queue,
    createdInvite,
    pendingInvite,
    lastMove,
    lastRejection,
    opponentGraceEndsAt,
    initialInviteToken,
    initialGameMatchId,
    toasts,
    reactions,
    retryBoot,
    joinQueue,
    cancelQueue,
    startAi,
    createInvite,
    cancelInvite,
    acceptInvite,
    joinMatch,
    submitMove,
    requestRematch,
    leaveMatch,
    sendReaction,
    incomingVoice,
    sendVoice,
    clearIncomingVoice,
    refreshProfile,
    setAutoAiFallback,
    setTurnNotifications,
    sendTestNotification,
    clearPendingInvite,
    clearCreatedInvite,
    reconnect,
    pushToast,
    dismissToast,
  };
}

export function resultHeadline(match: PublicMatchState): string {
  if (match.result === 'DRAW') return 'Draw';
  if (!match.winnerSide) return 'Game over';
  return match.winnerSide === match.youSide ? 'You win!' : 'You lost';
}

export function finishReasonText(reason: PublicMatchState['finishReason']): string {
  switch (reason) {
    case 'LINE':
      return 'Five in a row.';
    case 'DRAW':
      return 'The board is full — nobody gave an inch.';
    case 'DISCONNECT':
      return 'The opponent did not reconnect in time.';
    case 'TIMEOUT':
      return 'A turn timer expired.';
    case 'FORFEIT':
      return 'The opponent resigned.';
    case 'SERVER_SHUTDOWN':
      return 'The server restarted.';
    case 'CANCELLED':
      return 'The invitation was cancelled.';
    case 'ABANDONED':
      return 'The game was abandoned.';
    default:
      return '';
  }
}

// Re-exporting the socket error type keeps screen imports tidy.
export { SocketRequestError };
