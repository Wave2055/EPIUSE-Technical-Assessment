import { Injectable } from '@nestjs/common';
import type { AvatarUploadRequest, AvatarUploadResponse, Employee } from '@epiuse/shared';
import { AvatarService } from '../avatars/avatar.service.js';
import { notFound } from '../common/errors/api-error.js';
import type { RequestUser } from '../common/request-user.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmployeeMapper, employeeInclude } from './employee.mapper.js';

/** Ties S3 avatar objects to employee records; changes are audited like any other edit. */
@Injectable()
export class EmployeeAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarService,
    private readonly mapper: EmployeeMapper,
  ) {}

  async createUpload(id: string, request: AvatarUploadRequest): Promise<AvatarUploadResponse> {
    await this.assertExists(id);
    return this.avatars.createUpload(id, request);
  }

  async confirm(id: string, key: string, user: RequestUser): Promise<Employee> {
    const previous = await this.assertExists(id);
    await this.avatars.assertUploaded(id, key);
    const row = await this.prisma.auditedTransaction(user.id, (tx) =>
      tx.employee.update({ where: { id }, data: { avatarKey: key }, include: employeeInclude }),
    );
    if (previous.avatarKey && previous.avatarKey !== key) {
      await this.avatars.deleteObject(previous.avatarKey);
    }
    return this.mapper.toDto(row);
  }

  async remove(id: string, user: RequestUser): Promise<Employee> {
    const previous = await this.assertExists(id);
    const row = await this.prisma.auditedTransaction(user.id, (tx) =>
      tx.employee.update({ where: { id }, data: { avatarKey: null }, include: employeeInclude }),
    );
    if (previous.avatarKey) await this.avatars.deleteObject(previous.avatarKey);
    return this.mapper.toDto(row);
  }

  private async assertExists(id: string) {
    const row = await this.prisma.employee.findUnique({
      where: { id },
      select: { avatarKey: true },
    });
    if (!row) throw notFound('That employee');
    return row;
  }
}
