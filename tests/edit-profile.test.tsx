// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EditProfileModal } from '../src/client/components/EditProfileModal';
import type { UserProfile } from '../src/shared/game-types';

afterEach(() => {
  cleanup();
});

const mockProfile: UserProfile = {
  id: 'user-123',
  firstName: 'Sokha',
  lastName: 'Chea',
  username: 'sokha_chea',
  photoUrl: null,
  languageCode: 'km',
  autoAiFallback: false,
  turnNotifications: false,
  stats: {
    rating: 1250,
    gamesPlayed: 10,
    wins: 6,
    losses: 3,
    draws: 1,
    ratingGames: 8,
    humanGames: 10,
    aiGames: 0,
    aiWins: 0,
    aiLosses: 0,
    aiDraws: 0,
    winRate: 60,
  },
};

describe('EditProfileModal', () => {
  it('renders modal with initial profile data', () => {
    render(
      <EditProfileModal
        open={true}
        onClose={vi.fn()}
        profile={mockProfile}
        onSave={vi.fn()}
        languageCode="en"
      />,
    );

    const firstInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
    expect(firstInput.value).toBe('Sokha');

    const lastInput = screen.getByLabelText(/Last Name/i) as HTMLInputElement;
    expect(lastInput.value).toBe('Chea');

    const userInput = screen.getByLabelText(/Username/i) as HTMLInputElement;
    expect(userInput.value).toBe('sokha_chea');
  });

  it('selects a preset avatar and submits the new profile', async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();

    render(
      <EditProfileModal
        open={true}
        onClose={onClose}
        profile={mockProfile}
        onSave={onSave}
        languageCode="en"
      />,
    );

    // Select Ninja preset
    const ninjaButton = screen.getByTitle('Ninja');
    fireEvent.click(ninjaButton);

    // Change display name
    const firstInput = screen.getByLabelText(/Display Name/i);
    fireEvent.change(firstInput, { target: { value: 'SokhaPro' } });

    // Submit form
    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith({
      firstName: 'SokhaPro',
      lastName: 'Chea',
      username: 'sokha_chea',
      photoUrl: '/avatars/ninja.svg',
    });
  });

  it('allows clearing avatar to use name initials', async () => {
    const onSave = vi.fn(async () => undefined);

    const profileWithPhoto: UserProfile = {
      ...mockProfile,
      photoUrl: '/avatars/robot.svg',
    };

    render(
      <EditProfileModal
        open={true}
        onClose={vi.fn()}
        profile={profileWithPhoto}
        onSave={onSave}
        languageCode="en"
      />,
    );

    // Click Initials option
    const initialsBtn = screen.getByTitle(/Use Name Initials/i);
    fireEvent.click(initialsBtn);

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledWith({
      firstName: 'Sokha',
      lastName: 'Chea',
      username: 'sokha_chea',
      photoUrl: null,
    });
  });

  it('validates required display name', async () => {
    const onSave = vi.fn();

    render(
      <EditProfileModal
        open={true}
        onClose={vi.fn()}
        profile={mockProfile}
        onSave={onSave}
        languageCode="en"
      />,
    );

    const firstInput = screen.getByLabelText(/Display Name/i);
    fireEvent.change(firstInput, { target: { value: '   ' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('validates username special characters', async () => {
    const onSave = vi.fn();

    render(
      <EditProfileModal
        open={true}
        onClose={vi.fn()}
        profile={mockProfile}
        onSave={onSave}
        languageCode="en"
      />,
    );

    const userInput = screen.getByLabelText(/Username/i);
    fireEvent.change(userInput, { target: { value: 'bad username!' } });

    const saveButton = screen.getByRole('button', { name: /Save Changes/i });
    fireEvent.click(saveButton);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/Username may only contain letters/i)).toBeDefined();
  });

  it('renders in Khmer localization when languageCode is km', () => {
    render(
      <EditProfileModal
        open={true}
        onClose={vi.fn()}
        profile={mockProfile}
        onSave={vi.fn()}
        languageCode="km"
      />,
    );

    expect(screen.getByText(/កែសម្រួលព័ត៌មានគណនី/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /រក្សាទុក/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /បោះបង់/i })).toBeDefined();
  });
});
