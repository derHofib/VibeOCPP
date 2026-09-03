import { vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';

const ACCESS_SECRET = 'access-secret-for-tests-only-32chars';
const REFRESH_SECRET = 'refresh-secret-for-tests-only-32chars';

function makeConfigService() {
  return {
    getOrThrow: (key: string) => {
      if (key === 'JWT_ACCESS_SECRET') return ACCESS_SECRET;
      if (key === 'JWT_REFRESH_SECRET') return REFRESH_SECRET;
      throw new Error(`unexpected config key ${key}`);
    },
  } as any;
}

function makePrismaMock(user: any) {
  const refreshTokens = new Map<string, any>();
  let seq = 0;
  return {
    user: {
      findUnique: vi.fn(() => Promise.resolve(user)),
    },
    refreshToken: {
      create: vi.fn(({ data }: any) => {
        const record = { id: `rt-${++seq}`, revokedAt: null, ...data };
        refreshTokens.set(record.tokenHash, record);
        return Promise.resolve(record);
      }),
      findUnique: vi.fn(({ where: { tokenHash } }: any) =>
        Promise.resolve(refreshTokens.get(tokenHash) ?? null),
      ),
      update: vi.fn(({ where: { id }, data }: any) => {
        const record = [...refreshTokens.values()].find((r) => r.id === id);
        Object.assign(record, data);
        return Promise.resolve(record);
      }),
      updateMany: vi.fn(({ where: { tokenHash }, data }: any) => {
        const record = refreshTokens.get(tokenHash);
        if (record) Object.assign(record, data);
        return Promise.resolve({ count: record ? 1 : 0 });
      }),
    },
  } as any;
}

async function makeService(user: any) {
  const passwordService = new PasswordService();
  const passwordHash = await passwordService.hash('correct-horse-battery-staple');
  const prisma = makePrismaMock({ ...user, passwordHash });
  const service = new AuthService(prisma, new JwtService(), makeConfigService(), passwordService);
  return { service, prisma };
}

describe('AuthService', () => {
  const baseUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'admin@example.com',
    role: 'SuperAdmin',
    isActive: true,
  };

  it('validates correct credentials for an active user', async () => {
    const { service } = await makeService(baseUser);
    const result = await service.validateCredentials('tenant-1', 'admin@example.com', 'correct-horse-battery-staple');
    expect(result).toEqual({ id: 'user-1', tenantId: 'tenant-1', email: 'admin@example.com', role: 'SuperAdmin' });
  });

  it('rejects an incorrect password', async () => {
    const { service } = await makeService(baseUser);
    await expect(
      service.validateCredentials('tenant-1', 'admin@example.com', 'wrong-password'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a deactivated user even with the correct password', async () => {
    const { service } = await makeService({ ...baseUser, isActive: false });
    await expect(
      service.validateCredentials('tenant-1', 'admin@example.com', 'correct-horse-battery-staple'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('issues an access and refresh token pair and stores a hash of the refresh token', async () => {
    const { service, prisma } = await makeService(baseUser);
    const pair = await service.issueTokenPair(baseUser);
    expect(pair.accessToken).toBeTruthy();
    expect(pair.refreshToken).toBeTruthy();
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
    const storedHash = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
    expect(storedHash).not.toBe(pair.refreshToken); // never store the raw token
  });

  it('rotates the refresh token on use and rejects the old one on replay', async () => {
    const { service } = await makeService(baseUser);
    const first = await service.issueTokenPair(baseUser);
    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a revoked refresh token', async () => {
    const { service } = await makeService(baseUser);
    const pair = await service.issueTokenPair(baseUser);
    await service.revokeRefreshToken(pair.refreshToken);
    await expect(service.refresh(pair.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a refresh token signed with the wrong secret', async () => {
    const { service } = await makeService(baseUser);
    const forged = await new JwtService().signAsync(
      { sub: baseUser.id },
      { secret: 'not-the-real-secret', expiresIn: '30d' },
    );
    await expect(service.refresh(forged)).rejects.toThrow(UnauthorizedException);
  });
});
