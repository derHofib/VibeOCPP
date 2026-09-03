import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CitrineOsMessageApiService } from '../citrineos/citrineos-message-api.service.js';
import { CitrineOsConfigService } from '../citrineos/citrineos-config.service.js';
import { MessageLogWaiter } from './message-log-waiter.service.js';
import { pollUntil } from './poll-until.js';
import type { TestSuiteStepDefinition } from './testsuite-step-catalog.js';
import type { TestSuiteRunParams } from './testsuite-run-params.js';
import type { TestSuiteRun, TestSuiteStep } from '../generated/prisma/index.js';

const COMMAND_POLL_INTERVAL_MS = 1000;

// Runs exactly one testsuite step and writes its result. See
// testsuite-step-catalog.ts for what 'trigger' / 'command' / 'observe' mean
// and testsuite-callback.controller.ts for how a 'command' step's response
// gets back to us.
@Injectable()
export class TestSuiteStepExecutor {
  private readonly logger = new Logger(TestSuiteStepExecutor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messageApi: CitrineOsMessageApiService,
    private readonly configService: CitrineOsConfigService,
    private readonly waiter: MessageLogWaiter,
  ) {}

  async execute(
    run: TestSuiteRun,
    step: TestSuiteStep,
    definition: TestSuiteStepDefinition,
    params: TestSuiteRunParams,
  ): Promise<void> {
    const startedAt = new Date();
    try {
      if (definition.kind === 'trigger') {
        await this.runTriggerOrObserve(run, step, definition, startedAt, true);
      } else if (definition.kind === 'observe') {
        await this.runTriggerOrObserve(run, step, definition, startedAt, false);
      } else {
        await this.runCommand(run, step, definition, params, startedAt);
      }
    } catch (error) {
      this.logger.error(`Step ${step.id} (${step.action}) failed unexpectedly`, error as Error);
      await this.finish(step.id, {
        status: 'fail',
        errorMessage: `Unexpected error: ${(error as Error).message}`,
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      });
    }
  }

