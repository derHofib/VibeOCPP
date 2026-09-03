import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface IncomingCitrineOsEvent {
  ocppConnectionName: string;
  event: 'connected' | 'closed' | 'message';
  origin?: 'ChargingStation' | 'ChargingStationManagementSystem';
  message?: string;
  info?: Record<string, string>;
}

export interface MessageLogFilter {
  ocppConnectionName?: string;
  // Matches info.action (a plain OCPP action name like "BootNotification"),
  // stored inside the JSON `info` column CitrineOS's webhook sends us.
  action?: string;
  origin?: 'ChargingStation' | 'ChargingStationManagementSystem';
  after?: Date;
  before?: Date;
  limit?: number;
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

  list(tenantId: string, filter: MessageLogFilter = {}) {
    return this.prisma.citrineOsMessageLog.findMany({
      where: this.buildWhere(tenantId, filter),
      orderBy: { receivedAt: 'desc' },
      take: Math.min(filter.limit ?? 100, 500),
    });
  }

  // Used by the testsuite's step waiter (see testsuite/message-log-waiter.service.ts)
  // to poll for the one message that answers a given trigger/observe step —
  // the oldest matching row after the step started, since that is the
  // response to that step rather than to something sent later.
  async findFirstAfter(tenantId: string, filter: MessageLogFilter & { after: Date }) {
    return this.prisma.citrineOsMessageLog.findFirst({
      where: this.buildWhere(tenantId, filter),
      orderBy: { receivedAt: 'asc' },
    });
  }

  private buildWhere(tenantId: string, filter: MessageLogFilter) {
    return {
      tenantId,
      ...(filter.ocppConnectionName ? { ocppConnectionName: filter.ocppConnectionName } : {}),
      ...(filter.origin ? { origin: filter.origin } : {}),
      ...(filter.action ? { info: { path: ['action'], equals: filter.action } } : {}),
      ...(filter.after || filter.before
        ? {
            receivedAt: {
              ...(filter.after ? { gt: filter.after } : {}),
              ...(filter.before ? { lt: filter.before } : {}),
            },
          }
        : {}),
    };
  }
}
