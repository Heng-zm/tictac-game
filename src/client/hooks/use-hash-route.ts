import { useCallback, useEffect, useRef, useState } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'invite'; token: string }
  | { name: 'inviteWaiting' }
  | { name: 'game'; matchId: string }
  | { name: 'profile'; tab: 'overview' | 'history' | 'settings' }
  | { name: 'leaderboard' }
  | { name: 'notFound' };

export function parseHash(hash: string): Route {
  const withoutHash = hash.replace(/^#\/?/, '');
  // Separate query parameters (?...) from the path, and handle any secondary '#' fragments
  const firstSegment = (withoutHash.split('?')[0] ?? '').split('#')[0] ?? '';
  const pathOnly = firstSegment.replace(/\/+$/, '');
  if (!pathOnly) return { name: 'home' };
  // Telegram appends its launch parameters directly to the fragment, e.g.
  // `#tgWebAppData=...&tgWebAppVersion=8.0`. They describe the WebApp session,
  // not an app route, so treat them as the home route. Real routes may still
  // carry Telegram parameters after a `?` (for example `#/game/42?tgWebAppVersion=8.0`).
  if (/^tgWebApp[A-Za-z]*=/.test(pathOnly)) return { name: 'home' };
  const [first, second] = pathOnly.split('/');
  switch (first) {
    case 'search':
      return { name: 'search' };
    case 'invite':
      if (second === 'waiting') return { name: 'inviteWaiting' };
      if (second) return { name: 'invite', token: second };
      return { name: 'notFound' };
    case 'game':
      return second ? { name: 'game', matchId: second } : { name: 'notFound' };
    case 'profile':
      return {
        name: 'profile',
        tab: second === 'history' || second === 'settings' ? second : 'overview',
      };
    case 'leaderboard':
      return { name: 'leaderboard' };
    default:
      return { name: 'notFound' };
  }
}

export function routeToPath(route: Route): string {
  switch (route.name) {
    case 'home':
      return '/';
    case 'search':
      return '/search';
    case 'invite':
      return `/invite/${route.token}`;
    case 'inviteWaiting':
      return '/invite/waiting';
    case 'game':
      return `/game/${route.matchId}`;
    case 'profile':
      return route.tab === 'overview' ? '/profile' : `/profile/${route.tab}`;
    case 'leaderboard':
      return '/leaderboard';
    case 'notFound':
      return '/not-found';
  }
}

export interface NavigateOptions {
  replace?: boolean;
}

export function useHashRoute(): {
  route: Route;
  navigate: (path: string, options?: NavigateOptions) => void;
  canGoBack: boolean;
} {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  const [historyDepth, setHistoryDepth] = useState(0);

  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      // Focus management: move focus to main content container on navigation
      const main = document.getElementById('main-content');
      if (main && typeof main.focus === 'function') {
        main.focus({ preventScroll: true });
      }
    };
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/');
    }
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string, options?: NavigateOptions) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const targetHash = `#${normalized}`;

    if (options?.replace) {
      if (typeof window.history.replaceState === 'function') {
        window.history.replaceState(null, '', targetHash);
        setRoute(parseHash(targetHash));
        const main = document.getElementById('main-content');
        if (main && typeof main.focus === 'function') {
          main.focus({ preventScroll: true });
        }
        return;
      }
    }

    if (window.location.hash === targetHash) {
      setRoute(parseHash(targetHash));
      const main = document.getElementById('main-content');
      if (main && typeof main.focus === 'function') {
        main.focus({ preventScroll: true });
      }
      return;
    }

    setHistoryDepth((d) => d + 1);
    window.location.hash = targetHash;
  }, []);

  return { route, navigate, canGoBack: historyDepth > 0 };
}

type BackHandler = () => void;
const backHandlerStack: BackHandler[] = [];

function syncTelegramBackButton(): void {
  const backButton = window.Telegram?.WebApp?.BackButton;
  if (!backButton) return;
  if (backHandlerStack.length > 0) {
    backButton.show();
  } else {
    backButton.hide();
  }
}

let backButtonInitialized = false;

function ensureBackButtonSubscription(): void {
  if (backButtonInitialized) return;
  const backButton = window.Telegram?.WebApp?.BackButton;
  if (!backButton) return;
  backButtonInitialized = true;
  backButton.onClick(() => {
    const handler = backHandlerStack[backHandlerStack.length - 1];
    if (handler) {
      handler();
    }
  });
}

/**
 * Registers a priority back handler (e.g. Forfeit modal, HowToPlay guide, or screen back).
 * The most recently mounted active handler handles the BackButton press first.
 */
export function useTelegramBackHandler(active: boolean, onBack: () => void): void {
  const callback = useRef(onBack);
  callback.current = onBack;

  useEffect(() => {
    if (!active) return;
    ensureBackButtonSubscription();
    const handler = () => callback.current();
    backHandlerStack.push(handler);
    syncTelegramBackButton();
    return () => {
      const idx = backHandlerStack.lastIndexOf(handler);
      if (idx !== -1) backHandlerStack.splice(idx, 1);
      syncTelegramBackButton();
    };
  }, [active]);
}

/** Adds the browser-back affordance used by the Telegram header. */
export function useTelegramBackButton(visible: boolean, onBack: () => void): void {
  useTelegramBackHandler(visible, onBack);
}
