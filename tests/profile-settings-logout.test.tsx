// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
      gamesPlayed: 5,
      wins: 3,
      losses: 2,
      draws: 0,
      humanGames: 5,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      rating: 1200,
      ratingGames: 5,
      winRate: 60,
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

describe('ProfileScreen - Settings Tab Logout Button', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders Log Out card and trigger button in the settings tab', () => {
    const client = makeClient();
    render(<ProfileScreen client={client} navigate={vi.fn()} tab="settings" />);

    expect(screen.getByRole('heading', { name: /Log Out/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Log Out/i })).toBeTruthy();
  });

  it('opens confirmation modal when Log Out button is clicked and cancels correctly', () => {
    const client = makeClient();
    render(<ProfileScreen client={client} navigate={vi.fn()} tab="settings" />);

    const triggerBtn = screen.getByRole('button', { name: /Log Out/i });
    fireEvent.click(triggerBtn);

    // Modal dialog is opened
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/Log out of your account\?/i)).toBeTruthy();

    // Click Cancel
    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    expect(client.logout).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('calls client.logout and navigates to home when confirmed', async () => {
    const logoutMock = vi.fn(async () => undefined);
    const navigateMock = vi.fn();
    const client = makeClient({ logout: logoutMock });

    render(<ProfileScreen client={client} navigate={navigateMock} tab="settings" />);

    // Click trigger to open modal
    fireEvent.click(screen.getByRole('button', { name: /Log Out/i }));

    // Inside modal, click confirm Log Out
    const modal = screen.getByRole('dialog');
    const buttons = modal.querySelectorAll('button');
    const confirmBtn = Array.from(buttons).find((b) => b.textContent?.includes('Log Out'))!;
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith('/');
    });
  });

  it('renders localized Khmer text when user languageCode is km', () => {
    const kmProfile = makeProfile({ languageCode: 'km' });
    const client = makeClient({ profile: kmProfile });

    render(<ProfileScreen client={client} navigate={vi.fn()} tab="settings" />);

    expect(screen.getByText(/ចាកចេញពីគណនី/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /ចាកចេញ/i })).toBeTruthy();
  });
});
