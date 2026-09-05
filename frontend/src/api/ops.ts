import { apiFetch } from '../lib/api-client.js';

export interface OpsServiceStatus {
  service: string;
  found: boolean;
  containerId?: string;
  state?: string;
  status?: string;
}

export function listOpsStatus(): Promise<OpsServiceStatus[]> {
  return apiFetch<OpsServiceStatus[]>('/ops/status');
}

export function getOpsLogs(service: string): Promise<{ service: string; logs: string }> {
  return apiFetch<{ service: string; logs: string }>(`/ops/logs/${encodeURIComponent(service)}`);
}

export function restartOpsService(service: string): Promise<{ service: string; restarted: boolean }> {
  return apiFetch(`/ops/restart/${encodeURIComponent(service)}`, { method: 'POST' });
}
