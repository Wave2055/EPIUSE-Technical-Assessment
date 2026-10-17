import { Module } from '@nestjs/common';
import { AvatarModule } from '../avatars/avatar.module.js';
import { TasksController } from './tasks.controller.js';
import { TasksService } from './tasks.service.js';

@Module({ imports: [AvatarModule], controllers: [TasksController], providers: [TasksService] })
export class TasksModule {}
