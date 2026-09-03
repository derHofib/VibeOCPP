import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service.js';

const CATEGORY = 'citrineos';

export interface CitrineOsConfig {
  dataApiUrl: string;
  messageApiUrl: string;
  // CitrineOS's own tenant concept — an integer, unrelated to and never to
  // be confused with our product's tenantId (a UUID). Defaults to 1, the
  // OCPP_CallAction default tenant CitrineOS itself uses out of the box.
  citrineosTenantId: number;
  // Path segment for Message API calls (e.g. "1.6" or "2").
  ocppVersion: string;
  // Our own publicly reachable base URL, so CitrineOS's Subscription
  // webhook and per-call callbackUrl have somewhere to reach us — see
  // docs/architecture-proposal.md §8.
  webhookBaseUrl: string;
}

// Reads the "CitrineOS-Verbindung" config area described in
// docs/architecture-proposal.md §5 from the settings store — never from
// process.env, per the "config out of .env" requirement. Deliberately not
// cached: this is a handful of small rows read from an indexed table, and a
// stale in-memory copy after a SuperAdmin edits the connection settings is
// a worse failure mode than one extra query per call.
@Injectable()
export class CitrineOsConfigService {
  constructor(private readonly settingsService: SettingsService) {}

  async getConfig(tenantId: string): Promise<CitrineOsConfig> {
    const settings = await this.settingsService.list(tenantId, CATEGORY);
    const byKey = new Map(settings.map((s) => [s.key, s]));

    const dataApiUrl = byKey.get('dataApiUrl')?.value;
    const messageApiUrl = byKey.get('messageApiUrl')?.value;
    if (!dataApiUrl || !messageApiUrl) {
      throw new InternalServerErrorException(
        'CitrineOS connection is not configured yet — set settings/citrineos/dataApiUrl ' +
          'and settings/citrineos/messageApiUrl first (SuperAdmin > CitrineOS-Verbindung).',
      );
    }

    const citrineosTenantId = Number(byKey.get('citrineosTenantId')?.value ?? '1');
    const ocppVersion = byKey.get('ocppVersion')?.value ?? '2';
    const webhookBaseUrl = byKey.get('webhookBaseUrl')?.value ?? '';

    return {
      dataApiUrl: dataApiUrl.replace(/\/+$/, ''),
      messageApiUrl: messageApiUrl.replace(/\/+$/, ''),
      citrineosTenantId,
      ocppVersion,
      webhookBaseUrl: webhookBaseUrl.replace(/\/+$/, ''),
    };
  }

  // The webhook secret is stored as a secret setting (encrypted at rest,
  // masked everywhere else) — getPlaintext is the one place allowed to see
  // it, same pattern as the payment integration's API keys will use later.
  async getWebhookSecret(tenantId: string): Promise<string | null> {
    return this.settingsService.getPlaintext(tenantId, CATEGORY, 'webhookSecret');
  }
}
