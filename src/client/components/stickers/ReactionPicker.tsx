import { useState, useMemo, useEffect, useRef } from 'react';
import { X, Sparkles, MessageSquare, Smile, Zap } from 'lucide-react';
import {
  STICKER_LIST,
  getStickerLabel,
  type StickerCategory,
  type StickerDefinition,
  type StickerId,
} from '../../../shared/stickers';
import { StickerCharacter } from './StickerCharacter';
import { hapticImpact } from '../../lib/telegram';

interface ReactionPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (stickerId: StickerId) => void;
  languageCode?: string | null;
  disabled?: boolean;
}

export function ReactionPicker({
  isOpen,
  onClose,
  onSelect,
  languageCode,
  disabled = false,
}: ReactionPickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<StickerCategory>('all');
  const [sendingId, setSendingId] = useState<StickerId | null>(null);
  const trayRef = useRef<HTMLDivElement>(null);

  // Filter stickers by active tab
  const filteredStickers = useMemo(() => {
    if (selectedCategory === 'all') return STICKER_LIST;
    return STICKER_LIST.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const isKm = (languageCode ?? '').toLowerCase().startsWith('km');

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

  if (!isOpen) return null;

  const handlePick = (sticker: StickerDefinition) => {
    if (disabled || sendingId !== null) return;
    hapticImpact('light');
    setSendingId(sticker.id);

    // Brief tactile send feedback before closing
    setTimeout(() => {
      onSelect(sticker.id);
      setSendingId(null);
      onClose();
    }, 180);
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
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                  active
                    ? 'bg-accent text-accent-ink shadow-sm'
                    : 'bg-elevated text-muted hover:bg-elevated/80 hover:text-ink'
                }`}
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
                className={`group relative flex flex-col items-center justify-center rounded-2xl border border-line/60 bg-elevated/50 p-2 transition-all hover:bg-elevated hover:border-accent/40 active:scale-90 ${
                  isSending ? 'ring-2 ring-accent scale-95 bg-accent/10' : ''
                }`}
                title={label}
              >
                <div className="h-12 w-12 flex items-center justify-center transition-transform group-hover:scale-110">
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
