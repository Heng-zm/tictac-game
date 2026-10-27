import type {
  AppConfigPayload,
  CreatedInvitation,
  HistoryItem,
  InvitePreview,
  LeaderboardResponse,
  UserProfile,
} from '../../shared/game-types';
import type {
  TelegramLoginStartResponse,
  TelegramLoginStatusResponse,
} from '../../shared/telegram-login';

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiRequestError('NETWORK_ERROR', 'Cannot reach the game server. Check your connection.', 0);
  }

  if (response.status === 204) return undefined as T;
  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; requestId?: string } } | null)?.error;
    throw new ApiRequestError(
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? 'Something went wrong. Please try again.',
      response.status,
      error?.requestId,
    );
  }
  return payload as T;
}

export function fetchConfig(): Promise<AppConfigPayload> {
  return request<AppConfigPayload>('/api/config', { method: 'GET' });
}

export function fetchMe(): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/api/me', { method: 'GET' });
}

export function authenticateTelegram(initData: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/api/auth/telegram', {
    method: 'POST',
    body: JSON.stringify({ initData }),
  });
}

export function authenticateDev(deviceKey: string, displayName?: string): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/api/auth/dev', {
    method: 'POST',
    body: JSON.stringify({ deviceKey, ...(displayName ? { displayName } : {}) }),
  });
}

/** Creates a one-time browser sign-in request and returns the bot deep link. */
export function startTelegramBotLogin(): Promise<TelegramLoginStartResponse> {
  return request<TelegramLoginStartResponse>('/api/auth/telegram/bot/start', { method: 'POST' });
}

/** Polls until the bot's Verify button has been tapped. */
export function fetchTelegramBotLoginStatus(): Promise<TelegramLoginStatusResponse> {
  return request<TelegramLoginStatusResponse>('/api/auth/telegram/bot/status', { method: 'GET' });
}

export interface PreferencesPatch {
  autoAiFallback?: boolean;
  turnNotifications?: boolean;
}

export function updatePreferences(patch: PreferencesPatch): Promise<{ user: UserProfile }> {
  return request<{ user: UserProfile }>('/api/me/preferences', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function sendTestNotification(): Promise<{ status: 'sent' }> {
  return request<{ status: 'sent' }>('/api/me/notifications/test', { method: 'POST' });
}

export interface HistoryPage {
  items: HistoryItem[];
  nextCursor: string | null;
}

export function fetchHistory(limit = 10, cursor?: string): Promise<HistoryPage> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('cursor', cursor);
  return request<HistoryPage>(`/api/history?${params.toString()}`, { method: 'GET' });
}

export function fetchLeaderboard(limit = 50): Promise<LeaderboardResponse> {
  return request<LeaderboardResponse>(`/api/leaderboard?limit=${String(limit)}`, { method: 'GET' });
}

export function fetchInvitePreview(token: string): Promise<{ invite: InvitePreview }> {
  return request<{ invite: InvitePreview }>(`/api/invites/${encodeURIComponent(token)}`, { method: 'GET' });
}

export function acceptInviteRest(token: string): Promise<{ matchId: string }> {
  return request<{ matchId: string }>(`/api/invites/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
  });
}

export function cancelInviteRest(token: string): Promise<{ cancelled: true }> {
  return request<{ cancelled: true }>(`/api/invites/${encodeURIComponent(token)}/cancel`, {
    method: 'POST',
  });
}

export interface CreatedInviteResponse {
  invitation: CreatedInvitation;
}

export function getDeviceKey(): string {
  const storageKey = 'ttt:device-key';
  try {
    const existing = window.localStorage.getItem(storageKey);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `guest-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(storageKey, generated);
    return generated;
  } catch {
    return `guest-${Date.now().toString(36)}`;
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
