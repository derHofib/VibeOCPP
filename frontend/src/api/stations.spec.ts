import { connectorsOf, connectorStatusCounts, type StationRow } from './stations.js';

function station(evses: StationRow['Evses']): StationRow {
  return {
    id: 's1',
    ocppConnectionName: 'CP-01',
    isOnline: true,
    protocol: '2.0.1',
    chargePointVendor: null,
    chargePointModel: null,
    firmwareVersion: null,
    Location: null,
    Evses: evses,
  };
}

describe('connectorsOf', () => {
  it('flattens connectors across every EVSE on the station', () => {
    const s = station([
      { id: 'evse-1', Connectors: [{ id: 'c1', status: 'Available' }] },
      { id: 'evse-2', Connectors: [{ id: 'c2', status: 'Faulted' }, { id: 'c3', status: 'Occupied' }] },
    ]);
    expect(connectorsOf(s).map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it('returns an empty array for a station with no EVSEs', () => {
    expect(connectorsOf(station([]))).toEqual([]);
  });
});

describe('connectorStatusCounts', () => {
  it('counts connectors per status', () => {
    const s = station([
      { id: 'evse-1', Connectors: [{ id: 'c1', status: 'Available' }, { id: 'c2', status: 'Available' }] },
      { id: 'evse-2', Connectors: [{ id: 'c3', status: 'Faulted' }] },
    ]);
    const counts = connectorStatusCounts(s);
    expect(counts.get('Available')).toBe(2);
    expect(counts.get('Faulted')).toBe(1);
    expect(counts.get('Occupied')).toBeUndefined();
  });

  it('returns an empty map for a station with no connectors', () => {
    expect(connectorStatusCounts(station([])).size).toBe(0);
  });
});
