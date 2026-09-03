import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Foundation of the Live-Message-Monitor (docs/architecture-proposal.md §8)
// — every authenticated role may read OCPP traffic, per "Mitarbeiter: OCPP-
// Nachrichten lesen" in the role table.
@Controller('citrineos/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin, Role.Mitarbeiter)
export class CitrineOsMessagesController {
  constructor(private readonly messageLogService: CitrineOsMessageLogService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('ocppConnectionName') ocppConnectionName?: string,
    @Query('limit') limit?: string,
  ) {
    return this.messageLogService.list(user.tenantId, {
      ocppConnectionName,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
