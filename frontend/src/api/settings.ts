import { apiFetch } from '../lib/api-client.js';

export type SettingType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface SettingRow {
  id: string;
  category: string;
  key: string;
  type: SettingType;
  value: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string;
}

export function listSettings(): Promise<SettingRow[]> {
  return apiFetch<SettingRow[]>('/settings');
}

export function upsertSetting(
  category: string,
  key: string,
  type: SettingType,
  value: string,
): Promise<SettingRow> {
  return apiFetch<SettingRow>(`/settings/${encodeURIComponent(category)}/${encodeURIComponent(key)}`, {
    method: 'POST',
    body: { type, value },
  });
}

// Groups the flat settings list the backend returns into one bucket per
// category, in first-seen order — the API has no notion of category order,
// so this just follows whatever order the rows come back in.
export function groupByCategory(settings: SettingRow[]): Map<string, SettingRow[]> {
  const groups = new Map<string, SettingRow[]>();
  for (const setting of settings) {
    const bucket = groups.get(setting.category);
    if (bucket) {
      bucket.push(setting);
    } else {
      groups.set(setting.category, [setting]);
    }
  }
  return groups;
}
