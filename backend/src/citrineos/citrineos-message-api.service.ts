import { Injectable } from '@nestjs/common';
import { CitrineOsHttpClient } from './citrineos-http-client.js';
import { CitrineOsConfigService } from './citrineos-config.service.js';

export interface CitrineOsMessageConfirmation {
  success: boolean;
  payload?: string | object;
}

// Generic client for CitrineOS's REST Message API
// (`/ocpp/<version>/<prefix>/<action>` — see AbstractModule._toMessagePath).
// A call here only confirms the command was accepted for delivery
// (IMessageConfirmation), not that the station executed it — the actual
// OCPP response arrives asynchronously via the Subscription webhook (see
// CitrineOsWebhookController) or a per-call callbackUrl, matched by station
// identifier and timing, not by any id this call returns.
@Injectable()
export class CitrineOsMessageApiService {
  constructor(
    private readonly http: CitrineOsHttpClient,
    private readonly config: CitrineOsConfigService,
  ) {}

  async sendCommand(
    productTenantId: string,
    prefix: string,
    action: string,
    identifiers: string[],
    body: unknown,
    callbackUrl?: string,
  ): Promise<CitrineOsMessageConfirmation[]> {
    const cfg = await this.config.getConfig(productTenantId);
    return this.http.request<CitrineOsMessageConfirmation[]>(cfg.messageApiUrl, {
      method: 'POST',
      path: `/ocpp/${cfg.ocppVersion}/${prefix}/${action}`,
      query: { identifier: identifiers, tenantId: cfg.citrineosTenantId, callbackUrl },
      body,
    });
  }

  requestStartTransaction(
    productTenantId: string,
    stationIdentifiers: string[],
    request: Record<string, unknown>,
    callbackUrl?: string,
  ) {
    return this.sendCommand(
      productTenantId,
      'evdriver',
      'requeststarttransaction',
      stationIdentifiers,
      request,
      callbackUrl,
    );
  }

  requestStopTransaction(
    productTenantId: string,
    stationIdentifiers: string[],
    request: { transactionId: string },
    callbackUrl?: string,
  ) {
    return this.sendCommand(
      productTenantId,
      'evdriver',
      'requeststoptransaction',
      stationIdentifiers,
      request,
      callbackUrl,
    );
  }

  reset(
    productTenantId: string,
    stationIdentifiers: string[],
    request: { type: 'Immediate' | 'OnIdle' | 'ImmediateAndResume' },
    callbackUrl?: string,
  ) {
    return this.sendCommand(
      productTenantId,
      'configuration',
      'reset',
      stationIdentifiers,
      request,
      callbackUrl,
    );
  }

  triggerMessage(
    productTenantId: string,
    stationIdentifiers: string[],
    request: { requestedMessage: string; evse?: { id: number } },
  ) {
    return this.sendCommand(
      productTenantId,
      'configuration',
      'triggermessage',
      stationIdentifiers,
      request,
    );
  }

  getVariables(
    productTenantId: string,
    stationIdentifiers: string[],
    request: {
      getVariableData: { component: { name: string }; variable: { name: string } }[];
    },
    callbackUrl?: string,
  ) {
    return this.sendCommand(
      productTenantId,
      'monitoring',
      'getvariables',
      stationIdentifiers,
      request,
      callbackUrl,
    );
  }

  dataTransfer(
    productTenantId: string,
    stationIdentifiers: string[],
    request: { vendorId: string; messageId?: string; data?: unknown },
    callbackUrl?: string,
  ) {
    return this.sendCommand(
      productTenantId,
      'configuration',
      'datatransfer',
      stationIdentifiers,
      request,
      callbackUrl,
    );
  }
}
