import { vi } from 'vitest';
import { TestSuiteStepExecutor } from './testsuite-step-executor.service.js';
import { MessageLogWaiter } from './message-log-waiter.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CitrineOsMessageApiService } from '../citrineos/citrineos-message-api.service.js';
import type { CitrineOsConfigService } from '../citrineos/citrineos-config.service.js';
import type { TestSuiteStepDefinition } from './testsuite-step-catalog.js';

const RUN = { id: 'run-1', tenantId: 'tenant-1', ocppConnectionName: 'stationA' } as any;
const CONFIG = {
  dataApiUrl: 'http://x',
  messageApiUrl: 'http://x',
  citrineosTenantId: 1,
  ocppVersion: '2',
  webhookBaseUrl: 'https://bff.example',
};

function makeExecutor(overrides: {
  triggerMessage?: any;
  requestStartTransaction?: any;
  reset?: any;
  waiterResult?: unknown;
  stepStatusSequence?: string[];
}) {
  const updateCalls: any[] = [];
  const prisma = {
    testSuiteStep: {
      update: vi.fn((args: any) => {
        updateCalls.push(args);
        return Promise.resolve(undefined);
      }),
      findUnique: vi.fn(() => {
        // Undefined means the sequence array is exhausted — default to
        // 'running' (never resolves), not 'pass', so a test that never
        // provides a final status correctly exercises the timeout path.
        const status = overrides.stepStatusSequence?.shift() ?? 'running';
        return Promise.resolve(status === 'running' ? { status: 'running' } : { id: 'step-1', status });
      }),
    },
  } as unknown as PrismaService;

  const messageApi = {
    triggerMessage: overrides.triggerMessage ?? vi.fn().mockResolvedValue([{ success: true }]),
    requestStartTransaction: overrides.requestStartTransaction ?? vi.fn().mockResolvedValue([{ success: true }]),
    requestStopTransaction: vi.fn().mockResolvedValue([{ success: true }]),
    reset: overrides.reset ?? vi.fn().mockResolvedValue([{ success: true }]),
    getVariables: vi.fn().mockResolvedValue([{ success: true }]),
    dataTransfer: vi.fn().mockResolvedValue([{ success: true }]),
  } as unknown as CitrineOsMessageApiService;

  const configService = {
    getConfig: vi.fn().mockResolvedValue(CONFIG),
    getWebhookSecret: vi.fn().mockResolvedValue('secret-abc'),
  } as unknown as CitrineOsConfigService;

  const waiter = {
    waitForMessage: vi.fn().mockResolvedValue(overrides.waiterResult ?? null),
  } as unknown as MessageLogWaiter;

  const executor = new TestSuiteStepExecutor(prisma, messageApi, configService, waiter);
  return { executor, prisma, messageApi, configService, waiter, updateCalls };
}

function makeStep(overrides: Partial<{ id: string; action: string; kind: string }> = {}) {
  return { id: 'step-1', action: 'BootNotification', kind: 'trigger', ...overrides } as any;
}

