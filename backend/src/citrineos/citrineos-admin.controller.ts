import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { CitrineOsDataApiService } from './citrineos-data-api.service.js';
import { CitrineOsSubscriptionService } from './citrineos-subscription.service.js';
import { CreateSubscriptionDto } from './dto/create-subscription.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// The CitrineOS connection itself (URLs, subscriptions) is system
// configuration — SuperAdmin-only, same as the settings it reads, per the
// role model in docs/architecture-proposal.md §6.
@Controller('citrineos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
export class CitrineOsAdminController {
  constructor(
    private readonly dataApi: CitrineOsDataApiService,
    private readonly subscriptionService: CitrineOsSubscriptionService,
  ) {}

  // Backs the "Verbindung testen" button for the CitrineOS-Verbindung
  // settings category.
  @Get('health')
  async health(@CurrentUser() user: AuthenticatedUser) {
    await this.dataApi.ping(user.tenantId);
    return { status: 'ok' };
  }

  @Get('subscriptions')
  listSubscriptions(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ocppConnectionName') ocppConnectionName: string,
  ) {
    return this.dataApi.listSubscriptions(user.tenantId, ocppConnectionName);
  }

  @Post('subscriptions')
  @Audited('citrineos.subscription.create')
  createSubscription(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSubscriptionDto) {
    return this.subscriptionService.ensureSubscribed(user.tenantId, dto.ocppConnectionName);
  }

  @Delete('subscriptions/:id')
  @Audited('citrineos.subscription.delete')
  deleteSubscription(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseIntPipe) id: number) {
    return this.dataApi.deleteSubscription(user.tenantId, id);
  }
}
