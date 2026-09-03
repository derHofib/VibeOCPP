import { vi } from 'vitest';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makePrismaMock() {
  const create = vi.fn().mockResolvedValue({ id: 'log-1' });
  const findMany = vi.fn().mockResolvedValue([]);
  return { citrineOsMessageLog: { create, findMany } } as unknown as PrismaService;
}

describe('CitrineOsMessageLogService', () => {
  it('persists an incoming event with tenant scoping', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);

    await service.record('tenant-1', {
      ocppConnectionName: 'stationA',
      event: 'message',
      origin: 'ChargingStation',
      message: '[2,"1","BootNotification",{}]',
      info: { correlationId: 'abc' },
    });

    expect((prisma as any).citrineOsMessageLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'tenant-1',
        ocppConnectionName: 'stationA',
        event: 'message',
        origin: 'ChargingStation',
        rawMessage: '[2,"1","BootNotification",{}]',
        info: { correlationId: 'abc' },
      },
    });
  });

  it('caps the query limit at 500 to avoid an unbounded read', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);

    await service.list('tenant-1', { limit: 10_000 });

    const call = (prisma as any).citrineOsMessageLog.findMany.mock.calls[0][0];
    expect(call.take).toBe(500);
  });

  it('defaults to 100 when no limit is given', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);

    await service.list('tenant-1', {});

    const call = (prisma as any).citrineOsMessageLog.findMany.mock.calls[0][0];
    expect(call.take).toBe(100);
  });
});
