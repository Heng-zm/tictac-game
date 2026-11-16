// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSoundSettings } from '../src/client/hooks/use-sound-settings';
import { SOUND_STORAGE_KEY, isSoundMuted, setSoundMuted } from '../src/client/lib/sound';
import { ProfileScreen } from '../src/client/screens/ProfileScreen';
import type { GameClient } from '../src/client/hooks/use-game-client';
import type { UserProfile } from '../src/shared/game-types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-tester',
    firstName: 'Tester',
    lastName: null,
    username: 'tester',
    photoUrl: null,
    languageCode: 'en',
    autoAiFallback: true,
    turnNotifications: false,
    stats: {
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      humanGames: 0,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      rating: 1200,
      ratingGames: 0,
      winRate: 0,
    },
    ...overrides,
  };
}

function makeClient(overrides: Partial<GameClient> = {}): GameClient {
  return {
    phase: 'ready',
    profile: makeProfile(),
    config: null,
    connection: 'online',
    clockOffsetMs: 0,
    match: null,
    queue: null,
    createdInvite: null,
    pendingInvite: null,
    lastMove: null,
    lastRejection: null,
    opponentGraceEndsAt: null,
    initialInviteToken: null,
    initialGameMatchId: null,
    toasts: [],
    reactions: [],
    chatMessages: [],
    incomingVoice: null,
    retryBoot: vi.fn(),
    joinQueue: vi.fn(),
    cancelQueue: vi.fn(),
    startAi: vi.fn(),
    createInvite: vi.fn(),
    cancelInvite: vi.fn(),
    acceptInvite: vi.fn(),
    joinMatch: vi.fn(),
    submitMove: vi.fn(),
    requestRematch: vi.fn(),
    leaveMatch: vi.fn(),
    sendReaction: vi.fn(),
    sendChat: vi.fn(),
    sendVoice: vi.fn(),
    clearIncomingVoice: vi.fn(),
    refreshProfile: vi.fn(),
    updateProfile: vi.fn(),
    setAutoAiFallback: vi.fn(),
    setTurnNotifications: vi.fn(),
    sendTestNotification: vi.fn(),
    clearPendingInvite: vi.fn(),
    clearCreatedInvite: vi.fn(),
    reconnect: vi.fn(),
    logout: vi.fn(async () => undefined),
    pushToast: vi.fn(),
    dismissToast: vi.fn(),
    bootError: null,
    bootErrorCode: null,
    ...overrides,
  };
}

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

function SoundToggle() {
  const { soundOn, toggle } = useSoundSettings();
  return (
    <button type="button" role="switch" aria-checked={soundOn} aria-label="sound" onClick={toggle}>
      {soundOn ? 'on' : 'off'}
    </button>
  );
}

describe('sound settings', () => {
  beforeEach(() => {
    localStorage.clear();
    setSoundMuted(false);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('keeps every mounted toggle in sync', () => {
    render(
      <>
        <SoundToggle />
        <SoundToggle />
      </>,
    );

    const toggles = screen.getAllByRole('switch', { name: 'sound' });
    const [first] = toggles;
    expect(first!.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(first!);

    expect(isSoundMuted()).toBe(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');
    for (const toggle of toggles) expect(toggle.getAttribute('aria-checked')).toBe('false');
  });

  it('updates an already-mounted toggle when another control changes the setting', () => {
    render(<SoundToggle />);
    const toggle = screen.getByRole('switch', { name: 'sound' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    act(() => setSoundMuted(true));

    expect(toggle.getAttribute('aria-checked')).toBe('false');

    act(() => setSoundMuted(false));
    expect(toggle.getAttribute('aria-checked')).toBe('true');
  });

  it('exposes a sound switch in the profile settings tab that persists the choice', () => {
    render(<ProfileScreen client={makeClient()} navigate={vi.fn()} tab="settings" />);

    const toggle = screen.getByRole('switch', { name: 'Play sound effects' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);

    expect(isSoundMuted()).toBe(true);
    expect(localStorage.getItem(SOUND_STORAGE_KEY)).toBe('true');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
  });
});
