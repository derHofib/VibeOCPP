import { InternalServerErrorException } from '@nestjs/common';
import { CitrineOsConfigService } from './citrineos-config.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { SettingView } from '../settings/settings.types.js';

function makeSettingsService(settings: Partial<SettingView>[]): SettingsService {
  return {
    list: async () => settings as SettingView[],
    getPlaintext: async () => null,
  } as unknown as SettingsService;
}

describe('CitrineOsConfigService', () => {
  it('throws a clear error when the connection has not been configured yet', async () => {
    const service = new CitrineOsConfigService(makeSettingsService([]));
    await expect(service.getConfig('tenant-1')).rejects.toThrow(InternalServerErrorException);
    await expect(service.getConfig('tenant-1')).rejects.toThrow(/not configured/);
  });

  it('reads the configured URLs and applies defaults for the rest', async () => {
    const service = new CitrineOsConfigService(
      makeSettingsService([
        { key: 'dataApiUrl', value: 'http://citrineos:8080/' },
        { key: 'messageApiUrl', value: 'http://citrineos:8080/' },
      ]),
    );

    const config = await service.getConfig('tenant-1');
    expect(config.dataApiUrl).toBe('http://citrineos:8080'); // trailing slash stripped
    expect(config.messageApiUrl).toBe('http://citrineos:8080');
    expect(config.citrineosTenantId).toBe(1); // CitrineOS's own DEFAULT_TENANT_ID
    expect(config.ocppVersion).toBe('2');
    expect(config.webhookBaseUrl).toBe('');
  });

  it('parses an overridden citrineosTenantId and ocppVersion', async () => {
    const service = new CitrineOsConfigService(
      makeSettingsService([
        { key: 'dataApiUrl', value: 'http://citrineos:8080' },
        { key: 'messageApiUrl', value: 'http://citrineos:8080' },
        { key: 'citrineosTenantId', value: '3' },
        { key: 'ocppVersion', value: '1.6' },
        { key: 'webhookBaseUrl', value: 'https://csms.example.com/' },
      ]),
    );

    const config = await service.getConfig('tenant-1');
    expect(config.citrineosTenantId).toBe(3);
    expect(config.ocppVersion).toBe('1.6');
    expect(config.webhookBaseUrl).toBe('https://csms.example.com');
  });
});
