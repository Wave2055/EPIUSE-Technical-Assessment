import type { AuthUser } from '@epiuse/shared';
import { useContext } from 'react';
import { type Session, SessionContext } from './session-context';

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>.');
  return session;
}

/** The signed-in user. Only valid below the route guard, where a session is guaranteed. */
export function useCurrentUser(): AuthUser {
  const { state } = useSession();
  if (state.status !== 'signedIn') throw new Error('useCurrentUser used without a session.');
  return state.user;
}

export const useIsAdmin = () => useCurrentUser().role === 'ADMIN';
