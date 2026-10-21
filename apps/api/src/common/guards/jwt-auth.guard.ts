import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AppConfig } from '../../config/app-config.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ALLOW_DURING_PASSWORD_CHANGE } from '../decorators/allow-during-password-change.decorator.js';
import { IS_PUBLIC } from '../decorators/public.decorator.js';
import { ApiError } from '../errors/api-error.js';

interface AccessTokenPayload {
  sub: string;
}

/**
 * Global guard: every route needs a valid access token unless marked `@Public()`. The token
 * travels as a Bearer header, never a cookie, so it cannot be ridden by CSRF (ADR-0014).
 *
 * The token proves who the caller is; the database says what they may do now (ADR-0036).
 * Reading the login on every request means a deactivation or a role change takes effect on
 * the next request rather than when the token expires, and a one-time password confines
 * the user to changing it.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly prisma: PrismaService,
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

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.env.JWT_ACCESS_SECRET,
        algorithms: ['HS256'],
      });
    } catch {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, mustChangePassword: true, deactivatedAt: true },
    });
    if (!user || user.deactivatedAt !== null) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Sign in again.');
    }

    if (user.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_DURING_PASSWORD_CHANGE, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ApiError(
          403,
          'PASSWORD_CHANGE_REQUIRED',
          'Choose a new password before you continue.',
        );
      }
    }

    request.user = { id: user.id, email: user.email, role: user.role };
    return true;
  }
}
