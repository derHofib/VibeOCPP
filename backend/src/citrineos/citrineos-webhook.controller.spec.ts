import { vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { CitrineOsWebhookController } from './citrineos-webhook.controller.js';
import type { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import type { CitrineOsConfigService } from './citrineos-config.service.js';
import type { TenantsService } from '../tenants/tenants.service.js';

function makeController(webhookSecret: string | null) {
  const record = vi.fn().mockResolvedValue(undefined);
  const messageLogService = { record } as unknown as CitrineOsMessageLogService;
  const configService = {
    getWebhookSecret: vi.fn().mockResolvedValue(webhookSecret),
  } as unknown as CitrineOsConfigService;
  const tenantsService = {
    getDefaultTenant: vi.fn().mockResolvedValue({ id: 'tenant-1' }),
  } as unknown as TenantsService;
  const controller = new CitrineOsWebhookController(messageLogService, configService, tenantsService);
  return { controller, record };
}

const EVENT = { ocppConnectionName: 'stationA', event: 'message' as const, message: '[2,"1","Heartbeat",{}]' };

describe('CitrineOsWebhookController', () => {
  it('accepts and records an event when the secret matches', async () => {
    const { controller, record } = makeController('correct-secret');

    const result = await controller.receiveEvent('correct-secret', EVENT);

    expect(result).toEqual({ status: 'ok' });
    expect(record).toHaveBeenCalledWith('tenant-1', EVENT);
  });

  it('rejects when the secret does not match', async () => {
    const { controller, record } = makeController('correct-secret');
    await expect(controller.receiveEvent('wrong-secret', EVENT)).rejects.toThrow(ForbiddenException);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects when no secret is presented at all', async () => {
    const { controller, record } = makeController('correct-secret');
    await expect(controller.receiveEvent(undefined, EVENT)).rejects.toThrow(ForbiddenException);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects when no webhook secret has been configured yet, even if the caller sends one', async () => {
    const { controller, record } = makeController(null);
    await expect(controller.receiveEvent('anything', EVENT)).rejects.toThrow(ForbiddenException);
    expect(record).not.toHaveBeenCalled();
  });

  it('rejects a secret of a different length without throwing an unhandled error', async () => {
    const { controller, record } = makeController('short');
    await expect(controller.receiveEvent('a-much-longer-guess', EVENT)).rejects.toThrow(ForbiddenException);
    expect(record).not.toHaveBeenCalled();
  });
});
