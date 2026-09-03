import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { TenantsModule } from '../tenants/tenants.module.js';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), JwtModule.register({}), TenantsModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtStrategy],
  // Re-export PassportModule (registered, so it provides AuthModuleOptions)
  // so any module using JwtAuthGuard/RolesGuard just needs to import
  // AuthModule — Nest resolves @UseGuards() classes from the declaring
  // controller's own module providers/imports.
  exports: [AuthService, PasswordService, PassportModule],
})
export class AuthModule {}
