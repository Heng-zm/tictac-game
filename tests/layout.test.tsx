// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BottomNav, ConnectionBanner, Page, PageSection } from '../src/client/components/Layout';

describe('Layout Components', () => {
  afterEach(() => {
    cleanup();
  });

  describe('BottomNav', () => {
    it('renders navigation tabs and marks the active tab', () => {
      const onNavigate = vi.fn();
      render(<BottomNav active="home" onNavigate={onNavigate} />);

      const playTab = screen.getByRole('button', { name: 'Play' });
      const ranksTab = screen.getByRole('button', { name: 'Ranks' });
      const profileTab = screen.getByRole('button', { name: 'Profile' });

      expect(playTab).toBeTruthy();
      expect(ranksTab).toBeTruthy();
      expect(profileTab).toBeTruthy();

      expect(playTab.getAttribute('aria-current')).toBe('page');
      expect(ranksTab.getAttribute('aria-current')).toBeNull();

      fireEvent.click(ranksTab);
      expect(onNavigate).toHaveBeenCalledWith('/leaderboard');
    });

    it('displays active game pulse dot on the Play tab when a match is active', () => {
      render(<BottomNav active="profile" onNavigate={vi.fn()} hasActiveGame={true} />);

      const playBtn = screen.getByLabelText(/Play \(game in progress\)/i);
      expect(playBtn).toBeTruthy();
    });
  });

  describe('ConnectionBanner', () => {
    it('returns null when connection is online and browser is online', () => {
      const { container } = render(
        <ConnectionBanner connection="online" onRetry={vi.fn()} />,
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders reconnecting state when connection is reconnecting', () => {
      render(<ConnectionBanner connection="reconnecting" onRetry={vi.fn()} />);

      expect(screen.getByRole('status')).toBeTruthy();
      expect(screen.getByText('Reconnecting to the game…')).toBeTruthy();
    });

    it('renders retry button and triggers callback on shutdown', () => {
      const onRetry = vi.fn();
      render(<ConnectionBanner connection="shutdown" onRetry={onRetry} />);

      expect(screen.getByText('Server restarting — your game is safe.')).toBeTruthy();
      const retryBtn = screen.getByRole('button', { name: /Retry/i });
      expect(retryBtn).toBeTruthy();
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledOnce();
    });
  });

  describe('Page', () => {
    it('applies width presets and nav padding', () => {
      const { container, rerender } = render(
        <Page width="narrow" withNav>
          <div>Page content</div>
        </Page>,
      );

      expect(screen.getByText('Page content')).toBeTruthy();
      const pageEl = container.firstChild as HTMLElement;
      expect(pageEl.classList.contains('max-w-[520px]')).toBe(true);
      expect(pageEl.classList.contains('page-with-nav')).toBe(true);

      rerender(
        <Page width="wide" withNav={false}>
          <div>Wide content</div>
        </Page>,
      );
      const wideEl = container.firstChild as HTMLElement;
      expect(wideEl.classList.contains('lg:max-w-[1040px]')).toBe(true);
      expect(wideEl.classList.contains('page-with-nav')).toBe(false);
    });

    it('renders PageSection', () => {
      render(
        <PageSection>
          <p>Section Item</p>
        </PageSection>,
      );
      expect(screen.getByText('Section Item')).toBeTruthy();
    });
  });
});
