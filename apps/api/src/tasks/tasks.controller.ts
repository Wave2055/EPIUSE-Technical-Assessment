import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  CreateTaskSchema,
  TaskListResponseSchema,
  TaskSchema,
  TaskScopeQuerySchema,
  UpdateTaskSchema,
  type CreateTaskInput,
  type Task,
  type TaskListResponse,
  type UpdateTaskInput,
} from '@epiuse/shared';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import type { RequestUser } from '../common/request-user.js';
import { openApi } from '../common/swagger/zod-schema.js';
import { TasksService } from './tasks.service.js';

const IdPipe = new ZodValidationPipe(z.uuid('That is not a valid task id.'));

@ApiTags('Tasks')
@ApiBearerAuth()
@Controller('me/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  /** `?scope=mine` (default) or `?scope=team` to append each direct report's list. */
  @Get()
  @ApiOkResponse({ schema: openApi(TaskListResponseSchema) })
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(TaskScopeQuerySchema))
    query: z.output<typeof TaskScopeQuerySchema>,
  ): Promise<TaskListResponse> {
    return this.tasks.list(user, query.scope);
  }

  @Post()
  @ApiBody({ schema: openApi(CreateTaskSchema, 'input') })
  @ApiOkResponse({ schema: openApi(TaskSchema) })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateTaskSchema)) body: CreateTaskInput,
  ): Promise<Task> {
    return this.tasks.create(user, body);
  }

  @Patch(':id')
  @ApiBody({ schema: openApi(UpdateTaskSchema, 'input') })
  @ApiOkResponse({ schema: openApi(TaskSchema) })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', IdPipe) id: string,
    @Body(new ZodValidationPipe(UpdateTaskSchema)) body: UpdateTaskInput,
  ): Promise<Task> {
    return this.tasks.update(user, id, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id', IdPipe) id: string): Promise<void> {
    return this.tasks.remove(user, id);
  }
}
