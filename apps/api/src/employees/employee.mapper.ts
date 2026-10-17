import { Injectable } from '@nestjs/common';
import type { Employee, EmployeeRef } from '@epiuse/shared';
import { AvatarService } from '../avatars/avatar.service.js';
import type { Prisma } from '../generated/prisma/client.js';

export const employeeInclude = {
  manager: true,
  _count: { select: { directReports: true } },
} satisfies Prisma.EmployeeInclude;

export type EmployeeRow = Prisma.EmployeeGetPayload<{ include: typeof employeeInclude }>;
type EmployeeRecord = Prisma.EmployeeGetPayload<object>;

/** `DATE` columns come back as UTC midnight; this keeps the calendar day. */
export const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);
export const fromIsoDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Database rows → the shared response shapes (Data Mapper, ADR-0006). */
@Injectable()
export class EmployeeMapper {
  constructor(private readonly avatars: AvatarService) {}

  toDto(row: EmployeeRow): Employee {
    return {
      id: row.id,
      employeeNumber: row.employeeNumber,
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email,
      birthDate: toIsoDate(row.birthDate),
      salary: row.salary.toNumber(),
      position: row.position,
      managerId: row.managerId,
      manager: row.manager ? this.toRef(row.manager) : null,
      directReportCount: row._count.directReports,
      avatarUrl: this.avatars.resolveUrl(row),
      hasUploadedAvatar: row.avatarKey !== null,
    };
  }

  toRef(row: EmployeeRecord): EmployeeRef {
    return {
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      position: row.position,
      avatarUrl: this.avatars.resolveUrl(row),
    };
  }
}
