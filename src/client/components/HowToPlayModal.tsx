import { useEffect, useRef, useState, type TouchEvent } from 'react';
import {
  BookOpen,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Hand,
  Mic,
  Move,
  ShieldAlert,
  Sparkles,
  Swords,
  Trophy,
  X,
  ZoomIn,
} from 'lucide-react';
import { Modal } from './ui';
import { cn } from '../lib/cn';

export interface HowToPlayModalProps {
  open: boolean;
  onClose: () => void;
  languageCode?: string | null;
}

export const HOW_TO_PLAY_STORAGE_KEY = 'tictac_guide_seen';

interface StepData {
  id: string;
  tabKhmer: string;
  tabEnglish: string;
  badgeKhmer: string;
  badgeEnglish: string;
  titleKhmer: string;
  titleEnglish: string;
  descriptionKhmer: string;
  descriptionEnglish: string;
  highlights: {
    icon: typeof Move;
    titleKhmer: string;
    descKhmer: string;
    titleEnglish: string;
    descEnglish: string;
  }[];
}

const STEPS: StepData[] = [
  {
    id: 'controls',
    tabKhmer: 'ការបញ្ជា',
    tabEnglish: 'Controls',
    badgeKhmer: 'ជំហានទី ១ · ការបញ្ជាក្តារ',
    badgeEnglish: 'Step 1 · Board Controls',
    titleKhmer: 'ក្តារគ្មានដែនកំណត់ & ការបញ្ជា',
    titleEnglish: 'Infinite Grid & Controls',
    descriptionKhmer:
      'ក្តារលេងមានទំហំធំទូលាយគ្មានដែនកំណត់។ អ្នកអាចរំកិល ពង្រីក និងដាក់កូនបានដោយសេរីគ្រប់ទីកន្លែង។',
    descriptionEnglish:
      'The board is an infinite grid. Pan, zoom, and place your stones freely anywhere.',
    highlights: [
      {
        icon: Hand,
        titleKhmer: 'ប៉ះ (Tap)',
        descKhmer: 'ចុចលើប្រឡោះទទេដើម្បីដាក់កូន X ឬ O របស់អ្នក',
        titleEnglish: 'Tap empty cell to place X or O',
        descEnglish: 'Tap an empty cell to place your X or O.',
      },
      {
        icon: Move,
        titleKhmer: 'អូស (Drag)',
        descKhmer: 'អូសម្រាមដៃលើអេក្រង់ដើម្បីរំកិលក្តារមើលជុំវិញ',
        titleEnglish: 'Drag anywhere to pan across board',
        descEnglish: 'Drag anywhere on the board to look around.',
      },
      {
        icon: ZoomIn,
        titleKhmer: 'ពង្រីក (Pinch)',
        descKhmer: 'ប្រើម្រាមដៃពីរដើម្បីពង្រីក ឬបង្រួមក្តារលេង',
        titleEnglish: 'Pinch with 2 fingers to zoom',
        descEnglish: 'Pinch with two fingers to zoom in or out.',
      },
    ],
  },
  {
    id: 'win-rule',
    tabKhmer: 'ច្បាប់ឈ្នះ',
    tabEnglish: 'Win rule',
    badgeKhmer: 'ជំហានទី ២ · ច្បាប់ឈ្នះ',
    badgeEnglish: 'Step 2 · Win Condition',
    titleKhmer: 'តម្រៀប ៥ គ្រាប់ជាប់គ្នាដើម្បីឈ្នះ!',
    titleEnglish: 'Connect 5 in a Row to Win!',
    descriptionKhmer:
      'គោលដៅចម្បងគឺតម្រៀបកូនរបស់អ្នកឱ្យបាន ៥ គ្រាប់ជាប់គ្នាមុនគូប្រកួត តាមគ្រប់ទិសដៅ។',
    descriptionEnglish:
      'Your main objective is to line up 5 of your stones in a row before your opponent.',
    highlights: [
      {
        icon: Trophy,
        titleKhmer: 'ជួរដេក (Horizontal)',
        descKhmer: 'តម្រៀប ៥ គ្រាប់ជាជួរដេកត្រង់ជោគជ័យ',
        titleEnglish: '5 stones in a horizontal line',
        descEnglish: 'Connect five of your stones in a horizontal row.',
      },
      {
        icon: Trophy,
        titleKhmer: 'ជួរឈរ (Vertical)',
        descKhmer: 'តម្រៀប ៥ គ្រាប់ជាជួរឈរពីលើចុះក្រោម',
        titleEnglish: '5 stones in a vertical column',
        descEnglish: 'Connect five stones in a vertical column.',
      },
      {
        icon: Sparkles,
        titleKhmer: 'អង្កត់ទ្រូង (Diagonal)',
        descKhmer: 'តម្រៀប ៥ គ្រាប់បញ្ឆិត ឬអង្កត់ទ្រូងទាំងសងខាង',
        titleEnglish: '5 stones in any diagonal slant',
        descEnglish: 'Connect five stones in either diagonal direction.',
      },
    ],
  },
  {
    id: 'strategy',
    tabKhmer: 'យុទ្ធសាស្ត្រ',
    tabEnglish: 'Tactics',
    badgeKhmer: 'ជំហានទី ៣ · យុទ្ធសាស្ត្រ',
    badgeEnglish: 'Step 3 · Tactics & Defense',
    titleKhmer: 'យុទ្ធសាស្ត្រវាយប្រហារ & ការពារ',
    titleEnglish: 'Attack & Defense Tactics',
    descriptionKhmer:
      'ការលេងកូន ៥ ត្រូវការការគិតរហ័ស! ត្រូវសង្កេតកូនគូប្រកួត និងបង្កើតឱកាសវាយលុកផ្ទាល់ខ្លួន។',
    descriptionEnglish:
      'Keep an eye on the enemy stones. Block threats early and create double attack lines!',
    highlights: [
      {
        icon: ShieldAlert,
        titleKhmer: 'ការពារ (Defense)',
        descKhmer: 'ត្រូវរារាំងភ្លាមៗពេលគូប្រកួតមាន ៣ ឬ ៤ គ្រាប់ជាប់គ្នា',
        titleEnglish: 'Block opponent when they reach 3 or 4 in a row',
        descEnglish: 'Block immediately when your opponent has three or four in a row.',
      },
      {
        icon: Swords,
        titleKhmer: 'វាយលុក (Attack)',
        descKhmer: 'បង្កើតទម្រង់ ៤ បើកក្បាលសងខាង (Open-ended 4)',
        titleEnglish: 'Create open-ended 4s that cannot be stopped',
        descEnglish: 'Create open-ended fours that cannot be blocked on both sides.',
      },
      {
        icon: Sparkles,
        titleKhmer: 'អន្ទាក់ (Double Threat)',
        descKhmer: 'បង្កើតជួរ ៣ ពីរផ្លូវដំណាលគ្នា (Double 3) ធានាឈ្នះ',
        titleEnglish: 'Create simultaneous multi-line threats',
        descEnglish: 'Build two threats at once to force a winning line.',
      },
    ],
  },
  {
    id: 'voice-modes',
    tabKhmer: 'សំឡេង',
    tabEnglish: 'Voice',
    badgeKhmer: 'ជំហានទី ៤ · សំឡេង & របៀបលេង',
    badgeEnglish: 'Step 4 · Live Voice & Modes',
    titleKhmer: 'Walkie-Talkie & របៀបប្រកួត',
    titleEnglish: 'Live Voice & Game Modes',
    descriptionKhmer:
      'និយាយផ្ទាល់ជាមួយគូប្រកួតតាមរយៈ Walkie-Talkie និងជ្រើសរើសរបៀបលេងដែលអ្នកពេញចិត្ត។',
    descriptionEnglish:
      'Talk directly using the push-to-talk Walkie-Talkie and choose your favorite game mode.',
    highlights: [
      {
        icon: Mic,
        titleKhmer: 'សំឡេង Walkie-Talkie',
        descKhmer: 'ចុចសង្កត់ប៊ូតុង Mic ដើម្បីនិយាយ រួចលែងដៃដើម្បីផ្ញើភ្លាមៗ',
        titleEnglish: 'Hold mic button to talk, release to send instant voice',
        descEnglish: 'Hold the mic button to talk, then release to send instantly.',
      },
      {
        icon: Swords,
        titleKhmer: 'Quick Match',
        descKhmer: 'ប្រកួតចៃដន្យជាមួយអ្នកលេងផ្សេងទៀតដើម្បីដណ្តើមពិន្ទុ Rating',
        titleEnglish: 'Ranked matchmaking with random players',
        descEnglish: 'Play random opponents and compete for rating.',
      },
      {
        icon: Bot,
        titleKhmer: 'Practice Bot & Invite',
        descKhmer: 'ហ្វឹកហាត់ជាមួយ Bot ឬផ្ញើតំណ link អញ្ជើញមិត្តភក្តិ',
        titleEnglish: 'Practice with AI or share private link with friends',
        descEnglish: 'Practice against the bot or invite a friend with a private link.',
      },
    ],
  },
];

