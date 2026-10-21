import { ApiError } from '../common/errors/api-error.js';
import type { Tx } from '../prisma/prisma.service.js';

/**
 * The two rules that keep someone able to administer the system (ADR-0036): an admin cannot
 * change or remove their own access, and the last active admin cannot be demoted,
 * deactivated or deleted. Shared by the users and employees services.
 *
 * With the first rule, the caller is always a second active admin, so the second only bites
 * in a race: two admins removing each other at once would each see the other and both
 * succeed. Locking the active admins' rows makes the second transaction wait for the first
 * and then count again.
 */
export function assertNotSelf(callerId: string, targetUserId: string, what: string) {
  if (callerId === targetUserId) {
    throw new ApiError(409, 'CANNOT_CHANGE_SELF', `You can't ${what} your own account.`);
  }
}

export async function assertNotLastActiveAdmin(tx: Tx, targetUserId: string) {
  const target = await tx.user.findUnique({
    where: { id: targetUserId },
    select: { role: true, deactivatedAt: true },
  });
  if (!target || target.role !== 'ADMIN' || target.deactivatedAt !== null) return;

  const activeAdmins = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "users"
    WHERE "role" = 'ADMIN' AND "deactivated_at" IS NULL
    FOR UPDATE`;
  if (activeAdmins.length <= 1) {
    throw new ApiError(
      409,
      'LAST_ADMIN',
      'This is the only active admin. Make someone else an admin first.',
    );
  }
}
