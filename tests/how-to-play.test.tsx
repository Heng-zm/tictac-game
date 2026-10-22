// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HowToPlayModal, HOW_TO_PLAY_STORAGE_KEY } from '../src/client/components/HowToPlayModal';

describe('HowToPlayModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders step 1 in Khmer when the Khmer locale is active', () => {
    const onClose = vi.fn();
    render(<HowToPlayModal open={true} onClose={onClose} languageCode="km" />);

    expect(screen.getByRole('dialog', { name: 'របៀបលេង' })).toBeTruthy();
    expect(screen.getByText('របៀបលេង')).toBeTruthy();
    expect(screen.getByText('ក្តារគ្មានដែនកំណត់ & ការបញ្ជា')).toBeTruthy();
    expect(screen.getByText(/Board Controls/i)).toBeTruthy();
    expect(screen.getByText('បន្ទាប់')).toBeTruthy();
  });

  it('defaults to English and exposes an accessible dialog and current step', () => {
    render(<HowToPlayModal open={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'How to play' })).toBeTruthy();
    expect(screen.getByText('How to Play')).toBeTruthy();
    expect(screen.getByText('Infinite Grid & Controls')).toBeTruthy();
    expect(
      screen.getByText('The board is an infinite grid. Pan, zoom, and place your stones freely anywhere.'),
    ).toBeTruthy();
    expect(screen.queryByText('ក្តារគ្មានដែនកំណត់ & ការបញ្ជា')).toBeNull();
    expect(screen.getByText('Next')).toBeTruthy();

    const stepOne = screen.getByRole('button', { name: 'Go to step 1: Controls' });
    expect(stepOne.getAttribute('aria-current')).toBe('step');
    expect(
      screen.getByRole('button', { name: 'Go to step 2: Win rule' }).hasAttribute('aria-current'),
    ).toBe(false);
  });

  it('navigates through all 4 steps to completion', () => {
    const onClose = vi.fn();
    render(<HowToPlayModal open={true} onClose={onClose} languageCode="km" />);

    // Step 1 -> Step 2
    fireEvent.click(screen.getByRole('button', { name: /បន្ទាប់/ }));
    expect(screen.getByText('តម្រៀប ៥ គ្រាប់ជាប់គ្នាដើម្បីឈ្នះ!')).toBeTruthy();
    expect(screen.getByText('ថយក្រោយ')).toBeTruthy();

    // Step 2 -> Step 3
    fireEvent.click(screen.getByRole('button', { name: /បន្ទាប់/ }));
    expect(screen.getByText('យុទ្ធសាស្ត្រវាយប្រហារ & ការពារ')).toBeTruthy();

    // Step 3 -> Step 4
    fireEvent.click(screen.getByRole('button', { name: /បន្ទាប់/ }));
    expect(screen.getByText('Walkie-Talkie & របៀបប្រកួត')).toBeTruthy();
    expect(screen.getByText('យល់ហើយ')).toBeTruthy();

    // Step 4 completion
    fireEvent.click(screen.getByRole('button', { name: /យល់ហើយ/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY)).toBe('true');
  });

  it('allows jumping between steps directly using step progress pills', () => {
    render(<HowToPlayModal open={true} onClose={vi.fn()} />);

    // Jump to Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 3: Tactics' }));
    expect(screen.getByText('Attack & Defense Tactics')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go to step 3: Tactics' }).getAttribute('aria-current')).toBe(
      'step',
    );

    // Jump to Step 1
    fireEvent.click(screen.getByRole('button', { name: 'Go to step 1: Controls' }));
    expect(screen.getByText('Infinite Grid & Controls')).toBeTruthy();
  });

  it('stores preference when "Don\'t show again" is checked and closed', () => {
    const onClose = vi.fn();
    render(<HowToPlayModal open={true} onClose={onClose} />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    const closeBtn = screen.getByRole('button', { name: 'Close how to play guide' });
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY)).toBe('true');
  });

  it('can clear a previous preference by unchecking "Don\'t show again"', () => {
    localStorage.setItem(HOW_TO_PLAY_STORAGE_KEY, 'true');
    render(<HowToPlayModal open={true} onClose={vi.fn()} />);

    const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close how to play guide' }));

    expect(localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY)).toBeNull();
  });
});
