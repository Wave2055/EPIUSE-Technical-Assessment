import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { RoleSchema } from '@epiuse/shared';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { ApiError } from '../errors/api-error.js';

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string;
}

/**
 * Global guard: every route needs a valid access token unless marked `@Public()`. The token
 * travels as a Bearer header, never a cookie, so it cannot be ridden by CSRF (ADR-0014).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
    }

    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
      request.user = {
        id: payload.sub,
        email: payload.email,
        role: RoleSchema.parse(payload.role),
      };
      return true;
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    }
  }
}
