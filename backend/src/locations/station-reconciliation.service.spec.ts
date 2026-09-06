import { vi } from 'vitest';
import { StationReconciliationService } from './station-reconciliation.service.js';

function makePrismaMock({ plannedStation = null }: { plannedStation?: unknown } = {}) {
  return {
    plannedStation: {
      findUnique: vi.fn(() => Promise.resolve(plannedStation)),
      update: vi.fn(({ data }: any) => Promise.resolve({ id: 'station-1', ...data })),
    },
    unknownCharger: {
      upsert: vi.fn(({ create }: any) => Promise.resolve({ id: 'unknown-1', ...create })),
      deleteMany: vi.fn(() => Promise.resolve({ count: 1 })),
    },
  } as any;
}

describe('StationReconciliationService', () => {
  it('marks a Planned station as Linked when its chargeboxId connects', async () => {
    const prisma = makePrismaMock({ plannedStation: { id: 'station-1', status: 'Planned' } });
    const service = new StationReconciliationService(prisma);

    await service.reconcileIncomingConnection('tenant-1', 'cp001');

    expect(prisma.plannedStation.update).toHaveBeenCalledWith({
      where: { id: 'station-1' },
      data: { status: 'Linked', linkedAt: expect.any(Date) },
    });
    expect(prisma.unknownCharger.upsert).not.toHaveBeenCalled();
  });

  it('does not re-update an already Linked station', async () => {
    const prisma = makePrismaMock({ plannedStation: { id: 'station-1', status: 'Linked' } });
    const service = new StationReconciliationService(prisma);

    await service.reconcileIncomingConnection('tenant-1', 'cp001');

    expect(prisma.plannedStation.update).not.toHaveBeenCalled();
  });

  it('upserts an UnknownCharger when no PlannedStation matches', async () => {
    const prisma = makePrismaMock({ plannedStation: null });
    const service = new StationReconciliationService(prisma);

    await service.reconcileIncomingConnection('tenant-1', 'cp-unexpected');

    expect(prisma.unknownCharger.upsert).toHaveBeenCalledWith({
      where: { tenantId_chargeboxId: { tenantId: 'tenant-1', chargeboxId: 'cp-unexpected' } },
      create: { tenantId: 'tenant-1', chargeboxId: 'cp-unexpected' },
      update: { attemptCount: { increment: 1 }, dismissed: false },
    });
  });

  it('marks a station Linked and clears any matching UnknownCharger on manual assignment', async () => {
    const prisma = makePrismaMock();
    const service = new StationReconciliationService(prisma);

    await service.markLinkedAndClearUnknown('tenant-1', 'station-1', 'cp001');

    expect(prisma.plannedStation.update).toHaveBeenCalledWith({
      where: { id: 'station-1' },
      data: { status: 'Linked', linkedAt: expect.any(Date) },
    });
    expect(prisma.unknownCharger.deleteMany).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1', chargeboxId: 'cp001' },
    });
  });
});
