import { memo } from 'react';
import type { Side } from '../../../shared/game-types';
import { cn } from '../../lib/cn';

export interface DisplayChatMessage {
  messageId: string;
  senderSide: Side;
  isYou: boolean;
  text: string;
  timestamp: string;
}

interface ChatOverlayProps {
  message: DisplayChatMessage | null;
}

export const ChatOverlay = memo(function ChatOverlay({ message }: ChatOverlayProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none relative z-30 flex max-w-[min(16rem,65vw)] animate-reaction-pop"
      style={{
        filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.14))',
      }}
    >
      <div
        className={cn(
          'relative whitespace-pre-wrap break-words rounded-2xl border bg-surface/95 px-3 py-1.5 text-[11px] font-medium leading-snug text-ink shadow-sm backdrop-blur-md',
          message.isYou
            ? 'rounded-tl-xs border-accent/40 shadow-accent/10'
            : 'rounded-tr-xs border-danger/40 shadow-danger/10',
        )}
      >
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              message.isYou ? 'bg-accent' : 'bg-danger',
            )}
            aria-hidden="true"
          />
          <span>{message.text}</span>
        </div>
      </div>
    </div>
  );
});
