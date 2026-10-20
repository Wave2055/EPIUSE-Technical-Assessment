import { JwtService } from '@nestjs/jwt';
import { AppConfig } from '../config/app-config.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';
import { hashPassword } from './password.js';
import { RefreshTokenStore, type StoredRefreshToken } from './refresh-token.repository.js';

class MemoryStore extends RefreshTokenStore {
  rows: (StoredRefreshToken & { tokenHash: string })[] = [];
  async create(token: Omit<StoredRefreshToken, 'id' | 'revokedAt'> & { tokenHash: string }) {
    this.rows.push({ ...token, id: String(this.rows.length + 1), revokedAt: null });
  }
  async findByHash(tokenHash: string) {
    return this.rows.find((r) => r.tokenHash === tokenHash) ?? null;
  }
  async revoke(id: string) {
    const row = this.rows.find((r) => r.id === id && r.revokedAt === null);
    if (row) row.revokedAt = new Date();
    return Boolean(row);
  }
  async revokeFamily(familyId: string) {
    for (const r of this.rows) if (r.familyId === familyId) r.revokedAt ??= new Date();
  }
  async revokeAllForUser(userId: string) {
    for (const r of this.rows) if (r.userId === userId) r.revokedAt ??= new Date();
  }
}

const config = AppConfig.fromEnv({
  DATABASE_URL: 'postgres://unused',
  JWT_ACCESS_SECRET: 'x'.repeat(40),
});

describe('AuthService', () => {
  let users: {
    id: string;
    email: string;
    passwordHash: string | null;
    deactivatedAt: Date | null;
  }[];
  let store: MemoryStore;
  let auth: AuthService;
  const jwt = new JwtService({});

  beforeEach(async () => {
    const user = {
      id: '0b1f8a3e-2a4f-4f58-9a0e-6c1d9a2b7c11',
      email: 'admin@example.com',
      role: 'ADMIN' as const,
      employeeId: '5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
      passwordHash: (await hashPassword('correct horse battery')) as string | null,
      mustChangePassword: false,
      deactivatedAt: null as Date | null,
    };
    users = [user];
    const prisma = {
      user: {
        findUnique: ({ where }: { where: { email?: string; id?: string } }) =>
          Promise.resolve(users.find((u) => u.email === where.email || u.id === where.id) ?? null),
        update: () => Promise.resolve(user),
      },
    } as unknown as PrismaService;
    store = new MemoryStore();
    auth = new AuthService(prisma, jwt, config, store);
  });

  it('issues a verifiable access token on a correct password', async () => {
    const session = await auth.login({
      email: 'admin@example.com',
      password: 'correct horse battery',
    });
    const payload = await jwt.verifyAsync<{ role: string }>(session.accessToken, {
      secret: config.env.JWT_ACCESS_SECRET,
    });
    expect(payload.role).toBe('ADMIN');
    expect(store.rows).toHaveLength(1);
    // Only the hash is stored.
    expect(store.rows[0]!.tokenHash).not.toBe(session.refreshToken);
  });

  it('refuses a login that has no password yet, and a deactivated one, with the same answer', async () => {
    const answer = {
      code: 'UNAUTHENTICATED',
      message: 'That email and password do not match an account.',
    };
    users[0]!.passwordHash = null;
    await expect(
      auth.login({ email: 'admin@example.com', password: 'correct horse battery' }),
    ).rejects.toMatchObject(answer);

    users[0]!.passwordHash = await hashPassword('correct horse battery');
    users[0]!.deactivatedAt = new Date();
    await expect(
      auth.login({ email: 'admin@example.com', password: 'correct horse battery' }),
    ).rejects.toMatchObject(answer);
    expect(store.rows).toHaveLength(0);
  });

  it('gives the same answer for an unknown email and a wrong password', async () => {
    await expect(auth.login({ email: 'nobody@example.com', password: 'x' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
    await expect(auth.login({ email: 'admin@example.com', password: 'x' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      status: 401,
    });
  });

  it('rotates the refresh token within the same family', async () => {
    const first = await auth.login({
      email: 'admin@example.com',
      password: 'correct horse battery',
    });
    const second = await auth.refresh(first.refreshToken);
    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(new Set(store.rows.map((r) => r.familyId)).size).toBe(1);
    expect(store.rows[0]!.revokedAt).not.toBeNull();
  });

  it('revokes the whole family when a rotated token is reused', async () => {
    const first = await auth.login({
      email: 'admin@example.com',
      password: 'correct horse battery',
    });
    const second = await auth.refresh(first.refreshToken);

    await expect(auth.refresh(first.refreshToken)).rejects.toMatchObject({ status: 401 });
    // The legitimate newer token is now dead too.
    await expect(auth.refresh(second.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it('ends the family on logout', async () => {
    const session = await auth.login({
      email: 'admin@example.com',
      password: 'correct horse battery',
    });
    await auth.logout(session.refreshToken);
    await expect(auth.refresh(session.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});
