import { act, screen, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithQueryClient } from '../test/render-with-providers.js';
import { LocationsPage } from './locations-page.js';
import * as locationsApi from '../api/locations.js';
import type { LocationRow, StationRow } from '../api/locations.js';

function station(overrides: Partial<StationRow>): StationRow {
  return {
    id: 'station-1',
    chargeboxId: 'cp001',
    label: 'Säule Nord',
    vendor: null,
    model: null,
    ocppVersion: '2.0.1',
    status: 'Planned',
    linkedAt: null,
    connectors: [
      { id: 'c2', label: 'Ladepunkt 2', evseId: 2, connectorId: 1, type: 'cCCS2', format: 'Cable' },
      { id: 'c1', label: 'Ladepunkt 1', evseId: 1, connectorId: 1, type: 'sType2', format: 'Socket' },
    ],
    ...overrides,
  };
}

function location(stations: StationRow[]): LocationRow {
  return {
    id: 'location-1',
    name: 'Parkhaus',
    address: null,
    city: null,
    postalCode: null,
    country: null,
    latitude: null,
    longitude: null,
    stations,
  };
}

function mockApi(stations: StationRow[]) {
  vi.spyOn(locationsApi, 'listLocations').mockResolvedValue([location(stations)]);
  vi.spyOn(locationsApi, 'listUnknownChargers').mockResolvedValue([]);
}

describe('LocationsPage station parameters', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });

  it('shows the parameters of a planned station right away', async () => {
    mockApi([station({ status: 'Planned' })]);

    renderWithQueryClient(<LocationsPage />);

    const panel = await screen.findByRole('region', { name: 'An der Ladesäule eintragen' });
    expect(within(panel).getByText('ws://localhost:8081')).toBeInTheDocument();
    expect(within(panel).getByText('ws://localhost:8081/cp001')).toBeInTheDocument();
    expect(within(panel).getByText('2.0.1 (ocpp2.0.1)')).toBeInTheDocument();
    expect(within(panel).getByText('0 — keine Authentifizierung')).toBeInTheDocument();
  });

  it('lists the connectors in EVSE order', async () => {
    mockApi([station({ status: 'Planned' })]);

    renderWithQueryClient(<LocationsPage />);

    const panel = await screen.findByRole('region', { name: 'An der Ladesäule eintragen' });
    const lines = within(panel)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(lines[0]).toContain('EVSE 1 / Connector 1');
    expect(lines[0]).toContain('sType2');
    expect(lines[1]).toContain('EVSE 2 / Connector 1');
    expect(lines[1]).toContain('cCCS2');
  });

  it('lists each connector once: in the panel while open, as a summary while closed', async () => {
    mockApi([station({ status: 'Planned' })]);

    renderWithQueryClient(<LocationsPage />);
    const toggle = await screen.findByRole('button', { name: 'Parametrierung ausblenden' });

    // Matched by label, not plug type: the closed "new connector" dialog
    // keeps its <option>s in the DOM and would count too.
    const panel = screen.getByRole('region', { name: 'An der Ladesäule eintragen' });
    expect(screen.getAllByText(/Ladepunkt 1/)).toHaveLength(1);
    expect(within(panel).getAllByText(/Ladepunkt 1/)).toHaveLength(1);

    await act(async () => toggle.click());

    expect(screen.queryByRole('region', { name: 'An der Ladesäule eintragen' })).not.toBeInTheDocument();
    expect(screen.getAllByText(/Ladepunkt 1/)).toHaveLength(1);
  });

  it('keeps the parameters of an already linked station hidden until asked', async () => {
    mockApi([station({ status: 'Linked' })]);

    renderWithQueryClient(<LocationsPage />);

    const toggle = await screen.findByRole('button', { name: 'Parametrierung anzeigen' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'An der Ladesäule eintragen' })).not.toBeInTheDocument();

    await act(async () => toggle.click());

    expect(screen.getByRole('region', { name: 'An der Ladesäule eintragen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Parametrierung ausblenden' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('hides the parameters again on a second click', async () => {
    mockApi([station({ status: 'Planned' })]);

    renderWithQueryClient(<LocationsPage />);
    const toggle = await screen.findByRole('button', { name: 'Parametrierung ausblenden' });

    await act(async () => toggle.click());

    expect(screen.queryByRole('region', { name: 'An der Ladesäule eintragen' })).not.toBeInTheDocument();
  });

  it('toggles each station independently', async () => {
    mockApi([
      station({ id: 'a', chargeboxId: 'cp-a', status: 'Planned' }),
      station({ id: 'b', chargeboxId: 'cp-b', status: 'Linked' }),
    ]);

    renderWithQueryClient(<LocationsPage />);

    await waitFor(() => expect(screen.getAllByRole('region', { name: 'An der Ladesäule eintragen' })).toHaveLength(1));
    expect(screen.getByText('ws://localhost:8081/cp-a')).toBeInTheDocument();
    expect(screen.queryByText('ws://localhost:8081/cp-b')).not.toBeInTheDocument();
  });

  it('copies the full url and confirms it', async () => {
    mockApi([station({ status: 'Planned' })]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    renderWithQueryClient(<LocationsPage />);
    const copyFullUrl = await screen.findByRole('button', { name: 'Kopieren: Vollständige URL' });

    await act(async () => copyFullUrl.click());

    expect(writeText).toHaveBeenCalledWith('ws://localhost:8081/cp001');
    expect(within(copyFullUrl).getByText('Kopiert')).toBeInTheDocument();
  });
});
