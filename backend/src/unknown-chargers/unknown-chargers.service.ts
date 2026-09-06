import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { StationReconciliationService } from '../locations/station-reconciliation.service.js';

@Injectable()
export class UnknownChargersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: StationReconciliationService,
  ) {}

  list(tenantId: string) {
    return this.prisma.unknownCharger.findMany({
      where: { tenantId, dismissed: false },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  // "Zuordnen": corrects an existing PlannedStation's chargeboxId to match
  // a charger that's actually live — the usual cause is a typo made when
  // the station was first planned.
  async assignToStation(tenantId: string, unknownChargerId: string, stationId: string) {
    const unknown = await this.prisma.unknownCharger.findUnique({
      where: { id: unknownChargerId, tenantId },
    });
    if (!unknown) throw new NotFoundException('Unknown charger not found');

    const station = await this.prisma.plannedStation.findUnique({ where: { id: stationId, tenantId } });
    if (!station) throw new NotFoundException('Station not found');

    const clash = await this.prisma.plannedStation.findUnique({
      where: { tenantId_chargeboxId: { tenantId, chargeboxId: unknown.chargeboxId } },
    });
    if (clash && clash.id !== station.id) {
      throw new ConflictException(`chargeboxId "${unknown.chargeboxId}" is already planned on another station`);
    }

    await this.prisma.plannedStation.update({
      where: { id: station.id },
      data: { chargeboxId: unknown.chargeboxId },
    });
    await this.reconciliation.markLinkedAndClearUnknown(tenantId, station.id, unknown.chargeboxId);
  }

  async dismiss(tenantId: string, id: string) {
    const unknown = await this.prisma.unknownCharger.findUnique({ where: { id, tenantId } });
    if (!unknown) throw new NotFoundException('Unknown charger not found');
    await this.prisma.unknownCharger.update({ where: { id }, data: { dismissed: true } });
  }
}
