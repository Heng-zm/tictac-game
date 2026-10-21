import { useCallback, useEffect, useState } from 'react';
import {
  BarChart3,
  Bot,
  ChevronRight,
  Gamepad2,
  History,
  Medal,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
} from 'lucide-react';
import type { HistoryItem as HistoryRecord, MatchMode } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage, fetchHistory } from '../lib/api';
import { formatRelativeTime } from '../hooks/use-time';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, EmptyState, IconButton, Pill, ScreenHeader, Skeleton, StatTile, Toggle } from '../components/ui';
import { RankBadge, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';
import { modeShortLabel } from '../lib/game';

type ProfileTab = 'overview' | 'history' | 'settings';

const tabs: Array<{ value: ProfileTab; label: string; icon: typeof User }> = [
  { value: 'overview', label: 'Stats', icon: BarChart3 },
  { value: 'history', label: 'History', icon: History },
  { value: 'settings', label: 'Settings', icon: Settings2 },
];

export function ProfileScreen({
  client,
  navigate,
  tab,
}: {
  client: GameClient;
  navigate: (path: string) => void;
  tab: ProfileTab;
}) {
  const { profile, config } = client;

  if (!profile) return null;
  const stats = profile.stats;

  return (
    <Page withNav>
      <ScreenHeader
        title="Profile"
        subtitle="Your stats and match history"
        action={
          <IconButton label="Open leaderboard" onClick={() => navigate('/leaderboard')}>
            <Trophy className="h-4 w-4" aria-hidden />
          </IconButton>
        }
      />

      <Card className="p-4">
        <div className="flex items-center gap-3.5">
          <Avatar name={profile.firstName} photoUrl={profile.photoUrl} size="lg" ring />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold tracking-tight text-ink">
              {profile.firstName} {profile.lastName ?? ''}
            </h2>
            {profile.username ? <p className="truncate text-xs text-muted">@{profile.username}</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <RankBadge rating={stats.rating} />
              <Pill tone="accent">
                <Trophy className="h-3 w-3" aria-hidden />
                {stats.rating}
              </Pill>
              <Pill>{stats.ratingGames} rated</Pill>
            </div>
          </div>
        </div>
        <RankProgress rating={stats.rating} className="mt-4" />
        <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
          <div>
            <p className="text-base font-semibold tabular-nums text-ink">{stats.gamesPlayed}</p>
            <p className="mt-0.5 text-[10px] text-muted">Games</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums text-success">{stats.wins}</p>
            <p className="mt-0.5 text-[10px] text-muted">Wins</p>
          </div>
          <div>
            <p className="text-base font-semibold tabular-nums text-accent">{stats.winRate}%</p>
            <p className="mt-0.5 text-[10px] text-muted">Win rate</p>
          </div>
        </div>
      </Card>

      <div className="mt-5 flex border-b border-line" role="tablist" aria-label="Profile sections">
        {tabs.map((item) => {
          const Icon = item.icon;
          const selected = item.value === tab;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => navigate(item.value === 'overview' ? '/profile' : `/profile/${item.value}`)}
              className={cn(
                'relative flex flex-1 items-center justify-center gap-1.5 pb-2.5 pt-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                selected ? 'text-accent' : 'text-muted hover:text-ink',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {item.label}
              {selected ? <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-accent" /> : null}
            </button>
          );
        })}
      </div>

      {tab === 'overview' ? <OverviewTab client={client} navigate={navigate} /> : null}
      {tab === 'history' ? <HistoryTab /> : null}
      {tab === 'settings' ? <SettingsTab client={client} config={config} /> : null}
    </Page>
  );
}

function OverviewTab({ client, navigate }: { client: GameClient; navigate: (path: string) => void }) {
  const { profile, refreshProfile } = client;
  const [refreshing, setRefreshing] = useState(false);
  if (!profile) return null;
  const stats = profile.stats;

  async function refresh(): Promise<void> {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  }

  return (
    <div className="mt-4 space-y-3">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Record</h3>
          <Button size="sm" variant="ghost" icon={RefreshCw} loading={refreshing} onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <StatTile label="Wins" value={stats.wins} icon={Trophy} accent />
          <StatTile label="Losses" value={stats.losses} icon={Gamepad2} />
          <StatTile label="Draws" value={stats.draws} icon={Sparkles} />
          <StatTile label="Human games" value={stats.humanGames} icon={User} />
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Bot className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">Bot record</h3>
              <p className="text-[11px] text-muted">Unrated practice games</p>
            </div>
          </div>
          <Pill>{stats.aiGames} played</Pill>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Wins" value={stats.aiWins} />
          <StatTile label="Losses" value={stats.aiLosses} />
          <StatTile label="Draws" value={stats.aiDraws} />
        </div>
      </Card>

      <button
        type="button"
        onClick={() => navigate('/leaderboard')}
        className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition hover:bg-elevated active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500">
          <Medal className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">Ladder leaderboard</span>
          <span className="block text-[11px] text-muted">See where your rating ranks</span>
        </span>
        <ChevronRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
      </button>

      <Card className="flex items-start gap-2.5 p-3.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
        <p className="text-[11px] leading-relaxed text-muted">
          Rated human wins add 20 points, draws add 5, losses subtract 10. Abandoned or unfinished games never touch
          your rating; bot games are always unrated.
        </p>
      </Card>
    </div>
  );
}

function HistoryTab() {
  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (cursor?: string) => {
    if (cursor) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const page = await fetchHistory(15, cursor);
      setItems((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="mt-4 space-y-2">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-[74px] w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="mt-4">
        <EmptyState
          icon={History}
          title="History unavailable"
          description={error}
          action={
            <Button size="sm" icon={RefreshCw} onClick={() => void load()}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className="mt-4">
        <EmptyState
          icon={History}
          title="No games yet"
          description="Your finished matches will appear here with the mode, opponent, and result."
        />
      </Card>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <HistoryRow key={item.matchId} item={item} />
      ))}
      {nextCursor ? (
        <Button
          variant="secondary"
          className="w-full"
          loading={loadingMore}
          onClick={() => void load(nextCursor)}
        >
          Load more
        </Button>
      ) : (
        <p className="py-2 text-center text-[11px] text-muted">That is every game on this board.</p>
      )}
    </div>
  );
}

function HistoryRow({ item }: { item: HistoryRecord }) {
  const outcome = item.outcome;
  const label =
    outcome === 'WIN' ? 'Win' : outcome === 'LOSS' ? 'Loss' : outcome === 'DRAW' ? 'Draw' : 'Incomplete';
  const tone = outcome === 'WIN' ? 'success' : outcome === 'LOSS' ? 'danger' : 'neutral';

  return (
    <Card className="flex items-center gap-3 p-3.5">
      <Avatar name={item.opponent.displayName} photoUrl={item.opponent.photoUrl} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-bold text-ink">{item.opponent.displayName}</p>
          {item.opponent.isAi ? <Bot className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Bot" /> : null}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] font-medium text-muted">
          <span>{modeShortLabel(item.mode as MatchMode)}</span>
          <span aria-hidden>·</span>
          <span>{formatRelativeTime(item.playedAt)}</span>
          {item.opponent.isAi && item.opponent.aiDifficulty ? (
            <>
              <span aria-hidden>·</span>
              <span>{item.opponent.aiDifficulty.toLowerCase()}</span>
            </>
          ) : null}
        </p>
      </div>
      <Pill tone={tone}>{label}</Pill>
    </Card>
  );
}

function SettingsTab({
  client,
  config,
}: {
  client: GameClient;
  config: GameClient['config'];
}) {
  const { profile, connection } = client;
  const [saving, setSaving] = useState(false);
  if (!profile) return null;

  async function toggle(value: boolean): Promise<void> {
    setSaving(true);
    try {
      await client.setAutoAiFallback(value);
      client.pushToast({ type: 'success', title: value ? 'Bot fallback on' : 'Bot fallback off' });
    } catch (error) {
      client.pushToast({ type: 'error', title: 'Could not save preference', message: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">Auto-play a bot</h3>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              If no human joins within the queue window, automatically start an unrated bot match instead of leaving
              you waiting.
            </p>
          </div>
          <Toggle
            checked={profile.autoAiFallback}
            disabled={saving}
            onChange={(value) => void toggle(value)}
            label="Automatically play a bot when matchmaking takes too long"
          />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Themes & motion</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">
          The interface follows your Telegram light or dark theme and updates live. Motion is reduced automatically
          when your device asks for it.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Pill tone="accent">Telegram theme</Pill>
          <Pill>Safe areas</Pill>
          <Pill>Haptics</Pill>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="text-sm font-semibold text-ink">Account</h3>
        <dl className="mt-1.5 space-y-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Authentication</dt>
            <dd className="font-semibold text-ink">
              {config?.demoMode
                ? 'Guest demo'
                : config?.environment === 'production'
                  ? 'Telegram initData'
                  : 'Telegram or dev guest'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Connection</dt>
            <dd className="font-semibold capitalize text-ink">{connection}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted">Protocol</dt>
            <dd className="font-semibold tabular-nums text-ink">v{config?.protocol ?? 1}</dd>
          </div>
          {config?.botUsername ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted">Bot</dt>
              <dd className="truncate font-semibold text-accent">@{config.botUsername}</dd>
            </div>
          ) : null}
        </dl>
        {config?.demoMode ? (
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-muted">
            Demo mode. Guest sign-in is enabled and all data is stored in memory. Everything resets when the server
            restarts.
          </div>
        ) : config?.environment !== 'production' ? (
          <div className="mt-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-2.5 py-2 text-[10px] font-medium leading-relaxed text-muted">
            Development environment. Guest sign-in is available only outside production and is refused by the server
            when NODE_ENV=production.
          </div>
        ) : null}
      </Card>
    </div>
  );
}
