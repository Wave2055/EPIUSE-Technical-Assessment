import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenResponse, AuthUser, LoginInput } from '@epiuse/shared';
import { ApiError } from '../common/errors/api-error.js';
import { AppConfig } from '../config/app-config.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { RefreshTokenStore } from './refresh-token.repository.js';

export interface IssuedSession extends AccessTokenResponse {
  /** Goes into the httpOnly cookie; never into a response body. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const invalidCredentials = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'That email and password do not match an account.');
const sessionExpired = () =>
  new ApiError(401, 'UNAUTHENTICATED', 'Your session has ended. Sign in again.');

/**
 * Self-hosted auth (ADR-0014): a 15-minute access JWT held in memory by the client, and a
 * refresh token in an httpOnly cookie that is rotated on every use. Presenting a refresh
 * token that was already rotated means it leaked, so the whole family is revoked.
 */
@Injectable()
export class AuthService {
  /** Compared against when the email is unknown, so timing does not reveal which emails exist. */
  private readonly dummyHash = hashPassword(randomUUID());

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: AppConfig,
    private readonly tokens: RefreshTokenStore,
  ) {}

  async login({ email, password }: LoginInput): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = await verifyPassword(user?.passwordHash ?? (await this.dummyHash), password);
    if (!user || !valid) throw invalidCredentials();
    return this.issue(user, randomUUID());
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) throw sessionExpired();
    const stored = await this.tokens.findByHash(hashToken(refreshToken));
    if (!stored) throw sessionExpired();

    if (stored.revokedAt !== null) {
      await this.tokens.revokeFamily(stored.familyId);
      throw sessionExpired();
    }
    if (stored.expiresAt <= new Date()) throw sessionExpired();

    // Atomic claim: if two requests race with the same token, only one wins.
    if (!(await this.tokens.revoke(stored.id))) {
      await this.tokens.revokeFamily(stored.familyId);
      throw sessionExpired();
    }

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user) throw sessionExpired();
    return this.issue(user, stored.familyId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const stored = await this.tokens.findByHash(hashToken(refreshToken));
    if (stored) await this.tokens.revokeFamily(stored.familyId);
  }

  private async issue(
    user: { id: string; email: string; role: AuthUser['role']; employeeId: string | null },
    familyId: string,
  ): Promise<IssuedSession> {
    const { JWT_ACCESS_SECRET, JWT_ACCESS_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } = this.config.env;
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: JWT_ACCESS_SECRET, expiresIn: JWT_ACCESS_TTL_SECONDS, algorithm: 'HS256' },
    );

    const refreshToken = randomBytes(32).toString('base64url');
    const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.tokens.create({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: refreshExpiresAt,
    });

    return {
      accessToken,
      expiresIn: JWT_ACCESS_TTL_SECONDS,
      user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
      refreshToken,
      refreshExpiresAt,
    };
  }
}
