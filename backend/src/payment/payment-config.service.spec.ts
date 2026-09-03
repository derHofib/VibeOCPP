import { InternalServerErrorException } from '@nestjs/common';
import { PaymentConfigService } from './payment-config.service.js';
import type { SettingsService } from '../settings/settings.service.js';
import type { SettingView } from '../settings/settings.types.js';

function makeSettingsService(
  settings: Partial<SettingView>[],
  plaintext: string | null = 'postgresql://user:pass@localhost:5432/citrine',
): SettingsService {
  return {
    list: async () => settings as SettingView[],
    getPlaintext: async () => plaintext,
  } as unknown as SettingsService;
}

describe('PaymentConfigService', () => {
  it('throws a clear error when the payment DB is not configured yet', async () => {
    const service = new PaymentConfigService(makeSettingsService([]));
    await expect(service.getConfig('tenant-1')).rejects.toThrow(InternalServerErrorException);
    await expect(service.getConfig('tenant-1')).rejects.toThrow(/not configured/);
  });

  it('reads the databaseUrl and defaults tablePrefix to "payment_"', async () => {
    const service = new PaymentConfigService(
      makeSettingsService([{ key: 'databaseUrl', value: '••••5432/citrine', type: 'secret' }]),
    );
    const config = await service.getConfig('tenant-1');
    expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/citrine');
    expect(config.tablePrefix).toBe('payment_');
  });

  it('honors an overridden tablePrefix', async () => {
    const service = new PaymentConfigService(
      makeSettingsService([
        { key: 'databaseUrl', value: '••••', type: 'secret' },
        { key: 'tablePrefix', value: 'csms_payment_' },
      ]),
    );
    const config = await service.getConfig('tenant-1');
    expect(config.tablePrefix).toBe('csms_payment_');
  });

  it('reads the Stripe API key via getPlaintext', async () => {
    const service = new PaymentConfigService(makeSettingsService([], 'sk_live_abc'));
    await expect(service.getStripeApiKey('tenant-1')).resolves.toBe('sk_live_abc');
  });
});
