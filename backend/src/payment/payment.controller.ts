import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaymentDataService } from './payment-data.service.js';
import { PaymentDbService } from './payment-db.service.js';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto.js';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto.js';
import { CreateEvseDto, UpdateEvseDto } from './dto/evse.dto.js';
import { CreateConnectorDto, UpdateConnectorDto } from './dto/connector.dto.js';
import { CreateTariffDto, UpdateTariffDto } from './dto/tariff.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Operators/Locations/Evses/Connectors/Tariffs are the operational master
// data the role table assigns to Admin ("verwaltet Standorte, Stationen,
// Tarife") — not SuperAdmin-only system config, and not something
// Mitarbeiter creates or deletes.
@Controller('payment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin)
export class PaymentController {
  constructor(
    private readonly data: PaymentDataService,
    private readonly db: PaymentDbService,
  ) {}

  @Get('health')
  @Roles(Role.SuperAdmin)
  async health(@CurrentUser() user: AuthenticatedUser) {
    await this.db.testConnection(user.tenantId);
    return { status: 'ok' };
  }

  // ---- Operators ------------------------------------------------------

  @Get('operators')
  listOperators(@CurrentUser() user: AuthenticatedUser) {
    return this.data.listOperators(user.tenantId);
  }

  @Get('operators/:id')
  getOperator(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getOperator(user.tenantId, id);
  }

  @Post('operators')
  @Audited('payment.operator.create')
  createOperator(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOperatorDto) {
    return this.data.createOperator(user.tenantId, dto);
  }

  @Patch('operators/:id')
  @Audited('payment.operator.update')
  updateOperator(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperatorDto,
  ) {
    return this.data.updateOperator(user.tenantId, id, dto);
  }

  @Delete('operators/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('payment.operator.delete')
  async deleteOperator(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.data.deleteOperator(user.tenantId, id);
  }

  // ---- Locations --------------------------------------------------

  @Get('locations')
  listLocations(@CurrentUser() user: AuthenticatedUser) {
    return this.data.listLocations(user.tenantId);
  }

  @Get('locations/:id')
  getLocation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getLocation(user.tenantId, id);
  }

  @Post('locations')
  @Audited('payment.location.create')
  createLocation(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateLocationDto) {
    return this.data.createLocation(user.tenantId, dto);
  }

  @Patch('locations/:id')
  @Audited('payment.location.update')
  updateLocation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.data.updateLocation(user.tenantId, id, dto);
  }

  @Delete('locations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('payment.location.delete')
  async deleteLocation(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.data.deleteLocation(user.tenantId, id);
  }

  // ---- Evses --------------------------------------------------------

  @Get('evses')
  listEvses(@CurrentUser() user: AuthenticatedUser) {
    return this.data.listEvses(user.tenantId);
  }

  @Get('evses/:id')
  getEvse(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getEvse(user.tenantId, id);
  }

  @Post('evses')
  @Audited('payment.evse.create')
  createEvse(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEvseDto) {
    return this.data.createEvse(user.tenantId, dto);
  }

  @Patch('evses/:id')
  @Audited('payment.evse.update')
  updateEvse(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEvseDto,
  ) {
    return this.data.updateEvse(user.tenantId, id, dto);
  }

  @Delete('evses/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('payment.evse.delete')
  async deleteEvse(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.data.deleteEvse(user.tenantId, id);
  }

  // ---- Connectors -----------------------------------------------------

  @Get('connectors')
  listConnectors(@CurrentUser() user: AuthenticatedUser) {
    return this.data.listConnectors(user.tenantId);
  }

  @Get('connectors/:id')
  getConnector(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getConnector(user.tenantId, id);
  }

  @Post('connectors')
  @Audited('payment.connector.create')
  createConnector(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateConnectorDto) {
    return this.data.createConnector(user.tenantId, dto);
  }

  @Patch('connectors/:id')
  @Audited('payment.connector.update')
  updateConnector(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConnectorDto,
  ) {
    return this.data.updateConnector(user.tenantId, id, dto);
  }

  @Delete('connectors/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('payment.connector.delete')
  async deleteConnector(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.data.deleteConnector(user.tenantId, id);
  }

  // ---- Tariffs ------------------------------------------------------

  @Get('tariffs')
  listTariffs(@CurrentUser() user: AuthenticatedUser) {
    return this.data.listTariffs(user.tenantId);
  }

  @Get('tariffs/:id')
  getTariff(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getTariff(user.tenantId, id);
  }

  @Post('tariffs')
  @Audited('payment.tariff.create')
  createTariff(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTariffDto) {
    return this.data.createTariff(user.tenantId, dto);
  }

  @Patch('tariffs/:id')
  @Audited('payment.tariff.update')
  updateTariff(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTariffDto,
  ) {
    return this.data.updateTariff(user.tenantId, id, dto);
  }

  @Delete('tariffs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audited('payment.tariff.delete')
  async deleteTariff(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    await this.data.deleteTariff(user.tenantId, id);
  }

  // ---- Checkouts (read-only) ------------------------------------------

  @Get('checkouts')
  listCheckouts(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    return this.data.listCheckouts(user.tenantId, limit ? Number(limit) : undefined);
  }

  @Get('checkouts/:id')
  getCheckout(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.data.getCheckout(user.tenantId, id);
  }
}
