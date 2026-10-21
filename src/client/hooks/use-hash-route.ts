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

function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (!raw) return { name: 'home' };
  const [first, second] = raw.split('/');
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

export function useHashRoute(): { route: Route; navigate: (path: string) => void } {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/');
    }
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((path: string) => {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (window.location.hash === `#${normalized}`) {
      setRoute(parseHash(`#${normalized}`));
      return;
    }
    window.location.hash = `#${normalized}`;
  }, []);

  return { route, navigate };
}

/** Adds the browser-back affordance used by the Telegram header. */
export function useTelegramBackButton(visible: boolean, onBack: () => void): void {
  const callback = useRef(onBack);
  callback.current = onBack;

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;
    if (!visible) {
      backButton.hide();
      return;
    }
    const handler = () => callback.current();
    backButton.onClick(handler);
    backButton.show();
    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [visible]);
}
