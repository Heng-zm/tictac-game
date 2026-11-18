import { lazy, Suspense, useEffect, useRef, useState } from 'react';
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
import { HOW_TO_PLAY_STORAGE_KEY, modeLabel, opponentFor } from '../lib/game';
import { Avatar } from '../components/ui';
import { RankBadge, RankProgress } from '../components/RankBadge';
import { Page } from '../components/Layout';
import { LanguageButton } from '../components/LanguageButton';
import { formatDuration } from '../hooks/use-time';
import { useAnimatedNumber } from '../hooks/use-animated-number';
import { isKhmer as checkKhmer } from '../lib/language';
import { hapticImpact, hapticSelection } from '../lib/telegram';
import './HomeScreen.css';

const HowToPlayModal = lazy(() =>
  import('../components/HowToPlayModal').then((m) => ({ default: m.HowToPlayModal })),
);

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

  const animatedRating = useAnimatedNumber(profile?.stats.rating ?? 0, { animateOnMount: true, durationMs: 950 });
  const animatedGames = useAnimatedNumber(profile?.stats.gamesPlayed ?? 0, { animateOnMount: true, durationMs: 750 });
  const animatedWins = useAnimatedNumber(profile?.stats.wins ?? 0, { animateOnMount: true, durationMs: 750 });
  const animatedWinRate = useAnimatedNumber(profile?.stats.winRate ?? 0, { animateOnMount: true, durationMs: 850 });

  if (!profile) return null;
  const isKhmer = checkKhmer(profile.languageCode);
  const stats = profile.stats;

  const activeMatch = match?.status === 'ACTIVE' ? match : null;
  const activeOpponent = activeMatch ? opponentFor(activeMatch) : null;
  const yourTurn = activeMatch ? activeMatch.currentTurn === activeMatch.youSide : false;
  const busy = Boolean(activeMatch || pendingInvite);
  const busyLabel = pendingInvite && !activeMatch ? (isKhmer ? 'ការអញ្ជើញ' : 'invitation') : (isKhmer ? 'ការប្រកួត' : 'game');

  const difficulties: Array<{ value: AiDifficulty; label: string }> = [
    { value: 'EASY', label: isKhmer ? 'ងាយ' : 'Easy' },
    { value: 'MEDIUM', label: isKhmer ? 'មធ្យម' : 'Medium' },
    { value: 'HARD', label: isKhmer ? 'ពិបាក' : 'Hard' },
  ];

  async function startBot(): Promise<void> {
    hapticImpact('medium');
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
            <p className="home-brand-subtitle">
              {isKhmer ? `សួស្តី, ${profile.firstName}` : `Hey, ${profile.firstName}`}
            </p>
          </div>
        </div>
        <div className="home-header-actions">
          <LanguageButton client={client} variant="circle" className="home-lang-button" />
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
              onClick={() => {
                hapticImpact('light');
                navigate(`/game/${activeMatch.id}`);
              }}
            >
              <span className="home-current-icon">
                <Play aria-hidden="true" fill="currentColor" />
                {yourTurn ? <span className="home-live-dot" aria-hidden="true" /> : null}
              </span>
              <span className="home-current-copy">
                <span className="home-current-kicker">
                  <span className="home-pulse-dot" aria-hidden="true" />
                  {isKhmer ? 'កំពុងប្រកួត' : 'Game in progress'}
                </span>
                <span className="home-current-title">
                  {isKhmer
                    ? activeMatch.mode === 'RANDOM'
                      ? 'ការប្រកួតចៃដន្យ'
                      : activeMatch.mode === 'FRIEND'
                        ? 'ការប្រកួតមិត្តភក្តិ'
                        : 'ការប្រកួតជាមួយ Bot'
                    : modeLabel(activeMatch.mode)}{' '}
                  <span className="home-current-versus">
                    {isKhmer
                      ? `ទល់នឹង ${activeOpponent?.displayName ?? 'គូប្រកួត'}`
                      : `vs ${activeOpponent?.displayName ?? 'Opponent'}`}
                  </span>
                </span>
              </span>
              <span className="home-current-badge" data-tone={yourTurn ? 'turn' : 'resume'}>
                {yourTurn ? (isKhmer ? 'ដល់វេនអ្នក' : 'Your turn') : (isKhmer ? 'បន្តលេង' : 'Resume')}
              </span>
              <ChevronRight className="home-current-arrow" aria-hidden="true" />
            </button>
          ) : null}

          {pendingInvite ? (
            <button
              type="button"
              className="home-current-card"
              onClick={() => {
                hapticImpact('light');
                navigate('/invite/waiting');
              }}
            >
              <span className="home-current-icon">
                <Clock3 aria-hidden="true" />
              </span>
              <span className="home-current-copy">
                <span className="home-current-kicker">{isKhmer ? 'ការអញ្ជើញកំពុងរង់ចាំ' : 'Invitation pending'}</span>
                <span className="home-current-title">{isKhmer ? 'រង់ចាំមិត្តភក្តិ' : 'Waiting for a friend'}</span>
              </span>
              <ChevronRight className="home-current-arrow" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="home-scoreboard" aria-labelledby="home-rating-label">
        <div className="home-scoreboard-glow" aria-hidden="true" />
        <div className="home-scoreboard-top">
          <div className="home-score-main">
            <p className="home-kicker" id="home-rating-label">
              {isKhmer ? 'ពិន្ទុចំណាត់ថ្នាក់' : 'Ladder rating'}
            </p>
            <div className="home-score-value-row">
              <strong className="home-score-value">{animatedRating}</strong>
              <RankBadge rating={stats.rating} />
            </div>
            <p className="home-score-footnote">
              {isKhmer ? `${stats.ratingGames} ប្រកួតគិតពិន្ទុ` : `${stats.ratingGames} rated`}
            </p>
          </div>
          <div className="home-score-progress">
            <RankProgress rating={stats.rating} />
          </div>
        </div>
        <div className="home-score-stats">
          <div className="home-score-stat">
            <span className="home-score-stat-value">{animatedGames}</span>
            <span className="home-score-stat-label">{isKhmer ? 'ប្រកួត' : 'Games'}</span>
          </div>
          <div className="home-score-stat">
            <span className="home-score-stat-value">{animatedWins}</span>
            <span className="home-score-stat-label">{isKhmer ? 'ឈ្នះ' : 'Wins'}</span>
          </div>
          <div className="home-score-stat">
            <span className="home-score-stat-value">{animatedWinRate}%</span>
            <span className="home-score-stat-label">{isKhmer ? 'អត្រាឈ្នះ' : 'Win rate'}</span>
          </div>
        </div>
      </section>

      <div className="home-grid">
        <section className="home-play" aria-labelledby="home-play-title">
          <div className="home-section-heading">
            <h2 id="home-play-title">{isKhmer ? 'លេង' : 'Play'}</h2>
            <span>{isKhmer ? 'ជ្រើសរើសរបៀបលេង' : 'Choose a board'}</span>
          </div>
          <div className="home-modes">
            <ModeTile
              icon={Swords}
              index="01"
              title={isKhmer ? 'លេងរហ័ស' : 'Quick match'}
              description={isKhmer ? 'ផ្គូផ្គងអ្នកលេងចៃដន្យ · គិតពិន្ទុ' : 'Random player · rated'}
              tone="accent"
              onClick={() => navigate('/search')}
              disabled={busy}
            />
            <ModeTile
              icon={Link2}
              index="02"
              title={isKhmer ? 'អញ្ជើញមិត្តភក្តិ' : 'Invite a friend'}
              description={isKhmer ? 'តំណភ្ជាប់ផ្ទាល់ខ្លួន · គិតពិន្ទុ' : 'Private link · rated'}
              tone="emerald"
              onClick={() => navigate('/invite/waiting')}
              disabled={busy}
            />
          </div>
          {busy ? (
            <p className="home-hint">
              {isKhmer
                ? `សូមបញ្ចប់ ឬចាកចេញពី${busyLabel}បច្ចុប្បន្នដើម្បីចាប់ផ្តើមថ្មី។`
                : `Finish or leave your current ${busyLabel} to start another.`}
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
                <h2 id="home-practice-title">{isKhmer ? 'ហាត់ជាមួយ Bot' : 'Practice vs bot'}</h2>
                <span className="home-chip">{isKhmer ? 'មិនគិតពិន្ទុ' : 'Unrated'}</span>
              </div>
              <p>{isKhmer ? 'ជ្រើសរើសកម្រិត និងដើរមុន។' : 'Choose a difficulty and take the first move.'}</p>
            </div>
          </header>

          <div className="home-field">
            <span className="home-field-label">{isKhmer ? 'កម្រិតពិបាក' : 'Difficulty'}</span>
            <ChoiceGroup
              value={difficulty}
              options={difficulties}
              onChange={setDifficulty}
              ariaLabel={isKhmer ? 'កម្រិតពិបាករបស់ bot' : 'Bot difficulty'}
            />
          </div>

          <div className="home-practice-footer">
            <div className="home-field home-field--side">
              <span className="home-field-label">{isKhmer ? 'ដើរមុនជា' : 'Play as'}</span>
              <ChoiceGroup
                value={side}
                options={[
                  { value: 'X', label: 'X', mark: 'x' },
                  { value: 'O', label: 'O', mark: 'o' },
                ]}
                onChange={setSide}
                ariaLabel={isKhmer ? 'ខាងរបស់អ្នកទល់នឹង bot' : 'Your side against the bot'}
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
              {startingBot ? (isKhmer ? 'កំពុងចាប់ផ្តើម…' : 'Starting…') : (isKhmer ? 'ចាប់ផ្តើមលេង' : 'Start game')}
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
                <h2 id="home-fairplay-title">{isKhmer ? 'ការលេងដោយយុត្តិធម៌' : 'Fair play'}</h2>
                <p>{isKhmer ? 'គ្រប់ជំហានត្រូវបានផ្ទៀងផ្ទាត់ដោយម៉ាស៊ីនមេ' : 'Every move is checked by the server.'}</p>
              </div>
            </header>
            <ul className="home-fairplay-list">
              <li>
                <Timer aria-hidden="true" />
                <span>
                  {(config?.turnTimeoutMs ?? 0) > 0
                    ? isKhmer
                      ? `វេននីមួយៗមានពេល ${formatDuration(config?.turnTimeoutMs ?? 0)} នៅលើនាឡិកា។`
                      : `Each turn gets ${formatDuration(config?.turnTimeoutMs ?? 0)} on the clock.`
                    : isKhmer
                      ? 'នាឡិកាកំណត់ពេលត្រូវបានបិទ ដូច្នេះអ្នកអាចគិតបានស្រួល។'
                      : 'Turn timers are off, so take your time.'}
                </span>
              </li>
              <li>
                <Clock3 aria-hidden="true" />
                <span>
                  {isKhmer
                    ? `ការដាច់អ៊ីនធឺណិតផ្អាកនាឡិកាសម្រាប់ ${formatDuration(config?.disconnectGraceMs ?? 0)}។`
                    : `Disconnects pause the clock for ${formatDuration(config?.disconnectGraceMs ?? 0)}.`}
                </span>
              </li>
              <li>
                <Sparkles aria-hidden="true" />
                <span>
                  {isKhmer
                    ? 'តម្រៀប ៥ គ្រាប់ជាប់គ្នាដើម្បីឈ្នះ។ បើ ៤០០ ជំហានគ្មានអ្នកឈ្នះ នោះស្មើគ្នា។'
                    : 'Line up five in a row to win. Four hundred moves without a winner is a draw.'}
                </span>
              </li>
            </ul>
          </section>
        </aside>
      </div>

      {guideOpen ? (
        <Suspense fallback={null}>
          <HowToPlayModal
            open={guideOpen}
            onClose={() => setGuideOpen(false)}
            languageCode={profile.languageCode}
          />
        </Suspense>
      ) : null}
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
      onClick={() => {
        hapticImpact('light');
        onClick();
      }}
      disabled={disabled}
      className={`home-mode home-mode--${tone}`}
    >
      <div className="home-mode-shimmer" aria-hidden="true" />
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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % options.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = options.length - 1;
    }

    if (nextIndex !== null) {
      event.preventDefault();
      const nextOption = options[nextIndex];
      if (nextOption) {
        hapticSelection();
        onChange(nextOption.value);
        window.requestAnimationFrame(() => {
          const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
          buttons?.[nextIndex]?.focus();
        });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className="home-choices"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option, index) => {
        const isChecked = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isChecked}
            tabIndex={isChecked ? 0 : -1}
            data-active={isChecked ? 'true' : undefined}
            className="home-choice"
            onClick={() => {
              hapticSelection();
              onChange(option.value);
            }}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {option.mark ? (
              <span className={`home-choice-mark home-choice-mark--${option.mark}`}>{option.label}</span>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );
}
