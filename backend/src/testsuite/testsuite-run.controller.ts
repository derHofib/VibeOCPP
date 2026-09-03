import { Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { TestSuiteRunService } from './testsuite-run.service.js';
import { StartRunDto } from './dto/start-run.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Audited } from '../audit/audited.decorator.js';
import { Role } from '../common/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';

// Running the testsuite is a diagnostic task — per the role table in
// docs/architecture-proposal.md §6, "Mitarbeiter: Fehler diagnostizieren" —
// so it is open to every authenticated role, same as the message log.
@Controller('testsuite')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SuperAdmin, Role.Admin, Role.Mitarbeiter)
export class TestSuiteRunController {
  constructor(private readonly runService: TestSuiteRunService) {}

  @Post('runs')
  @Audited('testsuite.run.start')
  startRun(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartRunDto) {
    return this.runService.startRun({
      tenantId: user.tenantId,
      ocppConnectionName: dto.ocppConnectionName,
      manufacturer: dto.manufacturer,
      model: dto.model,
      firmwareVersion: dto.firmwareVersion,
      ocppVersion: dto.ocppVersion,
      startedById: user.id,
      params: dto.params,
      maxTimeoutMs: dto.maxTimeoutMs,
    });
  }

  @Get('runs')
  listRuns(@CurrentUser() user: AuthenticatedUser, @Query('ocppConnectionName') ocppConnectionName?: string) {
    return this.runService.listRuns(user.tenantId, ocppConnectionName);
  }

  @Get('runs/:id')
  async getRun(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const run = await this.runService.getRun(user.tenantId, id);
    if (!run) throw new NotFoundException('Test run not found');
    return run;
  }

  @Get('compatibility-matrix')
  compatibilityMatrix(@CurrentUser() user: AuthenticatedUser) {
    return this.runService.compatibilityMatrix(user.tenantId);
  }
}
