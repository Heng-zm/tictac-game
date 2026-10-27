import { memo } from 'react';
import type { Side } from '../../../shared/game-types';

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
    >
      <p
        className={`whitespace-pre-wrap break-words rounded-2xl border border-line/60 bg-surface/95 px-2.5 py-1.5 text-[11px] font-medium leading-snug text-ink shadow-sm backdrop-blur-md ${
          message.isYou ? 'rounded-bl-md' : 'rounded-br-md'
        }`}
      >
        {message.text}
      </p>
    </div>
  );
});
