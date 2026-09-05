import { apiFetch } from '../lib/api-client.js';

export type MessageOrigin = 'ChargingStation' | 'ChargingStationManagementSystem';
export type MessageEvent = 'connected' | 'closed' | 'message';

export interface MessageLogRow {
  id: string;
  ocppConnectionName: string;
  event: MessageEvent;
  origin: MessageOrigin | null;
  rawMessage: string | null;
  info: { action?: string; correlationId?: string; [key: string]: unknown } | null;
  receivedAt: string;
}

export interface MessageFilter {
  ocppConnectionName?: string;
  action?: string;
  origin?: MessageOrigin;
  after?: string;
  before?: string;
  limit?: number;
}

export function listMessages(filter: MessageFilter = {}): Promise<MessageLogRow[]> {
  return apiFetch<MessageLogRow[]>('/citrineos/messages', {
    query: {
      ocppConnectionName: filter.ocppConnectionName || undefined,
      action: filter.action || undefined,
      origin: filter.origin,
      after: filter.after,
      before: filter.before,
      limit: filter.limit,
    },
  });
}

// The endpoint requires a bearer token, so a plain <a href> can't hit it
// directly (no way to attach the Authorization header to a browser
// navigation) — fetch the CSV text through the authenticated client
// instead and hand the caller a Blob to turn into an object URL.
export async function fetchMessagesCsv(filter: MessageFilter = {}): Promise<Blob> {
  const csv = await apiFetch<string>('/citrineos/messages', {
    query: {
      ocppConnectionName: filter.ocppConnectionName || undefined,
      action: filter.action || undefined,
      origin: filter.origin,
      after: filter.after,
      before: filter.before,
      limit: filter.limit,
      format: 'csv',
    },
  });
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
