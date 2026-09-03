import { vi } from 'vitest';
import { firstValueFrom, of } from 'rxjs';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AuditInterceptor } from './audit.interceptor.js';
import type { AuditService } from './audit.service.js';

function makeContext(user: unknown, params: Record<string, string> = {}): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, params, ip: '127.0.0.1', headers: { 'user-agent': 'vitest' } }),
    }),
  } as unknown as ExecutionContext;
}

function makeNext(response: unknown): CallHandler {
  return { handle: () => of(response) };
}

describe('AuditInterceptor', () => {
  it('records an audit entry when the handler is @Audited and a user is present', async () => {
    const record = vi.fn().mockResolvedValue(undefined);
    const reflector = { getAllAndOverride: () => 'settings.update' } as unknown as Reflector;
    const auditService = { record } as unknown as AuditService;
    const interceptor = new AuditInterceptor(reflector, auditService);

    const context = makeContext({ id: 'user-1', tenantId: 'tenant-1' }, { id: 'setting-1' });
    await firstValueFrom(interceptor.intercept(context, makeNext({ ok: true })));

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        actorId: 'user-1',
        action: 'settings.update',
        targetId: 'setting-1',
        newValue: { ok: true },
      }),
    );
  });

  it('does not record anything when the handler has no @Audited metadata', async () => {
    const record = vi.fn();
    const reflector = { getAllAndOverride: () => undefined } as unknown as Reflector;
    const auditService = { record } as unknown as AuditService;
    const interceptor = new AuditInterceptor(reflector, auditService);

    await firstValueFrom(interceptor.intercept(makeContext({ id: 'user-1', tenantId: 't1' }), makeNext({})));
    expect(record).not.toHaveBeenCalled();
  });

  it('does not record anything when there is no authenticated user', async () => {
    const record = vi.fn();
    const reflector = { getAllAndOverride: () => 'settings.update' } as unknown as Reflector;
    const auditService = { record } as unknown as AuditService;
    const interceptor = new AuditInterceptor(reflector, auditService);

    await firstValueFrom(interceptor.intercept(makeContext(undefined), makeNext({})));
    expect(record).not.toHaveBeenCalled();
  });
});
