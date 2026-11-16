import { useState } from 'react';
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

  async function handleSelectLanguage(targetLang: SupportedLanguage) {
    if (targetLang === currentLang || switching) return;
    setSwitching(true);
    setFlipping(true);
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
      if (client) {
        client.pushToast({
          type: 'error',
          title: isKm ? 'មិនអាចប្តូរភាសាបានទេ' : 'Language update failed',
        });
      }
    } finally {
      setSwitching(false);
      setTimeout(() => setFlipping(false), 350);
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
          const isSelected = opt.code === currentLang;
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
                className={cn(
                  'transition-transform duration-200',
                  isSelected ? 'scale-105 ring-1 ring-accent/40' : 'opacity-80 group-hover:opacity-100 group-hover:scale-105',
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
          className={cn(
            'inline-flex transition-transform duration-300 ease-out',
            flipping && 'rotate-[360deg] scale-110',
          )}
        >
          <CircularFlag code={currentLang} size={size === 'sm' ? 'xs' : 'sm'} />
        </span>
        <span className="tracking-wide uppercase text-[11px] font-extrabold text-muted group-hover:text-ink">
          {currentLang.toUpperCase()}
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
        className={cn(
          'inline-flex items-center justify-center transition-all duration-300 ease-out',
          flipping && 'rotate-[360deg] scale-110',
          'group-hover:scale-105',
        )}
      >
        <CircularFlag
          code={currentLang}
          size={flagSize}
          ring
          className="shadow-sm transition-transform duration-200"
        />
      </span>

      {/* Tiny active locale badge indicator */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface text-[8px] font-black uppercase tracking-tighter text-muted ring-1 ring-line shadow-xs group-hover:text-accent group-hover:ring-accent/50"
      >
        {currentLang.toUpperCase()}
      </span>
    </button>
  );
}
