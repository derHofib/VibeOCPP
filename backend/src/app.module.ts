import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuditModule } from './audit/audit.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { CitrineOsModule } from './citrineos/citrineos.module.js';
import { TestSuiteModule } from './testsuite/testsuite.module.js';
import { PaymentModule } from './payment/payment.module.js';
import { OpsModule } from './ops/ops.module.js';
import { LocationsModule } from './locations/locations.module.js';
import { UnknownChargersModule } from './unknown-chargers/unknown-chargers.module.js';
import { validateEnv } from './config/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuditModule,
    TenantsModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    LocationsModule,
    UnknownChargersModule,
    CitrineOsModule,
    TestSuiteModule,
    PaymentModule,
    OpsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
