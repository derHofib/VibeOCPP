// The fixed step sequence from docs/architecture-proposal.md §8. Not
// user-configurable in this increment — extend this list (and, for
// 'command' steps, testsuite-step-executor.ts's switch) when a later
// increment needs more actions.
//
// 'trigger' and 'observe' steps are OCPP Calls the *station* sends on its
// own initiative — CitrineOS's Message API has no direct way to force one,
// only (for 'trigger') to ask the station to resend it via TriggerMessage.
// Correlating the response means watching the message log for the next
// matching Call from that station, not matching a reply to our own
// request — see testsuite-step-executor.ts for why 'command' steps use a
// different, more precise mechanism (a per-step callbackUrl).
export type TestSuiteStepKind = 'trigger' | 'command' | 'observe';

export interface TestSuiteStepDefinition {
  action: string;
  kind: TestSuiteStepKind;
  // For 'trigger': the OCPP TriggerMessageRequest.requestedMessage value.
  requestedMessage?: string;
  // Default wait for the expected message/response to arrive.
  timeoutMs: number;
  // Human-readable note shown alongside a 'skipped' or 'observe' result,
  // since those aren't self-explanatory the way pass/fail is.
  note?: string;
}

const SECONDS = 1000;

export const TESTSUITE_STEP_CATALOG: TestSuiteStepDefinition[] = [
  {
    action: 'BootNotification',
    kind: 'trigger',
    requestedMessage: 'BootNotification',
    timeoutMs: 30 * SECONDS,
  },
  {
    action: 'Heartbeat',
    kind: 'trigger',
    requestedMessage: 'Heartbeat',
    timeoutMs: 30 * SECONDS,
  },
  {
    action: 'StatusNotification',
    kind: 'trigger',
    requestedMessage: 'StatusNotification',
    timeoutMs: 30 * SECONDS,
  },
  {
    action: 'Authorize',
    kind: 'observe',
    timeoutMs: 120 * SECONDS,
    note: 'Waiting for the station to send Authorize — scan an RFID tag or start authorization on the station now.',
  },
  {
    action: 'TransactionEvent',
    kind: 'observe',
    timeoutMs: 120 * SECONDS,
    note: 'Waiting for the station to start a transaction — plug in and start charging now. (OCPP 1.6 sends StartTransaction instead; see testsuite-run.service.ts.)',
  },
  {
    action: 'MeterValues',
    kind: 'trigger',
    requestedMessage: 'MeterValues',
    timeoutMs: 30 * SECONDS,
    note: 'Only meaningful once a transaction is active — see the preceding TransactionEvent step.',
  },
  {
    action: 'RemoteStart',
    kind: 'command',
    timeoutMs: 30 * SECONDS,
    note: 'Requires idToken + remoteStartId in the run parameters; skipped if not provided.',
  },
  {
    action: 'RemoteStop',
    kind: 'command',
    timeoutMs: 30 * SECONDS,
    note: 'Requires a transactionId in the run parameters (e.g. from the TransactionEvent step); skipped if not provided.',
  },
  {
    action: 'Reset',
    kind: 'command',
    timeoutMs: 30 * SECONDS,
    note: 'Uses type "OnIdle" by default so it does not interrupt a running charge; override via run parameters.',
  },
  {
    action: 'GetVariables',
    kind: 'command',
    timeoutMs: 30 * SECONDS,
    note: 'Requires componentName + variableName in the run parameters; skipped if not provided.',
  },
  {
    action: 'DataTransfer',
    kind: 'command',
    timeoutMs: 30 * SECONDS,
    note: 'Requires a vendorId in the run parameters; skipped if not provided.',
  },
];
