import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/components/loading';
import { useSession } from './session';

/**
 * The whole application sits behind a login (ADR-0014). While the session is being restored
 * from the refresh cookie nothing is shown, so a signed-in user never flashes the login page.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