describe('TestSuiteStepExecutor', () => {
  it('trigger step: sends TriggerMessage, waits, and marks pass on a match', async () => {
    const { executor, messageApi, waiter, updateCalls } = makeExecutor({
      waiterResult: { info: { action: 'BootNotification' }, rawMessage: '[2,"1","BootNotification",{}]' },
    });
    const def: TestSuiteStepDefinition = {
      action: 'BootNotification',
      kind: 'trigger',
      requestedMessage: 'BootNotification',
      timeoutMs: 5000,
    };

    await executor.execute(RUN, makeStep(), def, {});

    expect(messageApi.triggerMessage).toHaveBeenCalledWith('tenant-1', ['stationA'], {
      requestedMessage: 'BootNotification',
    });
    expect(waiter.waitForMessage).toHaveBeenCalled();
    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('pass');
  });

  it('trigger step: fails immediately if TriggerMessage delivery itself fails, without waiting', async () => {
    const { executor, waiter, updateCalls } = makeExecutor({
      triggerMessage: vi.fn().mockResolvedValue([{ success: false }]),
    });
    const def: TestSuiteStepDefinition = {
      action: 'Heartbeat',
      kind: 'trigger',
      requestedMessage: 'Heartbeat',
      timeoutMs: 5000,
    };

    await executor.execute(RUN, makeStep({ action: 'Heartbeat' }), def, {});

    expect(waiter.waitForMessage).not.toHaveBeenCalled();
    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('fail');
  });

  it('trigger/observe step: marks timeout when the waiter finds nothing', async () => {
    const { executor, updateCalls } = makeExecutor({ waiterResult: null });
    const def: TestSuiteStepDefinition = {
      action: 'Authorize',
      kind: 'observe',
      timeoutMs: 20,
    };

    await executor.execute(RUN, makeStep({ action: 'Authorize', kind: 'observe' }), def, {});

    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('timeout');
  });

  it('observe step: never sends a TriggerMessage', async () => {
    const { executor, messageApi } = makeExecutor({ waiterResult: { info: {}, rawMessage: '[]' } });
    const def: TestSuiteStepDefinition = { action: 'Authorize', kind: 'observe', timeoutMs: 5000 };

    await executor.execute(RUN, makeStep({ action: 'Authorize', kind: 'observe' }), def, {});

    expect(messageApi.triggerMessage).not.toHaveBeenCalled();
  });

  it('command step: skips when required run params are missing', async () => {
    const { executor, messageApi, updateCalls } = makeExecutor({});
    const def: TestSuiteStepDefinition = { action: 'RemoteStart', kind: 'command', timeoutMs: 5000 };

    await executor.execute(RUN, makeStep({ action: 'RemoteStart', kind: 'command' }), def, {});

    expect(messageApi.requestStartTransaction).not.toHaveBeenCalled();
    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('skipped');
  });

  it('command step: sends the command and resolves once the step row shows a final status', async () => {
    const { executor, messageApi, updateCalls } = makeExecutor({
      requestStartTransaction: vi.fn().mockResolvedValue([{ success: true }]),
      stepStatusSequence: ['running', 'running', 'pass'],
    });
    const def: TestSuiteStepDefinition = { action: 'RemoteStart', kind: 'command', timeoutMs: 5000 };

    await executor.execute(
      RUN,
      makeStep({ action: 'RemoteStart', kind: 'command' }),
      def,
      { idToken: { idToken: 'abc', type: 'ISO14443' }, remoteStartId: 1 },
    );

    expect(messageApi.requestStartTransaction).toHaveBeenCalledWith(
      'tenant-1',
      ['stationA'],
      { idToken: { idToken: 'abc', type: 'ISO14443' }, remoteStartId: 1, evseId: undefined },
      expect.stringContaining('/citrineos/webhooks/callback/step-1?secret=secret-abc'),
    );
    // The callback controller (not this executor) wrote the final result —
    // the executor's last update call should be the 'running' state, not a
    // final status, since resolving found the row already finished.
    const statuses = updateCalls.map((c) => c.data.status);
    expect(statuses).toContain('running');
    expect(statuses).not.toContain('timeout');
  });

  it('command step: fails immediately when delivery itself fails, without polling', async () => {
    const { executor, prisma, updateCalls } = makeExecutor({
      reset: vi.fn().mockResolvedValue([{ success: false }]),
    });
    const def: TestSuiteStepDefinition = { action: 'Reset', kind: 'command', timeoutMs: 5000 };

    await executor.execute(RUN, makeStep({ action: 'Reset', kind: 'command' }), def, {});

    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('fail');
    // findUnique is only used for the resolution poll — delivery failure
    // must short-circuit before ever polling.
    expect((prisma.testSuiteStep.findUnique as any)).not.toHaveBeenCalled();
  });

  it('command step: times out when no callback arrives within the deadline', async () => {
    const { executor, updateCalls } = makeExecutor({ stepStatusSequence: [] });
    const def: TestSuiteStepDefinition = { action: 'Reset', kind: 'command', timeoutMs: 20 };

    await executor.execute(RUN, makeStep({ action: 'Reset', kind: 'command' }), def, {});

    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('timeout');
  });

  it('command step: fails when webhookBaseUrl is not configured, without sending anything', async () => {
    const { executor, messageApi, configService, updateCalls } = makeExecutor({});
    (configService.getConfig as any).mockResolvedValue({ ...CONFIG, webhookBaseUrl: '' });
    const def: TestSuiteStepDefinition = { action: 'Reset', kind: 'command', timeoutMs: 5000 };

    await executor.execute(RUN, makeStep({ action: 'Reset', kind: 'command' }), def, {});

    expect(messageApi.reset).not.toHaveBeenCalled();
    const finalUpdate = updateCalls.at(-1);
    expect(finalUpdate.data.status).toBe('fail');
  });
});
