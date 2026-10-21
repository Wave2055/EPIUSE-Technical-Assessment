import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuditEntrySchema,
  AuditQuerySchema,
  paginated,
  UserAuditEntrySchema,
  UserAuditQuerySchema,
  type AuditEntry,
  type AuditQuery,
  type Paginated,
  type UserAuditEntry,
  type UserAuditQuery,
} from '@epiuse/shared';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { AuditService } from './audit.service.js';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@Roles('ADMIN')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** Every change to an employee record, newest first. */
  @Get()
  @ApiOkResponse({ schema: openApi(paginated(AuditEntrySchema)) })
  list(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery,
  ): Promise<Paginated<AuditEntry>> {
    return this.audit.list(query);
  }

  /** Every change to a login: created, role, deactivation, passwords (ADR-0036). */
  @Get('accounts')
  @ApiOkResponse({ schema: openApi(paginated(UserAuditEntrySchema)) })
  listAccounts(
    @Query(new ZodValidationPipe(UserAuditQuerySchema)) query: UserAuditQuery,
  ): Promise<Paginated<UserAuditEntry>> {
    return this.audit.listAccounts(query);
  }
}
