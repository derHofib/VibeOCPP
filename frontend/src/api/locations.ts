import { apiFetch } from '../lib/api-client.js';

export interface ConnectorRow {
  id: string;
  label: string;
  evseId: number;
  connectorId: number;
  type: string;
  format: 'Socket' | 'Cable';
}

export interface StationRow {
  id: string;
  chargeboxId: string;
  label: string;
  vendor: string | null;
  model: string | null;
  ocppVersion: string | null;
  status: 'Planned' | 'Linked';
  linkedAt: string | null;
  connectors: ConnectorRow[];
}

export interface LocationRow {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  stations: StationRow[];
}

export interface CreateLocationInput {
  name: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface CreateStationInput {
  chargeboxId: string;
  label: string;
  vendor?: string;
  model?: string;
  ocppVersion?: string;
}

export interface CreateConnectorInput {
  label: string;
  evseId: number;
  connectorId?: number;
  type: string;
  format: 'Socket' | 'Cable';
}

export interface UnknownChargerRow {
  id: string;
  chargeboxId: string;
  firstSeenAt: string;
  lastSeenAt: string;
  attemptCount: number;
}

export function listLocations(): Promise<LocationRow[]> {
  return apiFetch<LocationRow[]>('/locations');
}

export function createLocation(input: CreateLocationInput): Promise<LocationRow> {
  return apiFetch<LocationRow>('/locations', { method: 'POST', body: input });
}

export function deleteLocation(id: string): Promise<void> {
  return apiFetch<void>(`/locations/${id}`, { method: 'DELETE' });
}

export function createStation(locationId: string, input: CreateStationInput): Promise<StationRow> {
  return apiFetch<StationRow>(`/locations/${locationId}/stations`, { method: 'POST', body: input });
}

export function createConnector(stationId: string, input: CreateConnectorInput): Promise<ConnectorRow> {
  return apiFetch<ConnectorRow>(`/stations/${stationId}/connectors`, { method: 'POST', body: input });
}

export function listUnknownChargers(): Promise<UnknownChargerRow[]> {
  return apiFetch<UnknownChargerRow[]>('/unknown-chargers');
}

export function assignUnknownCharger(id: string, stationId: string): Promise<void> {
  return apiFetch<void>(`/unknown-chargers/${id}/assign`, { method: 'POST', body: { stationId } });
}

export function dismissUnknownCharger(id: string): Promise<void> {
  return apiFetch<void>(`/unknown-chargers/${id}`, { method: 'DELETE' });
}
