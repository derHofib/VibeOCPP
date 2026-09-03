import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { OpsAgentClient } from './ops.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';

// Infrastructure/container control — SuperAdmin-only, per the role model in
// docs/architecture-proposal.md §6. Every call here proxies straight to the
// ops-agent's own fixed whitelist (see ops-agent/README.md); this controller
// adds nothing beyond auth, RBAC, and audit logging on the mutating action.
@Controller('ops')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin)
export class OpsController {
  constructor(private readonly opsAgentClient: OpsAgentClient) {}

  @Get('status')
  getAllStatus() {
    return this.opsAgentClient.getAllStatus();
  }

  @Get('status/:service')
  getStatus(@Param('service') service: string) {
    return this.opsAgentClient.getStatus(service);
  }

  @Get('logs/:service')
  getLogs(@Param('service') service: string, @Query('tail') tail?: string) {
    return this.opsAgentClient.getLogs(service, tail ? Number(tail) : undefined);
  }

  @Post('restart/:service')
  @Audited('ops.service.restart')
  restart(@Param('service') service: string) {
    return this.opsAgentClient.restart(service);
  }
}
