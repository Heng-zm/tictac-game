import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Clock3, RefreshCw, Search, UserPlus, Users, WifiOff, X } from 'lucide-react';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { formatDuration, useCountdown, useElapsed } from '../hooks/use-time';
import { Button, Card, Pill, ScreenHeader, Toggle } from '../components/ui';
import { Page } from '../components/Layout';

export function MatchmakingScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const { profile, config, connection, queue, match, pendingInvite, joinQueue } = client;
  const [autoFallback, setAutoFallback] = useState(profile?.stats ? profile.autoAiFallback : false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [fallbackDismissed, setFallbackDismissed] = useState(false);
  const autoJoined = useRef(false);
  const autoFallbackRequest = useRef(0);

  const activeMatch = match?.status === 'ACTIVE' ? match : null;
  const busy = Boolean(activeMatch || pendingInvite);
  const elapsed = useElapsed(startedAt);
  const fallbackRemaining = useCountdown(queue?.fallbackAt ?? null, undefined, client.clockOffsetMs);
  const maxWaitMs = config?.queueMaxWaitMs ?? 0;
  const searchProgress = maxWaitMs > 0 ? Math.min(1, elapsed / maxWaitMs) : 0;
  const timeLeftLabel =
    autoFallback && fallbackRemaining !== null
      ? fallbackRemaining <= 0
        ? 'Bot ready'
        : `Bot in ${formatDuration(fallbackRemaining)}`
      : `Up to ${formatDuration(Math.max(0, maxWaitMs - elapsed))}`;
  const connectionLost =
    connection === 'reconnecting' || connection === 'offline' || connection === 'shutdown';

  const joinNow = useCallback(
    async (fallback = autoFallback) => {
      setJoining(true);
      setLocalError(null);
      try {
        const status = await joinQueue(fallback);
        setStartedAt(Date.now());
        if (status.state === 'searching') autoJoined.current = true;
      } catch (error) {
        autoJoined.current = false;
        setLocalError(errorMessage(error));
      } finally {
        setJoining(false);
      }
    },
    [autoFallback, joinQueue],
  );

  useEffect(() => {
    // A dropped socket removes the player from the server queue. Clear the
    // guard while offline so reconnecting starts a fresh search automatically.
    if (connection !== 'online') {
      autoJoined.current = false;
      return;
    }
    if (autoJoined.current) return;
    if (busy || queue) {
      if (queue) autoJoined.current = true;
      return;
    }
    autoJoined.current = true;
    void joinNow(autoFallback);
  }, [autoFallback, busy, connection, joinNow, queue]);

  useEffect(() => {
    if (queue?.state === 'expired' || queue?.state === 'error') setStartedAt(null);
  }, [queue?.state]);

  useEffect(() => {
    if (profile) setAutoFallback(profile.autoAiFallback);
  }, [profile?.autoAiFallback, profile]);

  async function cancelAndHome(): Promise<void> {
    await client.cancelQueue();
    navigate('/');
  }

  async function retry(): Promise<void> {
    autoJoined.current = false;
    setStartedAt(null);
    setFallbackDismissed(false);
    await joinNow(autoFallback);
  }

  async function playBot(): Promise<void> {
    try {
      await client.cancelQueue();
      const difficulty = config?.aiFallbackDifficulty ?? 'MEDIUM';
      const matchId = await client.startAi(difficulty, Math.random() < 0.5 ? 'X' : 'O');
      navigate(`/game/${matchId}`);
    } catch (error) {
      client.pushToast({ type: 'error', title: 'Could not start the bot game', message: errorMessage(error) });
    }
  }

  function inviteFriend(): void {
    // Leave the queue before generating a private invitation. Otherwise a
    // match could arrive while the invitation link is being created.
    void client.cancelQueue();
    navigate('/invite/waiting');
  }

  async function toggleAutoFallback(next: boolean): Promise<void> {
    const previous = autoFallback;
    const requestId = ++autoFallbackRequest.current;
    setAutoFallback(next);
    try {
      await client.setAutoAiFallback(next);
    } catch (error) {
      // A newer toggle owns the UI now; ignore this stale failure.
      if (autoFallbackRequest.current !== requestId) return;
      setAutoFallback(previous);
      client.pushToast({ type: 'warning', title: 'Preference not saved', message: errorMessage(error) });
      // Do not re-queue with a preference the server did not save.
      return;
    }
    // A newer toggle superseded this request; let it drive the queue update.
    if (autoFallbackRequest.current !== requestId) return;
    if (queue?.state === 'searching' && connection === 'online') {
      try {
        await client.joinQueue(next);
      } catch {
        // The queue may have just matched; the match event takes precedence.
      }
    }
  }

  const expired = queue?.state === 'expired' || queue?.state === 'error';
  const fallbackReady =
    Boolean(queue && (queue.fallbackAvailable || fallbackRemaining === 0)) && !expired && !fallbackDismissed;

  return (
    <Page width="medium">
      <ScreenHeader
        title="Quick match"
        subtitle="Rated · random opponent"
        onBack={() => void cancelAndHome()}
      />

      {activeMatch ? (
        <Card className="p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">You are already playing</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Finish your current game first</h2>
          <p className="mt-1 text-sm text-muted">Only one active game is allowed at a time.</p>
          <div className="mt-4 grid gap-2">
            <Button onClick={() => navigate(`/game/${activeMatch.id}`)}>Resume game</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Back home
            </Button>
          </div>
        </Card>
      ) : pendingInvite ? (
        <Card className="p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Invitation pending</p>
          <h2 className="mt-2 text-xl font-bold text-ink">A friend is on the way</h2>
          <p className="mt-1 text-sm text-muted">Cancel your invitation before searching for a random game.</p>
          <div className="mt-4 grid gap-2">
            <Button onClick={() => navigate('/invite/waiting')}>View invitation</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Back home
            </Button>
          </div>
        </Card>
      ) : expired ? (
        <Card className="overflow-hidden p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <Clock3 className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-3 text-xl font-bold tracking-tight text-ink">
            {queue?.state === 'error' ? 'Search interrupted' : 'No one in the queue'}
          </h2>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted">
            {queue?.message ?? 'Nobody showed up in time. Try the queue again or play the bot.'}
          </p>
          <div className="mt-5 grid gap-2">
            <Button icon={RefreshCw} loading={joining} onClick={() => void retry()}>
              Search again
            </Button>
            <Button variant="secondary" icon={Bot} onClick={() => void playBot()}>
              Play the {config?.aiFallbackDifficulty.toLowerCase() ?? 'medium'} bot
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Back home
            </Button>
          </div>
        </Card>
      ) : connectionLost ? (
        <Card className="p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <WifiOff className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-3 text-xl font-bold text-ink">Connection lost</h2>
          <p className="mt-1 text-sm text-muted">
            Your queue spot was released. Reconnect and start a fresh search — your rating is safe.
          </p>
          <div className="mt-5 grid gap-2">
            <Button icon={RefreshCw} onClick={client.reconnect}>
              Reconnect
            </Button>
            <Button variant="ghost" onClick={() => navigate('/')}>
              Back home
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="md:grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:items-start md:gap-3">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/5 blur-2xl" aria-hidden />
            <div className="relative mx-auto flex h-32 w-32 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-accent/20 bg-accent/5 animate-pulse-ring" />
              <span
                className="absolute inset-0 rounded-full border border-accent/15 bg-accent/5 animate-pulse-ring"
                style={{ animationDelay: '0.7s' }}
              />
              <span
                className="absolute inset-0 rounded-full border border-accent/10 bg-accent/5 animate-pulse-ring"
                style={{ animationDelay: '1.4s' }}
              />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 text-accent shadow-glow/30 backdrop-blur-xs">
                <Search className="h-7 w-7" aria-hidden />
              </span>
            </div>

            <div className="mt-4 text-center">
              <h2 aria-live="polite" className="text-xl font-bold tracking-tight text-ink">
                {queue ? 'Finding an opponent' : 'Joining the queue'}
              </h2>
              <div className="mt-1.5 flex items-center justify-center gap-2 text-sm text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                </span>
                <span>{joining ? 'Connecting to matchmaking…' : `Searching for ${formatDuration(elapsed)}`}</span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Pill tone="accent">
                  <Users className="h-3 w-3" aria-hidden />
                  {queue?.waitingPlayers ?? 1} in queue
                </Pill>
                <Pill>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {timeLeftLabel}
                </Pill>
              </div>
              <div
                role="progressbar"
                aria-label="Matchmaking search progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(searchProgress * 100)}
                aria-valuetext={`${Math.round(searchProgress * 100)}% of the maximum wait used`}
                className="mx-auto mt-3 h-2 max-w-[14rem] overflow-hidden rounded-full bg-elevated/80 p-0.5 border border-line/40"
              >
                <div
                  className="h-full rounded-full bg-accent shadow-glow/40 transition-[width] duration-1000 ease-linear"
                  style={{ width: `${Math.round(searchProgress * 100)}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-line/60 pt-3">
                <Button size="sm" icon={Bot} variant="secondary" disabled={joining} onClick={() => void playBot()}>
                  Play Bot
                </Button>
                <Button size="sm" icon={UserPlus} variant="secondary" disabled={joining} onClick={inviteFriend}>
                  Invite friend
                </Button>
              </div>
            </div>

            {localError ? (
              <div role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-3 text-center">
                <p className="text-xs font-medium text-danger">{localError}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => void retry()}>
                  Try again
                </Button>
              </div>
            ) : null}
          </Card>

          <div className="mt-3 space-y-3 md:mt-0">
          <Card className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-ink">Auto-play a bot</p>
                  {autoFallback ? <Pill tone="accent">On</Pill> : null}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                  After {formatDuration(config?.queueAiTimeoutMs ?? 0)}, start a bot game automatically.
                </p>
              </div>
              <Toggle
                checked={autoFallback}
                onChange={(next) => void toggleAutoFallback(next)}
                label="Automatically play a bot if no human is found"
              />
            </div>
          </Card>

          {fallbackReady ? (
            <Card className="border-accent/20 bg-accent/[0.03] p-4 animate-fade-up">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">No human yet?</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    Play an unrated {config?.aiFallbackDifficulty.toLowerCase() ?? 'medium'} bot game instead. This
                    leaves the queue, so start a fresh search afterward.
                  </p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button size="sm" icon={Bot} onClick={() => void playBot()}>
                  Play bot
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setFallbackDismissed(true)}>
                  Keep waiting
                </Button>
              </div>
            </Card>
          ) : null}
          </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-2">
            <Button variant="ghost" icon={X} className="w-full max-w-xs" onClick={() => void cancelAndHome()}>
              Cancel search
            </Button>
            <p className="max-w-xs text-center text-[11px] leading-relaxed text-muted">
              Leaving the queue is free. You are only rated once a game actually begins.
            </p>
          </div>
        </>
      )}
    </Page>
  );
}
