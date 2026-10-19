import type { AccessTokenResponse, AuthUser, LoginInput } from '@epiuse/shared';
import { useSyncExternalStore } from 'react';
import { apiFetch, onSessionExpired, refreshSession, setAccessToken } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';

/**
 * Who is signed in (ADR-0014). The access token itself stays inside the API client; this
 * holds only what the UI needs to know: whether there is a session, and whose it is.
 */
export type Session =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: AuthUser };

let session: Session = { status: 'loading' };
const listeners = new Set<() => void>();

function setSession(next: Session) {
  session = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const useSession = (): Session => useSyncExternalStore(subscribe, () => session);

/** The signed-in user. Only for components rendered behind `RequireAuth`. */
export function useCurrentUser(): AuthUser {
  const current = useSession();
  if (current.status !== 'signedIn') throw new Error('useCurrentUser needs a signed-in user.');
  return current.user;
}

/** Salary, editing and the audit trail are ADMIN-only; the API enforces it, the UI follows. */
export const useIsAdmin = (): boolean => {
  const current = useSession();
  return current.status === 'signedIn' && current.user.role === 'ADMIN';
};

let restoring: Promise<void> | null = null;

/**
 * The access token is lost on every page load, so try the refresh cookie once to pick up an
 * existing session. Memoised, so it runs once however many times it is called.
 */
export function restoreSession(): Promise<void> {
  restoring ??= refreshSession().then(
    (renewed) => setSession(renewed ? { status: 'signedIn', user: renewed.user } : signedOut()),
    () => setSession(signedOut()),
  );
  return restoring;
}

export async function signIn(credentials: LoginInput): Promise<AuthUser> {
  const issued = await apiFetch<AccessTokenResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setAccessToken(issued.accessToken);
  setSession({ status: 'signedIn', user: issued.user });
  return issued.user;
}

export async function signOut(): Promise<void> {
  try {
    await apiFetch<void>('/auth/logout', { method: 'POST' });
  } finally {
    setSession(signedOut());
  }
}

/** Forget the token and every cached response, so the next user starts clean. */
function signedOut(): Session {
  setAccessToken(null);
  queryClient.clear();
  return { status: 'signedOut' };
}

onSessionExpired(() => setSession(signedOut()));
