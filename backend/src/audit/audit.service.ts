import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuditEntryInput {
  tenantId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

// Every privileged action funnels through here — settings changes, user
// management, remote OCPP commands, firmware/certificate operations,
// backup/restore — recording who, when, what, and the before/after value.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: AuditEntryInput) {
    return this.prisma.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorId: entry.actorId ?? null,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        oldValue: entry.oldValue === undefined ? undefined : (entry.oldValue as object),
        newValue: entry.newValue === undefined ? undefined : (entry.newValue as object),
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
      },
    });
  }
}
