// Queries against our own read-only Hasura mirror of CitrineOS-core's
// database (hasura/README.md) — never against the backend. Field and
// relationship names are verified against citrineos-core's real Sequelize
// models (packages/core/src/dal/layers/sequelize/model/Location/*.ts) and
// our own hasura/metadata/databases/default/tables/*.yaml, not assumed:
// ChargingStations has no direct Connectors relationship — connectors
// nest under Evses, which nest under ChargingStations.

export type ConnectorStatus =
  | 'Available'
  | 'Occupied'
  | 'Reserved'
  | 'Unavailable'
  | 'Faulted'
  // OCPP 1.6 only — CitrineOS stores these in the same `status` column.
  | 'Preparing'
  | 'Charging'
  | 'SuspendedEVSE'
  | 'SuspendedEV'
  | 'Finishing';

export interface ConnectorRow {
  id: string;
  status: ConnectorStatus;
}

export interface EvseRow {
  id: string;
  Connectors: ConnectorRow[];
}

export interface StationRow {
  id: string;
  ocppConnectionName: string;
  isOnline: boolean;
  protocol: string | null;
  chargePointVendor: string | null;
  chargePointModel: string | null;
  firmwareVersion: string | null;
  Location: { name: string } | null;
  Evses: EvseRow[];
}

export interface StationsListResult {
  ChargingStations: StationRow[];
}

export const STATIONS_LIST_SUBSCRIPTION = /* GraphQL */ `
  subscription StationsList {
    ChargingStations(order_by: { ocppConnectionName: asc }) {
      id
      ocppConnectionName
      isOnline
      protocol
      chargePointVendor
      chargePointModel
      firmwareVersion
      Location {
        name
      }
      Evses {
        id
        Connectors {
          id
          status
        }
      }
    }
  }
`;

export function connectorsOf(station: StationRow): ConnectorRow[] {
  return station.Evses.flatMap((evse) => evse.Connectors);
}

// Counts per status, in a fixed display order — a Map so the UI can render
// only the statuses actually present without a switch/if-chain per status.
export function connectorStatusCounts(station: StationRow): Map<ConnectorStatus, number> {
  const counts = new Map<ConnectorStatus, number>();
  for (const connector of connectorsOf(station)) {
    counts.set(connector.status, (counts.get(connector.status) ?? 0) + 1);
  }
  return counts;
}
