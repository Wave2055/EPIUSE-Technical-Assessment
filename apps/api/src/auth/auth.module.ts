import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PrismaRefreshTokenStore, RefreshTokenStore } from './refresh-token.repository.js';

@Module({
  // Secrets are passed per call from AppConfig, so no module-level secret is registered.
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, { provide: RefreshTokenStore, useClass: PrismaRefreshTokenStore }],
  exports: [JwtModule],
})
export class AuthModule {}
