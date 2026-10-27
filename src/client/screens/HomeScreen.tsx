import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Bot,
  ChevronRight,
  Clock3,
  Info,
  Link2,
  Loader2,
  Play,
  ShieldCheck,
  Sparkles,
  Swords,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import type { AiDifficulty, Side } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { errorMessage } from '../lib/api';
import { modeLabel, opponentFor } from '../lib/game';
import { Avatar } from '../components/ui';
import { RankBadge, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';
import { formatDuration } from '../hooks/use-time';
import { HowToPlayModal, HOW_TO_PLAY_STORAGE_KEY } from '../components/HowToPlayModal';
import './HomeScreen.css';

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
  const busyLabel = pendingInvite && !activeMatch ? 'invitation' : 'game';

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
    <Page withNav width="wide" className="home-screen">
      <header className="home-header">
        <div className="home-brand">
          <span className="home-brand-mark" aria-hidden="true">
            <img src="/icons/icon-192.png" alt="" width={44} height={44} />
          </span>
          <div className="home-brand-copy">
            <h1 className="home-brand-title">Tic Tac Toe</h1>
            <p className="home-brand-subtitle">Hey, {profile.firstName}</p>
          </div>
        </div>
        <div className="home-header-actions">
          <button
            type="button"
            className="home-guide-button"
            onClick={() => setGuideOpen(true)}
            aria-label={isKhmer ? 'របៀបលេង (How to play)' : 'How to play'}
            title={isKhmer ? 'របៀបលេង (How to play)' : 'How to play'}
          >
            <BookOpen aria-hidden="true" />
            <span>{isKhmer ? 'របៀបលេង' : 'How to play'}</span>
          </button>
          <button
            type="button"
            className="home-profile-button"
            onClick={() => navigate('/profile')}
            aria-label="Open profile"
            title="Open profile"
          >
            <Avatar name={profile.firstName} photoUrl={profile.photoUrl} size="md" />
          </button>
        </div>
      </header>

      {config?.demoMode ? (
        <div className="home-demo" role="note">
          <Info aria-hidden="true" />
          <p>
            <strong>Demo mode.</strong> Guest login is on. Data resets when the server restarts.
          </p>
        </div>
      ) : null}

      {activeMatch || pendingInvite ? (
        <div className="home-current">
          {activeMatch ? (
            <button
              type="button"
              className="home-current-card home-current-card--live"
              onClick={() => navigate(`/game/${activeMatch.id}`)}
            >
              <span className="home-current-icon">
                <Play aria-hidden="true" fill="currentColor" />
                {yourTurn ? <span className="home-live-dot" aria-hidden="true" /> : null}
              </span>
              <span className="home-current-copy">
                <span className="home-current-kicker">
                  <span className="home-pulse-dot" aria-hidden="true" />
                  Game in progress
                </span>
                <span className="home-current-title">
                  {modeLabel(activeMatch.mode)}{' '}
                  <span className="home-current-versus">vs {activeOpponent?.displayName ?? 'Opponent'}</span>
                </span>
              </span>
              <span className="home-current-badge" data-tone={yourTurn ? 'turn' : 'resume'}>
                {yourTurn ? 'Your turn' : 'Resume'}
              </span>
              <ChevronRight className="home-current-arrow" aria-hidden="true" />
            </button>
          ) : null}

          {pendingInvite ? (
            <button
              type="button"
              className="home-current-card"
              onClick={() => navigate('/invite/waiting')}
            >
              <span className="home-current-icon">
                <Clock3 aria-hidden="true" />
              </span>
              <span className="home-current-copy">
                <span className="home-current-kicker">Invitation pending</span>
                <span className="home-current-title">Waiting for a friend</span>
              </span>
              <ChevronRight className="home-current-arrow" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="home-scoreboard" aria-labelledby="home-rating-label">
        <div className="home-scoreboard-top">
          <div className="home-score-main">
            <p className="home-kicker" id="home-rating-label">
              Ladder rating
            </p>
            <div className="home-score-value-row">
              <strong className="home-score-value">{stats.rating}</strong>
              <RankBadge rating={stats.rating} />
            </div>
            <p className="home-score-footnote">{stats.ratingGames} rated</p>
          </div>
          <div className="home-score-progress">
            <RankProgress rating={stats.rating} />
          </div>
        </div>
        <div className="home-score-stats">
          <div className="home-score-stat">
            <span className="home-score-stat-value">{stats.gamesPlayed}</span>
            <span className="home-score-stat-label">Games</span>
          </div>
          <div className="home-score-stat">
            <span className="home-score-stat-value">{stats.wins}</span>
            <span className="home-score-stat-label">Wins</span>
          </div>
          <div className="home-score-stat">
            <span className="home-score-stat-value">{stats.winRate}%</span>
            <span className="home-score-stat-label">Win rate</span>
          </div>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-play" aria-labelledby="home-play-title">
          <div className="home-section-heading">
            <h2 id="home-play-title">Play</h2>
            <span>Choose a board</span>
          </div>
          <div className="home-modes">
            <ModeTile
              icon={Swords}
              index="01"
              title="Quick match"
              description="Random player · rated"
              tone="accent"
              onClick={() => navigate('/search')}
              disabled={busy}
            />
            <ModeTile
              icon={Link2}
              index="02"
              title="Invite a friend"
              description="Private link · rated"
              tone="emerald"
              onClick={() => navigate('/invite/waiting')}
              disabled={busy}
            />
          </div>
          {busy ? (
            <p className="home-hint">
              Finish or leave your current {busyLabel} to start another.
            </p>
          ) : null}
        </section>

        <section className="home-card home-practice" aria-labelledby="home-practice-title">
          <header className="home-card-head">
            <span className="home-card-icon">
              <Bot aria-hidden="true" />
            </span>
            <div className="home-card-copy">
              <div className="home-card-title-row">
                <h2 id="home-practice-title">Practice vs bot</h2>
                <span className="home-chip">Unrated</span>
              </div>
              <p>Choose a difficulty and take the first move.</p>
            </div>
          </header>

          <div className="home-field">
            <span className="home-field-label">Difficulty</span>
            <ChoiceGroup
              value={difficulty}
              options={DIFFICULTIES}
              onChange={setDifficulty}
              ariaLabel="Bot difficulty"
            />
          </div>

          <div className="home-practice-footer">
            <div className="home-field home-field--side">
              <span className="home-field-label">Play as</span>
              <ChoiceGroup
                value={side}
                options={[
                  { value: 'X', label: 'X', mark: 'x' },
                  { value: 'O', label: 'O', mark: 'o' },
                ]}
                onChange={setSide}
                ariaLabel="Your side against the bot"
              />
            </div>
            <button
              type="button"
              className="home-start"
              disabled={busy || startingBot}
              aria-busy={startingBot || undefined}
              onClick={() => void startBot()}
            >
              {startingBot ? (
                <Loader2 className="home-spin" aria-hidden="true" />
              ) : (
                <Play aria-hidden="true" fill="currentColor" />
              )}
              {startingBot ? 'Starting…' : 'Start game'}
            </button>
          </div>
        </section>

        <aside className="home-aside">
          {stats.gamesPlayed === 0 ? (
            <button
              type="button"
              className="home-first-game"
              onClick={() => setGuideOpen(true)}
            >
              <span className="home-first-game-icon">
                <BookOpen aria-hidden="true" />
              </span>
              <span className="home-first-game-copy">
                <span className="home-first-game-kicker">
                  {isKhmer ? 'ជំហានៗ' : 'Step by step'}
                </span>
                <span className="home-first-game-title">
                  {isKhmer ? 'របៀបលេងសម្រាប់អ្នកថ្មី' : 'New here? Learn how to play'}
                </span>
                <span className="home-first-game-desc">
                  {isKhmer
                    ? 'ស្វែងយល់ពីច្បាប់ ៥ គ្រាប់ឈ្នះ និងតិចនិកលេងក្នុង ១ នាទី'
                    : 'Learn the five-in-a-row rules and winning tactics in one minute.'}
                </span>
              </span>
              <ChevronRight className="home-first-game-arrow" aria-hidden="true" />
            </button>
          ) : null}

          <section className="home-card home-fairplay" aria-labelledby="home-fairplay-title">
            <header className="home-card-head">
              <span className="home-card-icon home-card-icon--success">
                <ShieldCheck aria-hidden="true" />
              </span>
              <div className="home-card-copy">
                <h2 id="home-fairplay-title">Fair play</h2>
                <p>Every move is checked by the server.</p>
              </div>
            </header>
            <ul className="home-fairplay-list">
              <li>
                <Timer aria-hidden="true" />
                <span>
                  {(config?.turnTimeoutMs ?? 0) > 0
                    ? `Each turn gets ${formatDuration(config?.turnTimeoutMs ?? 0)} on the clock.`
                    : 'Turn timers are off, so take your time.'}
                </span>
              </li>
              <li>
                <Clock3 aria-hidden="true" />
                <span>Disconnects pause the clock for {formatDuration(config?.disconnectGraceMs ?? 0)}.</span>
              </li>
              <li>
                <Sparkles aria-hidden="true" />
                <span>Line up five in a row to win. Four hundred moves without a winner is a draw.</span>
              </li>
            </ul>
          </section>
        </aside>
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
  index,
  title,
  description,
  tone = 'neutral',
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  index: string;
  title: string;
  description: string;
  tone?: 'accent' | 'emerald' | 'neutral';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`home-mode home-mode--${tone}`}
    >
      <span className="home-mode-top">
        <span className="home-mode-icon">
          <Icon aria-hidden="true" />
        </span>
        <span className="home-mode-index" aria-hidden="true">
          {index}
        </span>
      </span>
      <span className="home-mode-copy">
        <span className="home-mode-title">{title}</span>
        <span className="home-mode-desc">{description}</span>
      </span>
      <ChevronRight className="home-mode-arrow" aria-hidden="true" />
    </button>
  );
}

function ChoiceGroup<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: string; mark?: 'x' | 'o' }>;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="home-choices"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          data-active={value === option.value ? 'true' : undefined}
          className="home-choice"
          onClick={() => onChange(option.value)}
        >
          {option.mark ? (
            <span className={`home-choice-mark home-choice-mark--${option.mark}`}>{option.label}</span>
          ) : (
            option.label
          )}
        </button>
      ))}
    </div>
  );
}
