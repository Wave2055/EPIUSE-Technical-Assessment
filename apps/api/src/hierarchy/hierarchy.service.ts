import { Injectable } from '@nestjs/common';
import type { HierarchyResponse } from '@epiuse/shared';
import { ApiError, HierarchyCycleError } from '../common/errors/api-error.js';
import { AvatarService } from '../avatars/avatar.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { type ChainLink, findCyclePath } from './cycle-path.js';

/** Safety cap so even corrupt data cannot make a traversal run away. */
const MAX_DEPTH = 10_000;

/**
 * Reporting-line traversal with recursive CTEs (ADR-0006, ADR-0007). `assertValidManager`
 * is the service half of the cycle defence: the database trigger guarantees the rule, this
 * explains it to the user with the offending chain (ADR-0008).
 */
@Injectable()
export class HierarchyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
  ) {}

  async getChart(): Promise<HierarchyResponse> {
    const rows = await this.prisma.employee.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      select: {
        id: true,
        managerId: true,
        employeeNumber: true,
        firstName: true,
        lastName: true,
        position: true,
        email: true,
        avatarKey: true,
      },
    });
    return {
      nodes: rows.map(({ email: _e, avatarKey: _a, ...node }) => ({
        ...node,
        avatarUrl: this.avatars.resolveUrl({ email: _e, avatarKey: _a }),
      })),
      rootCount: rows.filter((r) => r.managerId === null).length,
    };
  }

  /**
   * Refuses a manager that does not exist, or one that would put `employeeId` below itself.
   * Pass `employeeId: null` for a new employee, who cannot be part of a loop yet.
   */
  async assertValidManager(tx: Tx, employeeId: string | null, managerId: string | null) {
    if (managerId === null) return;

    const chain = await this.ancestorChain(tx, managerId, employeeId);
    if (chain.length === 0) {
      throw new ApiError(422, 'UNKNOWN_MANAGER', 'The chosen manager does not exist.');
    }
    if (employeeId === null) return;

    const employee = await tx.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!employee) return;

    const path = findCyclePath(employee, chain);
    if (path) throw new HierarchyCycleError(path);
  }

  /** Ids of everyone below `employeeId`, at any depth. */
  async descendantIds(tx: Tx, employeeId: string): Promise<Set<string>> {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE below AS (
        SELECT id, 1 AS depth FROM employees WHERE manager_id = ${employeeId}::uuid
        UNION ALL
        SELECT e.id, b.depth + 1 FROM employees e JOIN below b ON e.manager_id = b.id
        WHERE b.depth < ${MAX_DEPTH}
      )
      SELECT DISTINCT id FROM below`;
    return new Set(rows.map((r) => r.id));
  }

  /**
   * `startId` and its managers upward, nearest first, stopping once `stopAtId` is reached so
   * a loop through it is reported once.
   */
  async ancestorChain(tx: Tx, startId: string, stopAtId: string | null): Promise<ChainLink[]> {
    return tx.$queryRaw<ChainLink[]>`
      WITH RECURSIVE chain AS (
        SELECT id, manager_id, first_name, last_name, 1 AS depth
        FROM employees WHERE id = ${startId}::uuid
        UNION ALL
        SELECT e.id, e.manager_id, e.first_name, e.last_name, c.depth + 1
        FROM employees e JOIN chain c ON e.id = c.manager_id
        WHERE c.depth < ${MAX_DEPTH} AND c.id IS DISTINCT FROM ${stopAtId}::uuid
      )
      SELECT id, first_name AS "firstName", last_name AS "lastName"
      FROM chain ORDER BY depth`;
  }
}
