import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/cn';
import { getNextLanguage, isKhmer, normalizeLanguage, LANGUAGE_OPTIONS, type SupportedLanguage } from '../lib/language';
import { CircularFlag } from './CircularFlag';
import { hapticSelection } from '../lib/telegram';
import type { GameClient } from '../hooks/use-game-client';

export interface LanguageButtonProps {
  client?: GameClient;
  languageCode?: string | null;
  onLanguageChange?: (lang: SupportedLanguage) => Promise<void> | void;
  variant?: 'circle' | 'pill' | 'segmented';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LanguageButton({
  client,
  languageCode,
  onLanguageChange,
  variant = 'circle',
  size = 'md',
  className,
}: LanguageButtonProps) {
  const currentRaw = languageCode ?? client?.profile?.languageCode;
  const currentLang = normalizeLanguage(currentRaw);
  const isKm = isKhmer(currentRaw);
  const [switching, setSwitching] = useState(false);
  const [flipping, setFlipping] = useState(false);
  const [displayedLang, setDisplayedLang] = useState<SupportedLanguage>(currentLang);
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const swapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!flipping) {
      setDisplayedLang(currentLang);
    }
  }, [currentLang, flipping]);

  useEffect(() => {
    return () => {
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
      if (swapTimerRef.current) clearTimeout(swapTimerRef.current);
    };
  }, []);

  async function handleSelectLanguage(targetLang: SupportedLanguage) {
    if (targetLang === currentLang || switching) return;
    setSwitching(true);
    setFlipping(true);

    if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    if (swapTimerRef.current) clearTimeout(swapTimerRef.current);

    // Swap the flag face smoothly at the 90deg edge-on midpoint (200ms into 420ms flip)
    swapTimerRef.current = setTimeout(() => {
      setDisplayedLang(targetLang);
    }, 200);

    flipTimerRef.current = setTimeout(() => {
      setFlipping(false);
    }, 420);

    try {
      hapticSelection();
    } catch {
      // ignore
    }

    try {
      if (onLanguageChange) {
        await onLanguageChange(targetLang);
      } else if (client) {
        await client.updateProfile({ languageCode: targetLang });
      }
    } catch {
      setDisplayedLang(currentLang);
      setFlipping(false);
      if (client) {
        client.pushToast({
          type: 'error',
          title: isKm ? 'មិនអាចប្តូរភាសាបានទេ' : 'Language update failed',
        });
      }
    } finally {
      setSwitching(false);
    }
  }

  function handleToggle() {
    const next = getNextLanguage(currentLang);
    void handleSelectLanguage(next);
  }

  const nextLang = getNextLanguage(currentLang);
  const toggleAriaLabel =
    nextLang === 'km'
      ? 'Switch language to Khmer (ប្តូរទៅជាភាសាខ្មែរ)'
      : 'Switch language to English (ប្តូរទៅជាភាសាអង់គ្លេស)';

  if (variant === 'segmented') {
    return (
      <div
        role="group"
        aria-label="Language selection"
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-line bg-surface/80 p-1 shadow-xs backdrop-blur-sm',
          className,
        )}
      >
        {LANGUAGE_OPTIONS.map((opt) => {
          const isSelected = opt.code === displayedLang;
          return (
            <button
              key={opt.code}
              type="button"
              disabled={switching}
              onClick={() => void handleSelectLanguage(opt.code)}
              aria-pressed={isSelected}
              className={cn(
                'group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
                isSelected
                  ? 'bg-elevated text-ink shadow-xs ring-1 ring-accent/30 font-bold'
                  : 'text-muted hover:bg-elevated/50 hover:text-ink',
              )}
            >
              <CircularFlag
                code={opt.code}
                size={size === 'sm' ? 'xs' : 'sm'}
                style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                className={cn(
                  'transition-transform duration-200 will-change-transform',
                  isSelected && flipping && 'animate-flag-flip',
                  isSelected && !flipping ? 'scale-105 ring-1 ring-accent/40' : 'opacity-80 group-hover:opacity-100 group-hover:scale-105',
                )}
              />
              <span>{opt.nativeLabel}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'pill') {
    return (
      <button
        type="button"
        disabled={switching}
        onClick={handleToggle}
        aria-label={toggleAriaLabel}
        title={toggleAriaLabel}
        className={cn(
          'group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-bold text-ink shadow-xs transition-all duration-200 hover:border-accent/40 hover:bg-elevated active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
          size === 'sm' && 'h-8 px-2 text-[11px]',
          size === 'lg' && 'h-10 px-3 text-sm',
          className,
        )}
      >
        <span
          style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
          className={cn(
            'inline-flex items-center justify-center will-change-transform',
            flipping && 'animate-flag-flip',
            !flipping && 'transition-transform duration-200 group-hover:scale-105',
          )}
        >
          <CircularFlag code={displayedLang} size={size === 'sm' ? 'xs' : 'sm'} />
        </span>
        <span className="tracking-wide uppercase text-[11px] font-extrabold text-muted group-hover:text-ink">
          {displayedLang.toUpperCase()}
        </span>
      </button>
    );
  }

  // variant === 'circle' (pure circular button with the circular flag)
  const flagSize = size === 'sm' ? 'xs' : size === 'lg' ? 'md' : 'sm';
  const buttonDimension = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9';

  return (
    <button
      type="button"
      disabled={switching}
      onClick={handleToggle}
      aria-label={toggleAriaLabel}
      title={toggleAriaLabel}
      className={cn(
        'group relative inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface p-0.5 shadow-xs transition-all duration-200 hover:border-accent/50 hover:bg-elevated hover:shadow-soft active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60',
        buttonDimension,
        className,
      )}
    >
      <span
        style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
        className={cn(
          'inline-flex items-center justify-center will-change-transform',
          flipping && 'animate-flag-flip',
          !flipping && 'transition-transform duration-200 group-hover:scale-105',
        )}
      >
        <CircularFlag
          code={displayedLang}
          size={flagSize}
          ring
          className="shadow-sm"
        />
      </span>

      {/* Tiny active locale badge indicator */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface text-[8px] font-black uppercase tracking-tighter ring-1 shadow-xs transition-all duration-200',
          flipping
            ? 'scale-110 text-accent ring-accent/60 font-black'
            : 'text-muted ring-line group-hover:text-accent group-hover:ring-accent/50',
        )}
      >
        {displayedLang.toUpperCase()}
      </span>
    </button>
  );
}
