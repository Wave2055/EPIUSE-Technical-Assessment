import { SetMetadata } from '@nestjs/common';
import type { Role } from '@epiuse/shared';

export const ROLES = 'roles';

/** Restricts a route to the listed roles (ADR-0014). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
