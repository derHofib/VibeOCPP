import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import type { CitrineOsMessageLog } from '../generated/prisma/index.js';

// The Live-Message-Monitor (docs/architecture-proposal.md §8) — every
// authenticated role may read OCPP traffic, per "Mitarbeiter: OCPP-
// Nachrichten lesen" in the role table. Filterable by station/action/
// direction/time range; exportable as CSV.
@Controller('citrineos/messages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin, Role.Mitarbeiter)
export class CitrineOsMessagesController {
  constructor(private readonly messageLogService: CitrineOsMessageLogService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
    @Query('ocppConnectionName') ocppConnectionName?: string,
    @Query('action') action?: string,
    @Query('origin') origin?: 'ChargingStation' | 'ChargingStationManagementSystem',
    @Query('after') after?: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: 'json' | 'csv',
  ) {
    const messages = await this.messageLogService.list(user.tenantId, {
      ocppConnectionName,
      action,
      origin,
      after: after ? new Date(after) : undefined,
      before: before ? new Date(before) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="ocpp-messages.csv"');
      return this.toCsv(messages);
    }

    return messages;
  }

  private toCsv(messages: CitrineOsMessageLog[]): string {
    const header = 'receivedAt,ocppConnectionName,event,origin,action,rawMessage\n';
    const rows = messages.map((m) => {
      const info = (m.info as Record<string, string> | null) ?? {};
      const fields = [
        m.receivedAt.toISOString(),
        m.ocppConnectionName,
        m.event,
        m.origin ?? '',
        info.action ?? '',
        m.rawMessage ?? '',
      ];
      return fields.map((f) => `"${f.replace(/"/g, '""')}"`).join(',');
    });
    return header + rows.join('\n');
  }
}
