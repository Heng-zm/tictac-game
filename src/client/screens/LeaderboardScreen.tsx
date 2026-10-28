import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Crown,
  Medal,
  RefreshCw,
  Search,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { LeaderboardEntry, LeaderboardResponse } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage, fetchLeaderboard } from '../lib/api';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, EmptyState, IconButton, Pill, ScreenHeader, Skeleton } from '../components/ui';
import { RankBadge, RankLabel, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';

type LeaderboardTab = 'all' | 'top10' | 'nearby';

export function LeaderboardScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const { profile } = client;
  const isKm = (profile?.languageCode ?? '').toLowerCase().startsWith('km');

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  const allEntries = useMemo(() => data?.entries ?? [], [data?.entries]);
  const currentInList = Boolean(allEntries.some((entry) => entry.isYou));
  const userRating = profile?.stats.rating ?? 1200;

  // Filter entries based on active tab and search query
  const filteredEntries = useMemo(() => {
    let list = allEntries;

    // Apply tab filter
    if (activeTab === 'top10') {
      list = list.slice(0, 10);
    } else if (activeTab === 'nearby') {
      // Find players close to user's rank or rating
      const youIndex = list.findIndex((e) => e.isYou);
      if (youIndex >= 0) {
        const start = Math.max(0, youIndex - 4);
        const end = Math.min(list.length, youIndex + 5);
        list = list.slice(start, end);
      } else {
        // Find players close to user rating
        list = [...list].sort(
          (a, b) => Math.abs(a.rating - userRating) - Math.abs(b.rating - userRating),
        ).slice(0, 8).sort((a, b) => a.rank - b.rank);
      }
    }

    // Apply search filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (entry) =>
          entry.displayName.toLowerCase().includes(query) ||
          (entry.username && entry.username.toLowerCase().includes(query)),
      );
    }

    return list;
  }, [allEntries, activeTab, searchQuery, userRating]);

  // Top 3 Podium entries (only shown when in 'all' or 'top10' tab with no search filter)
  const showPodium =
    (activeTab === 'all' || activeTab === 'top10') &&
    searchQuery.trim().length === 0 &&
    allEntries.length >= 3;

  const podiumEntries = showPodium ? allEntries.slice(0, 3) : [];
  const listEntries = showPodium ? filteredEntries.slice(3) : filteredEntries;

  const currentPosition = data?.currentUserRank
    ? isKm
      ? `ចំណាត់ថ្នាក់ #${data.currentUserRank}`
      : `Rank #${data.currentUserRank}`
    : (profile?.stats.ratingGames ?? 0) === 0
      ? isKm
        ? 'បណ្តោះអាសន្ន'
        : 'Provisional'
      : isKm
        ? 'ក្រៅកំពូលទាំង 50'
        : 'Outside top 50';

  // Calculate Win Rate for user
  const userGames = (profile?.stats.wins ?? 0) + (profile?.stats.losses ?? 0) + (profile?.stats.draws ?? 0);
  const userWinRate = userGames > 0 ? Math.round(((profile?.stats.wins ?? 0) / userGames) * 100) : 0;

  return (
    <Page withNav width="medium">
      <ScreenHeader
        title={isKm ? 'តារាងពិន្ទុ' : 'Leaderboard'}
        subtitle={isKm ? 'អ្នកលេងដែលមានចំណាត់ថ្នាក់ខ្ពស់បំផុត' : 'Top rated players'}
        action={
          <IconButton
            label={refreshing ? (isKm ? 'កំពុងផ្ទុកឡើងវិញ…' : 'Refreshing leaderboard') : (isKm ? 'ផ្ទុកឡើងវិញ' : 'Refresh leaderboard')}
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
          className="mb-3.5 flex items-start gap-2.5 rounded-2xl border border-danger/25 bg-danger/10 px-3.5 py-3 text-xs text-danger shadow-soft backdrop-blur-xs"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 leading-relaxed">
            <span className="font-semibold">{isKm ? 'មិនអាចផ្ទុកតារាងពិន្ទុបានទេ។' : 'Could not refresh the ladder.'}</span> {error}
          </p>
          <button
            type="button"
            onClick={() => void load('refresh')}
            disabled={refreshing}
            className="shrink-0 self-center rounded-lg px-2.5 py-1 text-xs font-semibold underline underline-offset-2 transition hover:bg-danger/15 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
          >
            {isKm ? 'ព្យាយាមម្តងទៀត' : 'Retry'}
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-2.5">
          <Skeleton className="h-[100px] w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-[120px] rounded-2xl" />
            <Skeleton className="h-[140px] rounded-2xl" />
            <Skeleton className="h-[110px] rounded-2xl" />
          </div>
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-[72px] w-full rounded-2xl" />
          ))}
        </div>
      ) : error && !data ? (
        <Card>
          <EmptyState
            icon={Trophy}
            title={isKm ? 'តារាងពិន្ទុមិនអាចប្រើបានទេ' : 'Leaderboard unavailable'}
            description={error}
            action={
              <Button size="sm" icon={RefreshCw} onClick={() => void load()}>
                {isKm ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
              </Button>
            }
          />
        </Card>
      ) : data ? (
        <>
          {/* Your Position Banner Card */}
          {!currentInList && profile ? (
            <Card className="relative mb-3.5 overflow-hidden border-accent/30 bg-gradient-to-br from-accent/15 via-accent/5 to-surface p-4 shadow-sm">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-xl" aria-hidden />
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-sm shadow-accent/25">
                  <UserRound className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
                      {isKm ? 'ចំណាត់ថ្នាក់របស់អ្នក' : 'Your position'}
                    </p>
                    {userGames > 0 ? (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                        {userWinRate}% {isKm ? 'ឈ្នះ' : 'Win Rate'}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-ink">
                      {currentPosition} · {profile.stats.rating} {isKm ? 'ពិន្ទុ' : 'rating'}
                    </p>
                    <RankBadge rating={profile.stats.rating} />
                    <Pill tone="accent">{profile.stats.ratingGames} {isKm ? 'ប្រកួត' : 'rated'}</Pill>
                  </div>
                </div>
              </div>
              <RankProgress rating={profile.stats.rating} className="mt-3" />
            </Card>
          ) : null}

          {/* Filter Tabs & Search Bar */}
          {allEntries.length > 0 ? (
            <div className="mb-3 space-y-2.5">
              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                    activeTab === 'all'
                      ? 'bg-accent text-accent-ink shadow-sm'
                      : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-ink',
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" aria-hidden />
                  <span>{isKm ? 'ទាំងអស់ (50)' : 'Top 50'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('top10')}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                    activeTab === 'top10'
                      ? 'bg-accent text-accent-ink shadow-sm'
                      : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-ink',
                  )}
                >
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                  <span>{isKm ? 'កំពូលទាំង 10' : 'Top 10'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('nearby')}
                  className={cn(
                    'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95',
                    activeTab === 'nearby'
                      ? 'bg-accent text-accent-ink shadow-sm'
                      : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-ink',
                  )}
                >
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  <span>{isKm ? 'ក្បែរអ្នក' : 'Nearby You'}</span>
                </button>
              </div>

              {/* Search input */}
              <div className="relative flex items-center">
                <Search className="pointer-events-none absolute left-3.5 h-3.5 w-3.5 text-muted" aria-hidden />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isKm ? 'ស្វែងរកអ្នកលេង…' : 'Search player…'}
                  aria-label={isKm ? 'ស្វែងរកអ្នកលេង' : 'Search player'}
                  className="h-9 w-full rounded-full border border-line bg-elevated/60 pl-9 pr-8 text-xs text-ink placeholder:text-muted transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 flex h-5 w-5 items-center justify-center rounded-full text-muted hover:text-ink"
                    aria-label={isKm ? 'សម្អាតការស្វែងរក' : 'Clear search'}
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Championship Podium for Top 3 */}
          {showPodium && podiumEntries.length === 3 ? (
            <div className="mb-4 pt-2">
              <div className="grid grid-cols-3 items-end gap-2 px-1">
                {/* 2nd Place (Silver) */}
                <PodiumCard entry={podiumEntries[1]!} place={2} isKm={isKm} />

                {/* 1st Place (Gold Champion) */}
                <PodiumCard entry={podiumEntries[0]!} place={1} isKm={isKm} />

                {/* 3rd Place (Bronze) */}
                <PodiumCard entry={podiumEntries[2]!} place={3} isKm={isKm} />
              </div>
            </div>
          ) : null}

          {/* Ladder Rows */}
          {allEntries.length === 0 ? (
            <Card>
              <EmptyState
                icon={Crown}
                title={isKm ? 'តារាងពិន្ទុនៅទំនេរ' : 'The ladder is wide open'}
                description={
                  isKm
                    ? 'មិនទាន់មានការប្រកួតដែលបានបញ្ចប់នៅឡើយទេ។ លេងការប្រកួតដើម្បីទទួលបានចំណាត់ថ្នាក់ដំបូង។'
                    : 'No rated games have finished yet. Play an online or friend match to claim the first spot.'
                }
                action={<Button onClick={() => navigate('/search')}>{isKm ? 'ស្វែងរកការប្រកួត' : 'Find a match'}</Button>}
              />
            </Card>
          ) : filteredEntries.length === 0 ? (
            <Card>
              <EmptyState
                icon={Search}
                title={isKm ? 'រកមិនឃើញអ្នកលេងទេ' : 'No players found'}
                description={
                  isKm
                    ? `គ្មានអ្នកលេងដែលត្រូវគ្នានឹង "${searchQuery}" ឡើយ។`
                    : `No players matched "${searchQuery}".`
                }
                action={
                  <Button size="sm" variant="secondary" onClick={() => setSearchQuery('')}>
                    {isKm ? 'សម្អាតការស្វែងរក' : 'Clear search'}
                  </Button>
                }
              />
            </Card>
          ) : (
            <Card className="divide-y divide-line overflow-hidden shadow-soft">
              {listEntries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} isKm={isKm} />
              ))}
            </Card>
          )}

          {/* Footnote about ranking mechanics */}
          <p className="mt-4 px-4 text-center text-[11px] leading-relaxed text-muted">
            {isKm
              ? 'ចំណាត់ថ្នាក់ប្រើកម្រិតពិន្ទុពីការប្រកួតរវាងមនុស្សប៉ុណ្ណោះ។ ឈ្នះ +20, ចាញ់ -20, ហើយការស្មើមិនផ្លាស់ប្តូរពិន្ទុទេ។ ការលេងជាមួយ Bot ឬការចាកចេញមិនប៉ះពាល់ដល់ពិន្ទុឡើយ។'
              : 'Rankings use ladder rating from rated human matches only. Wins add 20, losses subtract 20, and draws do not change rating. Bot and abandoned games never change your rating.'}
          </p>
        </>
      ) : null}
    </Page>
  );
}

