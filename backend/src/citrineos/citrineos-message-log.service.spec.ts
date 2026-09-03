import { vi } from 'vitest';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

function makePrismaMock() {
  const create = vi.fn().mockResolvedValue({ id: 'log-1' });
  const findMany = vi.fn().mockResolvedValue([]);
  const findFirst = vi.fn().mockResolvedValue(null);
  return { citrineOsMessageLog: { create, findMany, findFirst } } as unknown as PrismaService;
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

  it('filters by action via the JSON info.action path and by origin', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);

    await service.list('tenant-1', { action: 'BootNotification', origin: 'ChargingStation' });

    const call = (prisma as any).citrineOsMessageLog.findMany.mock.calls[0][0];
    expect(call.where).toMatchObject({
      tenantId: 'tenant-1',
      origin: 'ChargingStation',
      info: { path: ['action'], equals: 'BootNotification' },
    });
  });

  it('filters by a receivedAt range when after/before are given', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);
    const after = new Date('2026-01-01T00:00:00Z');
    const before = new Date('2026-01-02T00:00:00Z');

    await service.list('tenant-1', { after, before });

    const call = (prisma as any).citrineOsMessageLog.findMany.mock.calls[0][0];
    expect(call.where.receivedAt).toEqual({ gt: after, lt: before });
  });

  it('findFirstAfter queries ascending (oldest match first) unlike list (newest first)', async () => {
    const prisma = makePrismaMock();
    const service = new CitrineOsMessageLogService(prisma);
    const after = new Date('2026-01-01T00:00:00Z');

    await service.findFirstAfter('tenant-1', {
      ocppConnectionName: 'stationA',
      action: 'Heartbeat',
      origin: 'ChargingStation',
      after,
    });

    const call = (prisma as any).citrineOsMessageLog.findFirst.mock.calls[0][0];
    expect(call.orderBy).toEqual({ receivedAt: 'asc' });
    expect(call.where).toMatchObject({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      origin: 'ChargingStation',
      info: { path: ['action'], equals: 'Heartbeat' },
      receivedAt: { gt: after },
    });
  });
});
