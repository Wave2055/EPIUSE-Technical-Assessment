import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@epiuse/shared';
import type { Request } from 'express';
import { ROLES } from '../decorators/roles.decorator.js';
import { forbidden } from '../errors/api-error.js';

/** Runs after JwtAuthGuard; enforces `@Roles()` where present. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;

    const user = context.switchToHttp().getRequest<Request>().user;
    if (user && roles.includes(user.role)) return true;
    throw forbidden('Only an administrator can do that.');
  }
}
