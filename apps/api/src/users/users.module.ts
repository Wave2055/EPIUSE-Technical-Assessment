import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvatarModule } from '../avatars/avatar.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [AuthModule, AvatarModule],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
