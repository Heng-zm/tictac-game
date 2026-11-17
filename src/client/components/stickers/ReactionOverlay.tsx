import { memo } from 'react';
import type { StickerId } from '../../../shared/stickers';
import { getStickerLabel } from '../../../shared/stickers';
import { StickerCharacter } from './StickerCharacter';
import { cn } from '../../lib/cn';

export interface DisplayReaction {
  reactionId: string;
  senderSide: 'X' | 'O';
  isYou: boolean;
  stickerId: StickerId;
  timestamp: string;
}

interface ReactionOverlayProps {
  reaction: DisplayReaction | null;
  languageCode?: string | null;
}

export const ReactionOverlay = memo(function ReactionOverlay({
  reaction,
  languageCode,
}: ReactionOverlayProps) {
  if (!reaction) return null;

  const label = getStickerLabel(reaction.stickerId, languageCode);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none relative z-30 flex flex-col items-center animate-reaction-pop will-change-transform"
      style={{
        filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.16))',
        transform: 'translate3d(0, 0, 0)',
      }}
    >
      {/* Animated Character Mascot */}
      <div className="relative flex items-center justify-center transition-transform hover:scale-105">
        <StickerCharacter id={reaction.stickerId} size={48} className="sm:scale-115" animate={true} />
      </div>

      {/* Quick-Chat Text Label Bubble */}
      {label ? (
        <div
          className={cn(
            'mt-1 flex max-w-[115px] sm:max-w-[160px] items-center rounded-full border bg-surface/95 backdrop-blur-md px-2 py-0.5 shadow-sm sm:px-2.5',
            reaction.isYou ? 'border-accent/40 shadow-accent/10' : 'border-danger/40 shadow-danger/10',
          )}
        >
          <span className="text-[10px] sm:text-[11px] font-semibold text-ink truncate">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
});
