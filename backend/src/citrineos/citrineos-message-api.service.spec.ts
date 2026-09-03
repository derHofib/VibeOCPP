import { vi } from 'vitest';
import { CitrineOsMessageApiService } from './citrineos-message-api.service.js';
import type { CitrineOsHttpClient } from './citrineos-http-client.js';
import type { CitrineOsConfigService } from './citrineos-config.service.js';

const CONFIG = {
  dataApiUrl: 'http://citrineos.local:8080',
  messageApiUrl: 'http://citrineos.local:8080',
  citrineosTenantId: 1,
  ocppVersion: '2',
  webhookBaseUrl: '',
};

function makeDeps() {
  const request = vi.fn().mockResolvedValue([{ success: true }]);
  const http = { request } as unknown as CitrineOsHttpClient;
  const config = { getConfig: vi.fn().mockResolvedValue(CONFIG) } as unknown as CitrineOsConfigService;
  return { http, config, request };
}

describe('CitrineOsMessageApiService', () => {
  it('builds /ocpp/<version>/<prefix>/<action> with identifier repeated and tenantId', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsMessageApiService(http, config);

    const result = await service.sendCommand(
      'tenant-1',
      'evdriver',
      'requeststarttransaction',
      ['stationA', 'stationB'],
      { idToken: { idToken: 'abc', type: 'ISO14443' }, remoteStartId: 1 },
    );

    expect(result).toEqual([{ success: true }]);
    expect(request).toHaveBeenCalledWith(CONFIG.messageApiUrl, {
      method: 'POST',
      path: '/ocpp/2/evdriver/requeststarttransaction',
      query: { identifier: ['stationA', 'stationB'], tenantId: 1, callbackUrl: undefined },
      body: { idToken: { idToken: 'abc', type: 'ISO14443' }, remoteStartId: 1 },
    });
  });

  it('requestStartTransaction delegates to sendCommand with the evdriver prefix', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsMessageApiService(http, config);

    await service.requestStartTransaction('tenant-1', ['stationA'], {
      idToken: { idToken: 'abc', type: 'ISO14443' },
      remoteStartId: 1,
    });

    expect(request.mock.calls[0][1].path).toBe('/ocpp/2/evdriver/requeststarttransaction');
  });

  it('reset delegates to sendCommand with the configuration prefix', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsMessageApiService(http, config);

    await service.reset('tenant-1', ['stationA'], { type: 'Immediate' });

    expect(request.mock.calls[0][1].path).toBe('/ocpp/2/configuration/reset');
    expect(request.mock.calls[0][1].body).toEqual({ type: 'Immediate' });
  });

  it('passes a callbackUrl through when given', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsMessageApiService(http, config);

    await service.sendCommand(
      'tenant-1',
      'configuration',
      'triggermessage',
      ['stationA'],
      { requestedMessage: 'BootNotification' },
      'https://bff.example/callback',
    );

    expect(request.mock.calls[0][1].query.callbackUrl).toBe('https://bff.example/callback');
  });
});
