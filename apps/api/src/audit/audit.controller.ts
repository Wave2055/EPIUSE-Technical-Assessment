import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AuditEntrySchema,
  AuditQuerySchema,
  paginated,
  type AuditEntry,
  type AuditQuery,
  type Paginated,
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
}
