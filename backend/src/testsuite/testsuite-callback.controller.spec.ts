import { vi } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TestSuiteCallbackController } from './testsuite-callback.controller.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { CitrineOsConfigService } from '../citrineos/citrineos-config.service.js';

function makeDeps(step: any, secret: string | null = 'correct-secret') {
  const findUnique = vi.fn().mockResolvedValue(step);
  const update = vi.fn().mockResolvedValue(undefined);
  const prisma = { testSuiteStep: { findUnique, update } } as unknown as PrismaService;
  const configService = { getWebhookSecret: vi.fn().mockResolvedValue(secret) } as unknown as CitrineOsConfigService;
  return { prisma, configService, findUnique, update };
}

const RUNNING_STEP = {
  id: 'step-1',
  status: 'running',
  startedAt: new Date('2026-01-01T00:00:00.000Z'),
  run: { tenantId: 'tenant-1' },
};

describe('TestSuiteCallbackController', () => {
  it('marks the step pass and stores the payload for a normal CallResult', async () => {
    const { prisma, configService, update } = makeDeps(RUNNING_STEP);
    const controller = new TestSuiteCallbackController(prisma, configService);

    const result = await controller.receiveCallback('step-1', 'correct-secret', { status: 'Accepted' });

    expect(result).toEqual({ status: 'ok' });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'pass',
          responsePayload: { status: 'Accepted' },
          errorMessage: null,
        }),
      }),
    );
  });

  it('marks the step fail with a readable message for an OCPP CallError', async () => {
    const { prisma, configService, update } = makeDeps(RUNNING_STEP);
    const controller = new TestSuiteCallbackController(prisma, configService);

    await controller.receiveCallback('step-1', 'correct-secret', {
      errorCode: 'FormatViolation',
      errorDescription: 'idToken missing',
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'fail',
          errorMessage: 'FormatViolation: idToken missing',
        }),
      }),
    );
  });

  it('rejects a wrong secret and does not update the step', async () => {
    const { prisma, configService, update } = makeDeps(RUNNING_STEP);
    const controller = new TestSuiteCallbackController(prisma, configService);

    await expect(controller.receiveCallback('step-1', 'wrong-secret', {})).rejects.toThrow(
      ForbiddenException,
    );
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects an unknown stepId', async () => {
    const { prisma, configService } = makeDeps(null);
    const controller = new TestSuiteCallbackController(prisma, configService);

    await expect(controller.receiveCallback('missing', 'correct-secret', {})).rejects.toThrow(
      NotFoundException,
    );
  });

  it('ignores a late callback for a step that already finished', async () => {
    const finishedStep = { ...RUNNING_STEP, status: 'pass' };
    const { prisma, configService, update } = makeDeps(finishedStep);
    const controller = new TestSuiteCallbackController(prisma, configService);

    const result = await controller.receiveCallback('step-1', 'correct-secret', { status: 'Accepted' });

    expect(result).toEqual({ status: 'ignored' });
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects when no webhook secret has been configured yet', async () => {
    const { prisma, configService, update } = makeDeps(RUNNING_STEP, null);
    const controller = new TestSuiteCallbackController(prisma, configService);

    await expect(controller.receiveCallback('step-1', 'anything', {})).rejects.toThrow(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });
});
