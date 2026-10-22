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

  it('renders step 1 with board controls by default', () => {
    const onClose = vi.fn();
    render(<HowToPlayModal open={true} onClose={onClose} />);

    expect(screen.getByText('របៀបលេង · How to Play')).toBeTruthy();
    expect(screen.getByText('ក្តារគ្មានដែនកំណត់ & ការបញ្ជា')).toBeTruthy();
    expect(screen.getByText(/Board Controls/i)).toBeTruthy();
    expect(screen.getByText('បន្ទាប់')).toBeTruthy();
  });

  it('navigates through all 4 steps to completion', () => {
    const onClose = vi.fn();
    render(<HowToPlayModal open={true} onClose={onClose} />);

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
    expect(screen.getByText('យល់ហើយ ចាប់ផ្តើមលេង!')).toBeTruthy();

    // Step 4 completion
    fireEvent.click(screen.getByRole('button', { name: /យល់ហើយ ចាប់ផ្តើមលេង!/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(HOW_TO_PLAY_STORAGE_KEY)).toBe('true');
  });

  it('allows jumping between steps directly using step progress pills', () => {
    render(<HowToPlayModal open={true} onClose={vi.fn()} />);

    // Jump to Step 3
    fireEvent.click(screen.getByRole('button', { name: 'Jump to step 3' }));
    expect(screen.getByText('យុទ្ធសាស្ត្រវាយប្រហារ & ការពារ')).toBeTruthy();

    // Jump to Step 1
    fireEvent.click(screen.getByRole('button', { name: 'Jump to step 1' }));
    expect(screen.getByText('ក្តារគ្មានដែនកំណត់ & ការបញ្ជា')).toBeTruthy();
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
});
