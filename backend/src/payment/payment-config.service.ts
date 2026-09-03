import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

const CATEGORY = 'payment';

export interface PaymentConfig {
  // Connection string to CitrineOS's own Postgres database — NOT our
  // product DB. See docs/architecture-proposal.md §4: citrineos-payment
  // has no admin API for Operators/Locations/Evses/Connectors/Tariffs, so
  // this is the one deliberate exception to "the BFF never touches
  // CitrineOS's database directly" — writing into citrineos-payment's own
  // payment_* tables (its own schema, not CitrineOS-core's) is the only
  // way to manage those entities without patching citrineos-payment.
  databaseUrl: string;
  // Configurable because citrineos-payment's DB_TABLE_PREFIX env var is —
  // defaults to "payment_", matching citrineos-payment's own default.
  tablePrefix: string;
}

@Injectable()
export class PaymentConfigService {
  constructor(private readonly settingsService: SettingsService) {}

  async getConfig(tenantId: string): Promise<PaymentConfig> {
    const settings = await this.settingsService.list(tenantId, CATEGORY);
    const byKey = new Map(settings.map((s) => [s.key, s]));

    if (!byKey.has('databaseUrl')) {
      throw new InternalServerErrorException(
        'Payment integration is not configured yet — set settings/payment/databaseUrl first ' +
          '(SuperAdmin > Stripe/Payment). It must point at the same Postgres database as the ' +
          'citrineos-payment container.',
      );
    }

    const databaseUrl = await this.settingsService.getPlaintext(tenantId, CATEGORY, 'databaseUrl');
    if (!databaseUrl) {
      throw new InternalServerErrorException('settings/payment/databaseUrl is set but empty.');
    }

    const tablePrefix = byKey.get('tablePrefix')?.value || 'payment_';

    return { databaseUrl, tablePrefix };
  }

  getStripeApiKey(tenantId: string): Promise<string | null> {
    return this.settingsService.getPlaintext(tenantId, CATEGORY, 'stripeApiKey');
  }
}
