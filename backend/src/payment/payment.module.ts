import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller.js';
import { PaymentConfigService } from './payment-config.service.js';
import { PaymentDbService } from './payment-db.service.js';
import { PaymentDataService } from './payment-data.service.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [SettingsModule, AuthModule],
  controllers: [PaymentController],
  providers: [PaymentConfigService, PaymentDbService, PaymentDataService],
})
export class PaymentModule {}
