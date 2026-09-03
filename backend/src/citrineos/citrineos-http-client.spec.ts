import { vi } from 'vitest';
import { CitrineOsHttpClient } from './citrineos-http-client.js';
import { CitrineOsApiError } from './citrineos-api.error.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CitrineOsHttpClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the URL with repeated query params for array values', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = new CitrineOsHttpClient();

    await client.request('http://citrineos.local:8080', {
      method: 'GET',
      path: '/ocpp/2/evdriver/requeststarttransaction',
      query: { identifier: ['stationA', 'stationB'], tenantId: 1, callbackUrl: undefined },
    });

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.origin + calledUrl.pathname).toBe(
      'http://citrineos.local:8080/ocpp/2/evdriver/requeststarttransaction',
    );
    expect(calledUrl.searchParams.getAll('identifier')).toEqual(['stationA', 'stationB']);
    expect(calledUrl.searchParams.get('tenantId')).toBe('1');
    expect(calledUrl.searchParams.has('callbackUrl')).toBe(false);
  });

  it('sends a JSON body and Content-Type header for a POST', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(201, [{ success: true }]));
    const client = new CitrineOsHttpClient();

    const result = await client.request('http://citrineos.local:8080', {
      method: 'POST',
      path: '/data/ocpprouter/subscription',
      body: { ocppConnectionName: 'stationA', onMessage: true, url: 'https://example/hook' },
    });

    expect(result).toEqual([{ success: true }]);
    const init = fetchSpy.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      ocppConnectionName: 'stationA',
      onMessage: true,
      url: 'https://example/hook',
    });
  });

  it('throws a CitrineOsApiError with status and body for a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { message: 'FormatViolation' }));
    const client = new CitrineOsHttpClient();

    await expect(
      client.request('http://citrineos.local:8080', { method: 'GET', path: '/data/x/y' }),
    ).rejects.toMatchObject({
      name: 'CitrineOsApiError',
      status: 400,
      body: { message: 'FormatViolation' },
    });
  });

  it('does not retry on an HTTP error response, only calls fetch once', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, { message: 'boom' }));
    const client = new CitrineOsHttpClient();

    await expect(
      client.request('http://citrineos.local:8080', { method: 'GET', path: '/data/x/y' }),
    ).rejects.toThrow(CitrineOsApiError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries exactly once on a network-level failure, then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = new CitrineOsHttpClient();

    const result = await client.request('http://citrineos.local:8080', { method: 'GET', path: '/data/x/y' });

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('propagates the error if the network-level failure persists after the retry', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    const client = new CitrineOsHttpClient();

    await expect(
      client.request('http://citrineos.local:8080', { method: 'GET', path: '/data/x/y' }),
    ).rejects.toThrow('fetch failed');
  });
});
