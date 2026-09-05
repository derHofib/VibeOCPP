import { apiFetch } from '../lib/api-client.js';

export type TestSuiteRunStatus = 'running' | 'completed' | 'aborted';
export type TestSuiteStepKind = 'trigger' | 'command' | 'observe';
export type TestSuiteStepStatus = 'pending' | 'running' | 'pass' | 'fail' | 'timeout' | 'skipped';

export interface TestSuiteRunSummary {
  id: string;
  ocppConnectionName: string;
  manufacturer: string | null;
  model: string | null;
  firmwareVersion: string | null;
  ocppVersion: string;
  status: TestSuiteRunStatus;
  startedAt: string;
  finishedAt: string | null;
}

export interface TestSuiteStepRow {
  id: string;
  sequenceIndex: number;
  action: string;
  kind: TestSuiteStepKind;
  status: TestSuiteStepStatus;
  requestPayload: unknown;
  responsePayload: unknown;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
}

export interface TestSuiteRunDetail extends TestSuiteRunSummary {
  steps: TestSuiteStepRow[];
}

export interface StartRunInput {
  ocppConnectionName: string;
  ocppVersion: string;
  manufacturer?: string;
  model?: string;
  firmwareVersion?: string;
}

export function listRuns(): Promise<TestSuiteRunSummary[]> {
  return apiFetch<TestSuiteRunSummary[]>('/testsuite/runs');
}

export function getRun(id: string): Promise<TestSuiteRunDetail> {
  return apiFetch<TestSuiteRunDetail>(`/testsuite/runs/${id}`);
}

export function startRun(input: StartRunInput): Promise<TestSuiteRunDetail> {
  return apiFetch<TestSuiteRunDetail>('/testsuite/runs', { method: 'POST', body: input });
}
