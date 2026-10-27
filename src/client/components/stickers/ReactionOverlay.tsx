import { memo } from 'react';
import type { StickerId } from '../../../shared/stickers';
import { getStickerLabel } from '../../../shared/stickers';
import { StickerCharacter } from './StickerCharacter';

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
      className="pointer-events-none relative z-30 flex flex-col items-center animate-reaction-pop"
      style={{
        filter: 'drop-shadow(0 6px 14px rgba(0, 0, 0, 0.16))',
      }}
    >
      {/* Animated Character Mascot */}
      <div className="relative flex items-center justify-center">
        <StickerCharacter id={reaction.stickerId} size={58} animate={true} />
      </div>

      {/* Quick-Chat Text Label Bubble */}
      {label ? (
        <div className="mt-1 flex items-center rounded-full border border-line/60 bg-surface/95 backdrop-blur-md px-2.5 py-0.5 shadow-sm">
          <span className="text-[11px] font-semibold text-ink whitespace-nowrap">
            {label}
          </span>
        </div>
      ) : null}
    </div>
  );
});
