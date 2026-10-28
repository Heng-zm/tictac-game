// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { LeaderboardScreen } from '../src/client/screens/LeaderboardScreen';
import type { GameClient } from '../src/client/hooks/use-game-client';
import type { LeaderboardEntry, LeaderboardResponse, UserProfile } from '../src/shared/game-types';
import { fetchLeaderboard } from '../src/client/lib/api';

vi.mock('../src/client/lib/api', () => ({
  errorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Failed to fetch leaderboard'),
  fetchLeaderboard: vi.fn(),
}));

const mockFetchLeaderboard = vi.mocked(fetchLeaderboard);

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-you',
    firstName: 'You',
    lastName: null,
    username: 'you_player',
    photoUrl: null,
    languageCode: 'en',
    autoAiFallback: true,
    turnNotifications: false,
    stats: {
      gamesPlayed: 10,
      wins: 7,
      losses: 2,
      draws: 1,
      humanGames: 10,
      aiGames: 0,
      aiWins: 0,
      aiLosses: 0,
      aiDraws: 0,
      rating: 1300,
      ratingGames: 10,
      winRate: 70,
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
    match: null,
    queue: null,
    createdInvite: null,
    pendingInvite: null,
    lastMove: null,
    lastRejection: null,
    opponentGraceEndsAt: null,
    toasts: [],
    reactions: [],
    chatMessages: [],
    retryBoot: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as unknown as GameClient;
}

function makeEntry(rank: number, name: string, isYou = false, rating = 1200 + (10 - rank) * 20): LeaderboardEntry {
  return {
    rank,
    userId: isYou ? 'user-you' : `user-${rank}`,
    displayName: name,
    username: `${name.toLowerCase()}_tg`,
    photoUrl: null,
    rating,
    ratedGames: 15,
    wins: 10,
    losses: 3,
    draws: 2,
    gamesPlayed: 15,
    isYou,
  };
}

const mockEntries: LeaderboardEntry[] = [
  makeEntry(1, 'Champion Alex', false, 1600),
  makeEntry(2, 'Grandmaster Bob', false, 1550),
  makeEntry(3, 'Master Charlie', false, 1500),
  makeEntry(4, 'Diamond Dave', false, 1450),
  makeEntry(5, 'Platinum Eve', false, 1400),
  makeEntry(6, 'Gold Frank', true, 1350),
];

const mockResponse: LeaderboardResponse = {
  entries: mockEntries,
  currentUserRank: 6,
};

describe('LeaderboardScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders top 3 championship podium and list rows on successful load', async () => {
    mockFetchLeaderboard.mockResolvedValue(mockResponse);

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Leaderboard' })).toBeTruthy();
    expect(screen.getByText('Top rated players')).toBeTruthy();

    // Wait for podium items
    expect(await screen.findByText('Champion Alex')).toBeTruthy();
    expect(screen.getByText('Grandmaster Bob')).toBeTruthy();
    expect(screen.getByText('Master Charlie')).toBeTruthy();

    // Ranks 1, 2, 3 podium badges
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
    expect(screen.getByText('#3')).toBeTruthy();

    // List rows (rank 4+)
    expect(screen.getByText('Diamond Dave')).toBeTruthy();
    expect(screen.getByText('Platinum Eve')).toBeTruthy();
    expect(screen.getByText('Gold Frank')).toBeTruthy();
  });

  it('renders "Your position" card when player is not in the top list', async () => {
    mockFetchLeaderboard.mockResolvedValue({
      entries: mockEntries.filter((e) => !e.isYou),
      currentUserRank: null,
    });

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    expect(await screen.findByText('Your position')).toBeTruthy();
    expect(screen.getByText(/1300 rating/i)).toBeTruthy();
    expect(screen.getByText(/Outside top 50/i)).toBeTruthy();
  });

  it('switches between Top 50, Top 10, and Nearby You tabs', async () => {
    mockFetchLeaderboard.mockResolvedValue(mockResponse);

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    await screen.findByText('Champion Alex');

    // Click Top 10 tab
    const top10Btn = screen.getByRole('button', { name: /Top 10/i });
    fireEvent.click(top10Btn);
    expect(screen.getByText('Champion Alex')).toBeTruthy();

    // Click Nearby You tab
    const nearbyBtn = screen.getByRole('button', { name: /Nearby You/i });
    fireEvent.click(nearbyBtn);
    expect(screen.getByText('Gold Frank')).toBeTruthy();
  });

  it('filters leaderboard rows with search query input', async () => {
    mockFetchLeaderboard.mockResolvedValue(mockResponse);

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    await screen.findByText('Champion Alex');

    const searchInput = screen.getByRole('textbox', { name: /search player/i });
    fireEvent.change(searchInput, { target: { value: 'Dave' } });

    // Dave should remain visible, Alex should not be in filtered rows
    expect(screen.getByText('Diamond Dave')).toBeTruthy();
    expect(screen.queryByText('Platinum Eve')).toBeNull();

    // Clear search
    const clearBtn = screen.getByRole('button', { name: /clear search/i });
    fireEvent.click(clearBtn);

    expect(screen.getByText('Champion Alex')).toBeTruthy();
  });

  it('renders empty state when search returns no results', async () => {
    mockFetchLeaderboard.mockResolvedValue(mockResponse);

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    await screen.findByText('Champion Alex');

    const searchInput = screen.getByRole('textbox', { name: /search player/i });
    fireEvent.change(searchInput, { target: { value: 'NonexistentPlayer' } });

    expect(screen.getByText('No players found')).toBeTruthy();
    expect(screen.getByText(/No players matched "NonexistentPlayer"./i)).toBeTruthy();
  });

  it('renders wide-open ladder empty state when no rated games have finished', async () => {
    mockFetchLeaderboard.mockResolvedValue({
      entries: [],
      currentUserRank: null,
    });

    const navigate = vi.fn();
    render(<LeaderboardScreen client={makeClient()} navigate={navigate} />);

    expect(await screen.findByText('The ladder is wide open')).toBeTruthy();
    const findMatchBtn = screen.getByRole('button', { name: 'Find a match' });
    fireEvent.click(findMatchBtn);
    expect(navigate).toHaveBeenCalledWith('/search');
  });

  it('displays error banner and allows retry when load fails', async () => {
    mockFetchLeaderboard.mockRejectedValueOnce(new Error('Network timeout'));

    render(<LeaderboardScreen client={makeClient()} navigate={vi.fn()} />);

    expect(await screen.findByText('Leaderboard unavailable')).toBeTruthy();
    expect(screen.getByText('Network timeout')).toBeTruthy();

    // Click retry
    mockFetchLeaderboard.mockResolvedValueOnce(mockResponse);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() => {
      expect(screen.getByText('Champion Alex')).toBeTruthy();
    });
  });

  it('supports Khmer language localization when profile languageCode is km', async () => {
    mockFetchLeaderboard.mockResolvedValue(mockResponse);

    const kmProfile = makeProfile({ languageCode: 'km' });
    render(<LeaderboardScreen client={makeClient({ profile: kmProfile })} navigate={vi.fn()} />);

    expect(await screen.findByText('តារាងពិន្ទុ')).toBeTruthy();
    expect(screen.getByText('អ្នកលេងដែលមានចំណាត់ថ្នាក់ខ្ពស់បំផុត')).toBeTruthy();
    expect(screen.getByText('ទាំងអស់ (50)')).toBeTruthy();
    expect(screen.getByText('កំពូលទាំង 10')).toBeTruthy();
    expect(screen.getByText('ក្បែរអ្នក')).toBeTruthy();
  });
});

