import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

// The one place that decides what a chargeboxId showing up "live" means for
// our own PlannedStation/UnknownCharger tables. Two callers: the CitrineOS
// webhook (a real connection just happened) and manual admin actions
// (assigning/creating a station for a chargeboxId already sitting in
// UnknownCharger — we already know that one is live, so it skips straight
// to Linked instead of waiting for another webhook event).
@Injectable()
export class StationReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  async reconcileIncomingConnection(tenantId: string, chargeboxId: string) {
    const station = await this.prisma.plannedStation.findUnique({
      where: { tenantId_chargeboxId: { tenantId, chargeboxId } },
    });

    if (station) {
      if (station.status === 'Planned') {
        await this.prisma.plannedStation.update({
          where: { id: station.id },
          data: { status: 'Linked', linkedAt: new Date() },
        });
      }
      // A planned station is expected to connect — no UnknownCharger entry
      // to clean up here (createStation resolves any pre-existing one).
      return;
    }

    await this.prisma.unknownCharger.upsert({
      where: { tenantId_chargeboxId: { tenantId, chargeboxId } },
      create: { tenantId, chargeboxId },
      update: { attemptCount: { increment: 1 }, dismissed: false },
    });
  }

  // Called once we already know a chargeboxId is live (it was sitting in
  // UnknownCharger, i.e. it already connected at least once) and an admin
  // has now attached it to a PlannedStation — either a brand new one or an
  // existing one being corrected. No need to wait for another webhook.
  async markLinkedAndClearUnknown(tenantId: string, stationId: string, chargeboxId: string) {
    await this.prisma.plannedStation.update({
      where: { id: stationId },
      data: { status: 'Linked', linkedAt: new Date() },
    });
    await this.prisma.unknownCharger.deleteMany({ where: { tenantId, chargeboxId } });
  }
}
