import type { AuthUser, LoginInput } from '@epiuse/shared';
import { createContext } from 'react';

export type SessionState =
  | { status: 'loading'; user: null }
  /** `ended`: a session expired, so the user should return to where they were. */
  | { status: 'signedOut'; user: null; reason: 'signedOut' | 'ended' }
  | { status: 'signedIn'; user: AuthUser };

export interface Session {
  state: SessionState;
  login(input: LoginInput): Promise<void>;
  logout(): Promise<void>;
}

export const SessionContext = createContext<Session | null>(null);