export function HowToPlayModal({ open, onClose, languageCode }: HowToPlayModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const isKm = (languageCode ?? '').toLowerCase().startsWith('km');

  const step = (STEPS[currentStep] ?? STEPS[0]) as StepData;
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  useEffect(() => {
    if (!open) return;
    setCurrentStep(0);
    try {
      setDontShowAgain(localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY) === 'true');
    } catch {
      setDontShowAgain(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = contentRef.current?.closest<HTMLElement>('[role="dialog"]');
    if (panel) panel.scrollTop = 0;
  }, [currentStep, open]);

  function persistGuidePreference(seen: boolean): void {
    try {
      if (seen) localStorage.setItem(HOW_TO_PLAY_STORAGE_KEY, 'true');
      else localStorage.removeItem(HOW_TO_PLAY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function handleClose() {
    persistGuidePreference(dontShowAgain);
    onClose();
  }

  function handleComplete() {
    // Completing the guide counts as seen even if the early-close checkbox is unchecked.
    persistGuidePreference(true);
    onClose();
  }

  function handlePrev() {
    if (!isFirst) setCurrentStep((prev) => prev - 1);
  }

  function handleNext() {
    if (!isLast) setCurrentStep((prev) => prev + 1);
    else handleComplete();
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0]?.clientX ?? null;
    if (touchEndX !== null) {
      const diff = touchEndX - touchStartXRef.current;
      if (diff > 50 && !isFirst) {
        handlePrev();
      } else if (diff < -50 && !isLast) {
        handleNext();
      }
    }
    touchStartXRef.current = null;
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      dismissible
      showClose={false}
      ariaLabel={isKm ? 'របៀបលេង' : 'How to play'}
      className="max-w-md p-0 sm:max-w-lg"
    >
      <div
        className="flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <BookOpen className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-bold text-ink">
                {isKm ? 'របៀបលេង' : 'How to Play'}
              </h2>
              <p className="truncate text-[10.5px] font-medium text-muted">
                {isKm ? step.badgeKhmer : step.badgeEnglish} ({currentStep + 1}/{STEPS.length})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-95"
            aria-label={isKm ? 'បិទការណែនាំពីរបៀបលេង' : 'Close how to play guide'}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Step Progress Bar & Pills */}
        <div className="flex items-center justify-between gap-1.5 border-b border-line/60 bg-elevated/40 px-5 py-2">
          {STEPS.map((s, idx) => {
            const active = idx === currentStep;
            const completed = idx < currentStep;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-current={active ? 'step' : undefined}
                aria-label={`${isKm ? 'ទៅជំហាន' : 'Go to step'} ${idx + 1}: ${
                  isKm ? s.tabKhmer : s.tabEnglish
                }`}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1 text-center transition',
                  active
                    ? 'bg-accent/15 text-accent font-semibold shadow-xs'
                    : completed
                      ? 'text-ink/80 hover:bg-surface'
                      : 'text-muted/60 hover:text-muted',
                )}
              >
                <span
                  className={cn(
                    'flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold',
                    active
                      ? 'bg-accent text-accent-ink'
                      : completed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-line text-muted',
                  )}
                >
                  {completed ? <Check className="h-2.5 w-2.5 stroke-[3]" /> : idx + 1}
                </span>
                <span className="hidden text-[11px] sm:inline truncate">
                  {isKm ? s.tabKhmer : s.tabEnglish}
                </span>
              </button>
            );
          })}
        </div>

        {/* Visual Graphic & Content Container */}
        <div ref={contentRef} className="p-5 sm:p-6">
          {/* Visual SVG Graphic for the Active Step */}
          <div className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-gradient-to-b from-surface via-elevated/50 to-surface p-4 shadow-inner">
            {currentStep === 0 && <BoardControlsIllustration isKm={isKm} />}
            {currentStep === 1 && <WinConditionIllustration isKm={isKm} />}
            {currentStep === 2 && <TacticsIllustration isKm={isKm} />}
            {currentStep === 3 && <VoiceModesIllustration isKm={isKm} />}
          </div>

          {/* Step Text Info */}
          <div className="space-y-1.5" aria-live="polite" aria-atomic="true">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-block rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                {isKm ? step.badgeKhmer : step.badgeEnglish}
              </span>
              <span
                aria-hidden="true"
                className="text-[10px] font-semibold text-muted tracking-wide uppercase"
              >
                {isKm ? step.badgeEnglish : step.badgeKhmer}
              </span>
            </div>
            <h3 className="text-base font-bold text-ink sm:text-lg">
              {isKm ? step.titleKhmer : step.titleEnglish}
            </h3>
            <p className="text-xs leading-relaxed text-muted sm:text-[13px]">
              {isKm ? step.descriptionKhmer : step.descriptionEnglish}
            </p>
          </div>

          {/* Highlights List */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {step.highlights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl border border-line/70 bg-surface/80 p-2.5 shadow-2xs"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11.5px] font-bold leading-tight text-ink">
                      {isKm ? item.titleKhmer : item.titleEnglish}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-muted">
                      {isKm ? item.descKhmer : item.descEnglish}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Navigation Bar */}
        <div className="flex flex-col gap-3 border-t border-line bg-elevated/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex cursor-pointer items-center gap-2 select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-line text-accent accent-accent focus:ring-accent"
            />
            <span className="text-[11px] font-medium text-muted">
              {isKm ? 'កុំបង្ហាញម្តងទៀត' : "Don't show again"}
            </span>
          </label>

          <div className="flex items-center gap-2 sm:self-auto self-end w-full sm:w-auto">
            {!isFirst ? (
              <button
                type="button"
                onClick={handlePrev}
                className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-xs font-semibold text-ink shadow-2xs transition hover:bg-elevated active:scale-95"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                <span>{isKm ? 'ថយក្រោយ' : 'Back'}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleNext}
              className={cn(
                'flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-soft transition active:scale-95',
                isLast
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-emerald-500/20'
                  : 'bg-accent text-accent-ink hover:opacity-95 shadow-accent/20',
              )}
            >
              <span>{isLast ? (isKm ? 'យល់ហើយ' : 'Got it') : isKm ? 'បន្ទាប់' : 'Next'}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* =========================================================================
   Rich Step Illustrations (Custom Scalable Vector Graphics)
   ========================================================================= */

/** Step 1: Infinite Board, Panning & Gestures */
function BoardControlsIllustration({ isKm }: { isKm: boolean }) {
  return (
    <div className="relative flex h-48 w-full select-none items-center justify-center overflow-hidden">
      {/* Grid Canvas representation */}
      <svg
        viewBox="0 0 340 180"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern id="gridPattern" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="currentColor" strokeWidth="1" className="text-line/60" />
          </pattern>
          <radialGradient id="tapRipple" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent, #38bdf8)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-accent, #38bdf8)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Grid Background */}
        <rect width="340" height="180" fill="url(#gridPattern)" />

        {/* Existing Stones on Board */}
        <circle cx="85" cy="65" r="11" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
        <circle cx="85" cy="65" r="5" className="fill-rose-500" />
        <circle cx="115" cy="95" r="11" className="fill-emerald-500/20 stroke-emerald-500 stroke-2" />
        <path d="M110 90 L120 100 M120 90 L110 100" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />

        {/* Active Placement Target (Center) */}
        <rect
          x="136"
          y="51"
          width="28"
          height="28"
          rx="6"
          className="fill-accent/15 stroke-accent stroke-2 animate-pulse"
        />
        <circle cx="150" cy="65" r="18" fill="url(#tapRipple)" />
        <circle cx="150" cy="65" r="10" className="fill-accent text-accent-ink" />
        <path d="M145 60 L155 70 M155 60 L145 70" stroke="white" strokeWidth="2.5" strokeLinecap="round" />

        {/* Tap Gesture Pointer */}
        <g transform="translate(155, 75)">
          <path
            d="M5 2 L5 16 C5 18 2 20 0 24 L10 24 C14 20 16 16 16 12 L16 8 C16 6 14 5 12 5 C11 5 9 6 9 8 L9 2 C9 0 7 0 7 2 Z"
            fill="currentColor"
            className="text-amber-400 drop-shadow-md"
          />
          <circle cx="5" cy="2" r="3" fill="#f59e0b" />
        </g>

        {/* Pan Arrows (Drag gesture cue) */}
        <g className="text-muted/70">
          <circle cx="250" cy="90" r="28" className="fill-surface/90 stroke-line" strokeWidth="1.5" />
          <path d="M250 68 L250 112 M228 90 L272 90" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M246 72 L250 68 L254 72" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M246 108 L250 112 L254 108" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M232 86 L228 90 L232 94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M268 86 L272 90 L268 94" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <text x="250" y="132" textAnchor="middle" className="fill-ink text-[9px] font-bold">
            {isKm ? 'អូសដើម្បីរំកិល (Drag)' : 'Drag to pan'}
          </text>
        </g>

        {/* Zoom In/Out cue */}
        <g transform="translate(25, 110)">
          <rect width="84" height="26" rx="13" className="fill-surface/95 stroke-line shadow-xs" strokeWidth="1.2" />
          <circle cx="16" cy="13" r="6" stroke="currentColor" strokeWidth="1.5" className="text-accent" />
          <path d="M20 17 L24 21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-accent" />
          <text x="32" y="16" className="fill-ink text-[9.5px] font-bold">
            {isKm ? 'ពង្រីកម្រាមពីរ' : 'Pinch to zoom'}
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Step 2: 5-in-a-Row Gomoku Goal & Directions */
function WinConditionIllustration({ isKm }: { isKm: boolean }) {
  return (
    <div className="relative flex h-48 w-full select-none items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 340 180"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="winGlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="1" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.8" />
          </linearGradient>
          <filter id="glowBlur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Board Lines */}
        <line x1="30" y1="50" x2="310" y2="50" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="30" y1="90" x2="310" y2="90" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="30" y1="130" x2="310" y2="130" stroke="currentColor" strokeWidth="1" className="text-line/70" />

        <line x1="55" y1="30" x2="55" y2="150" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="105" y1="30" x2="105" y2="150" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="155" y1="30" x2="155" y2="150" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="205" y1="30" x2="205" y2="150" stroke="currentColor" strokeWidth="1" className="text-line/70" />
        <line x1="255" y1="30" x2="255" y2="150" stroke="currentColor" strokeWidth="1" className="text-line/70" />

        {/* Glowing 5-in-a-row Winning Ray */}
        <line
          x1="45"
          y1="90"
          x2="265"
          y2="90"
          stroke="url(#winGlow)"
          strokeWidth="7"
          strokeLinecap="round"
          filter="url(#glowBlur)"
        />
        <line x1="45" y1="90" x2="265" y2="90" stroke="#fef08a" strokeWidth="3" strokeLinecap="round" />

        {/* 5 Winning Stones (X) */}
        {[55, 105, 155, 205, 255].map((x, idx) => (
          <g key={idx} transform={`translate(${x}, 90)`}>
            <circle cx="0" cy="0" r="16" className="fill-amber-500/20 stroke-amber-400 stroke-2" />
            <circle cx="0" cy="0" r="13" className="fill-amber-500" />
            <path
              d="M-5 -5 L5 5 M5 -5 L-5 5"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Number indicator */}
            <circle cx="9" cy="-9" r="6" className="fill-ink text-surface" />
            <text x="9" y="-6.5" textAnchor="middle" className="fill-surface text-[7px] font-black">
              {idx + 1}
            </text>
          </g>
        ))}

        {/* Other Opponent Stones */}
        <g transform="translate(105, 50)">
          <circle cx="0" cy="0" r="13" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          <circle cx="0" cy="0" r="5" className="fill-rose-500" />
        </g>
        <g transform="translate(205, 130)">
          <circle cx="0" cy="0" r="13" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          <circle cx="0" cy="0" r="5" className="fill-rose-500" />
        </g>

        {/* Win Badge Header */}
        <g transform="translate(170, 25)">
          <rect x="-85" y="-12" width="170" height="24" rx="12" className="fill-amber-500 shadow-md" />
          <text x="0" y="4" textAnchor="middle" fill="#ffffff" className="text-[11px] font-black tracking-wide">
            {isKm ? '🏆 ៥ គ្រាប់ = ឈ្នះភ្លាមៗ (WIN!)' : '🏆 5 in a row = WIN!'}
          </text>
        </g>

        {/* Subtitle directions footer */}
        <g transform="translate(170, 165)">
          <text x="0" y="0" textAnchor="middle" className="fill-muted text-[10px] font-bold">
            {isKm ? 'ជួរដេក ↔ · ជួរឈរ ↕ · អង្កត់ទ្រូង ⤢' : 'Row ↔ · Column ↕ · Diagonal ⤢'}
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Step 3: Attack vs Defense Strategy */
function TacticsIllustration({ isKm }: { isKm: boolean }) {
  return (
    <div className="relative flex h-48 w-full select-none items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 340 180"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Grid lines */}
        {[40, 80, 120, 160].map((y) => (
          <line key={y} x1="20" y1={y} x2="320" y2={y} stroke="currentColor" strokeWidth="1" className="text-line/60" />
        ))}
        {[50, 95, 140, 185, 230, 275].map((x) => (
          <line key={x} x1={x} y1="20" x2={x} y2="170" stroke="currentColor" strokeWidth="1" className="text-line/60" />
        ))}

        {/* Opponent's dangerous 3-in-a-row */}
        <g transform="translate(95, 80)">
          <circle cx="0" cy="0" r="14" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          <circle cx="0" cy="0" r="6" className="fill-rose-500" />
        </g>
        <g transform="translate(140, 80)">
          <circle cx="0" cy="0" r="14" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          <circle cx="0" cy="0" r="6" className="fill-rose-500" />
        </g>
        <g transform="translate(185, 80)">
          <circle cx="0" cy="0" r="14" className="fill-rose-500/20 stroke-rose-500 stroke-2" />
          <circle cx="0" cy="0" r="6" className="fill-rose-500" />
        </g>

        {/* BLOCK TARGET on the right (230, 80) */}
        <g transform="translate(230, 80)">
          <circle cx="0" cy="0" r="18" className="fill-rose-500/15 stroke-rose-500 stroke-2 stroke-dashed animate-pulse" />
          <rect x="-10" y="-10" width="20" height="20" rx="4" className="fill-rose-600 shadow-md" />
          <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
        </g>

        {/* Warning Badge Callout */}
        <g transform="translate(230, 42)">
          <rect x="-42" y="-11" width="84" height="22" rx="11" className="fill-rose-600 shadow-md" />
          <text x="0" y="4" textAnchor="middle" fill="#ffffff" className="text-[9.5px] font-black">
            {isKm ? '🚨 ត្រូវបិទ! (BLOCK)' : '🚨 BLOCK!'}
          </text>
          <path d="M0 11 L-4 15 L4 15 Z" fill="#e11d48" />
        </g>

        {/* Player's Double Threat Attack (Diagonal 3) */}
        <g transform="translate(50, 120)">
          <circle cx="0" cy="0" r="14" className="fill-accent/20 stroke-accent stroke-2" />
          <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="currentColor" strokeWidth="2.5" className="text-accent" />
        </g>
        <g transform="translate(95, 120)">
          <circle cx="0" cy="0" r="14" className="fill-accent/20 stroke-accent stroke-2" />
          <path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="currentColor" strokeWidth="2.5" className="text-accent" />
        </g>

        {/* Tactics tips badge on bottom */}
        <g transform="translate(170, 155)">
          <rect x="-115" y="-10" width="230" height="22" rx="11" className="fill-surface stroke-line shadow-xs" />
          <text x="0" y="4.5" textAnchor="middle" className="fill-ink text-[10px] font-bold">
            {isKm
              ? '⚔️ បិទក្បាលគូប្រកួត + បង្កើតផ្លូវវាយលុក ២ ច្រក'
              : '⚔️ Block the threat + create two attack lines'}
          </text>
        </g>
      </svg>
    </div>
  );
}

/** Step 4: Walkie-Talkie Push-to-Talk & Game Modes */
function VoiceModesIllustration({ isKm }: { isKm: boolean }) {
  return (
    <div className="relative flex h-48 w-full select-none items-center justify-center overflow-hidden">
      <svg
        viewBox="0 0 340 180"
        className="h-full w-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="micPulse" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Left Side: Walkie Talkie Device Graphic */}
        <g transform="translate(85, 90)">
          {/* Animated sound ripple rings */}
          <circle cx="0" cy="0" r="44" fill="url(#micPulse)" />
          <circle cx="0" cy="0" r="32" className="stroke-emerald-500/40 stroke-2" strokeDasharray="3 3" />

          {/* Device Button */}
          <rect
            x="-26"
            y="-26"
            width="52"
            height="52"
            rx="16"
            className="fill-emerald-600 stroke-emerald-400 stroke-2 shadow-lg"
          />

          {/* Microphone Icon */}
          <g transform="translate(-10, -10)" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="2" width="10" height="13" rx="5" fill="#ffffff" fillOpacity="0.2" />
            <path d="M2 10 A8 8 0 0 0 18 10" />
            <line x1="10" y1="18" x2="10" y2="22" />
            <line x1="6" y1="22" x2="14" y2="22" />
          </g>

          {/* Waveform bars */}
          <g transform="translate(-20, 36)" fill="#10b981">
            <rect x="4" y="-3" width="3" height="6" rx="1.5" />
            <rect x="10" y="-8" width="3" height="16" rx="1.5" />
            <rect x="16" y="-12" width="3" height="24" rx="1.5" />
            <rect x="22" y="-7" width="3" height="14" rx="1.5" />
            <rect x="28" y="-11" width="3" height="22" rx="1.5" />
            <rect x="34" y="-4" width="3" height="8" rx="1.5" />
          </g>

          <text x="0" y="58" textAnchor="middle" className="fill-ink text-[10px] font-black">
            {isKm ? 'ចុចសង្កត់ដើម្បីនិយាយ' : 'Hold to talk'}
          </text>
        </g>

        {/* Divider */}
        <line x1="170" y1="25" x2="170" y2="155" stroke="currentColor" strokeWidth="1" className="text-line/70" strokeDasharray="4 4" />

        {/* Right Side: Game Modes Badges */}
        <g transform="translate(190, 45)">
          {/* Quick Match */}
          <g transform="translate(0, 0)">
            <rect width="130" height="32" rx="10" className="fill-accent/10 stroke-accent/40 stroke-1" />
            <circle cx="16" cy="16" r="9" className="fill-accent text-accent-ink" />
            <text x="32" y="15" className="fill-ink text-[10.5px] font-bold">
              Quick Match
            </text>
            <text x="32" y="25" className="fill-muted text-[8.5px] font-semibold">
              {isKm ? 'ប្រកួតចៃដន្យ Rated' : 'Rated match'}
            </text>
          </g>

          {/* Invite Friend */}
          <g transform="translate(0, 42)">
            <rect width="130" height="32" rx="10" className="fill-surface stroke-line stroke-1 shadow-2xs" />
            <circle cx="16" cy="16" r="9" className="fill-elevated text-ink" />
            <text x="32" y="15" className="fill-ink text-[10.5px] font-bold">
              Invite Friend
            </text>
            <text x="32" y="25" className="fill-muted text-[8.5px] font-semibold">
              {isKm ? 'តំណ link ជាមួយមិត្ត' : 'Private link'}
            </text>
          </g>

          {/* Practice Bot */}
          <g transform="translate(0, 84)">
            <rect width="130" height="32" rx="10" className="fill-surface stroke-line stroke-1 shadow-2xs" />
            <circle cx="16" cy="16" r="9" className="fill-elevated text-ink" />
            <text x="32" y="15" className="fill-ink text-[10.5px] font-bold">
              Practice Bot
            </text>
            <text x="32" y="25" className="fill-muted text-[8.5px] font-semibold">
              {isKm ? 'ហ្វឹកហាត់ Unrated' : 'Unrated practice'}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}
