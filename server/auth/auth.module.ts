import { Module, Global } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';
import { JwtAuthGuard } from './auth.guard.js';
import { RolesGuard } from './roles.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { AppConfigModule } from '../config/config.module.js';

@Global()
@Module({
  imports: [DatabaseModule, AppConfigModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
