import { vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CitrineOsSubscriptionService } from './citrineos-subscription.service.js';
import type { CitrineOsDataApiService } from './citrineos-data-api.service.js';
import type { CitrineOsConfigService } from './citrineos-config.service.js';

const CONFIG = {
  dataApiUrl: 'http://citrineos.local:8080',
  messageApiUrl: 'http://citrineos.local:8080',
  citrineosTenantId: 1,
  ocppVersion: '2',
  webhookBaseUrl: 'https://bff.example',
};

function makeDeps(existingSubscriptions: any[] = []) {
  const listSubscriptions = vi.fn().mockResolvedValue(existingSubscriptions);
  const createSubscription = vi.fn().mockResolvedValue(99);
  const dataApi = { listSubscriptions, createSubscription } as unknown as CitrineOsDataApiService;
  const config = {
    getConfig: vi.fn().mockResolvedValue(CONFIG),
    getWebhookSecret: vi.fn().mockResolvedValue('s3cret'),
  } as unknown as CitrineOsConfigService;
  return { dataApi, config, listSubscriptions, createSubscription };
}

describe('CitrineOsSubscriptionService', () => {
  it('creates a new subscription when none matching exists', async () => {
    const { dataApi, config, createSubscription } = makeDeps([]);
    const service = new CitrineOsSubscriptionService(dataApi, config);

    const id = await service.ensureSubscribed('tenant-1', 'stationA');

    expect(id).toBe(99);
    expect(createSubscription).toHaveBeenCalledWith('tenant-1', {
      ocppConnectionName: 'stationA',
      onConnect: true,
      onClose: true,
      onMessage: true,
      url: 'https://bff.example/citrineos/webhooks/events?secret=s3cret',
    });
  });

  it('does not create a duplicate when a matching subscription already exists', async () => {
    const { dataApi, config, createSubscription } = makeDeps([
      {
        id: 7,
        ocppConnectionName: 'stationA',
        onConnect: true,
        onClose: true,
        onMessage: true,
        url: 'https://bff.example/citrineos/webhooks/events?secret=s3cret',
      },
    ]);
    const service = new CitrineOsSubscriptionService(dataApi, config);

    const id = await service.ensureSubscribed('tenant-1', 'stationA');

    expect(id).toBe(7);
    expect(createSubscription).not.toHaveBeenCalled();
  });

  it('creates a new subscription when an existing one does not cover all three events', async () => {
    const { dataApi, config, createSubscription } = makeDeps([
      {
        id: 7,
        ocppConnectionName: 'stationA',
        onConnect: true,
        onClose: false, // does not match — must create a covering one
        onMessage: true,
        url: 'https://bff.example/citrineos/webhooks/events?secret=s3cret',
      },
    ]);
    const service = new CitrineOsSubscriptionService(dataApi, config);

    await service.ensureSubscribed('tenant-1', 'stationA');
    expect(createSubscription).toHaveBeenCalledTimes(1);
  });

  it('rejects when webhookBaseUrl is not configured', async () => {
    const { dataApi, config } = makeDeps([]);
    (config.getConfig as any).mockResolvedValue({ ...CONFIG, webhookBaseUrl: '' });
    const service = new CitrineOsSubscriptionService(dataApi, config);

    await expect(service.ensureSubscribed('tenant-1', 'stationA')).rejects.toThrow(BadRequestException);
  });

  it('rejects when no webhook secret has been generated yet', async () => {
    const { dataApi, config } = makeDeps([]);
    (config.getWebhookSecret as any).mockResolvedValue(null);
    const service = new CitrineOsSubscriptionService(dataApi, config);

    await expect(service.ensureSubscribed('tenant-1', 'stationA')).rejects.toThrow(BadRequestException);
  });
});
