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
import { BottomNav, ConnectionBanner, Page } from './components/Layout';
import { ToastViewport } from './components/ui';

export default function App() {
  const { route, navigate } = useHashRoute();
  const client = useGameClient({
    onMatchFound: (matchId) => navigate(`/game/${matchId}`),
  });
  const inviteHandled = useRef(false);

  useEffect(() => {
    if (client.phase !== 'ready' || inviteHandled.current) return;
    const token = client.initialInviteToken;
    if (!token) return;
    inviteHandled.current = true;
    if (route.name === 'home' || route.name === 'notFound') {
      navigate(`/invite/${token}`);
    }
  }, [client.initialInviteToken, client.phase, navigate, route.name]);

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

  return (
    <div className="min-h-[var(--app-vh)]">
      <ConnectionBanner connection={client.connection} onRetry={client.reconnect} />
      {client.connection === 'shutdown' && client.match?.status === 'ACTIVE' ? (
        <Page className="pt-[calc(env(safe-area-inset-top)+54px)] pb-0">
          <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-2.5 text-center text-[11px] font-medium text-muted">
            The server is restarting. Your active game will be paused and recoverable after reconnecting.
          </p>
        </Page>
      ) : null}
      {screen}
      {nav ? <BottomNav active={nav} onNavigate={navigate} /> : null}
      <ToastViewport toasts={client.toasts} onDismiss={client.dismissToast} />
    </div>
  );
}
