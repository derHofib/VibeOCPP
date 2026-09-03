import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface IncomingCitrineOsEvent {
  ocppConnectionName: string;
  event: 'connected' | 'closed' | 'message';
  origin?: 'ChargingStation' | 'ChargingStationManagementSystem';
  message?: string;
  info?: Record<string, string>;
}

@Injectable()
export class CitrineOsMessageLogService {
  constructor(private readonly prisma: PrismaService) {}

  record(tenantId: string, event: IncomingCitrineOsEvent) {
    return this.prisma.citrineOsMessageLog.create({
      data: {
        tenantId,
        ocppConnectionName: event.ocppConnectionName,
        event: event.event,
        origin: event.origin,
        rawMessage: event.message,
        info: event.info,
      },
    });
  }

  list(
    tenantId: string,
    filter: { ocppConnectionName?: string; limit?: number; before?: Date } = {},
  ) {
    return this.prisma.citrineOsMessageLog.findMany({
      where: {
        tenantId,
        ...(filter.ocppConnectionName ? { ocppConnectionName: filter.ocppConnectionName } : {}),
        ...(filter.before ? { receivedAt: { lt: filter.before } } : {}),
      },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(filter.limit ?? 100, 500),
    });
  }
}
