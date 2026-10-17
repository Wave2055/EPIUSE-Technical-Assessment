import { Module } from '@nestjs/common';
import { EmployeesModule } from '../employees/employees.module.js';
import { MeController } from './me.controller.js';
import { MeService } from './me.service.js';

@Module({ imports: [EmployeesModule], controllers: [MeController], providers: [MeService] })
export class MeModule {}
