import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service.js';
import { UpsertSettingDto } from './dto/upsert-setting.dto.js';
import { RollbackSettingDto } from './dto/rollback-setting.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// System configuration is SuperAdmin-only per the role model in
// docs/architecture-proposal.md §6 — Admin manages operational data, not
// secrets/infrastructure config.
@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('category') category?: string) {
    return this.settingsService.list(user.tenantId, category);
  }

  // Declared before the ':category/:key' catch-all below: Nest/Express
  // matches routes in registration order, and a literal prefix here means
  // this always wins over the generic two-segment route regardless of what
  // a category happens to be named.
  @Post('rollback/:id')
  @Audited('settings.rollback')
  rollback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RollbackSettingDto,
  ) {
    return this.settingsService.rollback(user.tenantId, id, dto.toVersion, user.id);
  }

  @Post(':category/:key')
  @Audited('settings.update')
  upsert(
    @CurrentUser() user: AuthenticatedUser,
    @Param('category') category: string,
    @Param('key') key: string,
    @Body() dto: UpsertSettingDto,
  ) {
    return this.settingsService.upsert({
      tenantId: user.tenantId,
      category,
      key,
      type: dto.type,
      value: dto.value,
      updatedBy: user.id,
    });
  }
}
