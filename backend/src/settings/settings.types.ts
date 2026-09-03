export type SettingType = 'string' | 'number' | 'boolean' | 'json' | 'secret';

export interface SettingView {
  id: string;
  category: string;
  key: string;
  type: SettingType;
  // Plaintext for non-secret types, masked (e.g. "••••1234") for secrets.
  // A secret's real value is never returned through this shape.
  value: string;
  version: number;
  updatedBy: string | null;
  updatedAt: Date;
}

export interface UpsertSettingInput {
  tenantId: string;
  category: string;
  key: string;
  type: SettingType;
  value: string;
  updatedBy?: string;
}
