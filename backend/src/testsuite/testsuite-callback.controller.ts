import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CitrineOsConfigService } from '../citrineos/citrineos-config.service.js';

function secretsMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// An OCPP CallError, once routed through CitrineOS's webhook dispatcher, is
// exactly OcppError.asOcppError() — {messageId, errorCode, errorDescription,
// errorDetails} (see message.ts in citrineos-core). A CallResult payload is
// the OCPP response object itself and never carries both of these two
// fields together, so their presence is a reliable discriminator without
// needing CitrineOS to tell us which one it sent.
function isOcppError(payload: unknown): payload is { errorCode: string; errorDescription: string } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    typeof (payload as any).errorCode === 'string' &&
    typeof (payload as any).errorDescription === 'string'
  );
}

// Receives the per-step callbackUrl CitrineOS calls back to with the raw
// response to exactly the one command a testsuite 'command' step sent
// (see testsuite-step-executor.service.ts) — this is more precise than the
// Subscription webhook's action-name matching, since CitrineOS keys the
// callback by the OCPP message's own correlationId (confirmed by reading
// router.ts's _routeCallResult/_routeCallError in citrineos-core).
@Controller('citrineos/webhooks/callback')
export class TestSuiteCallbackController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: CitrineOsConfigService,
  ) {}

  @Post(':stepId')
  @HttpCode(HttpStatus.OK)
  async receiveCallback(
    @Param('stepId') stepId: string,
    @Query('secret') secret: string | undefined,
    @Body() payload: unknown,
  ) {
    const step = await this.prisma.testSuiteStep.findUnique({
      where: { id: stepId },
      include: { run: true },
    });
    if (!step) throw new NotFoundException('Unknown testsuite step');

    const expected = await this.configService.getWebhookSecret(step.run.tenantId);
    if (!expected || !secret || !secretsMatch(secret, expected)) {
      throw new ForbiddenException('Invalid or missing webhook secret');
    }

    // A late or duplicate callback for a step we already finished (e.g. the
    // station retried) must not overwrite a result the executor has moved
    // past — only apply this while the step is genuinely still running.
    if (step.status !== 'running') {
      return { status: 'ignored' };
    }

    const failed = isOcppError(payload);
    const finishedAt = new Date();
    await this.prisma.testSuiteStep.update({
      where: { id: stepId },
      data: {
        status: failed ? 'fail' : 'pass',
        responsePayload: payload as object,
        errorMessage: failed
          ? `${(payload as { errorCode: string }).errorCode}: ${(payload as { errorDescription: string }).errorDescription}`
          : null,
        finishedAt,
        durationMs: step.startedAt ? finishedAt.getTime() - step.startedAt.getTime() : null,
      },
    });

    return { status: 'ok' };
  }
}
