import { Injectable } from '@nestjs/common';
import type { Me } from '@epiuse/shared';
import { ApiError } from '../common/errors/api-error.js';
import type { RequestUser } from '../common/request-user.js';
import { EmployeeMapper, employeeInclude } from '../employees/employee.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The signed-in person: their login, linked employee, manager and direct reports. */
@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: EmployeeMapper,
  ) {}

  async get(requestUser: RequestUser): Promise<Me> {
    const user = await this.prisma.user.findUnique({
      where: { id: requestUser.id },
      include: { employee: { include: employeeInclude } },
    });
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Your account no longer exists.');

    const authUser = {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      mustChangePassword: user.mustChangePassword,
    };

    const reports = await this.prisma.employee.findMany({
      where: { managerId: user.employee.id },
      include: employeeInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    return {
      user: authUser,
      employee: this.mapper.toDto(user.employee),
      manager: user.employee.manager ? this.mapper.toRef(user.employee.manager) : null,
      directReports: reports.map((r) => this.mapper.toDto(r)),
    };
  }
}
