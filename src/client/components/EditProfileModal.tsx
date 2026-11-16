import { useEffect, useState } from 'react';
import { Camera, Check, Globe, Link as LinkIcon, Sparkles, User, X } from 'lucide-react';
import { Avatar, Button, Modal } from './ui';
import { CircularFlag } from './CircularFlag';
import { cn } from '../lib/cn';
import { isKhmer, normalizeLanguage, LANGUAGE_OPTIONS, type SupportedLanguage } from '../lib/language';
import { useTelegramBackHandler } from '../hooks/use-hash-route';
import type { UserProfile } from '../../shared/game-types';

const PRESET_AVATARS = [
  { id: 'ninja', label: 'Ninja', url: '/avatars/ninja.svg' },
  { id: 'robot', label: 'Robot', url: '/avatars/robot.svg' },
  { id: 'tiger', label: 'Tiger', url: '/avatars/tiger.svg' },
  { id: 'panda', label: 'Panda', url: '/avatars/panda.svg' },
  { id: 'dragon', label: 'Dragon', url: '/avatars/dragon.svg' },
  { id: 'fox', label: 'Fox', url: '/avatars/fox.svg' },
  { id: 'astronaut', label: 'Astronaut', url: '/avatars/astronaut.svg' },
  { id: 'gamer', label: 'Gamer', url: '/avatars/gamer.svg' },
  { id: 'wizard', label: 'Wizard', url: '/avatars/wizard.svg' },
  { id: 'champion', label: 'Champion', url: '/avatars/champion.svg' },
] as const;

export interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSave: (data: {
    firstName: string;
    lastName: string | null;
    username: string | null;
    photoUrl: string | null;
    languageCode?: string | null;
  }) => Promise<void>;
  languageCode?: string | null;
}

