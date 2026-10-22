import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  ChevronRight,
  Clock3,
  Info,
  Link2,
  Play,
  ShieldCheck,
  Sparkles,
  Swords,
  type LucideIcon,
} from 'lucide-react';
import type { AiDifficulty, Side } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { modeLabel, opponentFor } from '../lib/game';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, Logo, Pill, SegmentedControl } from '../components/ui';
import { RankBadge, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';
import { formatDuration } from '../hooks/use-time';
import { HowToPlayModal, HOW_TO_PLAY_STORAGE_KEY } from '../components/HowToPlayModal';

const DIFFICULTIES: Array<{ value: AiDifficulty; label: string }> = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

export function HomeScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const { profile, config, match, pendingInvite } = client;
  const [difficulty, setDifficulty] = useState<AiDifficulty>('MEDIUM');
  const [side, setSide] = useState<Side>('X');
  const [startingBot, setStartingBot] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const autoGuideCheckedRef = useRef(false);

  useEffect(() => {
    if (!profile || autoGuideCheckedRef.current) return;
    autoGuideCheckedRef.current = true;
    if (match?.status === 'ACTIVE' || pendingInvite) return;
    try {
      const seen = localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY);
      if (!seen) {
        setGuideOpen(true);
      }
    } catch {
      // ignore storage errors
    }
  }, [profile, match?.status, pendingInvite]);

  if (!profile) return null;
  const isKhmer = (profile.languageCode ?? '').toLowerCase().startsWith('km');
  const stats = profile.stats;
  const activeMatch = match?.status === 'ACTIVE' ? match : null;
  const activeOpponent = activeMatch ? opponentFor(activeMatch) : null;
  const yourTurn = activeMatch ? activeMatch.currentTurn === activeMatch.youSide : false;
  const busy = Boolean(activeMatch || pendingInvite);

  async function startBot(): Promise<void> {
    setStartingBot(true);
    try {
      const matchId = await client.startAi(difficulty, side);
      navigate(`/game/${matchId}`);
    } catch (error) {
      client.pushToast({ type: 'error', title: 'Could not start the game', message: errorMessage(error) });
    } finally {
      setStartingBot(false);
    }
  }

  return (
    <Page withNav width="wide">
      <header className="flex items-center justify-between gap-4 pb-5 pt-1 sm:pb-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight text-ink">Tic Tac Toe</h1>
            <p className="truncate text-xs text-muted">Hey, {profile.firstName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition hover:bg-elevated hover:border-accent/40 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label={isKhmer ? 'របៀបលេង (How to play)' : 'How to play'}
            title={isKhmer ? 'របៀបលេង (How to play)' : 'How to play'}
          >
            <BookOpen className="h-3.5 w-3.5 text-accent" aria-hidden />
            <span>{isKhmer ? 'របៀបលេង' : 'How to play'}</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile')}
            className="shrink-0 rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
            aria-label="Open profile"
          >
            <Avatar name={profile.firstName} photoUrl={profile.photoUrl} size="md" />
          </button>
        </div>
      </header>

      {config?.demoMode ? (
        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>
            <span className="font-semibold">Demo mode.</span> Guest login is on. Data resets when the server restarts.
          </p>
        </div>
      ) : null}

      {activeMatch || pendingInvite ? (
        <div className="mb-3 space-y-2.5">
          {activeMatch ? (
            <button
              type="button"
              onClick={() => navigate(`/game/${activeMatch.id}`)}
              className="group flex w-full items-center gap-3 rounded-2xl border border-accent/20 bg-accent/5 p-3.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
                <Play className="h-4 w-4" fill="currentColor" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
                  Game in progress
                </span>
                <span className="mt-0.5 flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 text-sm font-semibold text-ink">{modeLabel(activeMatch.mode)}</span>
                  <span className="truncate text-[11px] text-muted">
                    vs {activeOpponent?.displayName ?? 'Opponent'}
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs font-semibold',
                  yourTurn ? 'text-success' : 'text-accent',
                )}
              >
                {yourTurn ? 'Your turn' : 'Resume'}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-accent transition group-hover:translate-x-0.5" aria-hidden />
            </button>
          ) : null}

          {pendingInvite ? (
            <button
              type="button"
              onClick={() => navigate('/invite/waiting')}
              className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3.5 text-left transition hover:bg-elevated active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted">
                <Clock3 className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
                  Invitation pending
                </span>
                <span className="mt-0.5 block truncate text-sm font-semibold text-ink">Waiting for a friend</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="group mb-3.5 flex w-full items-center justify-between gap-3 rounded-2xl border border-accent/25 bg-gradient-to-r from-accent/10 via-accent/5 to-surface p-3.5 text-left transition hover:border-accent/40 active:scale-[0.99] shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
      >
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
            <BookOpen className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink">
                {isKhmer ? 'របៀបលេងសម្រាប់អ្នកថ្មី' : 'New here? Learn how to play'}
              </span>
              <span className="rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-bold text-accent uppercase">
                {isKhmer ? 'ជំហានៗ' : 'Step by step'}
              </span>
            </span>
            <span className="mt-0.5 block text-[11px] text-muted">
              {isKhmer
                ? 'ស្វែងយល់ពីច្បាប់ ៥ គ្រាប់ឈ្នះ និងតិចនិកលេងក្នុង ១ នាទី'
                : 'Learn the five-in-a-row rules and winning tactics in one minute.'}
            </span>
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-accent transition group-hover:translate-x-0.5" aria-hidden />
      </button>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5">
        <Card className="p-4 lg:col-start-2 lg:row-start-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">Ladder rating</p>
              <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-ink">{stats.rating}</p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <RankBadge rating={stats.rating} />
              <span className="text-[10px] font-medium text-muted">{stats.ratingGames} rated</span>
            </div>
          </div>
          <RankProgress rating={stats.rating} className="mt-3" />
          <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
            <div>
              <p className="text-sm font-semibold tabular-nums text-ink">{stats.gamesPlayed}</p>
              <p className="mt-0.5 text-[10px] text-muted">Games</p>
            </div>
            <div>
              <p className="text-sm font-semibold tabular-nums text-ink">{stats.wins}</p>
              <p className="mt-0.5 text-[10px] text-muted">Wins</p>
            </div>
            <div>
              <p className="text-sm font-semibold tabular-nums text-ink">{stats.winRate}%</p>
              <p className="mt-0.5 text-[10px] text-muted">Win rate</p>
            </div>
          </div>
        </Card>

      <section className="order-first lg:order-none lg:col-start-1 lg:row-start-1">
        <h2 className="mb-2.5 text-sm font-semibold text-ink">Play</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <ModeTile
            icon={Swords}
            title="Quick match"
            description="Random player · rated"
            tone="accent"
            onClick={() => navigate('/search')}
            disabled={busy}
          />
          <ModeTile
            icon={Link2}
            title="Invite a friend"
            description="Private link · rated"
            onClick={() => navigate('/invite/waiting')}
            disabled={busy}
          />
        </div>
        {busy ? (
          <p className="mt-2.5 px-1 text-[11px] leading-relaxed text-muted">
            Finish or leave your current {pendingInvite && !activeMatch ? 'invitation' : 'game'} to start another.
          </p>
        ) : null}
      </section>

      <Card className="p-4 lg:col-start-1 lg:row-start-2">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-elevated text-ink">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-ink">Practice vs bot</h2>
              <Pill>Unrated</Pill>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">Choose a difficulty and take the first move.</p>
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-[11px] font-medium text-muted">Difficulty</p>
          <SegmentedControl
            value={difficulty}
            options={DIFFICULTIES}
            onChange={setDifficulty}
            ariaLabel="Bot difficulty"
          />
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2.5">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-muted">Play as</p>
            <SegmentedControl
              value={side}
              options={[
                { value: 'X', label: 'X' },
                { value: 'O', label: 'O' },
              ]}
              onChange={setSide}
              ariaLabel="Your side against the bot"
              className="grid-cols-2"
            />
          </div>
          <Button
            icon={Play}
            loading={startingBot}
            disabled={busy}
            onClick={() => void startBot()}
          >
            Start
          </Button>
        </div>
      </Card>

      <Card className="p-4 lg:col-start-2 lg:row-start-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Fair play</h2>
            <p className="text-[11px] text-muted">Every move is checked by the server.</p>
          </div>
        </div>
        <div className="mt-3 space-y-2.5 border-t border-line pt-3 text-[11px] leading-relaxed text-muted">
          <p className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span>Disconnects pause the clock for {formatDuration(config?.disconnectGraceMs ?? 0)}.</span>
          </p>
          <p className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span>Line up five in a row on the infinite board to win.</span>
          </p>
        </div>
      </Card>
      </div>

      <HowToPlayModal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        languageCode={profile.languageCode}
      />
    </Page>
  );
}

function ModeTile({
  icon: Icon,
  title,
  description,
  tone = 'neutral',
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: 'accent' | 'neutral';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex min-h-[130px] flex-col items-start rounded-2xl border p-4 text-left transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        tone === 'accent'
          ? 'border-accent/20 bg-accent/5 hover:border-accent/35'
          : 'border-line bg-surface hover:border-accent/20 hover:bg-elevated/60',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-xl',
          tone === 'accent' ? 'bg-accent text-accent-ink' : 'bg-elevated text-ink',
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="mt-auto pt-5">
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{description}</span>
      </span>
    </button>
  );
}
