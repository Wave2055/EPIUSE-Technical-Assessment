import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface StoredRefreshToken {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Storage for refresh tokens, by hash. An interface so rotation logic can be unit-tested. */
export abstract class RefreshTokenStore {
  abstract create(
    token: Omit<StoredRefreshToken, 'id' | 'revokedAt'> & { tokenHash: string },
  ): Promise<void>;
  abstract findByHash(tokenHash: string): Promise<StoredRefreshToken | null>;
  /** Revokes one token if still live. False means someone else already used it. */
  abstract revoke(id: string): Promise<boolean>;
  abstract revokeFamily(familyId: string): Promise<void>;
}

@Injectable()
export class PrismaRefreshTokenStore extends RefreshTokenStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(token: Omit<StoredRefreshToken, 'id' | 'revokedAt'> & { tokenHash: string }) {
    await this.prisma.refreshToken.create({ data: token });
  }

  findByHash(tokenHash: string) {
    return this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
    });
  }

  async revoke(id: string) {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return count === 1;
  }

  async revokeFamily(familyId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