export function EditProfileModal({
  open,
  onClose,
  profile,
  onSave,
  languageCode,
}: EditProfileModalProps) {
  const isKm = isKhmer(languageCode ?? profile.languageCode);

  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  const [username, setUsername] = useState(profile.username ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl ?? '');
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(() =>
    normalizeLanguage(languageCode ?? profile.languageCode),
  );
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useTelegramBackHandler(open, onClose, 2);

  useEffect(() => {
    if (!open) return;
    setFirstName(profile.firstName);
    setLastName(profile.lastName ?? '');
    setUsername(profile.username ?? '');
    setSelectedLang(normalizeLanguage(languageCode ?? profile.languageCode));
    const currentPhoto = profile.photoUrl ?? '';
    setPhotoUrl(currentPhoto);
    const isPreset = PRESET_AVATARS.some((p) => p.url === currentPhoto);
    const isCustom = Boolean(currentPhoto && !isPreset);
    setShowCustomUrl(isCustom);
    setCustomUrl(isCustom ? currentPhoto : '');
    setError(null);
    setSaving(false);
  }, [open, profile, languageCode]);

  function handleSelectPreset(url: string) {
    setPhotoUrl(url);
    setShowCustomUrl(false);
    setError(null);
  }

  function handleClearAvatar() {
    setPhotoUrl('');
    setCustomUrl('');
    setShowCustomUrl(false);
    setError(null);
  }

  function handleCustomUrlChange(value: string) {
    setCustomUrl(value);
    setPhotoUrl(value.trim());
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanFirst = firstName.trim();
    if (!cleanFirst) {
      setError(isKm ? 'សូមបញ្ចូលឈ្មោះរបស់អ្នក' : 'First name is required');
      return;
    }

    const cleanLast = lastName.trim() || null;
    const cleanUser = username.trim().replace(/^@+/, '') || null;
    if (cleanUser && !/^[A-Za-z0-9_]{1,64}$/.test(cleanUser)) {
      setError(
        isKm
          ? 'Username អាចប្រើបានតែអក្សរ លេខ និងសញ្ញា _ ប៉ុណ្ណោះ'
          : 'Username may only contain letters, numbers, and underscores',
      );
      return;
    }

    const cleanPhoto = photoUrl.trim() || null;
    const initialLang = normalizeLanguage(languageCode ?? profile.languageCode);
    const langChanged = selectedLang !== initialLang;

    setSaving(true);
    setError(null);
    try {
      await onSave({
        firstName: cleanFirst,
        lastName: cleanLast,
        username: cleanUser,
        photoUrl: cleanPhoto,
        ...(langChanged ? { languageCode: selectedLang } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : (isKm ? 'មិនអាចរក្សាទុកបានទេ' : 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissible={!saving}
      showClose={false}
      ariaLabel={isKm ? 'កែសម្រួលព័ត៌មានគណនី' : 'Edit profile'}
      className="max-w-md p-0 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[88dvh]"
    >
      <form onSubmit={handleSubmit} className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <User className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-bold text-ink">
                {isKm ? 'កែសម្រួលព័ត៌មានគណនី' : 'Edit Profile'}
              </h2>
              <p className="text-[10.5px] font-medium text-muted">
                {isKm ? 'ផ្លាស់ប្តូររូបតំណាង និងឈ្មោះបង្ហាញ' : 'Customize your avatar and display name'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition hover:bg-elevated hover:text-ink active:scale-95 disabled:opacity-50"
            aria-label={isKm ? 'បិទ' : 'Close'}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar p-4 sm:p-5 space-y-4">
          {error ? (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 animate-fade-in">
              {error}
            </div>
          ) : null}

          {/* Current Avatar Live Preview */}
          <div className="flex flex-col items-center justify-center gap-2 py-1">
            <div className="relative">
              <Avatar
                name={firstName.trim() || 'User'}
                photoUrl={photoUrl || null}
                size="xl"
                ring
                className="shadow-md"
              />
              <span className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-accent-ink shadow-sm ring-2 ring-surface">
                <Camera className="h-3 w-3" aria-hidden />
              </span>
            </div>
            <p className="text-[11px] font-bold text-ink">
              {firstName.trim() || (isKm ? 'ឈ្មោះរបស់អ្នក' : 'Your Name')}
            </p>
          </div>

          {/* Choose Avatar Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                <span>{isKm ? 'ជ្រើសរើសរូបតំណាង (Avatar)' : 'Choose Avatar'}</span>
              </label>
              <button
                type="button"
                onClick={() => setShowCustomUrl((prev) => !prev)}
                className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1"
              >
                <LinkIcon className="h-3 w-3" />
                <span>{showCustomUrl ? (isKm ? 'លាក់តំណភ្ជាប់' : 'Hide link') : isKm ? 'តំណភ្ជាប់ផ្ទាល់' : 'Custom link'}</span>
              </button>
            </div>

            {/* Custom URL Input (Optional) */}
            {showCustomUrl ? (
              <div className="animate-fade-in rounded-xl border border-line bg-elevated/50 p-2.5">
                <p className="text-[10.5px] font-medium text-muted mb-1.5">
                  {isKm ? 'បិទភ្ជាប់តំណរូបភាព (Image URL):' : 'Paste an image URL:'}
                </p>
                <input
                  type="url"
                  value={customUrl}
                  onChange={(e) => handleCustomUrlChange(e.target.value)}
                  placeholder="https://example.com/avatar.png"
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            ) : null}

            {/* Preset Avatars Grid */}
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-6">
              {/* Option 0: Initial Letter (No Image) */}
              <button
                type="button"
                onClick={handleClearAvatar}
                title={isKm ? 'ប្រើអក្សរដំបូងនៃឈ្មោះ' : 'Use Name Initials'}
                className={cn(
                  'relative flex aspect-square flex-col items-center justify-center rounded-2xl border transition-all active:scale-95',
                  !photoUrl
                    ? 'border-accent bg-accent/15 ring-2 ring-accent ring-offset-2 ring-offset-surface'
                    : 'border-line/70 bg-surface hover:bg-elevated text-muted',
                )}
              >
                <span className="text-xs font-black text-accent">
                  {(firstName.trim()[0] ?? 'A').toUpperCase()}
                </span>
                <span className="text-[8.5px] font-medium text-muted mt-0.5">
                  {isKm ? 'អក្សរ' : 'Initials'}
                </span>
                {!photoUrl ? (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs">
                    <Check className="h-2.5 w-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </button>

              {/* 10 Preset Avatars */}
              {PRESET_AVATARS.map((preset) => {
                const selected = photoUrl === preset.url;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.url)}
                    title={preset.label}
                    className={cn(
                      'relative flex aspect-square items-center justify-center rounded-2xl border p-1 transition-all active:scale-95',
                      selected
                        ? 'border-accent bg-accent/10 ring-2 ring-accent ring-offset-2 ring-offset-surface shadow-sm'
                        : 'border-line/60 bg-surface hover:bg-elevated hover:border-line',
                    )}
                  >
                    <img
                      src={preset.url}
                      alt={preset.label}
                      className="h-full w-full object-contain rounded-xl select-none"
                      loading="lazy"
                    />
                    {selected ? (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-3 pt-1">
            {/* First Name / Display Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-first-name" className="text-xs font-bold text-ink">
                  {isKm ? 'ឈ្មោះបង្ហាញ (Display Name)' : 'Display Name'} <span className="text-rose-500">*</span>
                </label>
                <span className="text-[10px] tabular-nums text-muted">
                  {firstName.length}/64
                </span>
              </div>
              <input
                id="edit-first-name"
                type="text"
                required
                maxLength={64}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={isKm ? 'បញ្ចូលឈ្មោះរបស់អ្នក' : 'Your name'}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Last Name (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-last-name" className="text-xs font-bold text-ink">
                  {isKm ? 'ត្រកូល (Last Name)' : 'Last Name'}{' '}
                  <span className="text-[10px] font-normal text-muted">({isKm ? 'មិនបង្ខំ' : 'Optional'})</span>
                </label>
                <span className="text-[10px] tabular-nums text-muted">
                  {lastName.length}/64
                </span>
              </div>
              <input
                id="edit-last-name"
                type="text"
                maxLength={64}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={isKm ? 'ត្រកូល' : 'Last name'}
                className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              />
            </div>

            {/* Username (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="edit-username" className="text-xs font-bold text-ink">
                  {isKm ? 'ឈ្មោះអ្នកប្រើ (Username)' : 'Username'}{' '}
                  <span className="text-[10px] font-normal text-muted">({isKm ? 'មិនបង្ខំ' : 'Optional'})</span>
                </label>
              </div>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-xs font-bold text-muted select-none">
                  @
                </span>
                <input
                  id="edit-username"
                  type="text"
                  maxLength={64}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                  placeholder={isKm ? 'username' : 'username'}
                  className="w-full rounded-xl border border-line bg-surface pl-7 pr-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            </div>

            {/* Preferred Language with Circular Flag */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-accent" aria-hidden />
                  <span>{isKm ? 'ភាសាបង្ហាញ (Language)' : 'Display Language'}</span>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {LANGUAGE_OPTIONS.map((opt) => {
                  const isSelected = selectedLang === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      onClick={() => setSelectedLang(opt.code)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        isSelected
                          ? 'border-accent bg-accent/10 text-ink shadow-xs ring-1 ring-accent'
                          : 'border-line bg-surface hover:bg-elevated text-muted hover:text-ink',
                      )}
                    >
                      <CircularFlag code={opt.code} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-ink">{opt.nativeLabel}</p>
                        <p className="truncate text-[10px] text-muted">{opt.englishLabel}</p>
                      </div>
                      {isSelected ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink">
                          <Check className="h-2.5 w-2.5 stroke-[3]" />
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="shrink-0 border-t border-line bg-surface px-4 py-3 sm:px-5">
          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onClose}
            >
              {isKm ? 'បោះបង់' : 'Cancel'}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              disabled={saving || !firstName.trim()}
            >
              {isKm ? 'រក្សាទុក' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
