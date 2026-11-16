import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Clock3,
  Copy,
  Link2,
  RefreshCw,
  Send,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import type { InvitePreview } from '../../shared/game-types';
import type { GameClient } from '../hooks/use-game-client';
import { ApiRequestError, cancelInviteRest, errorMessage, fetchInvitePreview } from '../lib/api';
import { SocketRequestError } from '../lib/socket';
import { alignInviteLinkToCurrentOrigin, buildInviteDeepLink, isValidInviteToken } from '../lib/invites';
import { hapticImpact, hapticSelection, shareInTelegram } from '../lib/telegram';
import { isKhmer } from '../lib/language';
import { cn } from '../lib/cn';
import { formatLongDuration, useCountdown } from '../hooks/use-time';
import { inviteLinkStorageKey } from '../hooks/use-game-client';
import { Avatar, Button, Card, EmptyState, Pill, ScreenHeader, Spinner } from '../components/ui';
import { Page } from '../components/Layout';

export function InviteWaitingScreen({
  client,
  navigate,
}: {
  client: GameClient;
  navigate: (path: string) => void;
}) {
  const {
    pendingInvite,
    createdInvite,
    profile,
    connection,
    match,
    createInvite,
    cancelInvite,
    clearPendingInvite,
    clearCreatedInvite,
  } = client;
  const isKm = isKhmer(profile?.languageCode);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  const staleInviteId = useRef<string | null>(null);
  const activeMatch = match?.status === 'ACTIVE' ? match : null;
  const activeFriendMatch = activeMatch?.mode === 'FRIEND';

  const storedLink = pendingInvite
    ? readStoredLink(pendingInvite.id)
    : null;
  const rawDeepLink = createdInvite?.deepLink ?? storedLink;
  const expiresAt = pendingInvite?.expiresAt ?? createdInvite?.expiresAt ?? null;
  const remaining = useCountdown(expiresAt, undefined, client.clockOffsetMs);
  const expired = remaining !== null && remaining <= 0;
  // An invitation is spent as soon as its match is no longer waiting. That can
  // happen without a match:found event in this session, for example when the
  // app reconnects into a game the friend already accepted.
  const inviteMatch =
    match &&
    ((pendingInvite !== null && pendingInvite.matchId === match.id) ||
      (createdInvite !== null && createdInvite.matchId === match.id))
      ? match
      : null;
  const inviteUsed = inviteMatch !== null && inviteMatch.status !== 'WAITING';
  const hasInvite = Boolean(pendingInvite || createdInvite);
  const inviteId = pendingInvite?.id ?? createdInvite?.id ?? null;
  const staleInvite = hasInvite && (expired || inviteUsed);
  const deepLink =
    rawDeepLink && !staleInvite
      ? alignInviteLinkToCurrentOrigin(rawDeepLink, client.config, window.location.origin)
      : null;

  const create = useCallback(async () => {
    attempted.current = true;
    setCreating(true);
    setError(null);
    try {
      await createInvite();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }, [createInvite]);

  useEffect(() => {
    if (!staleInvite) return;
    // Drop the old one-time link before requesting a new one so neither its
    // URL nor its expiry can appear on the next invitation. Keep the id so a
    // clock-skewed, still-pending invitation can be cancelled first.
    staleInviteId.current = inviteUsed ? null : inviteId;
    attempted.current = false;
    clearPendingInvite();
    clearCreatedInvite();
    setError(null);
  }, [clearCreatedInvite, clearPendingInvite, inviteId, inviteUsed, staleInvite]);

  useEffect(() => {
    if (attempted.current) return;
    if (staleInvite) return;
    if (pendingInvite || createdInvite) {
      // An invitation is already on screen. Do not replace it if the player
      // cancels; only the stale-invite cleanup schedules a renewal.
      attempted.current = true;
      return;
    }
    if (activeMatch) return;
    if (connection !== 'online') return;
    attempted.current = true;
    setCreating(true);
    const previousInviteId = staleInviteId.current;
    staleInviteId.current = null;
    void (async () => {
      if (previousInviteId) {
        // The client may consider an invitation expired slightly before the
        // server does. Close it so it cannot block the replacement.
        try {
          await cancelInvite(previousInviteId);
        } catch {
          // The server already expired, consumed, or removed it.
        }
      }
      await create();
    })();
  }, [activeMatch, cancelInvite, connection, create, createdInvite, pendingInvite, staleInvite]);

  async function copyLink(): Promise<void> {
    if (!deepLink) return;
    hapticImpact('light');
    const success = await copyText(deepLink);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      client.pushToast({
        type: 'success',
        title: isKm ? 'បានចម្លងតំណអញ្ជើញ' : 'Invite link copied',
      });
    } else {
      client.pushToast({
        type: 'error',
        title: isKm ? 'មិនអាចចម្លងតំណបានទេ' : 'Could not copy the link',
        message: isKm ? 'សូមជ្រើសរើសតំណ ហើយចម្លងដោយដៃ។' : 'Select the link and copy it manually.',
      });
    }
  }

  async function shareLink(): Promise<void> {
    if (!deepLink) return;
    hapticSelection();
    const text = isKm
      ? `${profile?.firstName ?? 'មិត្តភក្តិ'} បានអញ្ជើញអ្នកមកលេង Tic Tac Toe លើ Telegram។`
      : `${profile?.firstName ?? 'A friend'} invited you to Tic Tac Toe on Telegram.`;
    if (shareInTelegram(deepLink, text)) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: isKm ? 'ការអញ្ជើញលេង Tic Tac Toe' : 'Tic Tac Toe invitation',
          text,
          url: deepLink,
        });
        return;
      } catch {
        // The user dismissed the native share sheet.
        return;
      }
    }
    await copyLink();
  }

  async function cancel(): Promise<void> {
    hapticSelection();
    if (!pendingInvite || expired || inviteUsed) {
      clearPendingInvite();
      clearCreatedInvite();
      navigate('/');
      return;
    }
    setCancelling(true);
    try {
      await client.cancelInvite(pendingInvite.id);
      navigate('/');
    } catch (caught) {
      client.pushToast({
        type: 'error',
        title: isKm ? 'មិនអាចបោះបង់ការអញ្ជើញបានទេ' : 'Could not cancel invitation',
        message: errorMessage(caught),
      });
    } finally {
      setCancelling(false);
    }
  }

  async function regenerate(): Promise<void> {
    hapticImpact('medium');
    attempted.current = true;
    setCreating(true);
    setError(null);
    try {
      if (pendingInvite && !expired && !inviteUsed) {
        try {
          await client.cancelInvite(pendingInvite.id);
        } catch (caught) {
          const code =
            caught instanceof ApiRequestError || caught instanceof SocketRequestError ? caught.code : null;
          // These mean the invitation was already closed on the server, so a
          // fresh one is safe. Anything else should not silently drop a link
          // that could still be waiting for a friend.
          if (code !== 'INVITATION_USED' && code !== 'INVITATION_INVALID') throw caught;
        }
      }
      // Never let the replacement inherit the previous link or expiry date.
      clearPendingInvite();
      clearCreatedInvite();
      await createInvite();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page>
      <ScreenHeader
        title={isKm ? 'អញ្ជើញមិត្តភក្តិ' : 'Invite a friend'}
        subtitle={isKm ? 'តំណភ្ជាប់ឯកជនមួយ គូប្រកួតមួយ' : 'One private link, one opponent'}
        onBack={() => navigate('/')}
        action={<Pill tone="accent">{isKm ? 'គិតពិន្ទុ' : 'Rated'}</Pill>}
      />

      {activeMatch ? (
        <Card className="p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-accent">
            {isKm ? 'ការប្រកួតកំពុងដំណើរការ' : 'Game in progress'}
          </p>
          <h2 className="mt-2 text-xl font-bold text-ink">
            {activeFriendMatch
              ? (isKm ? 'មិត្តភក្តិរបស់អ្នកបានចូលរួមហើយ' : 'Your friend already joined')
              : (isKm ? 'អ្នកមានការប្រកួតមួយរួចហើយ' : 'You already have a game')}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {activeFriendMatch
              ? (isKm ? 'ការអញ្ជើញត្រូវបានទទួលយក។ ត្រឡប់ទៅក្ដារហ្គេមវិញ។' : 'The invitation was accepted. Jump back into the board.')
              : (isKm ? 'អាចលេងបានតែមួយហ្គេមក្នុងពេលតែមួយ។ សូមបញ្ចប់ហ្គេមបច្ចុប្បន្នសិន មុនពេលអញ្ជើញមិត្តភក្តិ។' : 'Only one game can be active at a time. Finish your current board before inviting a friend.')}
          </p>
          <Button className="mt-4 w-full" onClick={() => navigate(`/game/${activeMatch.id}`)}>
            {activeFriendMatch ? (isKm ? 'បើកហ្គេម' : 'Open game') : (isKm ? 'បន្តហ្គេម' : 'Resume game')}
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent/20 animate-pulse-ring" />
              <Avatar name={profile?.firstName ?? (isKm ? 'អ្នក' : 'You')} photoUrl={profile?.photoUrl} size="xl" ring />
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-ink">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-ink">
              {staleInvite
                ? (isKm ? 'កំពុងបង្កើតការអញ្ជើញថ្មី…' : 'Refreshing your invitation…')
                : creating
                  ? (isKm ? 'កំពុងបង្កើតតំណភ្ជាប់…' : 'Creating your link…')
                  : (isKm ? 'ក្ដារហ្គេមកំពុងរង់ចាំ' : 'Your board is waiting')}
            </h2>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              {staleInvite || creating
                ? (isKm ? 'តំណមុនត្រូវបានបិទ។ កំពុងរៀបចំការអញ្ជើញឯកជនថ្មីសម្រាប់មិត្តភក្តិរបស់អ្នក។' : 'The previous link is closed. Preparing a new private invitation for your friend.')
                : expired
                  ? (isKm ? 'បង្កើតតំណថ្មី ហើយផ្ញើទៅកាន់មិត្តរបស់អ្នក។' : 'Generate a fresh link and send it to your friend.')
                  : (isKm ? 'ផ្ញើតំណភ្ជាប់ខាងក្រោម។ ពេលមិត្តរបស់អ្នកបើកភ្លាម ការប្រកួតនឹងចាប់ផ្តើមភ្លាមៗ។' : 'Send the link below. As soon as your friend opens it, the game starts automatically.')}
            </p>

            {pendingInvite && !staleInvite ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Pill tone={expired ? 'danger' : 'accent'}>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {expired ? (isKm ? 'ផុតកំណត់' : 'Expired') : isKm ? `នៅសល់ ${formatLongDuration(remaining)}` : `${formatLongDuration(remaining)} left`}
                </Pill>
                <Pill tone="success">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  {isKm ? 'អ្នកបើកមុនបានចូលលេង' : 'First to open joins'}
                </Pill>
              </div>
            ) : null}
          </div>

          {(creating || staleInvite) && !deepLink ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Spinner />
              <p className="text-xs text-muted">
                {isKm ? 'កំពុងរៀបចំកូដអញ្ជើញសុវត្ថិភាព…' : 'Preparing a secure invitation token…'}
              </p>
            </div>
          ) : deepLink && !expired ? (
            <div className="mt-5">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-app/60 p-2 pl-3">
                <Link2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <p className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-muted">{deepLink}</p>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  aria-label={copied ? (isKm ? 'បានចម្លងតំណភ្ជាប់' : 'Invitation link copied') : (isKm ? 'ចម្លងតំណភ្ជាប់' : 'Copy invitation link')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button icon={Send} onClick={() => void shareLink()}>
                  {isKm ? 'ចែករំលែក' : 'Share'}
                </Button>
                <Button variant="secondary" icon={Copy} onClick={() => void copyLink()}>
                  {copied ? (isKm ? 'បានចម្លង' : 'Copied') : (isKm ? 'ចម្លងតំណ' : 'Copy link')}
                </Button>
              </div>
            </div>
          ) : !expired && !staleInvite && !creating ? (
            <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-left">
              <p className="text-xs font-semibold text-ink">
                {isKm ? 'មិនមានតំណនៅលើឧបករណ៍នេះទេ' : 'Link unavailable on this device'}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                {isKm
                  ? 'កូដអញ្ជើញត្រូវបានបង្ហាញតែម្តងប៉ុណ្ណោះសម្រាប់សុវត្ថិភាព។ បង្កើតតំណថ្មីដើម្បីចែករំលែកហ្គេមរបស់អ្នក។'
                  : 'Invitation tokens are only shown once for security. Generate a fresh link to share your game.'}
              </p>
              <Button size="sm" className="mt-2" variant="secondary" onClick={() => void regenerate()}>
                {isKm ? 'បង្កើតតំណថ្មី' : 'Generate a fresh link'}
              </Button>
            </div>
          ) : null}

          {error ? (
            <div role="alert" className="mt-3 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {error}
              {!deepLink ? (
                <button
                  type="button"
                  onClick={() => void create()}
                  className="mt-1 block text-[11px] font-semibold underline"
                >
                  {isKm ? 'ព្យាយាមម្តងទៀត' : 'Try again'}
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 border-t border-line pt-3">
            <Button
              variant="ghost"
              className="w-full"
              icon={X}
              loading={cancelling}
              onClick={() => void cancel()}
            >
              {pendingInvite && !staleInvite
                ? (isKm ? 'បោះបង់ការអញ្ជើញ' : 'Cancel invitation')
                : (isKm ? 'ត្រឡប់ទៅដើម' : 'Back home')}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-3 space-y-2">
        <Card className="flex items-start gap-2.5 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted">
            {isKm
              ? 'ការអញ្ជើញឯកជនអាចប្រើបានតែម្តងគត់។ អ្នកដំបូងដែលបើកតំណរបស់អ្នកនឹងលេងខាង O គ្មាននរណាផ្សេងអាចដណ្តើមបានឡើយ។'
              : 'Private invitations are single-use. The first person to open your link claims the O side; nobody else can take their place.'}
          </p>
        </Card>
      </div>
    </Page>
  );
}

export function InviteAcceptScreen({
  client,
  navigate,
  token,
}: {
  client: GameClient;
  navigate: (path: string) => void;
  token: string;
}) {
  const isKm = isKhmer(client.profile?.languageCode);
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchInvitePreview(token);
      setPreview(result.invite);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError({ code: caught.code, message: caught.message });
      } else {
        setError({ code: 'NETWORK_ERROR', message: errorMessage(caught) });
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!isValidInviteToken(token)) {
      setError({
        code: 'INVITATION_INVALID',
        message: isKm ? 'តំណអញ្ជើញនេះមិនត្រឹមត្រូវឡើយ។' : 'This invitation link is not valid.',
      });
      setLoading(false);
      return;
    }
    void load();
  }, [isKm, load, token]);

  const remaining = useCountdown(preview?.expiresAt ?? null, undefined, client.clockOffsetMs);
  const expired = preview?.status === 'EXPIRED' || (remaining !== null && remaining <= 0);
  const shareLink = buildInviteDeepLink(client.config, token);

  async function accept(): Promise<void> {
    hapticImpact('medium');
    setAccepting(true);
    setError(null);
    try {
      const result = await client.acceptInvite(token);
      navigate(`/game/${result.matchId}`);
    } catch (caught) {
      if (caught instanceof ApiRequestError) {
        setError({ code: caught.code, message: caught.message });
      } else if (caught instanceof SocketRequestError) {
        setError({ code: caught.code, message: caught.message });
      } else {
        setError({ code: 'ACCEPT_FAILED', message: errorMessage(caught) });
      }
      setAccepting(false);
      void load();
    }
  }

  async function copyLink(): Promise<void> {
    hapticImpact('light');
    const success = await copyText(shareLink);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      client.pushToast({
        type: 'success',
        title: isKm ? 'បានចម្លងតំណអញ្ជើញ' : 'Invite link copied',
      });
    }
  }

  async function shareLinkPress(): Promise<void> {
    hapticSelection();
    const text = isKm
      ? `${preview?.inviter.displayName ?? 'មិត្តភក្តិ'} បានអញ្ជើញអ្នកមកលេង Tic Tac Toe លើ Telegram។`
      : `${preview?.inviter.displayName ?? 'A friend'} invited you to Tic Tac Toe on Telegram.`;
    if (shareInTelegram(shareLink, text)) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: isKm ? 'ការអញ្ជើញលេង Tic Tac Toe' : 'Tic Tac Toe invitation',
          text,
          url: shareLink,
        });
        return;
      } catch {
        return;
      }
    }
    await copyLink();
  }

  async function cancelInvite(): Promise<void> {
    if (!preview) return;
    hapticSelection();
    setCancelling(true);
    try {
      await cancelInviteRest(token);
      client.clearPendingInvite();
      client.clearCreatedInvite();
      client.pushToast({
        type: 'success',
        title: isKm ? 'បានបោះបង់ការអញ្ជើញ' : 'Invitation cancelled',
      });
      navigate('/');
    } catch (caught) {
      client.pushToast({
        type: 'error',
        title: isKm ? 'មិនអាចបោះបង់ការអញ្ជើញបានទេ' : 'Could not cancel invitation',
        message: errorMessage(caught),
      });
    } finally {
      setCancelling(false);
    }
  }

  const busy = client.connection !== 'online';

  return (
    <Page>
      <ScreenHeader
        title={isKm ? 'ការអញ្ជើញចូលរួមលេង' : 'Game invitation'}
        subtitle={isKm ? 'ការប្រកួតឯកជន សម្រាប់តែពីរនាក់' : 'A private match, just for two'}
        onBack={() => navigate('/')}
      />

      {loading ? (
        <Card className="flex flex-col items-center gap-3 p-10">
          <Spinner className="h-7 w-7" />
          <p className="text-sm text-muted">
            {isKm ? 'កំពុងបើកការអញ្ជើញ…' : 'Opening the invitation…'}
          </p>
        </Card>
      ) : error && !preview ? (
        <Card>
          <EmptyState
            icon={Link2}
            title={isKm ? 'មិនមានការអញ្ជើញនេះទេ' : 'Invitation unavailable'}
            description={error.message}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void load()}>
                  {isKm ? 'ព្យាយាមម្តងទៀត' : 'Retry'}
                </Button>
                <Button size="sm" onClick={() => navigate('/')}>
                  {isKm ? 'ទំព័រដើម' : 'Home'}
                </Button>
              </div>
            }
          />
        </Card>
      ) : preview ? (
        <>
          <Card className="p-5">
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={preview.inviter.displayName}
                photoUrl={preview.inviter.photoUrl}
                size="xl"
                ring
              />
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted">
                {isKm ? 'អ្នកត្រូវបានអញ្ជើញដោយ' : 'You are invited by'}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{preview.inviter.displayName}</h2>
              {preview.inviter.username ? (
                <p className="text-xs text-muted">@{preview.inviter.username}</p>
              ) : null}

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-elevated/60 px-4 py-2.5">
                <span className="text-xl font-bold text-accent">X</span>
                <span className="text-[10px] font-medium text-muted">vs</span>
                <span className="text-xl font-bold text-danger">O</span>
                <span
                  className={cn(
                    'ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold',
                    preview.yourSide === 'X'
                      ? 'bg-accent/10 text-accent'
                      : 'bg-danger/10 text-danger',
                  )}
                >
                  {isKm ? `អ្នកលេងខាង ${preview.yourSide}` : `You play ${preview.yourSide}`}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Pill tone={expired ? 'danger' : preview.status === 'PENDING' ? 'accent' : 'neutral'}>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {expired
                    ? (isKm ? 'ផុតកំណត់' : 'Expired')
                    : preview.status === 'PENDING'
                      ? (isKm ? `នៅសល់ ${formatLongDuration(remaining)}` : `${formatLongDuration(remaining)} left`)
                      : preview.status.toLowerCase()}
                </Pill>
                <Pill>
                  {preview.matchStatus === 'WAITING'
                    ? (isKm ? 'កំពុងរង់ចាំអ្នក' : 'Waiting for you')
                    : preview.matchStatus.toLowerCase()}
                </Pill>
              </div>

              {preview.youAreInviter ? (
                <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">
                  {isKm
                    ? 'នេះជាការអញ្ជើញរបស់អ្នកផ្ទាល់។ ចែករំលែកតំណខាងក្រោម ហើយរង់ចាំមិត្តភក្តិចូលរួម។'
                    : 'This is your own invitation. Share the link below and wait for a friend to join.'}
                </p>
              ) : null}
            </div>

            {error ? (
              <div role="alert" className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs text-danger">
                {error.message}
                {error.code === 'INVITATION_USED' || error.code === 'INVITATION_EXPIRED' ? (
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-1 block w-full text-[11px] font-semibold underline"
                  >
                    {isKm ? 'ផ្ទុកការអញ្ជើញឡើងវិញ' : 'Refresh invitation'}
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 space-y-2">
              {preview.youAreInviter ? (
                preview.status === 'ACCEPTED' || preview.matchStatus === 'ACTIVE' ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      client.pushToast({
                        type: 'info',
                        title: isKm ? 'កំពុងបើកហ្គេមរបស់អ្នក' : 'Opening your game',
                      });
                      navigate(`/game/${preview.matchId}`);
                    }}
                  >
                    {isKm ? 'បើកហ្គេម' : 'Open game'}
                  </Button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button icon={Send} onClick={() => void shareLinkPress()}>
                        {isKm ? 'ចែករំលែកតំណ' : 'Share link'}
                      </Button>
                      <Button variant="secondary" icon={Copy} onClick={() => void copyLink()}>
                        {copied ? (isKm ? 'បានចម្លង' : 'Copied') : (isKm ? 'ចម្លងតំណ' : 'Copy link')}
                      </Button>
                    </div>
                    {preview.status === 'PENDING' || preview.matchStatus === 'WAITING' ? (
                      <Button
                        variant="ghost"
                        className="w-full"
                        icon={X}
                        loading={cancelling}
                        onClick={() => void cancelInvite()}
                      >
                        {isKm ? 'បោះបង់ការអញ្ជើញ' : 'Cancel invitation'}
                      </Button>
                    ) : null}
                  </>
                )
              ) : expired || preview.status === 'EXPIRED' ? (
                <div className="space-y-2">
                  <p className="text-center text-xs text-muted">
                    {isKm ? 'ការអញ្ជើញនេះបានផុតកំណត់ហើយ។' : 'This invitation has expired.'}
                  </p>
                  <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                    {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back to Home'}
                  </Button>
                </div>
              ) : preview.status === 'CANCELLED' ? (
                <div className="space-y-2">
                  <p className="text-center text-xs text-muted">
                    {isKm ? 'ការអញ្ជើញនេះត្រូវបានបោះបង់ដោយម្ចាស់បន្ទប់។' : 'This invitation was cancelled by the host.'}
                  </p>
                  <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                    {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back to Home'}
                  </Button>
                </div>
              ) : preview.status === 'ACCEPTED' || preview.matchStatus !== 'WAITING' ? (
                <div className="space-y-2">
                  <p className="text-center text-xs text-muted">
                    {isKm ? 'ការអញ្ជើញនេះត្រូវបានទទួលយកមុនរួចហើយ។' : 'This invitation was already accepted.'}
                  </p>
                  <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                    {isKm ? 'ត្រឡប់ទៅទំព័រដើម' : 'Back to Home'}
                  </Button>
                </div>
              ) : (
                <>
                  <Button size="lg" className="w-full" loading={accepting} disabled={busy} onClick={() => void accept()}>
                    {busy
                      ? (isKm ? 'កំពុងភ្ជាប់ឡើងវិញ…' : 'Reconnecting…')
                      : isKm ? `ទទួលយកលេងខាង ${preview.yourSide}` : `Accept as ${preview.yourSide}`}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
                    {isKm ? 'មិនមែនឥឡូវនេះទេ' : 'Not now'}
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="mt-3 flex items-start gap-2.5 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <p className="text-[11px] leading-relaxed text-muted">
              {isKm
                ? 'ការអញ្ជើញអាចប្រើបានតែម្តងគត់ និងផុតកំណត់ដោយស្វ័យប្រវត្តិ។ ការទទួលយកនឹងរក្សាកន្លែងរបស់អ្នក — ម៉ាស៊ីនបម្រើនឹងផ្ទៀងផ្ទាត់រាល់ជំហានលេងបន្ទាប់ពីនោះ។'
                : 'Invitations are single-use and expire automatically. Accepting reserves your seat — the server validates every move from there.'}
            </p>
          </Card>
        </>
      ) : null}
    </Page>
  );
}

function readStoredLink(invitationId: string): string | null {
  try {
    return window.localStorage.getItem(inviteLinkStorageKey(invitationId));
  } catch {
    return null;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to a temporary textarea.
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const success = document.execCommand('copy');
    textarea.remove();
    return success;
  } catch {
    return false;
  }
}
