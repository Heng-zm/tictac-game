import type { TelegramThemeParams, TelegramWebApp } from '../types/telegram';

const INVITE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

/** Reads the Mini App start parameter from Telegram or from the launch URL. */
export function readStartParam(): string | null {
  const tg = getWebApp();
  const fromTelegram = tg?.initDataUnsafe?.start_param;
  if (fromTelegram) return fromTelegram;
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const fromSearch = params.get('tgWebAppStartParam') ?? params.get('startapp') ?? params.get('start');
  if (fromSearch) return fromSearch;
  if (window.location.hash.includes('?')) {
    const hashQuery = window.location.hash.slice(window.location.hash.indexOf('?') + 1);
    const hashParams = new URLSearchParams(hashQuery);
    return hashParams.get('tgWebAppStartParam') ?? hashParams.get('startapp') ?? hashParams.get('start') ?? null;
  }
  return null;
}

export function parseInviteToken(startParam: string | null): string | null {
  if (!startParam?.startsWith('invite_')) return null;
  const token = startParam.slice('invite_'.length);
  return INVITE_PATTERN.test(token) ? token : null;
}

export function initTelegram(): void {
  const tg = getWebApp();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
  } catch {
    // Older clients may not implement every method.
  }
}

function setDataTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) {
    meta.content = theme === 'dark' ? '#0b1117' : '#f5f6f8';
  }
}

/** Applies Telegram theme colors, with a system-preference fallback. */
export function applyTheme(): void {
  const tg = getWebApp();
  if (!tg) {
    applySystemTheme();
    return;
  }
  const theme = tg.colorScheme === 'dark' ? 'dark' : 'light';
  setDataTheme(theme);
  const params = tg.themeParams ?? {};
  const root = document.documentElement;
  const mapped: Array<[string, string | undefined]> = [
    ['--app-bg', params.bg_color],
    ['--app-surface', params.section_bg_color ?? params.secondary_bg_color],
    ['--app-elevated', params.section_bg_color ?? params.secondary_bg_color],
    ['--app-text', params.text_color],
    ['--app-muted', params.hint_color ?? params.subtitle_text_color],
    ['--app-border', params.section_separator_color],
    ['--app-accent', params.button_color ?? params.link_color],
    ['--app-accent-text', params.button_text_color],
    ['--app-danger', params.destructive_text_color],
  ];
  for (const [variable, value] of mapped) {
    if (value) {
      root.style.setProperty(variable, value);
      const rgb = toRgbTriplet(value);
      if (rgb) root.style.setProperty(`${variable}-rgb`, rgb);
      else root.style.removeProperty(`${variable}-rgb`);
    } else {
      root.style.removeProperty(variable);
      root.style.removeProperty(`${variable}-rgb`);
    }
  }
  const bg = params.bg_color;
  if (bg) {
    try {
      tg.setHeaderColor(bg);
      tg.setBackgroundColor(bg);
    } catch {
      // Not supported on older Telegram clients.
    }
  }
}

function applySystemTheme(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const theme = media.matches ? 'dark' : 'light';
  setDataTheme(theme);
  const root = document.documentElement;
  for (const variable of [
    '--app-bg',
    '--app-surface',
    '--app-elevated',
    '--app-text',
    '--app-muted',
    '--app-border',
    '--app-accent',
    '--app-accent-text',
    '--app-danger',
  ]) {
    root.style.removeProperty(variable);
    root.style.removeProperty(`${variable}-rgb`);
  }
}

/** Converts a Telegram theme color (#rgb / #rrggbb) into an rgb channel triplet. */
function toRgbTriplet(value: string): string | null {
  let hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = [...hex].map((character) => `${character}${character}`).join('');
  }
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return `${Number.parseInt(hex.slice(0, 2), 16)} ${Number.parseInt(hex.slice(2, 4), 16)} ${Number.parseInt(hex.slice(4, 6), 16)}`;
}

export interface ThemeCleanup {
  cleanup: () => void;
}

export function watchTheme(): ThemeCleanup {
  const tg = getWebApp();
  applyTheme();

  if (!tg) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applySystemTheme();
    media.addEventListener('change', onChange);
    return { cleanup: () => media.removeEventListener('change', onChange) };
  }

  const onTheme = () => applyTheme();
  const onViewport = () => updateViewportHeight();
  tg.onEvent('themeChanged', onTheme);
  tg.onEvent('viewportChanged', onViewport);
  updateViewportHeight();
  return {
    cleanup: () => {
      tg.offEvent('themeChanged', onTheme);
      tg.offEvent('viewportChanged', onViewport);
    },
  };
}

export function updateViewportHeight(): void {
  const tg = getWebApp();
  const height = tg?.viewportStableHeight || window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${height}px`);
}

export function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // Haptics are optional.
  }
}

export function hapticNotify(type: 'error' | 'success' | 'warning'): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // Haptics are optional.
  }
}

export function shareInTelegram(url: string, text: string): boolean {
  const tg = getWebApp();
  if (!tg) return false;
  const shareLink = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  try {
    tg.openTelegramLink(shareLink);
    return true;
  } catch {
    return false;
  }
}

export function openTelegramBot(botUsername: string, startParam?: string): boolean {
  const tg = getWebApp();
  const suffix = startParam ? `?start=${encodeURIComponent(startParam)}` : '';
  const url = `https://t.me/${botUsername}${suffix}`;
  if (tg) {
    try {
      tg.openTelegramLink(url);
      return true;
    } catch {
      // Fall through to a normal link.
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function getTelegramThemeDescription(): { theme: TelegramThemeParams; scheme: 'light' | 'dark' } {
  const tg = getWebApp();
  return {
    theme: tg?.themeParams ?? {},
    scheme: tg?.colorScheme === 'dark' ? 'dark' : 'light',
  };
}
