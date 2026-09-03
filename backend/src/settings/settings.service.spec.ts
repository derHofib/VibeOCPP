import { vi } from 'vitest';
import { SettingsService } from './settings.service.js';
import { EncryptionService } from './encryption.service.js';

const VALID_KEY = Buffer.alloc(32, 3).toString('base64');

function makePrismaMock() {
  const settings = new Map<string, any>();
  const history: any[] = [];
  let settingSeq = 0;
  let historySeq = 0;

  const prisma: any = {
    setting: {
      findUnique: vi.fn(({ where: { tenantId_category_key } }: any) => {
        const key = `${tenantId_category_key.tenantId}:${tenantId_category_key.category}:${tenantId_category_key.key}`;
        return Promise.resolve(settings.get(key) ?? null);
      }),
      findMany: vi.fn(() => Promise.resolve([...settings.values()])),
      create: vi.fn(({ data }: any) => {
        const id = `setting-${++settingSeq}`;
        const record = { id, ...data };
        settings.set(`${data.tenantId}:${data.category}:${data.key}`, record);
        return Promise.resolve(record);
      }),
      update: vi.fn(({ where: { id }, data }: any) => {
        const record = [...settings.values()].find((s) => s.id === id);
        Object.assign(record, data);
        return Promise.resolve(record);
      }),
      findFirst: vi.fn(({ where: { id, tenantId } }: any) =>
        Promise.resolve([...settings.values()].find((s) => s.id === id && s.tenantId === tenantId) ?? null),
      ),
    },
    settingHistory: {
      create: vi.fn(({ data }: any) => {
        const record = { id: `history-${++historySeq}`, ...data };
        history.push(record);
        return Promise.resolve(record);
      }),
      findFirst: vi.fn(({ where: { settingId, version } }: any) =>
        Promise.resolve(history.find((h) => h.settingId === settingId && h.version === version) ?? null),
      ),
    },
    $transaction: vi.fn((fn: (tx: any) => Promise<unknown>) => fn(prisma)),
  };
  return prisma;
}

describe('SettingsService', () => {
  const configService = { getOrThrow: () => VALID_KEY } as any;
  const tenantId = 'tenant-1';

  it('stores a plain (non-secret) setting and returns its real value', async () => {
    const prisma = makePrismaMock();
    const service = new SettingsService(prisma, new EncryptionService(configService));

    const created = await service.upsert({
      tenantId,
      category: 'branding',
      key: 'appName',
      type: 'string',
      value: 'VibeOCPP',
      updatedBy: 'user-1',
    });

    expect(created.value).toBe('VibeOCPP');
    expect(created.version).toBe(1);
  });

  it('encrypts a secret setting and only ever returns it masked', async () => {
    const prisma = makePrismaMock();
    const service = new SettingsService(prisma, new EncryptionService(configService));

    const created = await service.upsert({
      tenantId,
      category: 'payment',
      key: 'stripeApiKey',
      type: 'secret',
      value: 'sk_live_abcdef1234',
      updatedBy: 'user-1',
    });

    expect(created.value).toBe('••••1234');
    expect(created.value).not.toContain('sk_live');

    const plaintext = await service.getPlaintext(tenantId, 'payment', 'stripeApiKey');
    expect(plaintext).toBe('sk_live_abcdef1234');
  });

  it('bumps the version and preserves the previous value in history on update', async () => {
    const prisma = makePrismaMock();
    const service = new SettingsService(prisma, new EncryptionService(configService));

    await service.upsert({ tenantId, category: 'smtp', key: 'host', type: 'string', value: 'v1' });
    const second = await service.upsert({ tenantId, category: 'smtp', key: 'host', type: 'string', value: 'v2' });

    expect(second.version).toBe(2);
    expect(prisma.settingHistory.create).toHaveBeenCalledTimes(1);
    expect(prisma.settingHistory.create.mock.calls[0][0].data.value).toBe('v1');
  });

  it('rolls back to a prior version and records the replaced value in history', async () => {
    const prisma = makePrismaMock();
    const service = new SettingsService(prisma, new EncryptionService(configService));

    const v1 = await service.upsert({ tenantId, category: 'smtp', key: 'host', type: 'string', value: 'first' });
    await service.upsert({ tenantId, category: 'smtp', key: 'host', type: 'string', value: 'second' });

    const rolledBack = await service.rollback(tenantId, v1.id, 1, 'user-1');

    expect(rolledBack.value).toBe('first');
    expect(rolledBack.version).toBe(3);
  });

  it('rejects rollback to a version that does not exist', async () => {
    const prisma = makePrismaMock();
    const service = new SettingsService(prisma, new EncryptionService(configService));

    const v1 = await service.upsert({ tenantId, category: 'smtp', key: 'host', type: 'string', value: 'first' });

    await expect(service.rollback(tenantId, v1.id, 99, 'user-1')).rejects.toThrow(/not found/i);
  });
});
