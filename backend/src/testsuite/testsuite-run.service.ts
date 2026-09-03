import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TestSuiteStepExecutor } from './testsuite-step-executor.service.js';
import { TESTSUITE_STEP_CATALOG } from './testsuite-step-catalog.js';
import type { TestSuiteRunParams } from './testsuite-run-params.js';

export interface StartTestSuiteRunInput {
  tenantId: string;
  ocppConnectionName: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
  ocppVersion: string;
  startedById: string;
  params?: TestSuiteRunParams;
  // Shortens every step's wait below the catalog's own default — useful
  // for a fast sanity check, or for automated verification of the run
  // orchestration itself. Deliberately one-directional: this can only make
  // a step give up sooner, never wait longer than the catalog specifies,
  // so it can't be used to silently make a diagnostic run more patient
  // than the tool was designed to be.
  maxTimeoutMs?: number;
}

// Orchestrates one run: creates the run + its (initially pending) steps,
// then executes them in the background — the HTTP request that started the
// run returns immediately with the run id; the client polls GET
// /testsuite/runs/:id for live progress.
//
// This background execution is in-process fire-and-forget, not a durable
// job queue: if the backend process restarts mid-run, that run is left
// stuck on whichever step was 'running'. Acceptable for this increment; a
// later one should move this onto a real queue if runs need to survive
// restarts or scale across multiple backend instances.
@Injectable()
export class TestSuiteRunService {
  private readonly logger = new Logger(TestSuiteRunService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly executor: TestSuiteStepExecutor,
  ) {}

  async startRun(input: StartTestSuiteRunInput) {
    // OCPP 1.6 sends StartTransaction where 2.x sends TransactionEvent —
    // swap that one catalog entry's watched action for a 1.6 run so the
    // step actually matches what the station will send.
    const steps = TESTSUITE_STEP_CATALOG.map((def) => {
      const withAction =
        input.ocppVersion.startsWith('1.6') && def.action === 'TransactionEvent'
          ? { ...def, action: 'StartTransaction' }
          : def;
      return input.maxTimeoutMs !== undefined
        ? { ...withAction, timeoutMs: Math.min(withAction.timeoutMs, input.maxTimeoutMs) }
        : withAction;
    });

    const run = await this.prisma.testSuiteRun.create({
      data: {
        tenantId: input.tenantId,
        ocppConnectionName: input.ocppConnectionName,
        manufacturer: input.manufacturer,
        model: input.model,
        firmwareVersion: input.firmwareVersion,
        ocppVersion: input.ocppVersion,
        startedById: input.startedById,
        steps: {
          create: steps.map((def, index) => ({
            sequenceIndex: index,
            action: def.action,
            kind: def.kind,
          })),
        },
      },
      include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
    });

    void this.executeRun(run.id, steps, input.params ?? {});

    return run;
  }

  private async executeRun(
    runId: string,
    steps: typeof TESTSUITE_STEP_CATALOG,
    params: TestSuiteRunParams,
  ): Promise<void> {
    try {
      const run = await this.prisma.testSuiteRun.findUniqueOrThrow({ where: { id: runId } });
      const dbSteps = await this.prisma.testSuiteStep.findMany({
        where: { runId },
        orderBy: { sequenceIndex: 'asc' },
      });

      for (let i = 0; i < dbSteps.length; i++) {
        await this.executor.execute(run, dbSteps[i], steps[i], params);
      }

      await this.prisma.testSuiteRun.update({
        where: { id: runId },
        data: { status: 'completed', finishedAt: new Date() },
      });
    } catch (error) {
      this.logger.error(`Run ${runId} aborted`, error as Error);
      await this.prisma.testSuiteRun.update({
        where: { id: runId },
        data: { status: 'aborted', finishedAt: new Date() },
      });
    }
  }

  getRun(tenantId: string, runId: string) {
    return this.prisma.testSuiteRun.findFirst({
      where: { id: runId, tenantId },
      include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
    });
  }

  listRuns(tenantId: string, ocppConnectionName?: string) {
    return this.prisma.testSuiteRun.findMany({
      where: { tenantId, ...(ocppConnectionName ? { ocppConnectionName } : {}) },
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
  }

  // One row per manufacturer/model/firmware/OCPP-version combination, with
  // its most recent run — the "compatibility matrix" from
  // docs/architecture-proposal.md §8.
  async compatibilityMatrix(tenantId: string) {
    const runs = await this.prisma.testSuiteRun.findMany({
      where: { tenantId, manufacturer: { not: null }, model: { not: null } },
      orderBy: { startedAt: 'desc' },
      include: { steps: { orderBy: { sequenceIndex: 'asc' } } },
    });

    const latestByKey = new Map<string, (typeof runs)[number]>();
    for (const run of runs) {
      const key = `${run.manufacturer}::${run.model}::${run.firmwareVersion}::${run.ocppVersion}`;
      if (!latestByKey.has(key)) latestByKey.set(key, run); // runs are newest-first, so the first hit per key is the latest
    }
    return [...latestByKey.values()];
  }
}
