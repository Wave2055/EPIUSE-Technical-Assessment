import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/components/loading';
import { useSession } from './use-session';

/** The whole application sits behind a login (ADR-0014). */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { state } = useSession();
  const location = useLocation();

  if (state.status === 'loading') return <Loading />;
  if (state.status === 'signedOut') {
    // After a deliberate sign-out the next person starts fresh, not on the last user's page.
    const from = state.reason === 'ended' ? location.pathname : undefined;
    return <Navigate to="/login" replace state={{ from }} />;
  }
  return children;
}
