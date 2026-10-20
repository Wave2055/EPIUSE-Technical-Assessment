import { SetMetadata } from '@nestjs/common';

export const ALLOW_DURING_PASSWORD_CHANGE = 'allowDuringPasswordChange';

/**
 * Marks a route a user with a one-time password may still call: changing it, signing out,
 * and reading who they are. Everything else answers PASSWORD_CHANGE_REQUIRED (ADR-0036).
 */
export const AllowDuringPasswordChange = () => SetMetadata(ALLOW_DURING_PASSWORD_CHANGE, true);
