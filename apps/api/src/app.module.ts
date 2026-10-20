import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApiExceptionFilter } from './common/filters/api-exception.filter.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SalaryMaskInterceptor } from './common/interceptors/salary-mask.interceptor.js';
import { clientAddress } from './common/throttling/client-address.js';
import { DEFAULT_RATE_LIMIT } from './common/throttling/rate-limits.js';
import { AppConfig } from './config/app-config.js';
import { ConfigModule } from './config/config.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthController } from './health/health.controller.js';
import { HierarchyModule } from './hierarchy/hierarchy.module.js';
import { MeModule } from './me/me.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [DEFAULT_RATE_LIMIT],
        errorMessage: 'Too many requests. Wait a moment and try again.',
        getTracker: (req) => clientAddress(req as Request, Boolean(config.env.ORIGIN_SECRET)),
      }),
    }),
    PrismaModule,
    AuthModule,
    EmployeesModule,
    HierarchyModule,
    AuditModule,
    MeModule,
    TasksModule,
    UsersModule,
  ],
  controllers: [HealthController],
  providers: [
    // Guards run in this order: rate-limit, authenticate, then authorise. Throttling first
    // means a flood is refused before any token is verified.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: SalaryMaskInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
