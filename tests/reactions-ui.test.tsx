// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STICKER_IDS } from '../src/shared/stickers';
import { CHAT_MESSAGE_MAX_LENGTH } from '../src/shared/events';
import { StickerCharacter } from '../src/client/components/stickers/StickerCharacter';
import { ReactionPicker } from '../src/client/components/stickers/ReactionPicker';
import { ReactionOverlay, type DisplayReaction } from '../src/client/components/stickers/ReactionOverlay';
import { ChatOverlay, type DisplayChatMessage } from '../src/client/components/stickers/ChatOverlay';

describe('Sticker Reactions UI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe('StickerCharacter', () => {
    it('renders vector graphics for all 12 animated sticker definitions', () => {
      for (const id of STICKER_IDS) {
        const { container } = render(<StickerCharacter id={id} size={48} animate={true} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
        expect(svg?.getAttribute('viewBox')).toBe('0 0 100 100');
        cleanup();
      }
    });

    it('does not render any raw emoji characters inside the vector asset', () => {
      const emojiRegex = /\p{Extended_Pictographic}/u;
      for (const id of STICKER_IDS) {
        const { container } = render(<StickerCharacter id={id} size={64} />);
        const textContent = container.textContent ?? '';
        expect(emojiRegex.test(textContent)).toBe(false);
        cleanup();
      }
    });
  });

  describe('ReactionPicker', () => {
    it('renders all stickers when open and allows filtering by category tabs', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <ReactionPicker
          isOpen={true}
          onClose={onClose}
          onSelect={onSelect}
          languageCode="en"
        />,
      );

      // Verify all 12 stickers are displayed initially (All tab)
      const buttons = screen.getAllByRole('button');
      // At least 4 category buttons + 1 close button + 12 sticker buttons = 17 buttons
      expect(buttons.length).toBeGreaterThanOrEqual(17);

      // Filter by 'Chat' tab
      const chatTab = screen.getByText('Chat');
      fireEvent.click(chatTab);

      // Verify chat stickers are displayed
      expect(screen.getByText('Hello!')).toBeTruthy();
      expect(screen.getByText('Good Game!')).toBeTruthy();

      // Click on a sticker
      fireEvent.click(screen.getByText('Hello!'));

      // Advance timer for the tactile feedback delay
      vi.advanceTimersByTime(250);

      expect(onSelect).toHaveBeenCalledWith('greeting');
      expect(onClose).toHaveBeenCalled();
    });

    it('renders Khmer translations when languageCode is km', () => {
      render(
        <ReactionPicker
          isOpen={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          languageCode="km"
        />,
      );

      // Khmer tab labels
      expect(screen.getByText('ទាំងអស់')).toBeTruthy(); // All
      expect(screen.getByText('ជជែករហ័ស')).toBeTruthy(); // Chat

      // Khmer quick-chat labels
      expect(screen.getByText('សួស្តី!')).toBeTruthy(); // Hello!
      expect(screen.getByText('ជ័យជំនះ!')).toBeTruthy(); // Victory!
    });

    it('closes on Escape key press', () => {
      const onClose = vi.fn();
      render(
        <ReactionPicker
          isOpen={true}
          onClose={onClose}
          onSelect={vi.fn()}
        />,
      );

      fireEvent.keyDown(window, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('does not render anything when isOpen is false', () => {
      const { container } = render(
        <ReactionPicker
          isOpen={false}
          onClose={vi.fn()}
          onSelect={vi.fn()}
        />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('sends trimmed custom chat text and closes the sheet', () => {
      const onSendText = vi.fn();
      const onClose = vi.fn();
      render(
        <ReactionPicker
          isOpen={true}
          onClose={onClose}
          onSelect={vi.fn()}
          onSendText={onSendText}
          languageCode="en"
        />,
      );

      const input = screen.getByRole('textbox', { name: 'Chat message' }) as HTMLInputElement;
      const send = screen.getByRole('button', { name: 'Send message' }) as HTMLButtonElement;
      expect(input.maxLength).toBe(CHAT_MESSAGE_MAX_LENGTH);
      expect(send.disabled).toBe(true);

      fireEvent.change(input, { target: { value: '   ' } });
      expect(send.disabled).toBe(true);

      fireEvent.change(input, { target: { value: '  Good luck!  ' } });
      expect(send.disabled).toBe(false);
      fireEvent.click(send);

      expect(onSendText).toHaveBeenCalledWith('Good luck!');
      expect(onClose).toHaveBeenCalled();
    });

    it('submits custom chat text through the form (Enter key path)', () => {
      const onSendText = vi.fn();
      render(
        <ReactionPicker
          isOpen={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          onSendText={onSendText}
        />,
      );

      const input = screen.getByRole('textbox', { name: 'Chat message' });
      fireEvent.change(input, { target: { value: 'Well played' } });
      fireEvent.submit(input.closest('form')!);

      expect(onSendText).toHaveBeenCalledWith('Well played');
    });

    it('localizes the custom chat composer in Khmer', () => {
      render(
        <ReactionPicker
          isOpen={true}
          onClose={vi.fn()}
          onSelect={vi.fn()}
          onSendText={vi.fn()}
          languageCode="km"
        />,
      );

      expect(screen.getByRole('textbox', { name: 'សារជជែក' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'ផ្ញើសារ' })).toBeTruthy();
    });
  });

  describe('ChatOverlay', () => {
    it('renders a transient custom chat bubble', () => {
      const message: DisplayChatMessage = {
        messageId: 'msg-1',
        senderSide: 'O',
        isYou: false,
        text: 'Nice move!',
        timestamp: new Date().toISOString(),
      };

      render(<ChatOverlay message={message} />);

      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText('Nice move!')).toBeTruthy();
    });

    it('renders user text literally rather than as markup', () => {
      const message: DisplayChatMessage = {
        messageId: 'msg-2',
        senderSide: 'X',
        isYou: true,
        text: '<b>hello</b>',
        timestamp: new Date().toISOString(),
      };

      const { container } = render(<ChatOverlay message={message} />);

      expect(screen.getByText('<b>hello</b>')).toBeTruthy();
      expect(container.querySelector('b')).toBeNull();
    });

    it('returns null when the message is null', () => {
      const { container } = render(<ChatOverlay message={null} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('ReactionOverlay', () => {
    it('renders animated reaction bubble with quick chat tag', () => {
      const reaction: DisplayReaction = {
        reactionId: 'rx-1',
        senderSide: 'X',
        isYou: true,
        stickerId: 'victory',
        timestamp: new Date().toISOString(),
      };

      render(<ReactionOverlay reaction={reaction} languageCode="en" />);

      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText('Victory!')).toBeTruthy();
    });

    it('renders Khmer label in ReactionOverlay when languageCode is km', () => {
      const reaction: DisplayReaction = {
        reactionId: 'rx-2',
        senderSide: 'O',
        isYou: false,
        stickerId: 'good_game',
        timestamp: new Date().toISOString(),
      };

      render(<ReactionOverlay reaction={reaction} languageCode="km" />);

      expect(screen.getByText('លេងបានល្អ!')).toBeTruthy();
    });

    it('returns null when reaction is null', () => {
      const { container } = render(<ReactionOverlay reaction={null} />);
      expect(container.firstChild).toBeNull();
    });
  });
});
