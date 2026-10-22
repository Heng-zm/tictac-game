import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useGameClient } from './hooks/use-game-client';
import { useHashRoute, useTelegramBackButton } from './hooks/use-hash-route';
import { AuthGate } from './screens/AuthGate';
import { HomeScreen } from './screens/HomeScreen';
import { MatchmakingScreen } from './screens/MatchmakingScreen';
import { InviteAcceptScreen, InviteWaitingScreen } from './screens/InviteScreens';
import { GameScreen } from './screens/GameScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { LeaderboardScreen } from './screens/LeaderboardScreen';
import { NotFoundScreen } from './screens/NotFoundScreen';
import { BottomNav, ConnectionBanner } from './components/Layout';
import { ToastViewport } from './components/ui';

export default function App() {
  const { route, navigate } = useHashRoute();
  const client = useGameClient({
    onMatchFound: (matchId) => navigate(`/game/${matchId}`),
  });
  const inviteHandled = useRef(false);
  const gameHandled = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [route]);

  useEffect(() => {
    if (client.phase !== 'ready' || inviteHandled.current) return;
    const token = client.initialInviteToken;
    if (!token) return;
    inviteHandled.current = true;
    if (route.name === 'home' || route.name === 'notFound') {
      navigate(`/invite/${token}`);
    }
  }, [client.initialInviteToken, client.phase, navigate, route.name]);

  useEffect(() => {
    if (client.phase !== 'ready' || gameHandled.current) return;
    const matchId = client.initialGameMatchId;
    if (!matchId) return;
    gameHandled.current = true;
    if (route.name === 'home' || route.name === 'notFound') {
      navigate(`/game/${matchId}`);
    }
  }, [client.initialGameMatchId, client.phase, navigate, route.name]);

  const { cancelQueue } = client;

  const handleTelegramBack = useCallback(() => {
    if (route.name === 'search') {
      void cancelQueue().finally(() => navigate('/'));
      return;
    }
    navigate('/');
  }, [cancelQueue, navigate, route.name]);

  useTelegramBackButton(client.phase === 'ready' && route.name !== 'home', handleTelegramBack);

  if (client.phase !== 'ready') {
    return (
      <AuthGate
        phase={client.phase}
        error={client.bootError}
        code={client.bootErrorCode}
        config={client.config}
        onRetry={client.retryBoot}
      />
    );
  }

  let screen: ReactNode;
  switch (route.name) {
    case 'home':
      screen = <HomeScreen client={client} navigate={navigate} />;
      break;
    case 'search':
      screen = <MatchmakingScreen client={client} navigate={navigate} />;
      break;
    case 'invite':
      screen = <InviteAcceptScreen client={client} navigate={navigate} token={route.token} />;
      break;
    case 'inviteWaiting':
      screen = <InviteWaitingScreen client={client} navigate={navigate} />;
      break;
    case 'game':
      screen = <GameScreen client={client} navigate={navigate} matchId={route.matchId} />;
      break;
    case 'profile':
      screen = <ProfileScreen client={client} navigate={navigate} tab={route.tab} />;
      break;
    case 'leaderboard':
      screen = <LeaderboardScreen client={client} navigate={navigate} />;
      break;
    case 'notFound':
      screen = <NotFoundScreen navigate={navigate} />;
      break;
    default:
      screen = <NotFoundScreen navigate={navigate} />;
  }

  const nav =
    route.name === 'home' || route.name === 'leaderboard' || route.name === 'profile'
      ? route.name === 'home'
        ? 'home'
        : route.name
      : null;

  const showConnectionBanner = route.name !== 'game' && route.name !== 'search';
  // The result modal already communicates the outcome while the player is on
  // the board, so keep its toast out of the modal's action area.
  const visibleToasts =
    route.name === 'game'
      ? client.toasts.filter((toast) => toast.source !== 'match-result')
      : client.toasts;

  return (
    <div className="min-h-[var(--app-vh)]">
      {showConnectionBanner ? (
        <ConnectionBanner connection={client.connection} onRetry={client.reconnect} />
      ) : null}
      {screen}
      {nav ? (
        <BottomNav active={nav} onNavigate={navigate} hasActiveGame={client.match?.status === 'ACTIVE'} />
      ) : null}
      <ToastViewport toasts={visibleToasts} onDismiss={client.dismissToast} />
    </div>
  );
}
