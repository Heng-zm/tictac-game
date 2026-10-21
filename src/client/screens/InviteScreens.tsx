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
import { shareInTelegram } from '../lib/telegram';
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
  const { pendingInvite, createdInvite, profile, connection, match, createInvite } = client;
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);
  const activeMatch = match?.status === 'ACTIVE' ? match : null;

  const storedLink = pendingInvite
    ? readStoredLink(pendingInvite.id)
    : null;
  const rawDeepLink = createdInvite?.deepLink ?? storedLink;
  const deepLink = rawDeepLink
    ? alignInviteLinkToCurrentOrigin(rawDeepLink, client.config, window.location.origin)
    : null;
  const expiresAt = pendingInvite?.expiresAt ?? createdInvite?.expiresAt ?? null;
  const remaining = useCountdown(expiresAt);
  const expired = remaining !== null && remaining <= 0;

  const create = useCallback(async () => {
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
    if (attempted.current) return;
    if (activeMatch || pendingInvite || createdInvite) {
      attempted.current = true;
      return;
    }
    if (connection !== 'online') return;
    attempted.current = true;
    void create();
  }, [activeMatch, connection, create, createdInvite, pendingInvite]);

  async function copyLink(): Promise<void> {
    if (!deepLink) return;
    const success = await copyText(deepLink);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      client.pushToast({ type: 'success', title: 'Invite link copied' });
    } else {
      client.pushToast({ type: 'error', title: 'Could not copy the link', message: 'Select the link and copy it manually.' });
    }
  }

  async function shareLink(): Promise<void> {
    if (!deepLink) return;
    const text = `${profile?.firstName ?? 'A friend'} invited you to Tic Tac Toe on Telegram.`;
    if (shareInTelegram(deepLink, text)) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tic Tac Toe invitation', text, url: deepLink });
        return;
      } catch {
        // The user dismissed the native share sheet.
        return;
      }
    }
    await copyLink();
  }

  async function cancel(): Promise<void> {
    if (!pendingInvite) {
      navigate('/');
      return;
    }
    setCancelling(true);
    try {
      await client.cancelInvite(pendingInvite.id);
      navigate('/');
    } catch (caught) {
      client.pushToast({ type: 'error', title: 'Could not cancel invitation', message: errorMessage(caught) });
    } finally {
      setCancelling(false);
    }
  }

  async function regenerate(): Promise<void> {
    setCreating(true);
    setError(null);
    try {
      if (pendingInvite) {
        try {
          await client.cancelInvite(pendingInvite.id);
        } catch {
          // An expired invitation may already be closed on the server.
        }
      }
      await client.createInvite();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Page>
      <ScreenHeader
        title="Invite a friend"
        subtitle="One private link, one opponent"
        onBack={() => navigate('/')}
        action={<Pill tone="accent">Rated</Pill>}
      />

      {activeMatch ? (
        <Card className="p-5 text-center">
          <p className="text-xs font-bold uppercase tracking-wide text-accent">Game in progress</p>
          <h2 className="mt-2 text-xl font-bold text-ink">Your friend already joined</h2>
          <p className="mt-1 text-sm text-muted">The invitation was accepted. Jump back into the board.</p>
          <Button className="mt-4 w-full" onClick={() => navigate(`/game/${activeMatch.id}`)}>
            Open game
          </Button>
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <span className="absolute inset-0 rounded-full bg-accent/20 animate-pulse-ring" />
              <Avatar name={profile?.firstName ?? 'You'} photoUrl={profile?.photoUrl} size="xl" ring />
              <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface bg-accent text-accent-ink">
                <UserPlus className="h-4 w-4" aria-hidden />
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-tight text-ink">
              {creating ? 'Creating your link…' : expired ? 'This invitation expired' : 'Your board is waiting'}
            </h2>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              {expired
                ? 'Generate a fresh link and send it to your friend.'
                : 'Send the link below. As soon as your friend opens it, the game starts automatically.'}
            </p>

            {pendingInvite ? (
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Pill tone={expired ? 'danger' : 'accent'}>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {expired ? 'Expired' : `${formatLongDuration(remaining)} left`}
                </Pill>
                <Pill tone="success">
                  <ShieldCheck className="h-3 w-3" aria-hidden />
                  First to open joins
                </Pill>
              </div>
            ) : null}
          </div>

          {creating && !deepLink ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              <Spinner />
              <p className="text-xs text-muted">Preparing a secure invitation token…</p>
            </div>
          ) : deepLink && !expired ? (
            <div className="mt-5">
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-app/60 p-2 pl-3">
                <Link2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
                <p className="min-w-0 flex-1 break-all text-[11px] leading-relaxed text-muted">{deepLink}</p>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  aria-label="Copy invitation link"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-elevated text-muted transition hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {copied ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button icon={Send} onClick={() => void shareLink()}>
                  Share
                </Button>
                <Button variant="secondary" icon={Copy} onClick={() => void copyLink()}>
                  {copied ? 'Copied' : 'Copy link'}
                </Button>
              </div>
            </div>
          ) : !expired && !creating ? (
            <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-left">
              <p className="text-xs font-semibold text-ink">Link unavailable on this device</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">
                Invitation tokens are only shown once for security. Generate a fresh link to share your game.
              </p>
              <Button size="sm" className="mt-2" variant="secondary" onClick={() => void regenerate()}>
                Generate a fresh link
              </Button>
            </div>
          ) : null}

          {error ? (
            <div className="mt-3 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-xs text-danger">
              {error}
              {!deepLink ? (
                <button
                  type="button"
                  onClick={() => void create()}
                  className="mt-1 block text-[11px] font-semibold underline"
                >
                  Try again
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
              {pendingInvite ? 'Cancel invitation' : 'Back home'}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-3 space-y-2">
        {expired ? (
          <Button variant="secondary" icon={RefreshCw} loading={creating} className="w-full" onClick={() => void regenerate()}>
            Generate a new link
          </Button>
        ) : null}
        <Card className="flex items-start gap-2.5 p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
          <p className="text-[11px] leading-relaxed text-muted">
            Private invitations are single-use. The first person to open your link claims the O side; nobody else can
            take their place.
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
      setError({ code: 'INVITATION_INVALID', message: 'This invitation link is not valid.' });
      setLoading(false);
      return;
    }
    void load();
  }, [load, token]);

  const remaining = useCountdown(preview?.expiresAt ?? null);
  const expired = preview?.status === 'EXPIRED' || (remaining !== null && remaining <= 0);
  const shareLink = buildInviteDeepLink(client.config, token);

  async function accept(): Promise<void> {
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
    const success = await copyText(shareLink);
    if (success) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  async function shareLinkPress(): Promise<void> {
    const text = `${preview?.inviter.displayName ?? 'A friend'} invited you to Tic Tac Toe on Telegram.`;
    if (shareInTelegram(shareLink, text)) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Tic Tac Toe invitation', text, url: shareLink });
        return;
      } catch {
        return;
      }
    }
    await copyLink();
  }

  async function cancelInvite(): Promise<void> {
    if (!preview) return;
    setCancelling(true);
    try {
      await cancelInviteRest(token);
      client.clearPendingInvite();
      client.clearCreatedInvite();
      client.pushToast({ type: 'success', title: 'Invitation cancelled' });
      navigate('/');
    } catch (caught) {
      client.pushToast({ type: 'error', title: 'Could not cancel invitation', message: errorMessage(caught) });
    } finally {
      setCancelling(false);
    }
  }

  const busy = client.connection !== 'online';

  return (
    <Page>
      <ScreenHeader title="Game invitation" subtitle="A private match, just for two" onBack={() => navigate('/')} />

      {loading ? (
        <Card className="flex flex-col items-center gap-3 p-10">
          <Spinner className="h-7 w-7" />
          <p className="text-sm text-muted">Opening the invitation…</p>
        </Card>
      ) : error && !preview ? (
        <Card>
          <EmptyState
            icon={Link2}
            title="Invitation unavailable"
            description={error.message}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" icon={RefreshCw} onClick={() => void load()}>
                  Retry
                </Button>
                <Button size="sm" onClick={() => navigate('/')}>
                  Home
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
              <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-muted">You are invited by</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-ink">{preview.inviter.displayName}</h2>
              {preview.inviter.username ? (
                <p className="text-xs text-muted">@{preview.inviter.username}</p>
              ) : null}

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-elevated/60 px-4 py-2.5">
                <span className="text-xl font-bold text-accent">X</span>
                <span className="text-[10px] font-medium text-muted">vs</span>
                <span className="text-xl font-bold text-danger">O</span>
                <span className="ml-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
                  You play {preview.yourSide}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <Pill tone={expired ? 'danger' : preview.status === 'PENDING' ? 'accent' : 'neutral'}>
                  <Clock3 className="h-3 w-3" aria-hidden />
                  {expired ? 'Expired' : preview.status === 'PENDING' ? `${formatLongDuration(remaining)} left` : preview.status.toLowerCase()}
                </Pill>
                <Pill>{preview.matchStatus === 'WAITING' ? 'Waiting for you' : preview.matchStatus.toLowerCase()}</Pill>
              </div>

              {preview.youAreInviter ? (
                <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted">
                  This is your own invitation. Share the link below and wait for a friend to join.
                </p>
              ) : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-2xl border border-danger/25 bg-danger/10 p-3 text-center text-xs text-danger">
                {error.message}
                {error.code === 'INVITATION_USED' || error.code === 'INVITATION_EXPIRED' ? (
                  <button
                    type="button"
                    onClick={() => void load()}
                    className="mt-1 block w-full text-[11px] font-semibold underline"
                  >
                    Refresh invitation
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
                      client.pushToast({ type: 'info', title: 'Opening your game' });
                      navigate(`/game/${preview.matchId}`);
                    }}
                  >
                    Open game
                  </Button>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button icon={Send} onClick={() => void shareLinkPress()}>
                        Share link
                      </Button>
                      <Button variant="secondary" icon={Copy} onClick={() => void copyLink()}>
                        {copied ? 'Copied' : 'Copy link'}
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
                        Cancel invitation
                      </Button>
                    ) : null}
                  </>
                )
              ) : expired || preview.status === 'EXPIRED' ? (
                <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                  This invite has expired
                </Button>
              ) : preview.status === 'CANCELLED' ? (
                <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                  This invite was cancelled
                </Button>
              ) : preview.status === 'ACCEPTED' || preview.matchStatus !== 'WAITING' ? (
                <Button variant="secondary" className="w-full" onClick={() => navigate('/')}>
                  This invite was already used
                </Button>
              ) : (
                <>
                  <Button size="lg" className="w-full" loading={accepting} disabled={busy} onClick={() => void accept()}>
                    {busy ? 'Reconnecting…' : `Accept as ${preview.yourSide}`}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate('/')}>
                    Not now
                  </Button>
                </>
              )}
            </div>
          </Card>

          <Card className="mt-3 flex items-start gap-2.5 p-3.5">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
            <p className="text-[11px] leading-relaxed text-muted">
              Invitations are single-use and expire automatically. Accepting reserves your seat — the server validates
              every move from there.
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
