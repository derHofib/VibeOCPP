import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const DEFAULT_TENANT_SLUG = 'default';

// Phase 1 runs with exactly one tenant (see docs/architecture-proposal.md
// §3). Every table still carries tenantId so a later multi-tenant rollout
// needs only new tenant rows, not a schema migration — this service is the
// single place that resolves "the current tenant" until real tenant
// selection (subdomain, header, etc.) is built.
@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDefaultTenant() {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: DEFAULT_TENANT_SLUG },
    });
    if (!tenant) {
      throw new InternalServerErrorException(
        'Default tenant not found — run the bootstrap seed before starting the app',
      );
    }
    return tenant;
  }
}
