import { Injectable } from '@nestjs/common';
import type {
  CreateEmployeeInput,
  DeleteEmployeeQuery,
  DeleteStrategyName,
  Employee,
  EmployeeListQuery,
  Paginated,
  UpdateEmployeeInput,
} from '@epiuse/shared';
import { notFound } from '../common/errors/api-error.js';
import type { RequestUser } from '../common/request-user.js';
import { HierarchyService } from '../hierarchy/hierarchy.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { DeleteStrategy } from './delete-strategies/delete-strategy.js';
import { PromoteStrategy } from './delete-strategies/promote.strategy.js';
import { ReassignStrategy } from './delete-strategies/reassign.strategy.js';
import { EmployeeMapper, employeeInclude, fromIsoDate } from './employee.mapper.js';
import { buildEmployeeListArgs } from './list-query.js';

@Injectable()
export class EmployeesService {
  private readonly strategies: Record<DeleteStrategyName, DeleteStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hierarchy: HierarchyService,
    private readonly mapper: EmployeeMapper,
    promote: PromoteStrategy,
    reassign: ReassignStrategy,
  ) {
    this.strategies = { promote, reassign };
  }

  async list(query: EmployeeListQuery, user: RequestUser): Promise<Paginated<Employee>> {
    const { where, orderBy, skip, take } = buildEmployeeListArgs(query, user.role);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({ where, orderBy, skip, take, include: employeeInclude }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      items: rows.map((r) => this.mapper.toDto(r)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string): Promise<Employee> {
    const row = await this.prisma.employee.findUnique({ where: { id }, include: employeeInclude });
    if (!row) throw notFound('That employee');
    return this.mapper.toDto(row);
  }

  async create(input: CreateEmployeeInput, user: RequestUser): Promise<Employee> {
    const row = await this.prisma.auditedTransaction(user.id, async (tx) => {
      await this.hierarchy.assertValidManager(tx, null, input.managerId);
      return tx.employee.create({
        data: { ...input, birthDate: fromIsoDate(input.birthDate) },
        include: employeeInclude,
      });
    });
    return this.mapper.toDto(row);
  }

  async update(id: string, input: UpdateEmployeeInput, user: RequestUser): Promise<Employee> {
    const row = await this.prisma.auditedTransaction(user.id, async (tx) => {
      const current = await tx.employee.findUnique({ where: { id }, select: { managerId: true } });
      if (!current) throw notFound('That employee');
      if (input.managerId !== undefined && input.managerId !== current.managerId) {
        await this.hierarchy.assertValidManager(tx, id, input.managerId);
      }
      return tx.employee.update({
        where: { id },
        data: {
          ...input,
          ...(input.birthDate !== undefined && { birthDate: fromIsoDate(input.birthDate) }),
        },
        include: employeeInclude,
      });
    });
    return this.mapper.toDto(row);
  }

  /**
   * Moves the direct reports by the chosen strategy, then deletes, in one transaction so a
   * partial re-parent is impossible. Each move writes its own REPARENT audit row (ADR-0010).
   */
  async remove(id: string, query: DeleteEmployeeQuery, user: RequestUser): Promise<void> {
    await this.prisma.auditedTransaction(user.id, async (tx) => {
      const target = await tx.employee.findUnique({
        where: { id },
        select: { id: true, firstName: true, lastName: true, managerId: true },
      });
      if (!target) throw notFound('That employee');

      const reportCount = await tx.employee.count({ where: { managerId: id } });
      if (reportCount > 0) {
        const newManagerId = await this.strategies[query.strategy].newManagerFor({
          tx,
          target,
          reassignTo: query.reassignTo,
        });
        await tx.employee.updateMany({
          where: { managerId: id },
          data: { managerId: newManagerId },
        });
      }
      await tx.employee.delete({ where: { id } });
    });
  }
}
