import { vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service.js';
import type { StationReconciliationService } from './station-reconciliation.service.js';

function makePrismaMock(overrides: any = {}) {
  return {
    location: {
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'location-1', ...data })),
      findUnique: vi.fn(() =>
        Promise.resolve('location' in overrides ? overrides.location : { id: 'location-1' }),
      ),
      update: vi.fn(({ data }: any) => Promise.resolve({ id: 'location-1', ...data })),
      delete: vi.fn(() => Promise.resolve(undefined)),
      findMany: vi.fn(() => Promise.resolve([])),
    },
    plannedStation: {
      findUnique: vi.fn(() => Promise.resolve(overrides.plannedStation ?? null)),
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'station-1', status: 'Planned', ...data })),
      findUniqueOrThrow: vi.fn(() => Promise.resolve({ id: 'station-1', status: 'Linked' })),
    },
    plannedConnector: {
      findUnique: vi.fn(() => Promise.resolve(overrides.plannedConnector ?? null)),
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'connector-1', ...data })),
    },
    unknownCharger: {
      findUnique: vi.fn(() => Promise.resolve(overrides.unknownCharger ?? null)),
    },
    ...overrides.prisma,
  } as any;
}

function makeReconciliationMock() {
  return {
    markLinkedAndClearUnknown: vi.fn().mockResolvedValue(undefined),
  } as unknown as StationReconciliationService;
}

describe('LocationsService', () => {
  it('creates a station as Planned when its chargeboxId was never seen before', async () => {
    const prisma = makePrismaMock();
    const reconciliation = makeReconciliationMock();
    const service = new LocationsService(prisma, reconciliation);

    const station = await service.createStation('tenant-1', 'location-1', {
      chargeboxId: 'cp001',
      label: 'Säule Nord',
    } as any);

    expect(station.status).toBe('Planned');
    expect(reconciliation.markLinkedAndClearUnknown).not.toHaveBeenCalled();
  });

  it('rejects a duplicate chargeboxId', async () => {
    const prisma = makePrismaMock({ plannedStation: { id: 'existing' } });
    const service = new LocationsService(prisma, makeReconciliationMock());

    await expect(
      service.createStation('tenant-1', 'location-1', { chargeboxId: 'cp001', label: 'x' } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects creating a station under a location that does not exist', async () => {
    const prisma = makePrismaMock({ location: null });
    const service = new LocationsService(prisma, makeReconciliationMock());

    await expect(
      service.createStation('tenant-1', 'missing-location', { chargeboxId: 'cp001', label: 'x' } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('immediately marks a station Linked when its chargeboxId is already a known Unknown Charger', async () => {
    const prisma = makePrismaMock({ unknownCharger: { id: 'unknown-1', chargeboxId: 'cp001' } });
    const reconciliation = makeReconciliationMock();
    const service = new LocationsService(prisma, reconciliation);

    await service.createStation('tenant-1', 'location-1', { chargeboxId: 'cp001', label: 'x' } as any);

    expect(reconciliation.markLinkedAndClearUnknown).toHaveBeenCalledWith('tenant-1', 'station-1', 'cp001');
  });

  it('rejects creating a connector that duplicates an EVSE/connector pair on the same station', async () => {
    const prisma = makePrismaMock({
      plannedStation: { id: 'station-1' },
      plannedConnector: { id: 'existing' },
    });
    const service = new LocationsService(prisma, makeReconciliationMock());

    await expect(
      service.createConnector('tenant-1', 'station-1', {
        label: 'Ladepunkt 1',
        evseId: 1,
        type: 'sType2',
        format: 'Cable',
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects deleting a location that still has stations', async () => {
    const prisma = makePrismaMock();
    prisma.location.findUnique = vi.fn(() =>
      Promise.resolve({ id: 'location-1', _count: { stations: 2 } }),
    );
    const service = new LocationsService(prisma, makeReconciliationMock());

    await expect(service.remove('tenant-1', 'location-1')).rejects.toThrow(ConflictException);
  });
});
