import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller.js';
import { LocationsService } from './locations.service.js';
import { StationReconciliationService } from './station-reconciliation.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [LocationsController],
  providers: [LocationsService, StationReconciliationService],
  // StationReconciliationService is shared with the CitrineOS webhook
  // (a real connection reconciling against PlannedStation/UnknownCharger)
  // and with the unknown-chargers module (manual assign).
  exports: [StationReconciliationService],
})
export class LocationsModule {}
