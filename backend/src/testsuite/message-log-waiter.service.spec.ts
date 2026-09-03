import { vi } from 'vitest';
import { MessageLogWaiter } from './message-log-waiter.service.js';
import type { CitrineOsMessageLogService } from '../citrineos/citrineos-message-log.service.js';

describe('MessageLogWaiter', () => {
  it('resolves with the message once findFirstAfter returns a match', async () => {
    const findFirstAfter = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'log-1' });
    const messageLogService = { findFirstAfter } as unknown as CitrineOsMessageLogService;
    const waiter = new MessageLogWaiter(messageLogService);

    const result = await waiter.waitForMessage(
      'tenant-1',
      { ocppConnectionName: 'stationA', action: 'Heartbeat', origin: 'ChargingStation' },
      new Date(),
      5000,
      1,
    );

    expect(result).toEqual({ id: 'log-1' });
    expect(findFirstAfter).toHaveBeenCalledTimes(3);
  });

  it('resolves with null once the timeout elapses without a match', async () => {
    const findFirstAfter = vi.fn().mockResolvedValue(null);
    const messageLogService = { findFirstAfter } as unknown as CitrineOsMessageLogService;
    const waiter = new MessageLogWaiter(messageLogService);

    const result = await waiter.waitForMessage(
      'tenant-1',
      { ocppConnectionName: 'stationA', action: 'Heartbeat', origin: 'ChargingStation' },
      new Date(),
      20,
      5,
    );

    expect(result).toBeNull();
  });

  it('passes the action/origin/since filter through unchanged', async () => {
    const findFirstAfter = vi.fn().mockResolvedValue({ id: 'log-1' });
    const messageLogService = { findFirstAfter } as unknown as CitrineOsMessageLogService;
    const waiter = new MessageLogWaiter(messageLogService);
    const since = new Date('2026-01-01T00:00:00Z');

    await waiter.waitForMessage(
      'tenant-1',
      { ocppConnectionName: 'stationA', action: 'BootNotification', origin: 'ChargingStation' },
      since,
      5000,
    );

    expect(findFirstAfter).toHaveBeenCalledWith('tenant-1', {
      ocppConnectionName: 'stationA',
      action: 'BootNotification',
      origin: 'ChargingStation',
      after: since,
    });
  });
});
