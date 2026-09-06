import { vi } from 'vitest';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UnknownChargersService } from './unknown-chargers.service.js';
import type { StationReconciliationService } from '../locations/station-reconciliation.service.js';

function makePrismaMock(overrides: any = {}) {
  return {
    unknownCharger: {
      findMany: vi.fn(() => Promise.resolve([])),
      findUnique: vi.fn(() =>
        Promise.resolve(
          'unknownCharger' in overrides ? overrides.unknownCharger : { id: 'unknown-1', chargeboxId: 'cp001' },
        ),
      ),
      update: vi.fn(({ data }: any) => Promise.resolve({ id: 'unknown-1', ...data })),
    },
    plannedStation: {
      findUnique: vi.fn(({ where }: any) =>
        Promise.resolve(
          where.id
            ? ('station' in overrides ? overrides.station : { id: 'station-1', chargeboxId: 'cp-old' })
            : ('clash' in overrides ? overrides.clash : null),
        ),
      ),
      update: vi.fn(({ data }: any) => Promise.resolve({ id: 'station-1', ...data })),
    },
  } as any;
}

function makeReconciliationMock() {
  return {
    markLinkedAndClearUnknown: vi.fn().mockResolvedValue(undefined),
  } as unknown as StationReconciliationService;
}

describe('UnknownChargersService', () => {
  it('assigns an unknown charger to an existing station and links it', async () => {
    const prisma = makePrismaMock();
    const reconciliation = makeReconciliationMock();
    const service = new UnknownChargersService(prisma, reconciliation);

    await service.assignToStation('tenant-1', 'unknown-1', 'station-1');

    expect(prisma.plannedStation.update).toHaveBeenCalledWith({
      where: { id: 'station-1' },
      data: { chargeboxId: 'cp001' },
    });
    expect(reconciliation.markLinkedAndClearUnknown).toHaveBeenCalledWith('tenant-1', 'station-1', 'cp001');
  });

  it('rejects when the unknown charger does not exist', async () => {
    const prisma = makePrismaMock({ unknownCharger: null });
    const service = new UnknownChargersService(prisma, makeReconciliationMock());

    await expect(service.assignToStation('tenant-1', 'missing', 'station-1')).rejects.toThrow(NotFoundException);
  });

  it('rejects assigning to a station whose target station does not exist', async () => {
    const prisma = makePrismaMock({ station: null });
    const service = new UnknownChargersService(prisma, makeReconciliationMock());

    await expect(service.assignToStation('tenant-1', 'unknown-1', 'missing-station')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects assigning when the chargeboxId is already planned on a different station', async () => {
    const prisma = makePrismaMock({ clash: { id: 'other-station' } });
    const service = new UnknownChargersService(prisma, makeReconciliationMock());

    await expect(service.assignToStation('tenant-1', 'unknown-1', 'station-1')).rejects.toThrow(ConflictException);
  });

  it('dismisses an unknown charger', async () => {
    const prisma = makePrismaMock();
    const service = new UnknownChargersService(prisma, makeReconciliationMock());

    await service.dismiss('tenant-1', 'unknown-1');

    expect(prisma.unknownCharger.update).toHaveBeenCalledWith({
      where: { id: 'unknown-1' },
      data: { dismissed: true },
    });
  });
});
