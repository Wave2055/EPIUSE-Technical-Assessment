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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

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
