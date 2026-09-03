import { vi } from 'vitest';
import { InternalServerErrorException } from '@nestjs/common';

const queryMock = vi.fn();
const endMock = vi.fn().mockResolvedValue(undefined);
// A regular function, not an arrow function: PaymentDbService calls `new
// Pool(...)`, and only a function (whose return value JS constructor
// semantics substitute for `this` when it returns an object) works there.
const PoolMock = vi.fn().mockImplementation(function () {
  return { query: queryMock, end: endMock };
});

vi.mock('pg', () => ({ Pool: PoolMock }));

const { PaymentDbService } = await import('./payment-db.service.js');
import type { PaymentConfigService } from './payment-config.service.js';

function makeConfigService(databaseUrl: string, tablePrefix = 'payment_'): PaymentConfigService {
  return {
    getConfig: vi.fn().mockResolvedValue({ databaseUrl, tablePrefix }),
  } as unknown as PaymentConfigService;
}

describe('PaymentDbService', () => {
  beforeEach(() => {
    PoolMock.mockClear();
    queryMock.mockReset();
    endMock.mockClear();
  });

  it('creates a Pool on first use and reuses it on subsequent calls', async () => {
    const service = new PaymentDbService(makeConfigService('postgresql://a/db'));
    await service.getPool('tenant-1');
    await service.getPool('tenant-1');
    expect(PoolMock).toHaveBeenCalledTimes(1);
  });

  it('recreates the pool when the configured databaseUrl changes', async () => {
    const configService = makeConfigService('postgresql://a/db');
    const service = new PaymentDbService(configService);
    await service.getPool('tenant-1');

    (configService.getConfig as any).mockResolvedValue({ databaseUrl: 'postgresql://b/db', tablePrefix: 'payment_' });
    await service.getPool('tenant-1');

    expect(PoolMock).toHaveBeenCalledTimes(2);
    expect(endMock).toHaveBeenCalledTimes(1); // the old pool was closed
  });

  it('keeps separate pools per tenant', async () => {
    const configService = makeConfigService('postgresql://a/db');
    const service = new PaymentDbService(configService);
    await service.getPool('tenant-1');
    await service.getPool('tenant-2');
    expect(PoolMock).toHaveBeenCalledTimes(2);
  });

  it('query() runs the SQL against the tenant pool and returns rows', async () => {
    queryMock.mockResolvedValue({ rows: [{ id: 1 }] });
    const service = new PaymentDbService(makeConfigService('postgresql://a/db'));

    const rows = await service.query('tenant-1', 'SELECT * FROM x WHERE id = $1', [1]);

    expect(rows).toEqual([{ id: 1 }]);
    expect(queryMock).toHaveBeenCalledWith('SELECT * FROM x WHERE id = $1', [1]);
  });

  it('testConnection succeeds when to_regclass finds the operators table', async () => {
    queryMock.mockResolvedValue({ rows: [{ exists: 'payment_operators' }] });
    const service = new PaymentDbService(makeConfigService('postgresql://a/db'));
    await expect(service.testConnection('tenant-1')).resolves.toBeUndefined();
  });

  it('testConnection throws a clear error when the table does not exist yet', async () => {
    queryMock.mockResolvedValue({ rows: [{ exists: null }] });
    const service = new PaymentDbService(makeConfigService('postgresql://a/db'));
    await expect(service.testConnection('tenant-1')).rejects.toThrow(InternalServerErrorException);
    await expect(service.testConnection('tenant-1')).rejects.toThrow(/does not exist yet/);
  });

  it('closes all pools on module destroy', async () => {
    const service = new PaymentDbService(makeConfigService('postgresql://a/db'));
    await service.getPool('tenant-1');
    await service.onModuleDestroy();
    expect(endMock).toHaveBeenCalledTimes(1);
  });
});
