import { Module } from '@nestjs/common';
import { TestSuiteRunController } from './testsuite-run.controller.js';
import { TestSuiteCallbackController } from './testsuite-callback.controller.js';
import { TestSuiteRunService } from './testsuite-run.service.js';
import { TestSuiteStepExecutor } from './testsuite-step-executor.service.js';
import { MessageLogWaiter } from './message-log-waiter.service.js';
import { AuthModule } from '../auth/auth.module.js';
import { CitrineOsModule } from '../citrineos/citrineos.module.js';

@Module({
  imports: [AuthModule, CitrineOsModule],
  controllers: [TestSuiteRunController, TestSuiteCallbackController],
  providers: [TestSuiteRunService, TestSuiteStepExecutor, MessageLogWaiter],
})
export class TestSuiteModule {}
