import { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Clock3, RefreshCw, Search, Users, WifiOff, X } from 'lucide-react';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { formatDuration, useCountdown, useElapsed } from '../hooks/use-time';
import { Button, Card, Pill, ScreenHeader, Toggle } from '../components/ui';
import { Page } from '../components/Layout';
import { cn } from '../lib/cn';

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

  const activeMatch = match?.status === 'ACTIVE' ? match : null;
  const busy = Boolean(activeMatch || pendingInvite);
  const elapsed = useElapsed(startedAt);
  const fallbackRemaining = useCountdown(queue?.fallbackAt ?? null);
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

  async function toggleAutoFallback(next: boolean): Promise<void> {
    setAutoFallback(next);
    try {
      await client.setAutoAiFallback(next);
    } catch (error) {
      client.pushToast({ type: 'warning', title: 'Preference not saved', message: errorMessage(error) });
    }
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
    <Page>
      <ScreenHeader
        title="Random match"
        subtitle="Server-matched with another player"
        onBack={() => void cancelAndHome()}
        action={<Pill tone="accent">Rated</Pill>}
      />

      {activeMatch ? (
        <Card className="p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">You are already playing</p>
          <h2 className="mt-2 text-2xl font-black text-ink">Finish your current game first</h2>
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
          <h2 className="mt-2 text-2xl font-black text-ink">A friend is on the way</h2>
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-500/10 text-amber-500">
            <Clock3 className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-ink">
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
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-danger/10 text-danger">
            <WifiOff className="h-8 w-8" aria-hidden />
          </div>
          <h2 className="mt-3 text-2xl font-black text-ink">Connection lost</h2>
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
          <Card className="relative overflow-hidden p-5">
            <div className="relative mx-auto flex h-44 w-44 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-accent/15" />
              <span className="absolute inset-5 rounded-full border border-accent/20" />
              <span className="absolute inset-10 rounded-full border border-accent/25" />
              <span className="absolute inset-3 rounded-full bg-accent/5 animate-pulse-ring" />
              <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink shadow-soft">
                <Search className="h-9 w-9" aria-hidden />
              </span>
              <span className="absolute left-3 top-8 flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-sm font-black text-danger shadow-soft">
                O
              </span>
              <span className="absolute bottom-8 right-3 flex h-8 w-8 items-center justify-center rounded-xl border border-line bg-surface text-sm font-black text-accent shadow-soft">
                X
              </span>
            </div>

            <div className="mt-2 text-center">
              <h2 className="text-2xl font-black tracking-tight text-ink">
                {queue ? 'Scanning the board…' : 'Joining the queue…'}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {joining ? 'Finding a fair match' : `Searching for ${formatDuration(elapsed)}`}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Pill tone="accent">
                  <Users className="h-3 w-3" aria-hidden />
                  {queue?.waitingPlayers ?? 1} searching
                </Pill>
                <Pill>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {formatDuration(Math.max(0, (config?.queueMaxWaitMs ?? 0) - elapsed))} max
                </Pill>
              </div>
            </div>

            {localError ? (
              <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center">
                <p className="text-xs font-medium text-danger">{localError}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => void retry()}>
                  Try again
                </Button>
              </div>
            ) : null}

            <div className="mt-5 border-t border-line pt-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Auto-play a bot</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    After {formatDuration(config?.queueAiTimeoutMs ?? 0)}, start a bot match automatically.
                  </p>
                </div>
                <Toggle
                  checked={autoFallback}
                  onChange={(next) => void toggleAutoFallback(next)}
                  label="Automatically play a bot if no human is found"
                />
              </div>
            </div>
          </Card>

          {fallbackReady ? (
            <Card className="mt-3 border-accent/25 bg-accent/5 p-4 animate-fade-up">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <Bot className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-ink">No human yet?</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    Jump into an unrated {config?.aiFallbackDifficulty.toLowerCase() ?? 'medium'} bot game without losing your
                    place in line.
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

          <div className="mt-3 flex flex-col items-center gap-2">
            <Button
              variant="ghost"
              icon={X}
              className={cn('w-full max-w-xs')}
              onClick={() => void cancelAndHome()}
            >
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
