import { Injectable } from '@nestjs/common';
import { CitrineOsHttpClient, type QueryValue } from './citrineos-http-client.js';
import { CitrineOsConfigService } from './citrineos-config.service.js';

export interface CitrineOsSubscriptionCreate {
  ocppConnectionName: string;
  onConnect?: boolean;
  onClose?: boolean;
  onMessage?: boolean;
  sentMessage?: boolean;
  messageRegexFilter?: string;
  url: string;
}

export interface CitrineOsSubscription extends CitrineOsSubscriptionCreate {
  id: number;
  tenantId: number;
}

// Generic client for CitrineOS's REST Data API (`/data/<prefix>/<namespace>`
// — see AbstractModule._toDataPath in citrineos-core), plus the handful of
// concrete endpoints this increment actually needs. Extend with more
// convenience methods as later increments need them rather than trying to
// cover every Data API namespace up front.
@Injectable()
export class CitrineOsDataApiService {
  constructor(
    private readonly http: CitrineOsHttpClient,
    private readonly config: CitrineOsConfigService,
  ) {}

  async request<T>(
    productTenantId: string,
    method: 'GET' | 'PUT' | 'POST' | 'DELETE',
    prefix: string,
    namespace: string,
    options: { query?: Record<string, QueryValue>; body?: unknown } = {},
  ): Promise<T> {
    const cfg = await this.config.getConfig(productTenantId);
    return this.http.request<T>(cfg.dataApiUrl, {
      method,
      path: `/data/${prefix}/${namespace}`,
      query: options.query,
      body: options.body,
    });
  }

  async listSubscriptions(
    productTenantId: string,
    ocppConnectionName: string,
  ): Promise<CitrineOsSubscription[]> {
    const cfg = await this.config.getConfig(productTenantId);
    return this.request<CitrineOsSubscription[]>(productTenantId, 'GET', 'ocpprouter', 'subscription', {
      query: { tenantId: cfg.citrineosTenantId, ocppConnectionName },
    });
  }

  async createSubscription(
    productTenantId: string,
    dto: CitrineOsSubscriptionCreate,
  ): Promise<number> {
    const cfg = await this.config.getConfig(productTenantId);
    return this.request<number>(productTenantId, 'POST', 'ocpprouter', 'subscription', {
      query: { tenantId: cfg.citrineosTenantId },
      body: dto,
    });
  }

  async deleteSubscription(productTenantId: string, id: number): Promise<boolean> {
    const cfg = await this.config.getConfig(productTenantId);
    return this.request<boolean>(productTenantId, 'DELETE', 'ocpprouter', 'subscription', {
      query: { tenantId: cfg.citrineosTenantId, id },
    });
  }

  // GET /data/<prefix>/systemconfig is exposed by every module with data
  // endpoints (AbstractModule.registerSystemConfigRoutes) — cheap, always
  // present, so it doubles as a connectivity check ("Verbindung testen").
  async ping(productTenantId: string): Promise<void> {
    await this.request(productTenantId, 'GET', 'ocpprouter', 'systemconfig');
  }
}
