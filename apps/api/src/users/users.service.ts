import { Injectable } from '@nestjs/common';
import type {
  TemporaryPassword,
  UpdateUserInput,
  UserListResponse,
  UserStatus,
  UserSummary,
} from '@epiuse/shared';
import { generateTemporaryPassword, hashPassword } from '../auth/password.js';
import { RefreshTokenStore } from '../auth/refresh-token.repository.js';
import { AvatarService } from '../avatars/avatar.service.js';
import { notFound } from '../common/errors/api-error.js';
import type { RequestUser } from '../common/request-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertNotLastActiveAdmin, assertNotSelf } from './account-rules.js';

const userSelect = {
  id: true,
  email: true,
  role: true,
  passwordHash: true,
  mustChangePassword: true,
  deactivatedAt: true,
  lastLoginAt: true,
  employee: {
    select: {
      id: true,
      employeeNumber: true,
      firstName: true,
      lastName: true,
      position: true,
      email: true,
      avatarKey: true,
    },
  },
} as const;

type UserRow = {
  id: string;
  email: string;
  role: UserSummary['role'];
  passwordHash: string | null;
  mustChangePassword: boolean;
  deactivatedAt: Date | null;
  lastLoginAt: Date | null;
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    position: string;
    email: string;
    avatarKey: string | null;
  };
};

function statusOf(row: UserRow): UserStatus {
  if (row.deactivatedAt !== null) return 'deactivated';
  if (row.passwordHash === null) return 'no_password';
  if (row.mustChangePassword) return 'must_change_password';
  return 'active';
}

/**
 * Admin management of logins (ADR-0036). Every write goes through the audited transaction,
 * so the trigger on users records who did it. Taking access away (demotion, deactivation,
 * a reset) also ends the person's sessions; the guard reads the login on every request, so
 * nothing they hold keeps working.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: RefreshTokenStore,
    private readonly avatars: AvatarService,
  ) {}

  async list(): Promise<UserListResponse> {
    const rows = await this.prisma.user.findMany({
      select: userSelect,
      orderBy: [{ employee: { lastName: 'asc' } }, { employee: { firstName: 'asc' } }],
    });
    return { users: rows.map((r) => this.toSummary(r)) };
  }

  async update(id: string, input: UpdateUserInput, caller: RequestUser): Promise<UserSummary> {
    assertNotSelf(caller.id, id, 'change');
    const takesAccessAway = input.role === 'VIEWER' || input.active === false;

    const row = await this.prisma.auditedTransaction(caller.id, async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw notFound('That user');
      if (takesAccessAway) await assertNotLastActiveAdmin(tx, id);
      return tx.user.update({
        where: { id },
        data: {
          ...(input.role !== undefined && { role: input.role }),
          ...(input.active !== undefined && { deactivatedAt: input.active ? null : new Date() }),
        },
        select: userSelect,
      });
    });

    if (takesAccessAway) await this.tokens.revokeAllForUser(id);
    return this.toSummary(row);
  }

  /** A new one-time password, returned once. The old password and every session stop working. */
  async resetPassword(id: string, caller: RequestUser): Promise<TemporaryPassword> {
    assertNotSelf(caller.id, id, 'reset the password of');
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);

    const row = await this.prisma.auditedTransaction(caller.id, async (tx) => {
      const current = await tx.user.findUnique({ where: { id }, select: { id: true } });
      if (!current) throw notFound('That user');
      return tx.user.update({
        where: { id },
        data: { passwordHash, mustChangePassword: true },
        select: { email: true },
      });
    });

    await this.tokens.revokeAllForUser(id);
    return { email: row.email, temporaryPassword };
  }

  private toSummary(row: UserRow): UserSummary {
    const { email, avatarKey, ...employee } = row.employee;
    return {
      id: row.id,
      email: row.email,
      role: row.role,
      status: statusOf(row),
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
      employee: { ...employee, avatarUrl: this.avatars.resolveUrl({ email, avatarKey }) },
    };
  }
}
