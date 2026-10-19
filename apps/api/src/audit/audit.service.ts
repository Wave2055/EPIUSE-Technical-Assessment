import { Injectable } from '@nestjs/common';
import {
  AuditActionSchema,
  type AuditEntry,
  type AuditQuery,
  type Paginated,
} from '@epiuse/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  type AuditSnapshot,
  describeChange,
  diffSnapshots,
  snapshotName,
} from './describe-change.js';

/**
 * Reads the trigger-written audit trail (ADR-0011). There is deliberately no write path:
 * rows only ever come from the database trigger.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AuditQuery): Promise<Paginated<AuditEntry>> {
    const where = {
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.action && { action: query.action }),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAudit.findMany({
        where,
        orderBy: [{ changedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAudit.count({ where }),
    ]);

    const snapshots = rows.map((r) => ({
      before: r.before as AuditSnapshot | null,
      after: r.after as AuditSnapshot | null,
    }));
    const managerIds = new Set(
      snapshots.flatMap(({ before, after }) =>
        [before?.manager_id, after?.manager_id].filter(
          (id): id is string => typeof id === 'string',
        ),
      ),
    );
    const userIds = new Set(rows.map((r) => r.changedBy).filter((id): id is string => id !== null));

    const [managers, users] = await Promise.all([
      this.prisma.employee.findMany({
        where: { id: { in: [...managerIds] } },
        select: { id: true, firstName: true, lastName: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, email: true },
      }),
    ]);
    const managerNames = new Map(managers.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
    const userById = new Map(users.map((u) => [u.id, u]));

    return {
      items: rows.map((row, i) => {
        const { before, after } = snapshots[i]!;
        const action = AuditActionSchema.parse(row.action);
        return {
          id: Number(row.id),
          employeeId: row.employeeId,
          employeeName: snapshotName(after) ?? snapshotName(before) ?? 'Unknown employee',
          action,
          changedBy: row.changedBy ? (userById.get(row.changedBy) ?? null) : null,
          changedAt: row.changedAt.toISOString(),
          summary: describeChange(action, before, after, (id) => managerNames.get(id) ?? null),
          changes: diffSnapshots(before, after),
        };
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
