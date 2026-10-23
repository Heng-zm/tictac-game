import type { TelegramThemeParams, TelegramWebApp } from '../types/telegram';

const INVITE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const MATCH_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Parses the deep link created when a turn notification opens the app. */
export function parseGameMatchId(startParam: string | null): string | null {
  if (!startParam?.startsWith('game_')) return null;
  const matchId = startParam.slice('game_'.length);
  return MATCH_ID_PATTERN.test(matchId) ? matchId : null;
}

export type TelegramWriteAccessResult = 'allowed' | 'denied' | 'unsupported';

/**
 * Requests permission for the bot to send messages to this Telegram user.
 * The prompt must be triggered by a user gesture, such as a settings toggle.
 */
export function requestTelegramWriteAccess(): Promise<TelegramWriteAccessResult> {
  const tg = getWebApp();
  if (!tg) return Promise.resolve('unsupported');
  if (tg.initDataUnsafe?.user?.allows_write_to_pm) return Promise.resolve('allowed');
  if (typeof tg.requestWriteAccess !== 'function') return Promise.resolve('unsupported');

  return new Promise((resolve) => {
    let settled = false;
    const timer = { current: undefined as number | undefined };
    const finish = (granted: boolean | string | { status?: string }) => {
      if (settled) return;
      settled = true;
      if (timer.current !== undefined) window.clearTimeout(timer.current);
      const isAllowed =
        granted === true ||
        granted === 'allowed' ||
        (typeof granted === 'object' && granted !== null && granted.status === 'allowed');
      resolve(isAllowed ? 'allowed' : 'denied');
    };

    timer.current = window.setTimeout(() => finish(false), 60_000);
    try {
      tg.requestWriteAccess?.(finish);
    } catch {
      finish(false);
    }
  });
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
    ['--app-accent-text', params.button_text_color ?? params.accent_text_color],
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
      tg.setHeaderColor(params.header_bg_color ?? bg);
      tg.setBackgroundColor(bg);
      tg.setBottomBarColor?.(params.secondary_bg_color ?? bg);
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

  const onViewport = () => updateViewportHeight();
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewport);
  }

  if (!tg) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applySystemTheme();
    media.addEventListener('change', onChange);
    return {
      cleanup: () => {
        media.removeEventListener('change', onChange);
        if (typeof window !== 'undefined' && window.visualViewport) {
          window.visualViewport.removeEventListener('resize', onViewport);
        }
      },
    };
  }

  const onTheme = () => applyTheme();
  tg.onEvent('themeChanged', onTheme);
  tg.onEvent('viewportChanged', onViewport);
  updateViewportHeight();
  return {
    cleanup: () => {
      tg.offEvent('themeChanged', onTheme);
      tg.offEvent('viewportChanged', onViewport);
      if (typeof window !== 'undefined' && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onViewport);
      }
    },
  };
}

export function updateViewportHeight(): void {
  const tg = getWebApp();
  const stable = tg?.viewportStableHeight;
  const current = tg?.viewportHeight;
  const height = stable || current || window.innerHeight;
  const root = document.documentElement;
  root.style.setProperty('--app-vh', `${height}px`);
  if (current) root.style.setProperty('--tg-viewport-height', `${current}px`);
  if (stable) root.style.setProperty('--tg-viewport-stable-height', `${stable}px`);
}

/**
 * Telegram treats a downward swipe at the top of a Mini App as a close/minimize
 * gesture. The game screen owns vertical drags, so disable that gesture while
 * the board is open and restore it when the player leaves.
 */
export function setVerticalSwipeLock(locked: boolean): void {
  const tg = getWebApp();
  if (!tg) return;
  try {
    if (locked) tg.disableVerticalSwipes?.();
    else tg.enableVerticalSwipes?.();
  } catch {
    // Optional API; older clients may not support vertical swipe control.
  }
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

export function hapticSelection(): void {
  try {
    getWebApp()?.HapticFeedback?.selectionChanged();
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
