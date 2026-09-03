import { vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { OpsAgentClient } from './ops.service.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeConfigService(overrides: Record<string, string> = {}): ConfigService {
  const values: Record<string, string> = {
    OPS_AGENT_URL: 'http://ops-agent:3100',
    OPS_AGENT_SHARED_SECRET: 'test-secret',
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('OpsAgentClient', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends the shared secret header on every call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(200, []));
    const client = new OpsAgentClient(makeConfigService());

    await client.getAllStatus();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://ops-agent:3100/ops/status');
    expect((init as RequestInit).headers).toMatchObject({ 'x-ops-agent-secret': 'test-secret' });
  });

  it('URL-encodes the service name for status/logs/restart calls', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { service: 'backend', restarted: true }));
    const client = new OpsAgentClient(makeConfigService());

    await client.restart('backend');

    expect(fetchSpy.mock.calls[0][0]).toBe('http://ops-agent:3100/ops/restart/backend');
    expect((fetchSpy.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('passes the tail query parameter through to /ops/logs', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { service: 'backend', logs: '' }));
    const client = new OpsAgentClient(makeConfigService());

    await client.getLogs('backend', 50);

    expect(fetchSpy.mock.calls[0][0]).toBe('http://ops-agent:3100/ops/logs/backend?tail=50');
  });

  it('throws when ops-agent responds with a non-2xx status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(400, { error: 'Unknown service: nope' }));
    const client = new OpsAgentClient(makeConfigService());

    await expect(client.getStatus('nope')).rejects.toThrow(/Unknown service: nope/);
  });

  it('throws when OPS_AGENT_SHARED_SECRET is not configured', async () => {
    const client = new OpsAgentClient(makeConfigService({ OPS_AGENT_SHARED_SECRET: '' }));

    await expect(client.getAllStatus()).rejects.toThrow(/OPS_AGENT_SHARED_SECRET/);
  });
});
