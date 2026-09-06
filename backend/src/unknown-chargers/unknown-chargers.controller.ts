import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { UnknownChargersService } from './unknown-chargers.service.js';
import { AssignUnknownChargerDto } from './dto/assign-unknown-charger.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('unknown-chargers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin)
export class UnknownChargersController {
  constructor(private readonly unknownChargersService: UnknownChargersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.unknownChargersService.list(user.tenantId);
  }

  @Post(':id/assign')
  @Audited('unknown-charger.assign')
  assign(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignUnknownChargerDto,
  ) {
    return this.unknownChargersService.assignToStation(user.tenantId, id, dto.stationId);
  }

  @Delete(':id')
  @Audited('unknown-charger.dismiss')
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.unknownChargersService.dismiss(user.tenantId, id);
  }
}
