import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  AvatarUploadRequestSchema,
  AvatarUploadResponseSchema,
  ConfirmAvatarSchema,
  CreateEmployeeSchema,
  DeleteEmployeeQuerySchema,
  EmployeeListQuerySchema,
  EmployeeSchema,
  paginated,
  UpdateEmployeeSchema,
  type AvatarUploadRequest,
  type AvatarUploadResponse,
  type ConfirmAvatarInput,
  type CreateEmployeeInput,
  type DeleteEmployeeQuery,
  type Employee,
  type EmployeeListQuery,
  type Paginated,
  type UpdateEmployeeInput,
} from '@epiuse/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../common/request-user.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { EmployeeAvatarService } from './employee-avatar.service.js';
import { EmployeesService } from './employees.service.js';

const IdPipe = new ZodValidationPipe(z.uuid('That is not a valid employee id.'));

@ApiTags('Employees')
@ApiBearerAuth()
@Controller('employees')
export class EmployeesController {
  constructor(
    private readonly employees: EmployeesService,
    private readonly avatars: EmployeeAvatarService,
  ) {}

  /** The reporting table: search, sort and filter on any field. */
  @Get()
  @ApiOkResponse({ schema: openApi(paginated(EmployeeSchema)) })
  list(
    @Query(new ZodValidationPipe(EmployeeListQuerySchema)) query: EmployeeListQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<Paginated<Employee>> {
    return this.employees.list(query, user);
  }

  @Get(':id')
  @ApiOkResponse({ schema: openApi(EmployeeSchema) })
  get(@Param('id', IdPipe) id: string): Promise<Employee> {
    return this.employees.get(id);
  }

  @Post()
  @Roles('ADMIN')
  @ApiBody({ schema: openApi(CreateEmployeeSchema, 'input') })
  @ApiOkResponse({ schema: openApi(EmployeeSchema) })
  create(
    @Body(new ZodValidationPipe(CreateEmployeeSchema)) body: CreateEmployeeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<Employee> {
    return this.employees.create(body, user);
  }

  /** Includes re-parenting: a `managerId` change is checked for loops (ADR-0008). */
  @Patch(':id')
  @Roles('ADMIN')
  @ApiBody({ schema: openApi(UpdateEmployeeSchema, 'input') })
  @ApiOkResponse({ schema: openApi(EmployeeSchema) })
  update(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(UpdateEmployeeSchema)) body: UpdateEmployeeInput,
    @CurrentUser() user: RequestUser,
  ): Promise<Employee> {
    return this.employees.update(id, body, user);
  }

  /** `?strategy=promote` (default) or `?strategy=reassign&reassignTo=<id>` (ADR-0010). */
  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(204)
  remove(
    @Param('id', IdPipe) id: string,
    @Query(new ZodValidationPipe(DeleteEmployeeQuerySchema)) query: DeleteEmployeeQuery,
    @CurrentUser() user: RequestUser,
  ): Promise<void> {
    return this.employees.remove(id, query, user);
  }

  /** Step 1 of an upload: a presigned POST the browser sends the file to (ADR-0013). */
  @Post(':id/avatar/upload-url')
  @Roles('ADMIN')
  @ApiBody({ schema: openApi(AvatarUploadRequestSchema, 'input') })
  @ApiOkResponse({ schema: openApi(AvatarUploadResponseSchema) })
  createAvatarUpload(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(AvatarUploadRequestSchema)) body: AvatarUploadRequest,
  ): Promise<AvatarUploadResponse> {
    return this.avatars.createUpload(id, body);
  }

  /** Step 2: after S3 accepts the file, point the employee at it. */
  @Patch(':id/avatar')
  @Roles('ADMIN')
  @ApiBody({ schema: openApi(ConfirmAvatarSchema, 'input') })
  @ApiOkResponse({ schema: openApi(EmployeeSchema) })
  confirmAvatar(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(ConfirmAvatarSchema)) body: ConfirmAvatarInput,
    @CurrentUser() user: RequestUser,
  ): Promise<Employee> {
    return this.avatars.confirm(id, body.key, user);
  }

  /** Back to Gravatar, or initials if there is none. */
  @Delete(':id/avatar')
  @Roles('ADMIN')
  @ApiOkResponse({ schema: openApi(EmployeeSchema) })
  removeAvatar(
    @Param('id', IdPipe) id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Employee> {
    return this.avatars.remove(id, user);
  }
}
