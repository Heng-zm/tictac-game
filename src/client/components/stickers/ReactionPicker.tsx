import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react';
import { X, Sparkles, MessageSquare, Smile, Zap, Send } from 'lucide-react';
import {
  STICKER_LIST,
  getStickerLabel,
  QUICK_CHAT_PRESETS,
  getQuickChatText,
  type StickerCategory,
  type StickerDefinition,
  type StickerId,
} from '../../../shared/stickers';
import { StickerCharacter } from './StickerCharacter';
import { hapticImpact } from '../../lib/telegram';
import { isKhmer } from '../../lib/language';
import { cn } from '../../lib/cn';
import { CHAT_MESSAGE_MAX_LENGTH } from '../../../shared/events';

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stickerId: StickerId) => void;
  onSendText?: (text: string) => void;
  languageCode?: string | null;
  disabled?: boolean;
}

export function ReactionPicker({
  isOpen,
  onClose,
  onSelect,
  onSendText,
  languageCode,
  disabled = false,
}: ReactionPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<StickerCategory>('all');
  const [sendingId, setSendingId] = useState<StickerId | null>(null);
  const [draft, setDraft] = useState('');
  const trayRef = useRef<HTMLDivElement>(null);
  const sendTimerRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Filter stickers by active tab
  const filteredStickers = useMemo(() => {
    if (selectedCategory === 'all') return STICKER_LIST;
    return STICKER_LIST.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const isKm = isKhmer(languageCode);
  const trimmedDraft = draft.trim();
  const canSendText = !disabled && trimmedDraft.length > 0;

  const categories: { id: StickerCategory; label: string; icon: typeof Sparkles }[] = [
    { id: 'all', label: isKm ? 'ទាំងអស់' : 'All', icon: Sparkles },
    { id: 'chat', label: isKm ? 'ជជែករហ័ស' : 'Chat', icon: MessageSquare },
    { id: 'emotion', label: isKm ? 'អារម្មណ៍' : 'Emotions', icon: Smile },
    { id: 'tactics', label: isKm ? 'យុទ្ធសាស្ត្រ' : 'Tactics', icon: Zap },
  ];

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Start every visit with an empty composer.
  useEffect(() => {
    if (!isOpen) setDraft('');
  }, [isOpen]);

  // A pick sends after a short feedback delay. Closing the picker (backdrop,
  // Escape, Telegram back) must cancel that pending send instead of firing an
  // action for a match the player has already dismissed.
  useEffect(() => {
    if (isOpen) return;
    if (sendTimerRef.current !== null) {
      window.clearTimeout(sendTimerRef.current);
      sendTimerRef.current = null;
    }
    setSendingId(null);
  }, [isOpen]);

  useEffect(
    () => () => {
      if (sendTimerRef.current !== null) window.clearTimeout(sendTimerRef.current);
    },
    [],
  );

  if (!isOpen) return null;

  const handlePick = (sticker: StickerDefinition) => {
    if (disabled || sendingId !== null) return;
    hapticImpact('light');
    setSendingId(sticker.id);

    // Brief tactile send feedback before closing
    sendTimerRef.current = window.setTimeout(() => {
      sendTimerRef.current = null;
      onSelectRef.current(sticker.id);
      setSendingId(null);
      onCloseRef.current();
    }, 180);
  };

  const handleSendText = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSendText || !onSendText) return;
    hapticImpact('light');
    onSendText(trimmedDraft);
    setDraft('');
    onClose();
  };

  const handleQuickChatPreset = (text: string) => {
    if (disabled || !onSendText) return;
    hapticImpact('light');
    onSendText(text);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isKm ? 'ជ្រើសរើសស្ទីគ័រប្រតិកម្ម' : 'Choose sticker reaction'}
      className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-auto"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Tray Bottom Sheet */}
      <div
        ref={trayRef}
        className="relative z-10 mx-auto w-full max-w-lg rounded-t-3xl border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3 shadow-2xl backdrop-blur-md transition-transform animate-sheet-up sm:mb-4 sm:max-w-2xl sm:rounded-3xl sm:border sm:pb-5"
      >
        {/* Grab Handle */}
        <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-muted/30 sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h3 className="truncate text-sm font-semibold text-ink">
              {isKm ? 'ស្ទីគ័រប្រតិកម្ម & ជជែករហ័ស' : 'Sticker Reactions & Quick Chat'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-elevated hover:text-ink active:scale-95 transition"
            aria-label={isKm ? 'បិទ' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Custom chat composer */}
        {onSendText ? (
          <form onSubmit={handleSendText} className="flex items-center gap-2 pt-2.5">
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={CHAT_MESSAGE_MAX_LENGTH}
              disabled={disabled}
              enterKeyHint="send"
              autoComplete="off"
              placeholder={isKm ? 'សរសេរសាររហ័ស…' : 'Write a quick message…'}
              aria-label={isKm ? 'សារជជែក' : 'Chat message'}
              className="min-w-0 flex-1 rounded-full border border-line bg-elevated/60 px-3.5 py-2 text-sm text-ink placeholder:text-muted transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!canSendText}
              aria-label={isKm ? 'ផ្ញើសារ' : 'Send message'}
              title={isKm ? 'ផ្ញើសារ' : 'Send message'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-accent/25 transition-all duration-150 hover:from-blue-500 hover:to-indigo-500 active:scale-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>
        ) : null}

        {/* Quick Chat Presets (One-tap messages) */}
        {onSendText ? (
          <div className="pt-2">
            <div
              className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar"
              aria-label={isKm ? 'ឃ្លាជជែករហ័ស' : 'Quick chat phrases'}
            >
              {QUICK_CHAT_PRESETS.map((preset) => {
                const text = getQuickChatText(preset, languageCode);
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleQuickChatPreset(text)}
                    disabled={disabled}
                    aria-label={isKm ? `សាររហ័ស៖ ${text}` : `Quick message: ${text}`}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-line/70 bg-elevated/80 px-3 py-1 text-xs font-semibold text-ink shadow-sm transition-all duration-150 hover:border-accent/40 hover:bg-elevated hover:shadow-xs active:scale-95"
                  >
                    <span aria-hidden="true">{preset.emoji}</span>
                    <span>{text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-2.5 no-scrollbar">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  hapticImpact('light');
                  setSelectedCategory(cat.id);
                }}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95',
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-accent/25 font-semibold'
                    : 'bg-elevated/70 text-muted hover:bg-elevated hover:text-ink border border-line/50',
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Sticker Grid (4 columns on mobile, 6 on wider sheets) */}
        <div className="no-scrollbar grid max-h-[46vh] grid-cols-4 gap-2 overflow-y-auto overscroll-contain py-1 pr-0.5 sm:max-h-[52vh] sm:grid-cols-6 sm:gap-2.5">
          {filteredStickers.map((sticker) => {
            const isSending = sendingId === sticker.id;
            const label = getStickerLabel(sticker.id, languageCode);

            return (
              <button
                key={sticker.id}
                type="button"
                onClick={() => handlePick(sticker)}
                disabled={disabled}
                className={cn(
                  'group relative flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-elevated/50 p-2 transition-all duration-150 hover:bg-elevated hover:border-accent/40 hover:shadow-soft hover:-translate-y-0.5 active:scale-90',
                  isSending && 'ring-2 ring-accent scale-95 bg-accent/10',
                )}
                title={label}
              >
                <div className="h-12 w-12 flex items-center justify-center transition-transform duration-200 group-hover:scale-115">
                  <StickerCharacter id={sticker.id} size={48} animate={true} />
                </div>
                <span className="mt-1 w-full text-center text-[10.5px] font-medium leading-tight text-ink/90 truncate">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
