import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/components/loading';
import { useSession } from './session';

/** Where someone signed in with a one-time password must go before anything else. */
export const CHANGE_PASSWORD_PATH = '/change-password';

/**
 * The whole application sits behind a login (ADR-0014). While the session is being restored
 * from the refresh cookie nothing is shown, so a signed-in user never flashes the login page.
 * Someone still on a one-time password is held on the change-password page (ADR-0036).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();

  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedOut') {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (session.user.mustChangePassword && location.pathname !== CHANGE_PASSWORD_PATH) {
    return <Navigate to={CHANGE_PASSWORD_PATH} replace state={{ from: location }} />;
  }
  return children;
}
