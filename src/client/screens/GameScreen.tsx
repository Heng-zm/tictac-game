import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Clock3,
  Flag,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Timer,
  Volume2,
  WifiOff,
  X,
} from 'lucide-react';
import { MATCH_START_COUNTDOWN_MS, type Side } from '../../shared/game-types';
import type { StickerId } from '../../shared/stickers';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { SocketRequestError } from '../lib/socket';
import {
  findWinningLine,
  isRatedMatch,
  modeLabel,
  opponentFor,
} from '../lib/game';
import { cn } from '../lib/cn';
import { hapticImpact, hapticNotify, setVerticalSwipeLock } from '../lib/telegram';
import { useTelegramBackHandler } from '../hooks/use-hash-route';
import { formatDuration, useCountdown } from '../hooks/use-time';
import { Avatar, Button, Card, EmptyState, IconButton, Modal, ScreenHeader, Spinner } from '../components/ui';
import { Page } from '../components/Layout';
import { Board } from '../components/Board';
import { GameResult } from '../components/GameResult';
import { ReactionPicker } from '../components/stickers/ReactionPicker';
import { ReactionOverlay } from '../components/stickers/ReactionOverlay';
import { ChatOverlay } from '../components/stickers/ChatOverlay';
import { WalkieTalkieButton } from '../components/voice/WalkieTalkieButton';

