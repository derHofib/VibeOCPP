// Operator-supplied inputs for the 'command' steps that need them (see
// testsuite-step-catalog.ts). Deliberately not inferred from prior steps
// (e.g. pulling transactionId out of the TransactionEvent step's captured
// message) in this increment — that needs per-OCPP-version payload parsing
// this increment doesn't attempt; the operator supplies known values
// instead, and an unset field means that step is skipped rather than
// guessed at.
export interface TestSuiteRunParams {
  idToken?: { idToken: string; type: string };
  remoteStartId?: number;
  evseId?: number;
  transactionId?: string;
  resetType?: 'Immediate' | 'OnIdle' | 'ImmediateAndResume';
  componentName?: string;
  variableName?: string;
  vendorId?: string;
}
