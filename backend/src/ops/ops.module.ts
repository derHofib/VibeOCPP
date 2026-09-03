import { Module } from '@nestjs/common';
import { OpsAgentClient } from './ops.service.js';
import { OpsController } from './ops.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [OpsController],
  providers: [OpsAgentClient],
})
export class OpsModule {}