  private async runTriggerOrObserve(
    run: TestSuiteRun,
    step: TestSuiteStep,
    definition: TestSuiteStepDefinition,
    startedAt: Date,
    sendTrigger: boolean,
  ): Promise<void> {
    if (sendTrigger) {
      const confirmations = await this.messageApi.triggerMessage(run.tenantId, [run.ocppConnectionName], {
        requestedMessage: definition.requestedMessage!,
      });
      await this.markRunning(step.id, startedAt, { requestedMessage: definition.requestedMessage });
      if (confirmations.some((c) => !c.success)) {
        await this.finish(step.id, {
          status: 'fail',
          errorMessage: 'CitrineOS could not deliver the TriggerMessage request (station likely offline).',
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt.getTime(),
        });
        return;
      }
    } else {
      await this.markRunning(step.id, startedAt, null);
    }

    const match = await this.waiter.waitForMessage(
      run.tenantId,
      { ocppConnectionName: run.ocppConnectionName, action: definition.action, origin: 'ChargingStation' },
      startedAt,
      definition.timeoutMs,
    );

    const finishedAt = new Date();
    if (match) {
      await this.finish(step.id, {
        status: 'pass',
        responsePayload: { info: match.info, rawMessage: match.rawMessage },
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
    } else {
      await this.finish(step.id, {
        status: 'timeout',
        errorMessage: definition.note ?? `No ${definition.action} observed within the timeout.`,
        finishedAt,
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
    }
  }

  private async runCommand(
    run: TestSuiteRun,
    step: TestSuiteStep,
    definition: TestSuiteStepDefinition,
    params: TestSuiteRunParams,
    startedAt: Date,
  ): Promise<void> {
    const built = this.buildCommandRequest(run, definition.action, params);
    if (!built) {
      await this.finish(step.id, {
        status: 'skipped',
        errorMessage: definition.note ?? 'Required run parameters were not provided.',
        finishedAt: new Date(),
      });
      return;
    }

    const cfg = await this.configService.getConfig(run.tenantId);
    const secret = await this.configService.getWebhookSecret(run.tenantId);
    if (!cfg.webhookBaseUrl || !secret) {
      await this.finish(step.id, {
        status: 'fail',
        errorMessage:
          'settings/citrineos/webhookBaseUrl and webhookSecret must be configured to correlate command responses.',
        finishedAt: new Date(),
      });
      return;
    }

    await this.markRunning(step.id, startedAt, built.body);
    const callbackUrl = `${cfg.webhookBaseUrl}/citrineos/webhooks/callback/${step.id}?secret=${encodeURIComponent(secret)}`;
    const confirmations = await built.send(callbackUrl);

    if (confirmations.some((c) => !c.success)) {
      await this.finish(step.id, {
        status: 'fail',
        errorMessage: 'CitrineOS could not deliver the command (station likely offline).',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      });
      return;
    }

    // The callback controller resolves the step out-of-band; poll our own
    // row rather than holding an in-memory wait, so this survives the
    // executor's process handling other steps/runs in the meantime.
    const resolved = await pollUntil(
      async () => {
        const current = await this.prisma.testSuiteStep.findUnique({ where: { id: step.id } });
        return current && current.status !== 'running' ? current : null;
      },
      definition.timeoutMs,
      COMMAND_POLL_INTERVAL_MS,
    );

    if (!resolved) {
      await this.finish(step.id, {
        status: 'timeout',
        errorMessage: 'CitrineOS accepted the command but no response callback arrived within the timeout.',
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
      });
    }
    // If resolved, the callback controller already wrote the final result.
  }

  private buildCommandRequest(
    run: TestSuiteRun,
    action: string,
    params: TestSuiteRunParams,
  ): { body: unknown; send: (callbackUrl: string) => Promise<{ success: boolean }[]> } | null {
    const identifiers = [run.ocppConnectionName];

    switch (action) {
      case 'RemoteStart': {
        if (!params.idToken || params.remoteStartId === undefined) return null;
        const body = { idToken: params.idToken, remoteStartId: params.remoteStartId, evseId: params.evseId };
        return {
          body,
          send: (callbackUrl) =>
            this.messageApi.requestStartTransaction(run.tenantId, identifiers, body, callbackUrl),
        };
      }
      case 'RemoteStop': {
        if (!params.transactionId) return null;
        const body = { transactionId: params.transactionId };
        return {
          body,
          send: (callbackUrl) =>
            this.messageApi.requestStopTransaction(run.tenantId, identifiers, body, callbackUrl),
        };
      }
      case 'Reset': {
        const body = { type: params.resetType ?? ('OnIdle' as const) };
        return {
          body,
          send: (callbackUrl) => this.messageApi.reset(run.tenantId, identifiers, body, callbackUrl),
        };
      }
      case 'GetVariables': {
        if (!params.componentName || !params.variableName) return null;
        const body = {
          getVariableData: [
            { component: { name: params.componentName }, variable: { name: params.variableName } },
          ],
        };
        return {
          body,
          send: (callbackUrl) => this.messageApi.getVariables(run.tenantId, identifiers, body, callbackUrl),
        };
      }
      case 'DataTransfer': {
        if (!params.vendorId) return null;
        const body = { vendorId: params.vendorId };
        return {
          body,
          send: (callbackUrl) =>
            this.messageApi.dataTransfer(run.tenantId, identifiers, body, callbackUrl),
        };
      }
      default:
        return null;
    }
  }

  private async markRunning(stepId: string, startedAt: Date, requestPayload: unknown) {
    await this.prisma.testSuiteStep.update({
      where: { id: stepId },
      data: { status: 'running', startedAt, requestPayload: requestPayload as object | undefined },
    });
  }

  private async finish(
    stepId: string,
    data: {
      status: 'pass' | 'fail' | 'timeout' | 'skipped';
      responsePayload?: unknown;
      errorMessage?: string;
      finishedAt: Date;
      durationMs?: number;
    },
  ) {
    await this.prisma.testSuiteStep.update({
      where: { id: stepId },
      data: {
        status: data.status,
        responsePayload: data.responsePayload as object | undefined,
        errorMessage: data.errorMessage,
        finishedAt: data.finishedAt,
        durationMs: data.durationMs,
      },
    });
  }
}
