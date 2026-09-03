import { Module } from '@nestjs/common';
import { CitrineOsConfigService } from './citrineos-config.service.js';
import { CitrineOsHttpClient } from './citrineos-http-client.js';
import { CitrineOsDataApiService } from './citrineos-data-api.service.js';
import { CitrineOsMessageApiService } from './citrineos-message-api.service.js';
import { CitrineOsMessageLogService } from './citrineos-message-log.service.js';
import { CitrineOsSubscriptionService } from './citrineos-subscription.service.js';
import { CitrineOsAdminController } from './citrineos-admin.controller.js';
import { CitrineOsCommandsController } from './citrineos-commands.controller.js';
import { CitrineOsMessagesController } from './citrineos-messages.controller.js';
import { CitrineOsWebhookController } from './citrineos-webhook.controller.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { TenantsModule } from '../tenants/tenants.module.js';

@Module({
  imports: [SettingsModule, AuthModule, TenantsModule],
  controllers: [
    CitrineOsAdminController,
    CitrineOsCommandsController,
    CitrineOsMessagesController,
    CitrineOsWebhookController,
  ],
  providers: [
    CitrineOsConfigService,
    CitrineOsHttpClient,
    CitrineOsDataApiService,
    CitrineOsMessageApiService,
    CitrineOsMessageLogService,
    CitrineOsSubscriptionService,
  ],
  // Exported so the testsuite module (which orchestrates commands and
  // reads the message log to build its own results) can inject these
  // directly instead of duplicating them.
  exports: [
    CitrineOsConfigService,
    CitrineOsDataApiService,
    CitrineOsMessageApiService,
    CitrineOsMessageLogService,
    CitrineOsSubscriptionService,
  ],
})
export class CitrineOsModule {}
