import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CitrineOsMessageApiService } from './citrineos-message-api.service.js';
import { RemoteStartDto } from './dto/remote-start.dto.js';
import { RemoteStopDto } from './dto/remote-stop.dto.js';
import { ResetDto } from './dto/reset.dto.js';
import { TriggerMessageDto } from './dto/trigger-message.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

@Controller('citrineos/commands')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CitrineOsCommandsController {
  constructor(private readonly messageApi: CitrineOsMessageApiService) {}

  // Starting/stopping a charge is the day-to-day operator action described
  // for Mitarbeiter in docs/architecture-proposal.md §6.
  @Post('remote-start')
  @Roles(Role.SuperAdmin, Role.Admin, Role.Mitarbeiter)
  @Audited('citrineos.command.remote-start')
  remoteStart(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemoteStartDto) {
    return this.messageApi.requestStartTransaction(user.tenantId, dto.ocppConnectionNames, {
      idToken: dto.idToken,
      remoteStartId: dto.remoteStartId,
      evseId: dto.evseId,
    });
  }

  @Post('remote-stop')
  @Roles(Role.SuperAdmin, Role.Admin, Role.Mitarbeiter)
  @Audited('citrineos.command.remote-stop')
  remoteStop(@CurrentUser() user: AuthenticatedUser, @Body() dto: RemoteStopDto) {
    return this.messageApi.requestStopTransaction(user.tenantId, dto.ocppConnectionNames, {
      transactionId: dto.transactionId,
    });
  }

  // Reset and TriggerMessage are more disruptive (Reset can interrupt a
  // running charge) — Admin and above only, not Mitarbeiter.
  @Post('reset')
  @Roles(Role.SuperAdmin, Role.Admin)
  @Audited('citrineos.command.reset')
  reset(@CurrentUser() user: AuthenticatedUser, @Body() dto: ResetDto) {
    return this.messageApi.reset(user.tenantId, dto.ocppConnectionNames, { type: dto.type });
  }

  @Post('trigger-message')
  @Roles(Role.SuperAdmin, Role.Admin)
  @Audited('citrineos.command.trigger-message')
  triggerMessage(@CurrentUser() user: AuthenticatedUser, @Body() dto: TriggerMessageDto) {
    return this.messageApi.triggerMessage(user.tenantId, dto.ocppConnectionNames, {
      requestedMessage: dto.requestedMessage,
      evse: dto.evseId !== undefined ? { id: dto.evseId } : undefined,
    });
  }
}
