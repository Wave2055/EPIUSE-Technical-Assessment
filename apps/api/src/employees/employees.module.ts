import { Module } from '@nestjs/common';
import { AvatarModule } from '../avatars/avatar.module.js';
import { HierarchyModule } from '../hierarchy/hierarchy.module.js';
import { PromoteStrategy } from './delete-strategies/promote.strategy.js';
import { ReassignStrategy } from './delete-strategies/reassign.strategy.js';
import { EmployeeAvatarService } from './employee-avatar.service.js';
import { EmployeeMapper } from './employee.mapper.js';
import { EmployeesController } from './employees.controller.js';
import { EmployeesService } from './employees.service.js';

@Module({
  imports: [AvatarModule, HierarchyModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    EmployeeAvatarService,
    EmployeeMapper,
    PromoteStrategy,
    ReassignStrategy,
  ],
  exports: [EmployeeMapper],
})
export class EmployeesModule {}
