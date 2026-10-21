import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  TemporaryPasswordSchema,
  UpdateUserSchema,
  UserListResponseSchema,
  UserSummarySchema,
  type TemporaryPassword,
  type UpdateUserInput,
  type UserListResponse,
  type UserSummary,
} from '@epiuse/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../common/request-user.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { UsersService } from './users.service.js';

const IdPipe = new ZodValidationPipe(z.uuid('That is not a valid user id.'));

/**
 * Logins, for admins only (ADR-0036). There is no create route: a login is created with its
 * employee, through `POST /employees`.
 */
@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@Roles('ADMIN')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOkResponse({ schema: openApi(UserListResponseSchema) })
  list(): Promise<UserListResponse> {
    return this.users.list();
  }

  /** Promote or demote (`role`), deactivate or reactivate (`active`). */
  @Patch(':id')
  @ApiBody({ schema: openApi(UpdateUserSchema, 'input') })
  @ApiOkResponse({ schema: openApi(UserSummarySchema) })
  update(
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUserInput,
    @CurrentUser() caller: RequestUser,
  ): Promise<UserSummary> {
    return this.users.update(id, body, caller);
  }

  /** Issues a new one-time password, shown once; the user must replace it at sign-in. */
  @Post(':id/reset-password')
  @HttpCode(200)
  @ApiOkResponse({ schema: openApi(TemporaryPasswordSchema) })
  resetPassword(
    @Param('id', IdPipe) id: string,
    @CurrentUser() caller: RequestUser,
  ): Promise<TemporaryPassword> {
    return this.users.resetPassword(id, caller);
  }
}
