// API-facing (camelCase) shapes for citrineos-payment's payment_* tables.
// Field names and constraints below are transcribed from that table's own
// SQLAlchemy models in db/init_db.py — this is someone else's schema, not
// ours to redesign, so the shapes here follow it exactly rather than what
// we'd otherwise choose.

export interface Operator {
  id: number;
  name: string;
  stripeAccountId: string;
}
export interface OperatorInput {
  name: string;
  stripeAccountId: string;
}

export interface Location {
  id: number;
  locationId: string;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  operatorId: number | null;
}
export interface LocationInput {
  locationId: string;
  address?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  operatorId?: number;
}

export interface Evse {
  id: number;
  evseId: string;
  ocppEvseId: number;
  status: string;
  stationId: string;
  tenantId: string;
  locationId: number | null;
}
export interface EvseInput {
  evseId: string;
  ocppEvseId: number;
  status: string;
  stationId: string;
  // citrineos-payment's own tenantId column (varchar(3)) — CitrineOS's
  // numeric tenant, not our product tenantId. See
  // citrineos/citrineos-config.service.ts's CitrineOsConfig.citrineosTenantId
  // for the same distinction on the CitrineOS-core side.
  tenantId: string;
  locationId?: number;
}

export interface Connector {
  id: number;
  connectorId: string;
  powerType: string;
  maxVoltage: number;
  maxAmperage: number;
  evseId: number | null;
  tariffId: number | null;
}
export interface ConnectorInput {
  connectorId: string;
  powerType: string;
  maxVoltage: number;
  maxAmperage: number;
  evseId?: number;
  tariffId?: number;
}

export interface Tariff {
  id: number;
  priceKwh: number | null;
  priceMinute: number | null;
  priceSession: number | null;
  currency: string;
  taxRate: number;
  authorizationAmount: number;
  paymentFee: number;
  stripePriceId: string | null;
}
export interface TariffInput {
  priceKwh?: number;
  priceMinute?: number;
  priceSession?: number;
  currency: string;
  taxRate: number;
  authorizationAmount: number;
  paymentFee: number;
  stripePriceId?: string;
}

// Checkouts are runtime data citrineos-payment itself creates during a
// Scan&Charge/Web-Portal checkout — read-only from here, never written.
export interface Checkout {
  id: number;
  paymentIntentId: string | null;
  authorizationAmount: number | null;
  connectorId: number | null;
  tariffId: number | null;
  remoteRequestStatus: string | null;
  remoteRequestTransactionId: string | null;
  transactionStartTime: Date | null;
  transactionEndTime: Date | null;
  transactionKwh: number | null;
  transactionSoc: number | null;
}