function PodiumCard({
  entry,
  place,
  isKm,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  isKm: boolean;
}) {
  const isRank1 = place === 1;
  const isRank2 = place === 2;

  const totalGames = entry.wins + entry.losses + entry.draws;
  const winRate = totalGames > 0 ? Math.round((entry.wins / totalGames) * 100) : 0;

  const cardStyle = isRank1
    ? 'border-amber-500/40 bg-gradient-to-b from-amber-500/15 via-amber-500/5 to-surface shadow-[0_0_24px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
    : isRank2
      ? 'border-slate-400/35 bg-gradient-to-b from-slate-400/15 via-slate-400/5 to-surface'
      : 'border-amber-700/35 bg-gradient-to-b from-amber-700/15 via-amber-700/5 to-surface';

  const badgeColor = isRank1
    ? 'bg-amber-500 text-amber-950 shadow-glow-gold'
    : isRank2
      ? 'bg-slate-300 text-slate-900 dark:bg-slate-400'
      : 'bg-amber-700 text-amber-100';

  const avatarRing = isRank1
    ? 'ring-2 ring-amber-400 shadow-glow-gold'
    : isRank2
      ? 'ring-2 ring-slate-400'
      : 'ring-2 ring-amber-700';

  return (
    <div
      className={cn(
        'relative flex flex-col items-center rounded-2xl border p-2.5 text-center transition-transform hover:-translate-y-0.5',
        cardStyle,
        isRank1 ? 'pb-3.5 pt-3' : 'pb-2.5 pt-2',
      )}
    >
      {/* Crown / Trophy icon for champion */}
      {isRank1 ? (
        <span className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/20 text-amber-500 animate-bounce">
          <Crown className="h-4 w-4" aria-hidden />
        </span>
      ) : isRank2 ? (
        <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-400/20 text-slate-400">
          <Medal className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : (
        <span className="mb-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-700/20 text-amber-600 dark:text-amber-400">
          <Award className="h-3.5 w-3.5" aria-hidden />
        </span>
      )}

      {/* Avatar with medal ring */}
      <div className={cn('relative rounded-full', avatarRing)}>
        <Avatar name={entry.displayName} photoUrl={entry.photoUrl} size={isRank1 ? 'md' : 'sm'} />
        {entry.isYou ? (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-1.5 py-0.2 text-[8px] font-bold text-accent-ink ring-1 ring-surface">
            YOU
          </span>
        ) : null}
      </div>

      {/* Display name */}
      <p className="mt-1.5 w-full truncate text-xs font-bold text-ink">
        {entry.displayName}
      </p>

      {/* Rating */}
      <p className="tabular-nums text-xs font-extrabold text-ink">
        {entry.rating}
      </p>

      {/* Win rate pill */}
      <span className="mt-0.5 text-[9.5px] font-medium text-muted">
        {winRate}% {isKm ? 'ឈ្នះ' : 'win'}
      </span>

      {/* Place Pedestal Tag */}
      <div className={cn('mt-2 flex h-6 w-full items-center justify-center rounded-lg text-[10.5px] font-black', badgeColor)}>
        #{place}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  isKm,
}: {
  entry: LeaderboardEntry;
  isKm: boolean;
}) {
  const isRank1 = entry.rank === 1;
  const isRank2 = entry.rank === 2;
  const isRank3 = entry.rank === 3;

  const totalGames = entry.wins + entry.losses + entry.draws;
  const winRate = totalGames > 0 ? Math.round((entry.wins / totalGames) * 100) : 0;

  const rankBadgeStyle = isRank1
    ? 'border-amber-500/50 bg-amber-500/20 text-amber-500 shadow-glow-gold'
    : isRank2
      ? 'border-slate-400/50 bg-slate-400/20 text-slate-600 dark:text-slate-300'
      : isRank3
        ? 'border-amber-700/50 bg-amber-700/20 text-amber-600 dark:text-amber-400'
        : entry.rank <= 10
          ? 'border-accent/40 bg-accent/10 text-accent font-extrabold'
          : 'border-line bg-elevated/70 text-muted';

  const rowHighlight = isRank1
    ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/[0.03] to-transparent'
    : isRank2
      ? 'bg-gradient-to-r from-slate-400/10 via-slate-400/[0.02] to-transparent'
      : isRank3
        ? 'bg-gradient-to-r from-amber-700/10 via-orange-600/[0.02] to-transparent'
        : entry.isYou
          ? 'border-l-accent bg-accent/10'
          : '';

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-l-2 border-l-transparent px-3.5 py-3 transition-colors hover:bg-elevated/40 sm:px-5 sm:py-3.5',
        rowHighlight,
      )}
    >
      <span
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border text-xs font-bold tabular-nums',
          rankBadgeStyle,
        )}
        aria-label={`Rank ${entry.rank}`}
      >
        {isRank1 ? (
          <Crown className="h-4 w-4" aria-hidden />
        ) : entry.rank <= 3 ? (
          <Medal className="h-3.5 w-3.5" aria-hidden />
        ) : (
          entry.rank
        )}
      </span>

      <Avatar name={entry.displayName} photoUrl={entry.photoUrl} size="sm" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-ink">{entry.displayName}</p>
          {entry.isYou ? <Pill tone="accent">{isKm ? 'អ្នក' : 'You'}</Pill> : null}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted">
          <span className="truncate">
            {entry.username ? `@${entry.username}` : (isKm ? 'អ្នកលេង' : 'Player')}
          </span>
          <span>·</span>
          <span className="tabular-nums">
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{entry.wins}W</span>{' '}
            <span className="text-muted">{entry.draws}D</span>{' '}
            <span className="text-rose-500 dark:text-rose-400">{entry.losses}L</span>
          </span>
          <span>·</span>
          <span className="font-medium text-accent">
            {winRate}% {isKm ? 'ឈ្នះ' : 'win'}
          </span>
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-ink">{entry.rating}</p>
        <p className="mt-0.5 whitespace-nowrap text-[10px] text-muted">
          <RankLabel rating={entry.rating} /> · {entry.ratedGames} {isKm ? 'ប្រកួត' : 'rated'}
        </p>
      </div>
    </div>
  );
}
