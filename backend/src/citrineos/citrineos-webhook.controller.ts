import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import { CitrineOsConfigService } from './citrineos-config.service.js';
import { TenantsService } from '../tenants/tenants.service.js';
import { IncomingWebhookEventDto } from './dto/incoming-webhook-event.dto.js';
import { StationReconciliationService } from '../locations/station-reconciliation.service.js';

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on length mismatch rather than returning false —
  // compare against a same-length buffer first so a wrong-length guess
  // can't short-circuit before the constant-time comparison runs.
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Receives CitrineOS's Subscription webhook (see webhook.dispatcher.ts in
// citrineos-core) and per-call callbackUrl deliveries. CitrineOS signs
// neither — the shared secret in the URL we registered is the only
// authentication, so it is checked here on every request rather than
// relying on network-level trust.
//
// No JwtAuthGuard here: the caller is CitrineOS, not one of our logged-in
// users.
@Controller('citrineos/webhooks')
export class CitrineOsWebhookController {
  constructor(
    private readonly messageLogService: CitrineOsMessageLogService,
    private readonly configService: CitrineOsConfigService,
    private readonly tenantsService: TenantsService,
    private readonly reconciliation: StationReconciliationService,
  ) {}

  @Post('events')
  @HttpCode(HttpStatus.OK)
  async receiveEvent(@Query('secret') secret: string | undefined, @Body() dto: IncomingWebhookEventDto) {
    const tenant = await this.tenantsService.getDefaultTenant();
    const expected = await this.configService.getWebhookSecret(tenant.id);
    if (!expected || !secret || !secretsMatch(secret, expected)) {
      throw new ForbiddenException('Invalid or missing webhook secret');
    }

    await this.messageLogService.record(tenant.id, dto);

    // A BootNotification is the one message that reliably means "this
    // chargeboxId is live right now" — everything else (StatusNotification,
    // Heartbeat, ...) presupposes a station CitrineOS already accepted.
    if (dto.info?.action === 'BootNotification') {
      await this.reconciliation.reconcileIncomingConnection(tenant.id, dto.ocppConnectionName);
    }

    return { status: 'ok' };
  }
}
