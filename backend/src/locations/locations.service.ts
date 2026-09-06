import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateLocationDto } from './dto/create-location.dto.js';
import { UpdateLocationDto } from './dto/update-location.dto.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { CreateConnectorDto } from './dto/create-connector.dto.js';
import { StationReconciliationService } from './station-reconciliation.service.js';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliation: StationReconciliationService,
  ) {}

  create(tenantId: string, dto: CreateLocationDto) {
    return this.prisma.location.create({ data: { tenantId, ...dto } });
  }

  list(tenantId: string) {
    return this.prisma.location.findMany({
      where: { tenantId },
      include: { stations: { include: { connectors: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateLocationDto) {
    await this.getLocationOrThrow(tenantId, id);
    return this.prisma.location.update({ where: { id }, data: dto });
  }

  // A location with stations still on it is kept — deleting it would
  // orphan those stations' chargeboxId reservations silently. The caller
  // must move or delete its stations first.
  async remove(tenantId: string, id: string) {
    const location = await this.prisma.location.findUnique({
      where: { id, tenantId },
      include: { _count: { select: { stations: true } } },
    });
    if (!location) throw new NotFoundException('Location not found');
    if (location._count.stations > 0) {
      throw new ConflictException('Location still has stations — move or delete them first');
    }
    await this.prisma.location.delete({ where: { id } });
  }

  async createStation(tenantId: string, locationId: string, dto: CreateStationDto) {
    await this.getLocationOrThrow(tenantId, locationId);
    const existing = await this.prisma.plannedStation.findUnique({
      where: { tenantId_chargeboxId: { tenantId, chargeboxId: dto.chargeboxId } },
    });
    if (existing) {
      throw new ConflictException(`chargeboxId "${dto.chargeboxId}" is already planned`);
    }
    const station = await this.prisma.plannedStation.create({
      data: { tenantId, locationId, ...dto },
    });

    // Covers "Als Station übernehmen" from the Unknown Charger tab: the
    // chargeboxId is already known to be live, so skip waiting for another
    // webhook and mark it Linked immediately.
    const unknown = await this.prisma.unknownCharger.findUnique({
      where: { tenantId_chargeboxId: { tenantId, chargeboxId: dto.chargeboxId } },
    });
    if (unknown) {
      await this.reconciliation.markLinkedAndClearUnknown(tenantId, station.id, dto.chargeboxId);
      return this.prisma.plannedStation.findUniqueOrThrow({ where: { id: station.id } });
    }

    return station;
  }

  async createConnector(tenantId: string, stationId: string, dto: CreateConnectorDto) {
    const station = await this.prisma.plannedStation.findUnique({ where: { id: stationId, tenantId } });
    if (!station) throw new NotFoundException('Station not found');
    const connectorId = dto.connectorId ?? 1;
    const existing = await this.prisma.plannedConnector.findUnique({
      where: { stationId_evseId_connectorId: { stationId, evseId: dto.evseId, connectorId } },
    });
    if (existing) {
      throw new ConflictException(`EVSE ${dto.evseId} / Connector ${connectorId} already exists on this station`);
    }
    return this.prisma.plannedConnector.create({
      data: { tenantId, stationId, ...dto, connectorId },
    });
  }

  private async getLocationOrThrow(tenantId: string, id: string) {
    const location = await this.prisma.location.findUnique({ where: { id, tenantId } });
    if (!location) throw new NotFoundException('Location not found');
    return location;
  }
}
