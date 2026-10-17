import type { Role } from '@epiuse/shared';

/** The authenticated caller, as decoded from the access token. */
export interface RequestUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express's own augmentation point.
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}
