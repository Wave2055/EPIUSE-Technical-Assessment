import type { AccessTokenResponse, LoginInput } from '@epiuse/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiSend, refreshSession, setAccessToken, setSessionEndedHandler } from '@/lib/api-client';
import { queryClient } from '@/lib/query-client';
import { SessionContext, type SessionState } from './session-context';

/**
 * Who is signed in (ADR-0014). On load the refresh cookie is swapped for an access token, so
 * a reload keeps the user signed in without the token ever touching storage.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });

  const signedOut = useCallback((reason: 'signedOut' | 'ended') => {
    setAccessToken(null);
    queryClient.clear();
    setState({ status: 'signedOut', user: null, reason });
  }, []);

  useEffect(() => {
    setSessionEndedHandler(() => signedOut('ended'));
    let cancelled = false;
    refreshSession()
      .then((session) => !cancelled && setState({ status: 'signedIn', user: session.user }))
      .catch(() => !cancelled && setState({ status: 'signedOut', user: null, reason: 'ended' }));
    return () => {
      cancelled = true;
      setSessionEndedHandler(null);
    };
  }, [signedOut]);

  const login = useCallback(async (input: LoginInput) => {
    const session = await apiSend<AccessTokenResponse>('POST', '/auth/login', input);
    setAccessToken(session.accessToken);
    setState({ status: 'signedIn', user: session.user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiSend('POST', '/auth/logout');
    } finally {
      signedOut('signedOut');
    }
  }, [signedOut]);

  const value = useMemo(() => ({ state, login, logout }), [state, login, logout]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
