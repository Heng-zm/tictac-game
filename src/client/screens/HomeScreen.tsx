import { useState } from 'react';
import {
  Bot,
  ChevronRight,
  Clock,
  Gamepad2,
  Link2,
  Play,
  Sparkles,
  Swords,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AiDifficulty, Side } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { modeLabel } from '../lib/game';
import { cn } from '../lib/cn';
import { Avatar, Button, Card, Logo, Pill, SegmentedControl, StatTile } from '../components/ui';
import { Page } from '../components/Layout';
import { formatDuration } from '../hooks/use-time';

const DIFFICULTIES: Array<{ value: AiDifficulty; label: string; hint: string }> = [
  { value: 'EASY', label: 'Easy', hint: 'Warm-up' },
  { value: 'MEDIUM', label: 'Medium', hint: 'Tricky' },
  { value: 'HARD', label: 'Hard', hint: 'Unbeatable' },
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

  if (!profile) return null;
  const stats = profile.stats;
  const activeMatch = match?.status === 'ACTIVE' ? match : null;
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
    <Page withNav>
      <header className="flex items-center justify-between pb-5 pt-1">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent">Telegram Mini App</p>
            <h1 className="text-lg font-black leading-tight tracking-tight text-ink">Tic Tac Toe</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/profile')}
          className="rounded-full transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70"
          aria-label="Open profile"
        >
          <Avatar name={profile.firstName} photoUrl={profile.photoUrl} size="md" ring />
        </button>
      </header>

      {config?.demoMode ? (
        <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200">
          Demo mode: guest login is enabled and data resets when the server restarts.
        </div>
      ) : null}

      <section className="mb-4">
        <p className="text-sm font-medium text-muted">Hey, {profile.firstName}.</p>
        <h2 className="mt-0.5 text-[28px] font-black leading-[1.12] tracking-tight text-ink">
          Three in a row.
          <br />
          <span className="text-accent">One tap away.</span>
        </h2>
      </section>

      <div className="mb-4 grid grid-cols-3 gap-2">
        <StatTile label="Rating" value={stats.rating} icon={Trophy} accent />
        <StatTile label="Win rate" value={`${stats.winRate}%`} icon={Sparkles} />
        <StatTile label="Games" value={stats.gamesPlayed} icon={Gamepad2} />
      </div>

      {activeMatch ? (
        <button
          type="button"
          onClick={() => navigate(`/game/${activeMatch.id}`)}
          className="group mb-3 flex w-full items-center gap-3 rounded-3xl border border-accent/30 bg-accent/10 p-3.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-ink">
            <Play className="h-5 w-5" fill="currentColor" aria-hidden />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-success" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-accent">Game in progress</span>
            <span className="block truncate text-sm font-semibold text-ink">
              {modeLabel(activeMatch.mode)} · tap to resume
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-accent transition group-hover:translate-x-0.5" aria-hidden />
        </button>
      ) : null}

      {pendingInvite ? (
        <button
          type="button"
          onClick={() => navigate('/invite/waiting')}
          className="group mb-3 flex w-full items-center gap-3 rounded-3xl border border-line bg-elevated/70 p-3.5 text-left transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-elevated text-accent">
            <Clock className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">Waiting for a friend</span>
            <span className="block truncate text-sm font-semibold text-ink">Your invitation is still pending</span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted transition group-hover:translate-x-0.5" aria-hidden />
        </button>
      ) : null}

      <div className="space-y-2.5">
        <ModeCard
          icon={Swords}
          title="Play online"
          description="Get paired with a random player. Rated."
          tone="accent"
          onClick={() => navigate('/search')}
          disabled={busy}
        />
        <ModeCard
          icon={Link2}
          title="Invite a friend"
          description="Share a private link. Only the two of you."
          tone="danger"
          onClick={() => navigate('/invite/waiting')}
          disabled={busy}
        />
      </div>

      {busy ? (
        <p className="mt-2.5 px-1 text-center text-[11px] leading-relaxed text-muted">
          Finish or leave your current {pendingInvite && !activeMatch ? 'invitation' : 'game'} to start another.
        </p>
      ) : null}

      <Card className="mt-4 p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Bot className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-sm font-extrabold text-ink">Play the bot</h3>
              <p className="text-[11px] text-muted">Hard uses perfect minimax. Good luck.</p>
            </div>
          </div>
          <Pill tone="accent">Unrated</Pill>
        </div>

        <SegmentedControl
          value={difficulty}
          options={DIFFICULTIES}
          onChange={setDifficulty}
          ariaLabel="Bot difficulty"
          className="grid-cols-3"
        />

        <div className="mt-2.5 flex items-center gap-2.5">
          <SegmentedControl
            value={side}
            options={[
              { value: 'X', label: 'Play as X', hint: 'First' },
              { value: 'O', label: 'Play as O', hint: 'Second' },
            ]}
            onChange={setSide}
            ariaLabel="Your side against the bot"
            className="flex-1 grid-cols-2"
          />
          <Button
            size="md"
            icon={Play}
            loading={startingBot}
            disabled={busy}
            onClick={() => void startBot()}
            className="shrink-0 px-4"
          >
            Start
          </Button>
        </div>
      </Card>

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line bg-elevated/50 p-3 text-[11px] leading-relaxed text-muted">
        <Users className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p>
          Every move is validated by the server. Disconnects pause the clock for {formatDuration(config?.disconnectGraceMs ?? 0)} so
          a dropped signal never costs you the game.
        </p>
      </div>
    </Page>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  tone,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tone: 'accent' | 'danger';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-3xl border p-4 text-left transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70',
        tone === 'accent'
          ? 'border-accent/25 bg-gradient-to-br from-accent/15 via-surface to-surface'
          : 'border-danger/20 bg-gradient-to-br from-danger/10 via-surface to-surface',
      )}
    >
      <span
        className={cn(
          'pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl',
          tone === 'accent' ? 'bg-accent/20' : 'bg-danger/15',
        )}
      />
      <span
        className={cn(
          'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
          tone === 'accent' ? 'bg-accent text-accent-ink shadow-soft' : 'bg-danger text-white shadow-soft',
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-base font-extrabold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted">{description}</span>
      </span>
      <ChevronRight className="relative h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
