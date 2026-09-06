import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { CreateConnectorDto } from './dto/create-connector.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Provisioning is structural setup, not day-to-day operation — same
// SuperAdmin/Admin bar as user management, per the "Standort- &
// Ladepunkt-Verwaltung" plan.
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin)
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('locations')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.locationsService.list(user.tenantId);
  }

  @Post('locations')
  @Audited('location.create')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLocationDto) {
    return this.locationsService.create(user.tenantId, dto);
  }

  @Patch('locations/:id')
  @Audited('location.update')
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(user.tenantId, id, dto);
  }

  @Delete('locations/:id')
  @Audited('location.delete')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.locationsService.remove(user.tenantId, id);
  }

  @Post('locations/:id/stations')
  @Audited('station.create')
  createStation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') locationId: string,
    @Body() dto: CreateStationDto,
  ) {
    return this.locationsService.createStation(user.tenantId, locationId, dto);
  }

  @Post('stations/:id/connectors')
  @Audited('connector.create')
  createConnector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') stationId: string,
    @Body() dto: CreateConnectorDto,
  ) {
    return this.locationsService.createConnector(user.tenantId, stationId, dto);
  }
}
