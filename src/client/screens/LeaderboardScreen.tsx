import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Crown, Medal, RefreshCw, Trophy, UserRound } from 'lucide-react';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage, fetchLeaderboard } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, EmptyState, IconButton, Pill, ScreenHeader, Skeleton } from '../components/ui';
import { RankBadge, RankLabel, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';

export function LeaderboardScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const { profile } = client;
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      setData(await fetchLeaderboard(50));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load('initial');
  }, [load]);

  const currentInList = Boolean(data?.entries.some((entry) => entry.isYou));
  const currentPosition = data?.currentUserRank
    ? `Rank #${data.currentUserRank}`
    : (profile?.stats.ratingGames ?? 0) === 0
      ? 'Provisional'
      : 'Outside top 50';

  return (
    <Page withNav width="medium">
      <ScreenHeader
        title="Leaderboard"
        subtitle="Top rated players"
        action={
          <IconButton
            label={refreshing ? 'Refreshing leaderboard' : 'Refresh leaderboard'}
            onClick={() => void load('refresh')}
            disabled={loading || refreshing}
            aria-busy={refreshing || undefined}
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
          </IconButton>
        }
      />

      {error && data ? (
        <div
          role="alert"
          className="mb-3 flex items-start gap-2.5 rounded-xl border border-danger/25 bg-danger/10 px-3 py-2.5 text-xs text-danger"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-semibold">Could not refresh the ladder.</span> {error}
          </p>
          <button
            type="button"
            onClick={() => void load('refresh')}
            disabled={refreshing}
            className="shrink-0 self-center rounded-lg px-2 py-1 font-semibold underline underline-offset-2 transition hover:bg-danger/10 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, index) => (
            <Skeleton key={index} className="h-[70px] w-full" />
          ))}
        </div>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title="Leaderboard unavailable"
            description={error}
            action={
              <Button size="sm" icon={RefreshCw} onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        </Card>
      ) : data ? (
        <>
          {!currentInList && profile ? (
            <Card className="mb-3 border-accent/25 bg-accent/5 p-3.5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/15 text-accent">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">Your position</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-ink">
                      {currentPosition} · {profile.stats.rating} rating
                    </p>
                    <RankBadge rating={profile.stats.rating} />
                    <Pill tone="accent">{profile.stats.ratingGames} rated</Pill>
                  </div>
                </div>
              </div>
              <RankProgress rating={profile.stats.rating} className="mt-3" />
            </Card>
          ) : null}

          {data.entries.length === 0 ? (
            <Card>
              <EmptyState
                icon={Crown}
                title="The ladder is wide open"
                description="No rated games have finished yet. Play an online or friend match to claim the first spot."
                action={<Button onClick={() => navigate('/search')}>Find a match</Button>}
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {data.entries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </Card>
          )}

          <p className="mt-4 px-4 text-center text-[11px] leading-relaxed text-muted">
            Rankings use ladder rating from rated human matches only. Wins add 20, draws add 5, and losses subtract 10.
            Bot and abandoned games never change your rating.
          </p>
        </>
      ) : null}
    </Page>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  const rankTone =
    entry.rank === 1
      ? 'border-amber-500/35 bg-amber-500/15 text-amber-600 dark:text-amber-400'
      : entry.rank === 2
        ? 'border-slate-400/35 bg-slate-400/15 text-slate-600 dark:text-slate-300'
        : entry.rank === 3
          ? 'border-orange-500/35 bg-orange-500/15 text-orange-600 dark:text-orange-400'
          : 'border-line bg-elevated text-muted';

  return (
    <div className={cn('flex items-center gap-3 px-3.5 py-3 sm:px-5 sm:py-3.5', entry.isYou && 'bg-accent/5')}>
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums',
          rankTone,
        )}
        aria-label={`Rank ${entry.rank}`}
      >
        {entry.rank <= 3 ? <Medal className="h-3.5 w-3.5" aria-hidden /> : entry.rank}
      </span>

      <Avatar name={entry.displayName} photoUrl={entry.photoUrl} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-ink">{entry.displayName}</p>
          {entry.isYou ? <Pill tone="accent">You</Pill> : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] text-muted">
          {entry.username ? `@${entry.username}` : 'Player'} · {entry.wins}W {entry.draws}D {entry.losses}L
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-ink">{entry.rating}</p>
        <p className="mt-0.5 whitespace-nowrap text-[10px] text-muted">
          <RankLabel rating={entry.rating} /> · {entry.ratedGames} rated
        </p>
      </div>
    </div>
  );
}
