// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CircularFlag } from '../src/client/components/CircularFlag';
import { LanguageButton } from '../src/client/components/LanguageButton';
import { normalizeLanguage, getNextLanguage, isKhmer } from '../src/client/lib/language';

describe('Language Utilities', () => {
  it('correctly detects Khmer vs English', () => {
    expect(isKhmer('km')).toBe(true);
    expect(isKhmer('km-KH')).toBe(true);
    expect(isKhmer('KM')).toBe(true);
    expect(isKhmer('en')).toBe(false);
    expect(isKhmer('en-US')).toBe(false);
    expect(isKhmer(null)).toBe(false);
    expect(isKhmer(undefined)).toBe(false);
  });

  it('normalizes language code to supported set', () => {
    expect(normalizeLanguage('km')).toBe('km');
    expect(normalizeLanguage('km-KH')).toBe('km');
    expect(normalizeLanguage('en')).toBe('en');
    expect(normalizeLanguage('fr')).toBe('en');
    expect(normalizeLanguage(null)).toBe('en');
  });

  it('computes next toggled language', () => {
    expect(getNextLanguage('en')).toBe('km');
    expect(getNextLanguage('km')).toBe('en');
  });
});

describe('CircularFlag Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders Cambodia flag for km', () => {
    render(<CircularFlag code="km" data-testid="flag-km" />);
    const flag = screen.getByTestId('flag-km');
    expect(flag).toBeTruthy();
    expect(flag.getAttribute('aria-label')).toContain('Cambodia');
    expect(flag.querySelector('svg')).toBeTruthy();
  });

  it('renders UK flag for en', () => {
    render(<CircularFlag code="en" data-testid="flag-en" />);
    const flag = screen.getByTestId('flag-en');
    expect(flag).toBeTruthy();
    expect(flag.getAttribute('aria-label')).toContain('United Kingdom');
  });

  it('handles custom sizes and classes', () => {
    render(<CircularFlag code="km" size="lg" className="custom-flag-class" data-testid="flag-lg" />);
    const flag = screen.getByTestId('flag-lg');
    expect(flag.className).toContain('custom-flag-class');
    expect(flag.className).toContain('h-9');
  });
});

describe('LanguageButton Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders circular button variant by default', () => {
    render(<LanguageButton languageCode="en" />);
    const button = screen.getByRole('button', { name: /switch language to khmer/i });
    expect(button).toBeTruthy();
    expect(button.querySelector('span[role="img"]')).toBeTruthy();
  });

  it('triggers onLanguageChange when clicked in circular mode', async () => {
    const onLanguageChange = vi.fn();
    render(<LanguageButton languageCode="en" onLanguageChange={onLanguageChange} />);
    const button = screen.getByRole('button', { name: /switch language to khmer/i });
    fireEvent.click(button);
    expect(onLanguageChange).toHaveBeenCalledWith('km');
  });

  it('triggers onLanguageChange when toggling from km to en', async () => {
    const onLanguageChange = vi.fn();
    render(<LanguageButton languageCode="km" onLanguageChange={onLanguageChange} />);
    const button = screen.getByRole('button', { name: /switch language to english/i });
    fireEvent.click(button);
    expect(onLanguageChange).toHaveBeenCalledWith('en');
  });

  it('renders segmented variant with both options', () => {
    const onLanguageChange = vi.fn();
    render(<LanguageButton languageCode="km" variant="segmented" onLanguageChange={onLanguageChange} />);
    const group = screen.getByRole('group', { name: /language selection/i });
    expect(group).toBeTruthy();

    const enButton = screen.getByRole('button', { name: /english/i });
    fireEvent.click(enButton);
    expect(onLanguageChange).toHaveBeenCalledWith('en');
  });

  it('updates profile silently without pushing success notification toast', async () => {
    const pushToast = vi.fn();
    const updateProfile = vi.fn(async () => ({ languageCode: 'km' }));
    const mockClient = {
      profile: { languageCode: 'en' },
      pushToast,
      updateProfile,
    } as unknown as Parameters<typeof LanguageButton>[0]['client'];

    render(<LanguageButton client={mockClient} />);
    const button = screen.getByRole('button', { name: /switch language to khmer/i });
    fireEvent.click(button);

    expect(updateProfile).toHaveBeenCalledWith({ languageCode: 'km' });
    expect(pushToast).not.toHaveBeenCalled();
  });
});
