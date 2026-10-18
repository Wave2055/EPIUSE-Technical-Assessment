import type { AccessTokenResponse } from '@epiuse/shared';

/**
 * Thin fetch wrapper over the API.
 *
 * Always relative to `/api`: in production the SPA and the API share a single CloudFront
 * distribution (ADR-0016), so there is no cross-origin concern and no per-environment base
 * URL. In development Vite proxies the same path to the local API.
 *
 * The access token is held in memory only — never localStorage — so an XSS cannot exfiltrate
 * a long-lived credential (ADR-0014). The refresh token travels in an httpOnly cookie, which
 * is why every request sends credentials.
 */

const API_BASE = '/api';

let accessToken: string | null = null;
let onSessionEnded: (() => void) | null = null;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

/** Called once a refresh fails, so the app can send the user back to sign in. */
export const setSessionEndedHandler = (handler: (() => void) | null): void => {
  onSessionEnded = handler;
};

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Query string from an object, skipping empty values. */
export function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return fetch(`${API_BASE}${path}`, { ...init, headers, credentials: 'include' });
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiRequestError(
      response.status,
      (payload as { code?: string } | null)?.code ?? 'UNKNOWN',
      (payload as { message?: string } | null)?.message ?? response.statusText,
      (payload as { details?: unknown } | null)?.details,
    );
  }

  return payload as T;
}

let refreshing: Promise<AccessTokenResponse> | null = null;

/**
 * Swaps the refresh cookie for a new access token. Concurrent callers share one request,
 * because the API rotates the cookie and treats a second use of the old one as theft.
 */
export function refreshSession(): Promise<AccessTokenResponse> {
  refreshing ??= send('/auth/refresh', { method: 'POST' })
    .then((response) => parse<AccessTokenResponse>(response))
    .then((session) => {
      setAccessToken(session.accessToken);
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/**
 * A request to the API. When the access token has expired, it refreshes once and retries;
 * if that fails too, the session is over.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await send(path, init);

  if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
    try {
      await refreshSession();
    } catch {
      setAccessToken(null);
      onSessionEnded?.();
      return parse<T>(response);
    }
    return parse<T>(await send(path, init));
  }

  return parse<T>(response);
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);

export const apiSend = <T>(method: 'POST' | 'PATCH' | 'DELETE', path: string, body?: unknown) =>
  apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });
