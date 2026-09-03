import { BadRequestException, Injectable } from '@nestjs/common';
import { CitrineOsDataApiService } from './citrineos-data-api.service.js';
import { CitrineOsConfigService } from './citrineos-config.service.js';

// Ensures our webhook is registered for a station without creating
// duplicate rows on repeated calls — CitrineOS's Subscription API is a bare
// create/list/delete with no upsert of its own (see
// AdminApi.postSubscription in citrineos-core), so idempotency has to be
// built here: list first, skip if a matching subscription already exists.
@Injectable()
export class CitrineOsSubscriptionService {
  constructor(
    private readonly dataApi: CitrineOsDataApiService,
    private readonly config: CitrineOsConfigService,
  ) {}

  async ensureSubscribed(productTenantId: string, ocppConnectionName: string): Promise<number> {
    const cfg = await this.config.getConfig(productTenantId);
    if (!cfg.webhookBaseUrl) {
      throw new BadRequestException(
        'settings/citrineos/webhookBaseUrl is not configured — CitrineOS needs a reachable ' +
          'URL to call back into for subscriptions.',
      );
    }
    const secret = await this.getRequiredSecret(productTenantId);
    const url = `${cfg.webhookBaseUrl}/citrineos/webhooks/events?secret=${encodeURIComponent(secret)}`;

    const existing = await this.dataApi.listSubscriptions(productTenantId, ocppConnectionName);
    const match = existing.find((s) => s.url === url && s.onMessage && s.onConnect && s.onClose);
    if (match) return match.id;

    return this.dataApi.createSubscription(productTenantId, {
      ocppConnectionName,
      onConnect: true,
      onClose: true,
      onMessage: true,
      url,
    });
  }

  private async getRequiredSecret(productTenantId: string): Promise<string> {
    const secret = await this.config.getWebhookSecret(productTenantId);
    if (!secret) {
      throw new BadRequestException(
        'settings/citrineos/webhookSecret is not configured — generate one before ' +
          'registering subscriptions.',
      );
    }
    return secret;
  }
}
