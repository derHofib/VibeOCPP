import { Module } from '@nestjs/common';
import { UnknownChargersController } from './unknown-chargers.controller.js';
import { UnknownChargersService } from './unknown-chargers.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { LocationsModule } from '../locations/locations.module.js';

@Module({
  imports: [AuthModule, LocationsModule],
  controllers: [UnknownChargersController],
  providers: [UnknownChargersService],
})
export class UnknownChargersModule {}
