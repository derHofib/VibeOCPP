import { vi } from 'vitest';
import { CitrineOsDataApiService } from './citrineos-data-api.service.js';
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
  const request = vi.fn().mockResolvedValue({ ok: true });
  const http = { request } as unknown as CitrineOsHttpClient;
  const config = { getConfig: vi.fn().mockResolvedValue(CONFIG) } as unknown as CitrineOsConfigService;
  return { http, config, request };
}

describe('CitrineOsDataApiService', () => {
  it('builds /data/<prefix>/<namespace> and forwards query/body', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsDataApiService(http, config);

    await service.request('tenant-1', 'PUT', 'monitoring', 'variableattributetype', {
      query: { setOnCharger: true },
      body: { name: 'x' },
    });

    expect(request).toHaveBeenCalledWith(CONFIG.dataApiUrl, {
      method: 'PUT',
      path: '/data/monitoring/variableattributetype',
      query: { setOnCharger: true },
      body: { name: 'x' },
    });
  });

  it('creates a subscription with the CitrineOS tenantId as a query param', async () => {
    const { http, config, request } = makeDeps();
    request.mockResolvedValueOnce(42);
    const service = new CitrineOsDataApiService(http, config);

    const id = await service.createSubscription('tenant-1', {
      ocppConnectionName: 'stationA',
      onMessage: true,
      url: 'https://bff.example/hook',
    });

    expect(id).toBe(42);
    expect(request).toHaveBeenCalledWith(CONFIG.dataApiUrl, {
      method: 'POST',
      path: '/data/ocpprouter/subscription',
      query: { tenantId: 1 },
      body: { ocppConnectionName: 'stationA', onMessage: true, url: 'https://bff.example/hook' },
    });
  });

  it('lists subscriptions filtered by station', async () => {
    const { http, config, request } = makeDeps();
    request.mockResolvedValueOnce([{ id: 1 }]);
    const service = new CitrineOsDataApiService(http, config);

    const result = await service.listSubscriptions('tenant-1', 'stationA');

    expect(result).toEqual([{ id: 1 }]);
    expect(request).toHaveBeenCalledWith(CONFIG.dataApiUrl, {
      method: 'GET',
      path: '/data/ocpprouter/subscription',
      query: { tenantId: 1, ocppConnectionName: 'stationA' },
      body: undefined,
    });
  });

  it('pings the systemconfig endpoint for a connectivity check', async () => {
    const { http, config, request } = makeDeps();
    const service = new CitrineOsDataApiService(http, config);

    await service.ping('tenant-1');

    expect(request).toHaveBeenCalledWith(CONFIG.dataApiUrl, {
      method: 'GET',
      path: '/data/ocpprouter/systemconfig',
      query: undefined,
      body: undefined,
    });
  });
});
