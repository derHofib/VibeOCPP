import { vi } from 'vitest';
import {
  buildStationParameters,
  copyToClipboard,
  resolveOcppBaseUrl,
  type ParameterConnector,
} from './station-parameters.js';

const CONNECTOR = (overrides: Partial<ParameterConnector>): ParameterConnector => ({
  id: 'c',
  label: 'Ladepunkt',
  evseId: 1,
  connectorId: 1,
  type: 'sType2',
  format: 'Cable',
  ...overrides,
});

describe('resolveOcppBaseUrl', () => {
  it('derives ws://<browsing host>:8081 when nothing is configured', () => {
    expect(resolveOcppBaseUrl(undefined, '192.168.2.200', '8081')).toBe('ws://192.168.2.200:8081');
  });

  it('prefers an explicit override and drops its trailing slash', () => {
    expect(resolveOcppBaseUrl('wss://csms.example.com:443/', '192.168.2.200', '8081')).toBe(
      'wss://csms.example.com:443',
    );
  });

  it('honours a custom port', () => {
    expect(resolveOcppBaseUrl(undefined, 'csms.local', '9081')).toBe('ws://csms.local:9081');
  });

  it('keeps an IPv6 literal bracketed', () => {
    expect(resolveOcppBaseUrl(undefined, '::1', '8081')).toBe('ws://[::1]:8081');
  });
});

describe('buildStationParameters', () => {
  it('builds the base url, the id and the full url a charger needs', () => {
    const params = buildStationParameters(
      { chargeboxId: 'cp001', ocppVersion: '2.0.1' },
      [],
      'ws://192.168.2.200:8081/',
    );

    expect(params.serverUrl).toBe('ws://192.168.2.200:8081');
    expect(params.chargePointId).toBe('cp001');
    expect(params.fullUrl).toBe('ws://192.168.2.200:8081/cp001');
  });

  it.each([
    ['1.6', 'ocpp1.6'],
    ['2.0.1', 'ocpp2.0.1'],
    ['2.1', 'ocpp2.1'],
  ])('maps OCPP %s to the %s websocket subprotocol', (version, subprotocol) => {
    const params = buildStationParameters({ chargeboxId: 'cp001', ocppVersion: version }, [], 'ws://h:8081');
    expect(params.subprotocol).toBe(subprotocol);
  });

  it('leaves version and subprotocol open when none was planned', () => {
    const params = buildStationParameters({ chargeboxId: 'cp001', ocppVersion: null }, [], 'ws://h:8081');
    expect(params.ocppVersion).toBeNull();
    expect(params.subprotocol).toBeNull();
  });

  it('reports security profile 0 while the listener is unauthenticated', () => {
    const params = buildStationParameters({ chargeboxId: 'cp001', ocppVersion: null }, [], 'ws://h:8081');
    expect(params.securityProfile).toBe(0);
  });

  it('orders connectors by EVSE, then connector id, without mutating the input', () => {
    const input = [
      CONNECTOR({ id: 'b', evseId: 2, connectorId: 1 }),
      CONNECTOR({ id: 'c', evseId: 1, connectorId: 2 }),
      CONNECTOR({ id: 'a', evseId: 1, connectorId: 1 }),
    ];
    const params = buildStationParameters({ chargeboxId: 'cp001', ocppVersion: null }, input, 'ws://h:8081');

    expect(params.connectors.map((c) => c.id)).toEqual(['a', 'c', 'b']);
    expect(input.map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('uses the async clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    await expect(copyToClipboard('ws://h:8081')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('ws://h:8081');
  });

  it('falls back to execCommand over plain http, where navigator.clipboard is undefined', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    await expect(copyToClipboard('cp001')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the async clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    document.execCommand = vi.fn().mockReturnValue(true);

    await expect(copyToClipboard('cp001')).resolves.toBe(true);
  });
});
