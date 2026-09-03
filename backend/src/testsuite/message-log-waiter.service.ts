import { Injectable } from '@nestjs/common';
import { CitrineOsMessageLogService } from '../citrineos/citrineos-message-log.service.js';
import type { CitrineOsMessageLog } from '../generated/prisma/index.js';
import { pollUntil } from './poll-until.js';

const DEFAULT_POLL_INTERVAL_MS = 1000;

// Polls citrineos_message_log for the one message a 'trigger'/'observe'
// testsuite step is waiting for. Simple DB polling rather than an in-memory
// wake-up: the row is written by an unrelated HTTP request (CitrineOS's
// webhook), possibly to a different server process, so polling a shared
// table is the option that doesn't assume a single process or an in-memory
// event bus.
@Injectable()
export class MessageLogWaiter {
  constructor(private readonly messageLogService: CitrineOsMessageLogService) {}

  waitForMessage(
    tenantId: string,
    filter: { ocppConnectionName: string; action: string; origin: 'ChargingStation' },
    since: Date,
    timeoutMs: number,
    pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  ): Promise<CitrineOsMessageLog | null> {
    return pollUntil(
      () => this.messageLogService.findFirstAfter(tenantId, { ...filter, after: since }),
      timeoutMs,
      pollIntervalMs,
    );
  }
}
