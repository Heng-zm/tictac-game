import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Clock3, Flag, Loader2, ShieldCheck, Timer, WifiOff, X } from 'lucide-react';
import type { Side } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { SocketRequestError } from '../lib/socket';
import {
  describeOutcome,
  findWinningLine,
  isRatedMatch,
  modeLabel,
  opponentFor,
} from '../lib/game';
import { cn } from '../lib/cn';
import { hapticImpact } from '../lib/telegram';
import { formatDuration, useCountdown } from '../hooks/use-time';
import { Avatar, Button, Card, EmptyState, IconButton, Modal, ScreenHeader, Spinner } from '../components/ui';
import { Page } from '../components/Layout';
import { Board } from '../components/Board';
import { GameResult } from '../components/GameResult';

export function GameScreen({
  client,
  navigate,
  matchId,
}: {
  client: GameClient;
  navigate: (path: string) => void;
  matchId: string;
}) {
  const { connection, match: currentMatch, joinMatch } = client;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ code: string; message: string } | null>(null);
  const [pendingCell, setPendingCell] = useState<number | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [forfeitOpen, setForfeitOpen] = useState(false);
  const [forfeiting, setForfeiting] = useState(false);
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
  }, [matchId]);

  useEffect(() => {
    setPendingCell(null);
    setPendingActionId(null);
  }, [match?.version, match?.currentTurn]);

  useEffect(() => {
    if (!client.lastRejection || !pendingActionId) return;
    if (client.lastRejection.actionId === pendingActionId) {
      setPendingCell(null);
      setPendingActionId(null);
    }
  }, [client.lastRejection, pendingActionId]);

  const turnRemaining = useCountdown(match?.turnDeadline ?? null);
  const graceRemaining = useCountdown(client.opponentGraceEndsAt);
  const youSide = match?.youSide ?? null;
  const yourTurn = Boolean(
    match &&
      match.status === 'ACTIVE' &&
      match.currentTurn === match.youSide &&
      youSide &&
      match.youSide === youSide,
  );
  const board = match?.board ?? [];
  const displayBoard =
    pendingCell !== null && youSide
      ? board.map((cell, index) => (index === pendingCell ? youSide : cell))
      : board;
  const activeBoard = match?.status === 'FINISHED' ? board : displayBoard;
  const winningLine = match ? findWinningLine(activeBoard) : null;
  const lastMoveCell = client.lastMove && client.match?.id === match?.id ? client.lastMove.cell : null;

  async function playCell(cell: number): Promise<void> {
    if (!match || match.status !== 'ACTIVE' || !yourTurn || pendingCell !== null || board[cell] !== null) return;
    const actionId = makeActionId();
    setPendingCell(cell);
    setPendingActionId(actionId);
    hapticImpact('light');
    try {
      await client.submitMove(match.id, cell, actionId);
    } catch (error) {
      setPendingCell(null);
      setPendingActionId(null);
      if (error instanceof SocketRequestError && (error.code === 'CONNECTION_LOST' || error.code === 'TIMEOUT')) {
        client.pushToast({ type: 'error', title: 'Move not sent', message: error.message });
      }
    }
  }

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
        <GameHeader onBack={() => navigate('/')} onResign={undefined} showResign={false} />
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
        <GameHeader onBack={() => navigate('/')} showResign={false} />
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
  const opponentDisconnected =
    match.opponentConnection === 'disconnected' || Boolean(client.opponentGraceEndsAt);

  const outcome = match.status === 'FINISHED' ? describeOutcome(match) : null;
  const clockText =
    match.status === 'FINISHED'
      ? '—'
      : match.turnTimerPaused
        ? 'Paused'
        : turnRemaining !== null
          ? formatDuration(turnRemaining)
          : yourTurn
            ? 'You'
            : `${match.currentTurn ?? '—'}`;
  const clockLabel =
    match.status === 'FINISHED'
      ? 'Finished'
      : match.turnTimerPaused
        ? 'Clock paused'
        : yourTurn
          ? 'Your turn'
          : "Opponent's turn";
  const statusText =
    outcome === 'win'
      ? 'You won'
      : outcome === 'loss'
        ? 'You lost'
        : outcome === 'draw'
          ? 'Draw'
          : yourTurn
            ? 'Your move'
            : match.currentTurn
              ? `${opponent?.displayName ?? 'Opponent'} to move`
              : 'Waiting';

  return (
    <Page className="flex min-h-[var(--app-vh)] flex-col pb-[calc(env(safe-area-inset-bottom)+20px)]">
      <GameHeader
        onBack={() => navigate('/')}
        onResign={() => setForfeitOpen(true)}
        showResign={match.status === 'ACTIVE'}
        mode={modeLabel(match.mode)}
        rated={isRatedMatch(match)}
      />

      <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <PlayerBadge
          name={you?.displayName ?? 'You'}
          photoUrl={you?.photoUrl}
          side={match.youSide}
          active={match.currentTurn === match.youSide && match.status === 'ACTIVE'}
          connected
          isYou
          isAi={false}
        />
        <div className="flex min-w-[68px] flex-col items-center text-center">
          <span
            className={cn(
              'text-xl font-bold tabular-nums tracking-tight',
              turnRemaining !== null && turnRemaining <= 5000 && yourTurn ? 'text-danger' : 'text-ink',
            )}
          >
            {clockText}
          </span>
          <span className="mt-0.5 text-[10px] font-medium text-muted">{clockLabel}</span>
        </div>
        <PlayerBadge
          name={opponent?.displayName ?? 'Opponent'}
          photoUrl={opponent?.photoUrl}
          side={opponent?.side ?? (match.youSide === 'X' ? 'O' : 'X')}
          active={match.currentTurn !== match.youSide && match.status === 'ACTIVE'}
          connected={match.opponentConnection === 'connected' || match.opponentConnection === 'not_applicable'}
          isAi={Boolean(opponent?.isAi)}
          align="right"
        />
      </div>

      {opponentDisconnected && match.status === 'ACTIVE' ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2.5">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
          <p className="text-[11px] font-medium leading-relaxed text-ink">
            Opponent disconnected. Clock paused
            {graceRemaining !== null ? ` · ${formatDuration(graceRemaining)} to reconnect` : ''}.
          </p>
        </div>
      ) : connection !== 'online' ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-line bg-elevated/60 px-3 py-2.5">
          <Timer className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <p className="text-[11px] font-medium leading-relaxed text-ink">
            {connection === 'idle' || connection === 'connecting'
              ? 'Connecting. Your board and rating are safe.'
              : 'Reconnecting. Your board and rating are safe.'}
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col justify-center py-3">
        <div className="relative">
          <Board
            board={displayBoard}
            winningLine={winningLine}
            lastMoveCell={lastMoveCell}
            yourTurn={yourTurn}
            disabled={
              pendingCell !== null ||
              match.status !== 'ACTIVE' ||
              match.currentTurn !== match.youSide ||
              connection !== 'online'
            }
            onCell={(cell) => void playCell(cell)}
          />
          {pendingCell !== null ? (
            <span className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center">
              <span className="rounded-full border border-line bg-surface/95 px-2.5 py-0.5 text-[10px] font-medium text-muted shadow-soft">
                Sending move…
              </span>
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 px-0.5">
          <p className="min-w-0 truncate text-sm font-medium text-ink">{statusText}</p>
          <p className="shrink-0 text-[11px] font-medium text-muted">Turn {match.turnNumber}</p>
        </div>
        <p className="mt-1 px-0.5 text-[10px] leading-relaxed text-muted">
          {isRatedMatch(match) ? 'Rated game' : 'Unrated practice'} · moves verified by the server · leaving does not
          forfeit
        </p>
      </div>

      <GameResult
        match={match}
        open={match.status === 'FINISHED'}
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
    </Page>
  );
}

function GameHeader({
  onBack,
  onResign,
  showResign,
  mode,
  rated,
}: {
  onBack: () => void;
  onResign?: () => void;
  showResign: boolean;
  mode?: string;
  rated?: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pb-5 pt-1">
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
      {showResign && onResign ? (
        <IconButton label="Resign game" tone="danger" onClick={onResign}>
          <Flag className="h-4 w-4" aria-hidden />
        </IconButton>
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
              'flex h-9 w-9 items-center justify-center rounded-full',
              active ? 'bg-accent/10 text-accent ring-2 ring-accent/30' : 'bg-elevated text-muted',
            )}
          >
            <Bot className="h-4 w-4" aria-hidden />
          </span>
        ) : (
          <Avatar name={name} photoUrl={photoUrl} size="sm" ring={active} />
        )}
        {!isAi ? (
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-app',
              connected ? 'bg-success' : 'bg-muted',
            )}
            aria-label={connected ? 'Connected' : 'Disconnected'}
          />
        ) : null}
      </div>
      <div className="min-w-0">
        <p className={cn('truncate text-xs font-semibold', active ? 'text-accent' : 'text-ink')}>
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
