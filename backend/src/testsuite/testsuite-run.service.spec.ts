import { vi } from 'vitest';
import { TestSuiteRunService } from './testsuite-run.service.js';
import { TESTSUITE_STEP_CATALOG } from './testsuite-step-catalog.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { TestSuiteStepExecutor } from './testsuite-step-executor.service.js';

function flushMicrotasks(times = 10): Promise<void> {
  return new Promise((resolve) => {
    let remaining = times;
    const tick = () => {
      remaining--;
      if (remaining <= 0) resolve();
      else setImmediate(tick);
    };
    setImmediate(tick);
  });
}

function makeDeps() {
  const createdRun = {
    id: 'run-1',
    tenantId: 'tenant-1',
    ocppConnectionName: 'stationA',
    steps: TESTSUITE_STEP_CATALOG.map((def, i) => ({
      id: `step-${i}`,
      sequenceIndex: i,
      action: def.action,
      kind: def.kind,
    })),
  };

  const create = vi.fn().mockResolvedValue(createdRun);
  const findUniqueOrThrow = vi.fn().mockResolvedValue(createdRun);
  const update = vi.fn().mockResolvedValue(undefined);
  const findFirst = vi.fn().mockResolvedValue(createdRun);
  const findMany = vi.fn().mockResolvedValue([createdRun]);

  const prisma = {
    testSuiteRun: { create, findUniqueOrThrow, update, findFirst, findMany },
    testSuiteStep: { findMany: vi.fn().mockResolvedValue(createdRun.steps) },
  } as unknown as PrismaService;

  const execute = vi.fn().mockResolvedValue(undefined);
  const executor = { execute } as unknown as TestSuiteStepExecutor;

  return { prisma, executor, create, update, execute, findUniqueOrThrow, findFirst, findMany };
}

describe('TestSuiteRunService', () => {
  it('creates a run with one step per catalog entry, in order', async () => {
    const { prisma, executor, create } = makeDeps();
    const service = new TestSuiteRunService(prisma, executor);

    await service.startRun({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      ocppVersion: '2',
      startedById: 'user-1',
    });

    const createArgs = create.mock.calls[0][0];
    expect(createArgs.data.steps.create).toHaveLength(TESTSUITE_STEP_CATALOG.length);
    expect(createArgs.data.steps.create[0].action).toBe(TESTSUITE_STEP_CATALOG[0].action);
    expect(createArgs.data.steps.create.map((s: any) => s.sequenceIndex)).toEqual(
      TESTSUITE_STEP_CATALOG.map((_, i) => i),
    );
  });

  it('remaps TransactionEvent to StartTransaction for an OCPP 1.6 run', async () => {
    const { prisma, executor, create } = makeDeps();
    const service = new TestSuiteRunService(prisma, executor);

    await service.startRun({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      ocppVersion: '1.6',
      startedById: 'user-1',
    });

    const createArgs = create.mock.calls[0][0];
    const actions = createArgs.data.steps.create.map((s: any) => s.action);
    expect(actions).toContain('StartTransaction');
    expect(actions).not.toContain('TransactionEvent');
  });

  it('does not remap the action for an OCPP 2.x run', async () => {
    const { prisma, executor, create } = makeDeps();
    const service = new TestSuiteRunService(prisma, executor);

    await service.startRun({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      ocppVersion: '2.0.1',
      startedById: 'user-1',
    });

    const actions = create.mock.calls[0][0].data.steps.create.map((s: any) => s.action);
    expect(actions).toContain('TransactionEvent');
  });

  it('executes every step in the background and marks the run completed', async () => {
    const { prisma, executor, execute, update } = makeDeps();
    const service = new TestSuiteRunService(prisma, executor);

    await service.startRun({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      ocppVersion: '2',
      startedById: 'user-1',
    });
    await flushMicrotasks();

    expect(execute).toHaveBeenCalledTimes(TESTSUITE_STEP_CATALOG.length);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
  });

  it('marks the run aborted if step execution throws unexpectedly', async () => {
    const { prisma, executor, update } = makeDeps();
    (executor.execute as any).mockRejectedValue(new Error('boom'));
    const service = new TestSuiteRunService(prisma, executor);

    await service.startRun({
      tenantId: 'tenant-1',
      ocppConnectionName: 'stationA',
      ocppVersion: '2',
      startedById: 'user-1',
    });
    await flushMicrotasks();

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'aborted' }) }),
    );
  });

  it('compatibilityMatrix keeps only the newest run per manufacturer/model/firmware/version', async () => {
    const { prisma, executor, findMany } = makeDeps();
    const older = { id: 'run-old', manufacturer: 'Bender', model: 'CC612', firmwareVersion: '1.0', ocppVersion: '1.6', startedAt: new Date('2025-01-01') };
    const newer = { id: 'run-new', manufacturer: 'Bender', model: 'CC612', firmwareVersion: '1.0', ocppVersion: '1.6', startedAt: new Date('2026-01-01') };
    findMany.mockResolvedValue([newer, older]); // service assumes newest-first ordering, as findMany would return

    const service = new TestSuiteRunService(prisma, executor);
    const matrix = await service.compatibilityMatrix('tenant-1');

    expect(matrix).toHaveLength(1);
    expect(matrix[0].id).toBe('run-new');
  });
});
