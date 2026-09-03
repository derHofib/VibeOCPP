import { vi } from 'vitest';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PasswordService } from '../auth/password.service.js';
import { Role } from '../common/roles.enum.js';

function makePrismaMock(existing: unknown = null) {
  return {
    user: {
      findUnique: vi.fn(() => Promise.resolve(existing)),
      create: vi.fn(({ data }: any) => Promise.resolve({ id: 'user-2', isActive: true, createdAt: new Date(), ...data })),
    },
  } as any;
}

describe('UsersService role hierarchy', () => {
  it('lets SuperAdmin create an Admin', async () => {
    const service = new UsersService(makePrismaMock(), new PasswordService());
    const created = await service.create('tenant-1', Role.SuperAdmin, 'admin@example.com', 'password1234', Role.Admin);
    expect(created.role).toBe(Role.Admin);
  });

  it('lets Admin create a Mitarbeiter', async () => {
    const service = new UsersService(makePrismaMock(), new PasswordService());
    const created = await service.create('tenant-1', Role.Admin, 'staff@example.com', 'password1234', Role.Mitarbeiter);
    expect(created.role).toBe(Role.Mitarbeiter);
  });

  it('does not let Admin create another Admin', async () => {
    const service = new UsersService(makePrismaMock(), new PasswordService());
    await expect(
      service.create('tenant-1', Role.Admin, 'admin2@example.com', 'password1234', Role.Admin),
    ).rejects.toThrow(ForbiddenException);
  });

  it('does not let Mitarbeiter create any user', async () => {
    const service = new UsersService(makePrismaMock(), new PasswordService());
    await expect(
      service.create('tenant-1', Role.Mitarbeiter, 'x@example.com', 'password1234', Role.Mitarbeiter),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects creating a user with an email that already exists', async () => {
    const service = new UsersService(makePrismaMock({ id: 'existing' }), new PasswordService());
    await expect(
      service.create('tenant-1', Role.SuperAdmin, 'dup@example.com', 'password1234', Role.Admin),
    ).rejects.toThrow(ConflictException);
  });
});
