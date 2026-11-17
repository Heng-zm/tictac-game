import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  Check,
  Clock3,
  RefreshCw,
  Search,
  Swords,
  UserPlus,
  Users,
  WifiOff,
  X,
} from 'lucide-react';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { formatDuration, useCountdown, useElapsed } from '../hooks/use-time';
import { isKhmer } from '../lib/language';
import { hapticImpact, hapticSelection } from '../lib/telegram';
import { Avatar, Button, Card, Pill, ScreenHeader, Toggle } from '../components/ui';
import { Page } from '../components/Layout';

export function MatchmakingScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const { profile, config, connection, queue, match, pendingInvite, joinQueue } = client;
  const isKm = isKhmer(profile?.languageCode);

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
  const fallbackWaitMs = config?.queueAiTimeoutMs ?? 0;
  // When auto-play is armed the wait actually ends at the bot countdown, not at
  // the (much longer) queue limit, so the bar has to fill towards that instead.
  // Otherwise it sits near 0% for the whole 10 seconds and then jumps straight
  // to the fallback offer.
  const botFallbackProgress =
    autoFallback && fallbackRemaining !== null && fallbackWaitMs > 0
      ? Math.min(1, Math.max(0, 1 - fallbackRemaining / fallbackWaitMs))
      : null;
  const searchProgress =
    botFallbackProgress ?? (maxWaitMs > 0 ? Math.min(1, elapsed / maxWaitMs) : 0);

  const timeLeftLabel =
    autoFallback && fallbackRemaining !== null
      ? fallbackRemaining <= 0
        ? isKm ? 'Bot រួចរាល់' : 'Bot ready'
        : isKm ? `Bot ក្នុង ${formatDuration(fallbackRemaining)}` : `Bot in ${formatDuration(fallbackRemaining)}`
      : isKm
        ? `រហូតដល់ ${formatDuration(Math.max(0, maxWaitMs - elapsed))}`
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
      if (queue) {
        autoJoined.current = true;
        // Re-entering /search while a search is already live used to render
        // 0:00 and 0% progress. The server knows how long the queue has been
        // waiting, so seed the local start time from it.
        setStartedAt((current) => current ?? Date.now() - Math.max(0, queue.elapsedMs));
      }
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
    try {
      hapticImpact('light');
    } catch {
      // ignore
    }
    await client.cancelQueue();
    navigate('/');
  }

  async function retry(): Promise<void> {
    try {
      hapticSelection();
    } catch {
      // ignore
    }
    autoJoined.current = false;
    setStartedAt(null);
    setFallbackDismissed(false);
    await joinNow(autoFallback);
  }

  async function playBot(): Promise<void> {
    try {
      hapticSelection();
    } catch {
      // ignore
    }
    try {
      await client.cancelQueue();
      const difficulty = config?.aiFallbackDifficulty ?? 'MEDIUM';
      const matchId = await client.startAi(difficulty, Math.random() < 0.5 ? 'X' : 'O');
      navigate(`/game/${matchId}`);
    } catch (error) {
      client.pushToast({
        type: 'error',
        title: isKm ? 'មិនអាចចាប់ផ្តើមហ្គេមជាមួយ Bot បានទេ' : 'Could not start the bot game',
        message: errorMessage(error),
      });
    }
  }

  function inviteFriend(): void {
    try {
      hapticSelection();
    } catch {
      // ignore
    }
    // Leave the queue before generating a private invitation. Otherwise a
    // match could arrive while the invitation link is being created.
    void client.cancelQueue();
    navigate('/invite/waiting');
  }

  async function toggleAutoFallback(next: boolean): Promise<void> {
    try {
      hapticSelection();
    } catch {
      // ignore
    }
    const previous = autoFallback;
    const requestId = ++autoFallbackRequest.current;
    setAutoFallback(next);
    try {
      await client.setAutoAiFallback(next);
    } catch (error) {
      // A newer toggle owns the UI now; ignore this stale failure.
      if (autoFallbackRequest.current !== requestId) return;
      setAutoFallback(previous);
      client.pushToast({
        type: 'warning',
        title: isKm ? 'មិនបានរក្សាទុកចំណូលចិត្តទេ' : 'Preference not saved',
        message: errorMessage(error),
      });
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
  const waiting = !activeMatch && !pendingInvite && !expired && !connectionLost;

  return (
    <Page width={waiting ? 'wide' : 'medium'}>
      <ScreenHeader
        title={isKm ? 'ប្រកួតរហ័ស' : 'Quick match'}
        subtitle={isKm ? 'គិតពិន្ទុ ELO · គូប្រកួតចៃដន្យ' : 'Rated · random opponent'}
        onBack={() => void cancelAndHome()}
      />

      {activeMatch ? (
        <Card className="p-4 sm:p-6 text-center shadow-glass backdrop-blur-xl animate-fade-up">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow-sm">
            <Swords className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <p className="mt-2.5 sm:mt-3 text-xs font-bold uppercase tracking-wider text-accent">
            {isKm ? 'អ្នកកំពុងមានការប្រកួតស្រាប់' : 'You are already playing'}
          </p>
          <h2 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-black text-ink">
            {isKm ? 'សូមបញ្ចប់ការប្រកួតបច្ចុប្បន្នជាមុនសិន' : 'Finish your current game first'}
          </h2>
          <p className="mt-1 sm:mt-1.5 text-xs text-muted max-w-xs mx-auto">
            {isKm ? 'អនុញ្ញាតឱ្យមានការប្រកួតសកម្មតែម្តងប៉ុណ្ណោះក្នុងពេលតែមួយ។' : 'Only one active game is allowed at a time.'}
          </p>
          <div className="mt-4 sm:mt-5 grid gap-2 sm:gap-2.5 max-w-xs mx-auto">
            <Button size="lg" className="w-full font-bold shadow-md" onClick={() => navigate(`/game/${activeMatch.id}`)}>
              {isKm ? 'បន្តការប្រកួត' : 'Resume game'}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => navigate('/')}>
              {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back home'}
            </Button>
          </div>
        </Card>
      ) : pendingInvite ? (
        <Card className="p-4 sm:p-6 text-center shadow-glass backdrop-blur-xl animate-fade-up">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-accent/15 text-accent shadow-glow-sm">
            <UserPlus className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <p className="mt-2.5 sm:mt-3 text-xs font-bold uppercase tracking-wider text-accent">
            {isKm ? 'ការអញ្ជើញកំពុងរង់ចាំ' : 'Invitation pending'}
          </p>
          <h2 className="mt-1.5 sm:mt-2 text-lg sm:text-xl font-black text-ink">
            {isKm ? 'មិត្តភក្តិកំពុងចូលរួម' : 'A friend is on the way'}
          </h2>
          <p className="mt-1 sm:mt-1.5 text-xs text-muted max-w-xs mx-auto">
            {isKm ? 'សូមបោះបង់ការអញ្ជើញរបស់អ្នក មុនពេលស្វែងរកការប្រកួតចៃដន្យ។' : 'Cancel your invitation before searching for a random game.'}
          </p>
          <div className="mt-4 sm:mt-5 grid gap-2 sm:gap-2.5 max-w-xs mx-auto">
            <Button size="lg" className="w-full font-bold shadow-md" onClick={() => navigate('/invite/waiting')}>
              {isKm ? 'មើលការអញ្ជើញ' : 'View invitation'}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => navigate('/')}>
              {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back home'}
            </Button>
          </div>
        </Card>
      ) : expired ? (
        <Card className="overflow-hidden p-4 sm:p-6 text-center shadow-glass backdrop-blur-xl animate-fade-up">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500 shadow-glow-gold">
            <Clock3 className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <h2 className="mt-2.5 sm:mt-3 text-lg sm:text-xl font-black tracking-tight text-ink">
            {queue?.state === 'error'
              ? isKm ? 'ការស្វែងរកត្រូវបានរំខាន' : 'Search interrupted'
              : isKm ? 'គ្មានអ្នកលេងក្នុងជួរទេ' : 'No one in the queue'}
          </h2>
          <p className="mx-auto mt-1 sm:mt-1.5 max-w-xs text-xs leading-relaxed text-muted">
            {queue?.message ??
              (isKm
                ? 'គ្មានអ្នកលេងបង្ហាញខ្លួនទាន់ពេលទេ។ សាកល្បងស្វែងរកម្តងទៀត ឬលេងជាមួយ Bot។'
                : 'Nobody showed up in time. Try the queue again or play the bot.')}
          </p>
          <div className="mt-4 sm:mt-5 grid gap-2 sm:gap-2.5 max-w-xs mx-auto">
            <Button icon={RefreshCw} loading={joining} size="lg" className="w-full font-bold shadow-md" onClick={() => void retry()}>
              {isKm ? 'ស្វែងរកម្តងទៀត' : 'Search again'}
            </Button>
            <Button variant="secondary" icon={Bot} size="md" className="w-full" onClick={() => void playBot()}>
              {isKm
                ? `លេងជាមួយ Bot កម្រិត ${config?.aiFallbackDifficulty.toLowerCase() ?? 'មធ្យម'}`
                : `Play the ${config?.aiFallbackDifficulty.toLowerCase() ?? 'medium'} bot`}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => navigate('/')}>
              {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back home'}
            </Button>
          </div>
        </Card>
      ) : connectionLost ? (
        <Card className="p-4 sm:p-6 text-center shadow-glass backdrop-blur-xl animate-fade-up">
          <div className="mx-auto flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-danger/15 text-danger shadow-glow-danger">
            <WifiOff className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
          </div>
          <h2 className="mt-2.5 sm:mt-3 text-lg sm:text-xl font-black text-ink">
            {isKm ? 'ការតភ្ជាប់ត្រូវបានកាត់ផ្តាច់' : 'Connection lost'}
          </h2>
          <p className="mt-1 sm:mt-1.5 text-xs text-muted max-w-xs mx-auto leading-relaxed">
            {isKm
              ? 'កន្លែងក្នុងជួររបស់អ្នកត្រូវបានបញ្ចេញ។ សូមភ្ជាប់ឡើងវិញដើម្បីស្វែងរកថ្មី — ពិន្ទុរបស់អ្នកនៅមានសុវត្ថិភាព។'
              : 'Your queue spot was released. Reconnect and start a fresh search — your rating is safe.'}
          </p>
          <div className="mt-4 sm:mt-5 grid gap-2 sm:gap-2.5 max-w-xs mx-auto">
            <Button icon={RefreshCw} size="lg" className="w-full font-bold shadow-md" onClick={client.reconnect}>
              {isKm ? 'ភ្ជាប់ឡើងវិញ' : 'Reconnect'}
            </Button>
            <Button variant="ghost" size="md" className="w-full" onClick={() => navigate('/')}>
              {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back home'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="md:flex md:min-h-[calc(var(--app-vh)-11rem)] md:flex-col md:justify-center">
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,0.82fr)] md:items-start md:gap-4">
            {/* Matchmaking Arena Card */}
            <Card className="relative overflow-hidden p-4 xs:p-5 sm:p-7 shadow-glass backdrop-blur-2xl border-line/80">
              {/* Background ambient radial aura */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 xs:h-48 xs:w-48 rounded-full bg-accent/15 blur-3xl" aria-hidden />
              <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 xs:h-48 xs:w-48 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />

              {/* Matchup Duel Stage */}
              <div className="relative mx-auto my-1 w-full max-w-sm rounded-2xl border border-line/70 bg-surface/50 p-3.5 xs:p-4 sm:p-5 shadow-glass backdrop-blur-xl">
                {/* Connecting duel energy beam in the background */}
                <div
                  className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-4 bg-gradient-to-r from-accent/30 via-accent/60 to-accent/30"
                  aria-hidden
                />

                <div className="relative flex items-center justify-between gap-2 xs:gap-3 sm:gap-4">
                  {/* Left Player: You */}
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="relative">
                      <div className="rounded-full p-0.5 bg-gradient-to-b from-accent/40 via-accent/20 to-transparent shadow-glow-sm">
                        <Avatar
                          name={profile?.firstName || (isKm ? 'អ្នក' : 'You')}
                          photoUrl={profile?.photoUrl}
                          size="lg"
                          ring
                        />
                      </div>
                      <span
                        className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-white shadow-xs ring-2 ring-surface"
                        title="You (X)"
                      >
                        ✕
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm font-bold text-ink truncate max-w-[5.25rem] sm:max-w-[6.5rem]">
                      {profile?.firstName || (isKm ? 'អ្នក' : 'You')}
                    </p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10.5px] sm:text-xs font-bold text-accent tabular-nums">
                      ⚡ {profile?.stats?.rating ?? 1200}
                    </span>
                  </div>

                  {/* Center Clash Badge & Energy Pulse */}
                  <div className="relative flex shrink-0 flex-col items-center justify-center px-1">
                    <div className="relative flex h-11 w-11 sm:h-13 sm:w-13 items-center justify-center">
                      {/* Concentric Pulse Waves */}
                      <span
                        className="absolute inset-0 rounded-full border border-accent/30 animate-pulse-ring will-change-transform"
                        style={{ transform: 'translate3d(0, 0, 0)' }}
                      />
                      <span
                        className="absolute inset-0 rounded-full border border-indigo-500/25 animate-pulse-ring will-change-transform"
                        style={{ animationDelay: '1s', transform: 'translate3d(0, 0, 0)' }}
                      />

                      {/* Glowing VS Badge */}
                      <div className="relative flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent via-blue-600 to-indigo-600 font-black text-xs sm:text-sm text-white shadow-glow tracking-wider">
                        VS
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted">
                      <Swords className="h-2.5 w-2.5 text-accent" aria-hidden />
                      <span>1v1</span>
                    </div>
                  </div>

                  {/* Right Player: Searching Opponent */}
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="relative">
                      <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-accent/40 bg-gradient-to-r from-accent/5 via-accent/20 to-accent/5 bg-[length:200%_100%] animate-shimmer shadow-inner overflow-hidden">
                        <Search className="h-6 w-6 text-accent animate-pulse-subtle" aria-hidden />
                      </div>
                      <span
                        className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface border border-line text-[10px] font-black text-muted shadow-xs ring-2 ring-surface"
                        title="Opponent (O)"
                      >
                        ◯
                      </span>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm font-bold text-ink/75 truncate max-w-[5.25rem] sm:max-w-[6.5rem]">
                      {isKm ? 'គូប្រកួត' : 'Challenger'}
                    </p>
                    <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-elevated px-2 py-0.5 text-[10.5px] sm:text-xs font-semibold text-muted tabular-nums">
                      ~{profile?.stats?.rating ?? 1200}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Header & Elapsed Timer */}
              <div className="mt-3.5 sm:mt-5 text-center">
                <h2 aria-live="polite" className="text-lg sm:text-2xl font-black tracking-tight text-ink">
                  {queue
                    ? isKm ? 'កំពុងស្វែងរកគូប្រកួត' : 'Finding an opponent'
                    : isKm ? 'កំពុងចូលរួមជួររង់ចាំ' : 'Joining the queue'}
                </h2>
                <div className="mt-1 sm:mt-1.5 flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-muted font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
                  </span>
                  <span className="tabular-nums">
                    {joining
                      ? isKm ? 'កំពុងភ្ជាប់ទៅកាន់ប្រព័ន្ធស្វែងរក…' : 'Connecting to matchmaking…'
                      : isKm ? `ស្វែងរកបាន ${formatDuration(elapsed)}` : `Searching for ${formatDuration(elapsed)}`}
                  </span>
                </div>

                {/* Status Badges */}
                <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
                  <Pill tone="accent" className="text-[10.5px] sm:text-xs py-0.5 sm:py-1 shadow-xs">
                    <Users className="h-3 w-3" aria-hidden />
                    {isKm ? `${queue?.waitingPlayers ?? 1} នាក់ក្នុងជួរ` : `${queue?.waitingPlayers ?? 1} in queue`}
                  </Pill>
                  <Pill className="text-[10.5px] sm:text-xs py-0.5 sm:py-1 tabular-nums shadow-xs">
                    <Clock3 className="h-3 w-3" aria-hidden />
                    {timeLeftLabel}
                  </Pill>
                </div>

                {/* Smooth Continuous Wait Progress Bar */}
                <div
                  role="progressbar"
                  aria-label={
                    botFallbackProgress !== null
                      ? 'Time until a bot match starts'
                      : 'Matchmaking search progress'
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(searchProgress * 100)}
                  aria-valuetext={`${Math.round(searchProgress * 100)}% of the wait completed`}
                  className="mx-auto mt-2.5 sm:mt-3 h-2 sm:h-2.5 max-w-[13rem] sm:max-w-[15rem] overflow-hidden rounded-full bg-elevated p-0.5 border border-line/70 shadow-inner"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-accent shadow-glow transition-[width] duration-1000 ease-linear"
                    style={{ width: `${Math.round(searchProgress * 100)}%` }}
                  />
                </div>

                {/* Quick Secondary Actions */}
                <div className="mx-auto mt-3 sm:mt-4 max-w-xs border-t border-line/60 pt-2.5 sm:pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      icon={Bot}
                      variant="secondary"
                      disabled={joining}
                      onClick={() => void playBot()}
                      className="font-semibold shadow-xs hover:border-accent/40 text-xs"
                    >
                      {isKm ? 'លេង Bot' : 'Play Bot'}
                    </Button>
                    <Button
                      size="sm"
                      icon={UserPlus}
                      variant="secondary"
                      disabled={joining}
                      onClick={inviteFriend}
                      className="font-semibold shadow-xs hover:border-accent/40 text-xs"
                    >
                      {isKm ? 'អញ្ជើញមិត្តភក្តិ' : 'Invite friend'}
                    </Button>
                  </div>
                </div>
              </div>

              {localError ? (
                <div role="alert" className="mt-4 rounded-xl border border-danger/20 bg-danger/5 p-3 text-center animate-shake-subtle">
                  <p className="text-xs font-semibold text-danger">{localError}</p>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => void retry()}>
                    {isKm ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
                  </Button>
                </div>
              ) : null}
            </Card>

            {/* Sidebar Cards */}
            <div className="mt-3 sm:mt-3.5 space-y-2.5 sm:space-y-3 md:mt-0">
              {/* Auto Bot Fallback Card */}
              <Card className="p-3.5 sm:p-5 shadow-glass backdrop-blur-xl border-line/80">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <p className="text-xs sm:text-sm font-bold text-ink">
                        {isKm ? 'លេងជាមួយ Bot ស្វ័យប្រវត្តិ' : 'Auto-play a bot'}
                      </p>
                      {autoFallback ? (
                        <Pill tone="accent" className="text-[9.5px] px-1.5 py-0.5">
                          {isKm ? 'បើក' : 'On'}
                        </Pill>
                      ) : null}
                    </div>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] leading-relaxed text-muted tabular-nums">
                      {isKm
                        ? `ប្រសិនគ្មានអ្នកលេងបន្ទាប់ពី ${formatDuration(config?.queueAiTimeoutMs ?? 0)} នឹងចាប់ផ្តើមជាមួយ Bot ស្វ័យប្រវត្តិ។`
                        : `After ${formatDuration(config?.queueAiTimeoutMs ?? 0)}, start a bot game automatically.`}
                    </p>
                  </div>
                  <Toggle
                    checked={autoFallback}
                    onChange={(next) => void toggleAutoFallback(next)}
                    label="Automatically play a bot if no human is found"
                  />
                </div>
              </Card>

              {/* Bot Fallback Ready Card */}
              {fallbackReady ? (
                <Card className="border-accent/30 bg-accent/[0.04] p-3.5 sm:p-5 shadow-glass backdrop-blur-xl animate-fade-up">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <span className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-accent/15 text-accent shadow-xs">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-ink">
                        {isKm ? 'មិនទាន់មានអ្នកលេង?' : 'No human yet?'}
                      </p>
                      <p className="mt-0.5 text-[10px] sm:text-[11px] leading-relaxed text-muted">
                        {isKm
                          ? `លេងការប្រកួតមិនគិតពិន្ទុជាមួយ Bot កម្រិត ${config?.aiFallbackDifficulty.toLowerCase() ?? 'មធ្យម'} ជំនួសវិញ។`
                          : `Play an unrated ${config?.aiFallbackDifficulty.toLowerCase() ?? 'medium'} bot game instead. This leaves the queue.`}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 sm:mt-3 grid grid-cols-2 gap-2">
                    <Button size="sm" icon={Bot} className="font-bold shadow-sm" onClick={() => void playBot()}>
                      {isKm ? 'លេងជាមួយ Bot' : 'Play bot'}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setFallbackDismissed(true)}>
                      {isKm ? 'រង់ចាំបន្ត' : 'Keep waiting'}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {/* Queue reassurance — desktop only. On phones the same two lines
                  live under the cancel button so the screen stays one page tall. */}
              <Card className="hidden p-4 sm:p-5 md:block shadow-glass backdrop-blur-xl border-line/80">
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    <span>{isKm ? 'ការចាកចេញពីជួរគឺឥតគិតថ្លៃ' : 'Leaving the queue is free.'}</span>
                  </li>
                  <li className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
                    <span>
                      {isKm
                        ? 'ពិន្ទុនឹងត្រូវគិតលុះត្រាតែការប្រកួតចាប់ផ្តើម'
                        : 'Your rating only moves once a game actually begins.'}
                    </span>
                  </li>
                </ul>
              </Card>
            </div>
          </div>

          {/* Cancel Search Footer */}
          <div className="mt-4 sm:mt-5 md:mt-7 flex flex-col items-center gap-1.5 sm:gap-2">
            <Button
              variant="ghost"
              icon={X}
              size="lg"
              className="w-full max-w-xs text-muted hover:text-danger hover:bg-danger/5"
              onClick={() => void cancelAndHome()}
            >
              {isKm ? 'បោះបង់ការស្វែងរក' : 'Cancel search'}
            </Button>
            <p className="max-w-xs text-center text-[9.5px] sm:text-[10.5px] leading-relaxed text-muted md:hidden">
              {isKm
                ? 'ការចាកចេញពីជួរគឺឥតគិតថ្លៃ។ ពិន្ទុនឹងត្រូវគិតលុះត្រាតែការប្រកួតចាប់ផ្តើម។'
                : 'Leaving the queue is free. You are only rated once a game actually begins.'}
            </p>
          </div>
        </div>
      )}
    </Page>
  );
}