export function GameScreen({
  client,
  navigate,
  matchId,
}: {
  client: GameClient;
  navigate: (path: string) => void;
  matchId: string;
}) {
  const { connection, match: currentMatch, joinMatch, config, submitMove, pushToast } = client;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const joinRequested = useRef(false);

  const match = currentMatch?.id === matchId ? currentMatch : null;
  const otherActive =
    currentMatch && currentMatch.id !== matchId && currentMatch.status === 'ACTIVE' ? currentMatch : null;

  const loadJoin = useCallback(async () => {
    if (match || otherActive) {
      setLoading(false);
      return;
    }
    if (connection !== 'online') {
      setLoading(true);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      await joinMatch(matchId);
    } catch (error) {
      if (error instanceof SocketRequestError) {
        setLoadError({ code: error.code, message: error.message });
      } else {
        setLoadError({ code: 'LOAD_FAILED', message: errorMessage(error) });
      }
    } finally {
      setLoading(false);
    }
  }, [joinMatch, connection, match, matchId, otherActive]);

  useEffect(() => {
    if (match || otherActive) {
      setLoading(false);
      return;
    }
    if (connection !== 'online' || joinRequested.current) return;
    joinRequested.current = true;
    void loadJoin();
  }, [connection, loadJoin, match, otherActive]);

  useEffect(() => {
    joinRequested.current = false;
    setLoading(true);
    setLoadError(null);
    setPendingCell(null);
    setPendingActionId(null);
    setRematchBusy(false);
    setForfeitOpen(false);
    setReactionPickerOpen(false);
  }, [matchId]);

  useEffect(() => {
    setPendingCell(null);
    setPendingActionId(null);
  }, [match?.version, match?.currentTurn]);

  // The game screen owns the viewport and vertical drags pan the board. Keep
  // Telegram from treating those gestures as swipe-to-close/minimize.
  useEffect(() => {
    setVerticalSwipeLock(true);
    return () => setVerticalSwipeLock(false);
  }, []);

  useEffect(() => {
    if (!client.lastRejection || !pendingActionId) return;
    if (client.lastRejection.actionId === pendingActionId) {
      setPendingCell(null);
      setPendingActionId(null);
    }
  }, [client.lastRejection, pendingActionId]);

  const turnRemaining = useCountdown(match?.turnDeadline ?? null);
  const turnTimerTotal = config?.turnTimeoutMs ?? 0;
  const graceRemaining = useCountdown(client.opponentGraceEndsAt);
  const matchStartCountdownMs = config?.matchStartCountdownMs ?? MATCH_START_COUNTDOWN_MS;
  const matchStartTarget = useMemo(() => {
    if (!match || match.mode === 'AI' || matchStartCountdownMs <= 0) return null;
    const startedAt = Date.parse(match.startedAt);
    return Number.isFinite(startedAt)
      ? new Date(startedAt + matchStartCountdownMs).toISOString()
      : null;
  }, [match, matchStartCountdownMs]);
  const matchStartRemaining = useCountdown(matchStartTarget);
  const matchStarting = Boolean(
    match &&
      match.status === 'ACTIVE' &&
      matchStartRemaining !== null &&
      matchStartRemaining > 0,
  );
  const countdownSeconds =
    matchStartRemaining === null ? 0 : Math.max(1, Math.ceil(matchStartRemaining / 1000));
  const countdownProgress =
    matchStartRemaining === null || matchStartCountdownMs <= 0
      ? 0
      : Math.min(1, Math.max(0, matchStartRemaining / matchStartCountdownMs));
  const youSide = match?.youSide ?? null;
  const yourTurn = Boolean(
    match &&
      match.status === 'ACTIVE' &&
      match.currentTurn === match.youSide &&
      youSide &&
      match.youSide === youSide,
  );
  const board = useMemo(() => match?.board ?? {}, [match]);
  const displayBoard = useMemo(
    () => (pendingCell !== null && youSide ? { ...board, [pendingCell]: youSide } : board),
    [board, pendingCell, youSide],
  );
  const activeBoard = match && match.status !== 'ACTIVE' ? board : displayBoard;
  const winningLine = useMemo(() => findWinningLine(activeBoard), [activeBoard]);
  const lastMoveCell =
    (client.lastMove && client.match?.id === match?.id ? client.lastMove.cell : null) ??
    match?.lastMove?.cell ??
    null;

  const playCell = useCallback(
    async (cell: number): Promise<void> => {
      if (!match || match.status !== 'ACTIVE' || !yourTurn || pendingCell !== null || board[cell] !== undefined) {
        return;
      }
      const actionId = makeActionId();
      setPendingCell(cell);
      setPendingActionId(actionId);
      hapticImpact('light');
      try {
        await submitMove(match.id, cell, actionId);
        hapticImpact('light');
      } catch (error) {
        hapticNotify('error');
        if (error instanceof SocketRequestError && (error.code === 'CONNECTION_LOST' || error.code === 'TIMEOUT')) {
          pushToast({ type: 'error', title: 'Move not sent', message: error.message });
        }
      } finally {
        setPendingCell(null);
        setPendingActionId(null);
      }
    },
    [board, match, pendingCell, pushToast, submitMove, yourTurn],
  );
  const handleCell = useCallback(
    (cell: number) => {
      void playCell(cell);
    },
    [playCell],
  );

  async function rematch(): Promise<void> {
    if (!match) return;
    setRematchBusy(true);
    try {
      const result = await client.requestRematch(match.id);
      if (result.matchId !== match.id) navigate(`/game/${result.matchId}`);
      else client.pushToast({ type: 'info', title: 'Rematch requested', message: 'Waiting for your opponent to accept.' });
    } catch (error) {
      client.pushToast({ type: 'error', title: 'Rematch unavailable', message: errorMessage(error) });
    } finally {
      setRematchBusy(false);
    }
  }

  async function leaveGame(to: string): Promise<void> {
    try {
      await client.leaveMatch(matchId);
    } catch {
      // Leaving the screen is still safe even if the socket is reconnecting.
    }
    navigate(to);
  }

  async function forfeit(): Promise<void> {
    setForfeiting(true);
    try {
      await client.leaveMatch(matchId);
      setForfeitOpen(false);
      navigate('/');
    } catch (error) {
      client.pushToast({ type: 'error', title: 'Could not leave the game', message: errorMessage(error) });
    } finally {
      setForfeiting(false);
    }
  }

  // Intercept Telegram BackButton to dismiss forfeit confirmation modal if open
  useTelegramBackHandler(forfeitOpen, () => setForfeitOpen(false));
  useTelegramBackHandler(reactionPickerOpen, () => setReactionPickerOpen(false));

  const youReaction = useMemo(
    () => client.reactions.filter((r) => r.isYou).slice(-1)[0] ?? null,
    [client.reactions],
  );
  const opponentReaction = useMemo(
    () => client.reactions.filter((r) => !r.isYou).slice(-1)[0] ?? null,
    [client.reactions],
  );
  const youChat = useMemo(
    () => client.chatMessages.filter((message) => message.isYou).slice(-1)[0] ?? null,
    [client.chatMessages],
  );
  const opponentChat = useMemo(
    () => client.chatMessages.filter((message) => !message.isYou).slice(-1)[0] ?? null,
    [client.chatMessages],
  );


  const handleSendReaction = useCallback(
    async (stickerId: StickerId): Promise<void> => {
      if (!match) return;
      try {
        await client.sendReaction(match.id, stickerId);
      } catch (error) {
        client.pushToast({
          type: 'error',
          title: 'Reaction not sent',
          message: errorMessage(error),
        });
      }
    },
    [client, match],
  );

  const handleSendText = useCallback(
    async (text: string): Promise<void> => {
      if (!match) return;
      try {
        await client.sendChat(match.id, text);
      } catch (error) {
        client.pushToast({
          type: 'error',
          title: 'Message not sent',
          message: errorMessage(error),
        });
      }
    },
    [client, match],
  );

  const handleSendVoice = useCallback(
    async (audioData: string, durationMs: number, waveform: number[]): Promise<void> => {
      if (!match) return;
      try {
        await client.sendVoice(match.id, audioData, durationMs, waveform);
      } catch (error) {
        client.pushToast({
          type: 'error',
          title: 'Voice transmission failed',
          message: errorMessage(error),
        });
      }
    },
    [client, match],
  );

  if (otherActive) {
    return (
      <Page>
        <ScreenHeader title="Another game is active" onBack={() => navigate('/')} />
        <Card>
          <EmptyState
            icon={ShieldCheck}
            title="One board at a time"
            description="You already have a game in progress. Finish or leave it before opening another."
            action={<Button onClick={() => navigate(`/game/${otherActive.id}`)}>Resume current game</Button>}
          />
        </Card>
      </Page>
    );
  }

  if (loading && !match) {
    return (
      <Page>
        <GameHeader onBack={() => navigate('/')} />
        <Card className="flex flex-col items-center gap-3 p-10">
          <Spinner className="h-7 w-7" />
          <p className="text-sm font-medium text-muted">
            {connection === 'online'
              ? 'Opening the board…'
              : connection === 'idle' || connection === 'connecting'
                ? 'Connecting to the board…'
                : 'Reconnecting to the board…'}
          </p>
        </Card>
      </Page>
    );
  }

  if (!match) {
    const waiting = loadError?.code === 'GAME_NOT_ACTIVE';
    const offline = connection !== 'online' && !loadError;
    return (
      <Page>
        <GameHeader onBack={() => navigate('/')} />
        <Card>
          <EmptyState
            icon={offline ? WifiOff : waiting ? Clock3 : X}
            title={
              offline
                ? 'You are offline'
                : waiting
                  ? 'Waiting for your friend'
                  : loadError?.code === 'MATCH_FORBIDDEN'
                    ? 'This is not your game'
                    : 'This board is gone'
            }
            description={
              offline
                ? 'The board will appear as soon as the connection is back.'
                : waiting
                  ? 'The invitation has not been accepted yet. Share the link with your friend.'
                  : loadError?.message ?? 'This game could not be found. It may have expired or been removed.'
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  icon={offline ? Loader2 : undefined}
                  variant={offline ? 'secondary' : 'primary'}
                  onClick={() => {
                    joinRequested.current = false;
                    if (offline) client.reconnect();
                    else void loadJoin();
                  }}
                >
                  {offline ? 'Reconnect' : 'Try again'}
                </Button>
                {waiting ? (
                  <Button variant="secondary" onClick={() => navigate('/invite/waiting')}>
                    Invitation
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={() => navigate('/')}>
                    Home
                  </Button>
                )}
              </div>
            }
          />
        </Card>
      </Page>
    );
  }

  const opponent = opponentFor(match);
  const you = match.players[match.youSide];
  const gameOver = match.status === 'FINISHED' || match.status === 'ABANDONED';
  const opponentDisconnected =
    match.opponentConnection === 'disconnected' || Boolean(client.opponentGraceEndsAt);

  const clockText =
    gameOver
      ? '—'
      : match.turnTimerPaused
        ? 'Paused'
        : turnRemaining !== null
          ? formatDuration(turnRemaining)
          : yourTurn
            ? 'You'
            : `${match.currentTurn ?? '—'}`;
  const clockLabel =
    gameOver
      ? 'Finished'
      : match.turnTimerPaused
        ? 'Clock paused'
        : yourTurn
          ? 'Your turn'
          : "Opponent's turn";
  const clockProgress =
    match.status === 'ACTIVE' && !match.turnTimerPaused && turnRemaining !== null && turnTimerTotal > 0
      ? Math.min(1, Math.max(0, turnRemaining / turnTimerTotal))
      : null;
  const clockUrgent = Boolean(
    yourTurn && match.status === 'ACTIVE' && !match.turnTimerPaused && turnRemaining !== null && turnRemaining <= 5000,
  );

  return (
    <div className="fixed inset-0 z-0 overflow-hidden overscroll-none bg-app">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {yourTurn ? 'Your turn to place a stone' : `${opponent?.displayName || 'Opponent'}'s turn`}
      </div>
      <Board
        board={displayBoard}
        winningLine={winningLine}
        lastMoveCell={lastMoveCell}
        pendingCell={pendingCell}
        yourTurn={yourTurn}
        disabled={
          pendingCell !== null ||
          matchStarting ||
          match.status !== 'ACTIVE' ||
          match.currentTurn !== match.youSide ||
          connection !== 'online'
        }
        onCell={handleCell}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
        <div className="pointer-events-auto border-b border-line/70 bg-app px-3 pb-2.5 pt-[calc(env(safe-area-inset-top)+6px)] shadow-[0_18px_40px_-32px_rgba(0,0,0,0.55)] sm:px-4">
          <div className="mx-auto w-full max-w-[720px] lg:max-w-[840px]">
            <GameHeader
              onBack={() => {
                if (match.status === 'ACTIVE') {
                  setForfeitOpen(true);
                } else {
                  navigate('/');
                }
              }}
              mode={modeLabel(match.mode)}
              rated={isRatedMatch(match)}
              connection={connection}
              onRetry={client.reconnect}
            />

            <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-0.5">
              <div className="relative">
                <PlayerBadge
                  name={you?.displayName ?? 'You'}
                  photoUrl={you?.photoUrl}
                  side={match.youSide}
                  active={match.currentTurn === match.youSide && match.status === 'ACTIVE'}
                  connected
                  isYou
                  isAi={false}
                />
                {youChat || youReaction ? (
                  <div className="absolute top-11 left-1 z-30 flex flex-col items-start gap-1">
                    <ChatOverlay message={youChat} />
                    <ReactionOverlay reaction={youReaction} languageCode={client.profile?.languageCode} />
                  </div>
                ) : null}
              </div>

              <TurnClock
                text={clockText}
                label={clockLabel}
                progress={clockProgress}
                urgent={clockUrgent}
                muted={match.turnTimerPaused || gameOver}
              />

              <div className="relative">
                <PlayerBadge
                  name={opponent?.displayName ?? 'Opponent'}
                  photoUrl={opponent?.photoUrl}
                  side={opponent?.side ?? (match.youSide === 'X' ? 'O' : 'X')}
                  active={match.currentTurn !== match.youSide && match.status === 'ACTIVE'}
                  connected={match.opponentConnection === 'connected' || match.opponentConnection === 'not_applicable'}
                  isAi={Boolean(opponent?.isAi)}
                  align="right"
                />
                {opponentChat || opponentReaction ? (
                  <div className="absolute top-11 right-1 z-30 flex flex-col items-end gap-1">
                    <ChatOverlay message={opponentChat} />
                    <ReactionOverlay reaction={opponentReaction} languageCode={client.profile?.languageCode} />
                  </div>
                ) : null}
                {client.incomingVoice ? (
                  <div className="absolute -bottom-1.5 right-0 z-30 flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm animate-pulse">
                    <Volume2 className="h-2.5 w-2.5" aria-hidden />
                    <span>Voice</span>
                  </div>
                ) : null}
              </div>
            </div>

            {opponentDisconnected && match.status === 'ACTIVE' ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-2.5 py-1.5">
                <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                <p className="text-[10.5px] font-medium leading-tight text-ink">
                  Opponent disconnected. Clock paused
                  {graceRemaining !== null ? ` · ${formatDuration(graceRemaining)} to reconnect` : ''}.
                </p>
              </div>
            ) : connection !== 'online' ? (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-elevated/60 px-2.5 py-1.5">
                <Timer className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
                <p className="text-[10.5px] font-medium leading-tight text-ink">
                  {connection === 'idle' || connection === 'connecting'
                    ? 'Connecting. Your board and rating are safe.'
                    : 'Reconnecting. Your board and rating are safe.'}
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+18px)] z-20 flex items-center justify-end gap-2 px-3 sm:px-4">
        <button
          type="button"
          onClick={() => {
            hapticImpact('light');
            setReactionPickerOpen(true);
          }}
          disabled={
            connection !== 'online' ||
            (match.status !== 'ACTIVE' && match.status !== 'FINISHED')
          }
          className="pointer-events-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface text-accent shadow-soft transition hover:border-accent/40 hover:bg-elevated active:scale-90 disabled:cursor-not-allowed disabled:opacity-50"
          title="Sticker reactions and quick chat"
          aria-label="Open sticker reactions and quick chat"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
        </button>
        <WalkieTalkieButton
          matchId={match.id}
          onSendVoice={handleSendVoice}
          onError={(message) => pushToast({ type: 'error', title: 'Microphone unavailable', message })}
          disabled={match.status !== 'ACTIVE' && match.status !== 'FINISHED'}
        />
      </div>

      {matchStarting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-5 backdrop-blur-sm animate-fade-in">
          <div
            className="w-full max-w-xs rounded-3xl border border-accent/25 bg-surface/95 p-6 text-center shadow-soft animate-pop-in"
            role="status"
            aria-live="polite"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-accent">
              Match found
            </p>
            <div className="mt-4 flex items-center justify-center gap-4">
              <Avatar name={you?.displayName ?? 'You'} photoUrl={you?.photoUrl} size="lg" ring />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted">vs</span>
              <Avatar
                name={opponent?.displayName ?? 'Opponent'}
                photoUrl={opponent?.photoUrl}
                size="lg"
                ring
              />
            </div>
            <div
              key={countdownSeconds}
              className="mt-4 text-7xl font-black leading-none tabular-nums text-ink animate-countdown-tick"
              aria-hidden="true"
            >
              {countdownSeconds}
            </div>
            <span className="sr-only">Match starts in {countdownSeconds} seconds</span>
            <p className="mt-2 text-sm font-medium text-muted">
              Get ready — you play {match.youSide}
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-elevated" aria-hidden="true">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-linear"
                style={{ width: `${Math.round(countdownProgress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <GameResult
        match={match}
        open={match.status === 'FINISHED' || match.status === 'ABANDONED'}
        rematchBusy={rematchBusy}
        onRematch={() => void rematch()}
        onHome={() => void leaveGame('/')}
        onHistory={() => void leaveGame('/profile/history')}
      />

      <Modal
        open={forfeitOpen}
        onClose={() => setForfeitOpen(false)}
        title="Leave this game?"
        dismissible={!forfeiting}
      >
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {match.mode === 'AI'
            ? 'This bot game will be abandoned. Bot games do not affect your rating.'
            : 'Your opponent will win by resignation and this rated game will count as a loss. This cannot be undone.'}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setForfeitOpen(false)} disabled={forfeiting}>
            Keep playing
          </Button>
          <Button variant="danger" icon={Flag} loading={forfeiting} onClick={() => void forfeit()}>
            {match.mode === 'AI' ? 'Abandon' : 'Resign'}
          </Button>
        </div>
      </Modal>

      <ReactionPicker
        isOpen={reactionPickerOpen}
        onClose={() => setReactionPickerOpen(false)}
        onSelect={(stickerId) => void handleSendReaction(stickerId)}
        onSendText={(text) => void handleSendText(text)}
        languageCode={client.profile?.languageCode}
        disabled={connection !== 'online'}
      />
    </div>
  );
}

function TurnClock({
  text,
  label,
  progress,
  urgent,
  muted,
}: {
  text: string;
  label: string;
  progress: number | null;
  urgent: boolean;
  muted: boolean;
}) {
  const radius = 27;
  const circumference = 2 * Math.PI * radius;
  const offset = progress === null ? circumference : circumference * (1 - progress);

  return (
    <div className="flex min-w-[72px] flex-col items-center text-center" role="timer" aria-label={`${label}: ${text}`}>
      <div className="relative flex h-14 w-14 items-center justify-center">
        <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden>
          <circle
            cx="32"
            cy="32"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            className="text-line/80"
          />
          {progress !== null ? (
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={cn(
                'transition-[stroke-dashoffset,color] duration-500 ease-linear',
                muted ? 'text-muted/60' : urgent ? 'text-danger' : 'text-accent',
              )}
            />
          ) : null}
        </svg>
        <span
          className={cn(
            'font-bold tabular-nums tracking-tight transition-colors duration-200',
            text.length > 5 ? 'text-[11px]' : 'text-base',
            muted ? 'text-muted' : urgent ? 'text-danger' : 'text-ink',
          )}
        >
          {text}
        </span>
      </div>
      <span className="mt-0.5 text-[10px] font-medium text-muted">{label}</span>
    </div>
  );
}

function GameHeader({
  onBack,
  mode,
  rated,
  connection,
  onRetry,
}: {
  onBack: () => void;
  mode?: string;
  rated?: boolean;
  connection?: string;
  onRetry?: () => void;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pb-2.5 sm:pb-3.5 pt-0">
      <div className="flex min-w-0 items-center gap-2.5">
        <IconButton label="Leave game screen" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight tracking-tight text-ink">
            {mode ?? 'Tic Tac Toe'}
          </h1>
          {mode ? (
            <p className="mt-0.5 text-[10px] font-medium text-muted">
              {rated ? 'Rated match' : 'Casual match'}
            </p>
          ) : null}
        </div>
      </div>
      {connection && connection !== 'online' ? (
        <div className="shrink-0 flex items-center">
          {connection === 'reconnecting' ? (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
              </span>
              <span>Reconnecting…</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-danger/30 bg-danger/10 px-2.5 py-1 text-[11px] font-medium text-danger">
              <WifiOff className="h-3 w-3 shrink-0" aria-hidden />
              <span>Offline</span>
              {onRetry ? (
                <button
                  type="button"
                  onClick={onRetry}
                  className="ml-1 font-semibold underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current"
                >
                  Retry
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </header>
  );
}

function PlayerBadge({
  name,
  photoUrl,
  side,
  active,
  connected,
  isYou = false,
  isAi = false,
  align = 'left',
}: {
  name: string;
  photoUrl?: string | null;
  side: Side;
  active: boolean;
  connected: boolean;
  isYou?: boolean;
  isAi?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div
      className={cn(
        'flex min-w-0 items-center gap-2.5',
        align === 'right' && 'flex-row-reverse text-right',
      )}
    >
      <div className="relative shrink-0">
        {isAi ? (
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200',
              active ? 'bg-accent/10 text-accent ring-2 ring-accent/30' : 'bg-elevated text-muted',
            )}
          >
            <Bot className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <Avatar name={name} photoUrl={photoUrl} size="sm" ring={active} className="transition-shadow duration-200" />
        )}
        {!isAi ? (
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-app transition-colors duration-200',
              connected ? 'bg-success' : 'bg-muted',
            )}
            aria-label={connected ? 'Connected' : 'Disconnected'}
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-xs font-semibold transition-colors duration-200', active ? 'text-accent' : 'text-ink')}>
          {isYou ? 'You' : name}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-muted">
          <span className={side === 'X' ? 'text-accent' : 'text-danger'}>{side}</span>
          <span>· {isAi ? 'Bot' : isYou ? 'You' : 'Opponent'}</span>
        </p>
      </div>
    </div>
  );
}

function makeActionId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
