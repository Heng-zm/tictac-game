import { useCallback, useEffect, useState } from 'react';
import { Crown, Medal, RefreshCw, Sparkles, Trophy, UserRound } from 'lucide-react';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage, fetchLeaderboard } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, EmptyState, IconButton, Pill, ScreenHeader, Skeleton } from '../components/ui';
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
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      setData(await fetchLeaderboard(50));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentInList = Boolean(data?.entries.some((entry) => entry.isYou));

  return (
    <Page withNav>
      <ScreenHeader
        title="Leaderboard"
        subtitle="The sharpest marks on the board"
        eyebrow="Ladder"
        action={
          <IconButton label="Refresh leaderboard" onClick={() => void load(false)}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          </IconButton>
        }
      />

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
                  <p className="text-[11px] font-bold uppercase tracking-wide text-accent">Your position</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-ink">
                      {data.currentUserRank ? `Rank #${data.currentUserRank}` : 'Unranked'} · {profile.stats.rating} rating
                    </p>
                    <Pill tone="accent">{profile.stats.ratingGames} rated</Pill>
                  </div>
                </div>
              </div>
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
            <div className="space-y-2">
              {data.entries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </div>
          )}

          <div className="mt-3 flex items-start gap-2 rounded-2xl border border-line bg-elevated/40 p-3 text-[11px] leading-relaxed text-muted">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
            <p>
              Rankings use ladder rating from rated human matches only. Wins add 20, draws add 5, and losses subtract
              10. Bot games and abandoned games never change your rating.
            </p>
          </div>
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
    <Card
      className={cn(
        'flex items-center gap-3 p-3',
        entry.isYou && 'border-accent/40 bg-accent/5 ring-1 ring-accent/20',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-black tabular-nums',
          rankTone,
        )}
        aria-label={`Rank ${entry.rank}`}
      >
        {entry.rank <= 3 ? <Medal className="h-4 w-4" aria-hidden /> : entry.rank}
      </span>

      <Avatar name={entry.displayName} photoUrl={entry.photoUrl} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold text-ink">{entry.displayName}</p>
          {entry.isYou ? <Pill tone="accent">You</Pill> : null}
        </div>
        <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
          {entry.username ? `@${entry.username}` : 'Player'} · {entry.wins}W {entry.draws}D {entry.losses}L
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-base font-black tabular-nums text-ink">{entry.rating}</p>
        <p className="text-[9px] font-bold uppercase tracking-wide text-muted">{entry.ratedGames} rated</p>
      </div>
    </Card>
  );
}
