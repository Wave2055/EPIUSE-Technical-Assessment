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

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
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

let refreshing: Promise<AccessTokenResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;

/** Called when the session cannot be renewed, so the app can send the user to sign in. */
export const onSessionExpired = (handler: (() => void) | null): void => {
  sessionExpiredHandler = handler;
};

let passwordChangeRequiredHandler: (() => void) | null = null;

/**
 * Called when the API refuses a request until the user replaces a one-time password
 * (ADR-0036), e.g. after an admin reset it mid-session, so the app can send them to do so.
 */
export const onPasswordChangeRequired = (handler: (() => void) | null): void => {
  passwordChangeRequiredHandler = handler;
};

/**
 * Exchanges the refresh cookie for a new access token, or resolves `null` if there is no
 * valid session. Concurrent callers share one request: the API rotates the cookie on every
 * refresh and treats reuse of a rotated one as theft, revoking the whole session (ADR-0014),
 * so two parallel refreshes would sign the user out.
 */
export function refreshSession(): Promise<AccessTokenResponse | null> {
  refreshing ??= (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!response.ok) {
        accessToken = null;
        return null;
      }
      const session = (await response.json()) as AccessTokenResponse;
      accessToken = session.accessToken;
      return session;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

function send(path: string, init: RequestInit): Promise<Response> {
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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);

  // Access tokens are short-lived, so a 401 usually means this one expired: renew it once and
  // retry. The sign-in routes are left alone, so a failed login is reported as it is; a
  // password change is an ordinary signed-in request and renews like any other.
  const renews = !path.startsWith('/auth/') || path === '/auth/password';
  if (response.status === 401 && renews) {
    const session = await refreshSession();
    if (session) {
      response = await send(path, init);
    } else {
      sessionExpiredHandler?.();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    if ((payload as { code?: string } | null)?.code === 'PASSWORD_CHANGE_REQUIRED') {
      passwordChangeRequiredHandler?.();
    }
    throw new ApiRequestError(
      response.status,
      (payload as { code?: string } | null)?.code ?? 'UNKNOWN',
      (payload as { message?: string } | null)?.message ?? response.statusText,
      (payload as { details?: unknown } | null)?.details,
    );
  }

  return payload as T;
}
