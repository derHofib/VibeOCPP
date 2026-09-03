import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from '../auth/password.service.js';
import { Role } from '../common/roles.enum.js';

// Per the role table in docs/architecture-proposal.md §6: SuperAdmin creates
// Admins, Admin creates Mitarbeiter. Neither role creates a Driver account
// (unused in Phase 1) or a SuperAdmin through this API.
const ALLOWED_TARGET_ROLES: Record<Role, Role[]> = {
  [Role.SuperAdmin]: [Role.Admin, Role.Mitarbeiter],
  [Role.Admin]: [Role.Mitarbeiter],
  [Role.Mitarbeiter]: [],
  [Role.Driver]: [],
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async create(tenantId: string, actorRole: Role, email: string, plainPassword: string, role: Role) {
    if (!ALLOWED_TARGET_ROLES[actorRole].includes(role)) {
      throw new ForbiddenException(`${actorRole} may not create a user with role ${role}`);
    }
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }
    const passwordHash = await this.passwordService.hash(plainPassword);
    return this.prisma.user.create({
      data: { tenantId, email, passwordHash, role },
      select: { id: true, tenantId: true, email: true, role: true, isActive: true, createdAt: true },
    });
  }

  list(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { email: 'asc' },
    });
  }

  async setActive(tenantId: string, userId: string, isActive: boolean) {
    return this.prisma.user.update({
      where: { id: userId, tenantId },
      data: { isActive },
      select: { id: true, email: true, role: true, isActive: true },
    });
  }
}
