import { Module } from '@nestjs/common';
import { AvatarModule } from '../avatars/avatar.module.js';
import { HierarchyController } from './hierarchy.controller.js';
import { HierarchyService } from './hierarchy.service.js';

@Module({
  imports: [AvatarModule],
  controllers: [HierarchyController],
  providers: [HierarchyService],
  exports: [HierarchyService],
})
export class HierarchyModule {}
