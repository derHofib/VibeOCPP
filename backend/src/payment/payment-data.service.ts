import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentDbService } from './payment-db.service.js';
import type {
  Checkout,
  Connector,
  ConnectorInput,
  Evse,
  EvseInput,
  Location,
  LocationInput,
  Operator,
  OperatorInput,
  Tariff,
  TariffInput,
} from './payment.types.js';

// Thin, explicit CRUD against citrineos-payment's own payment_* tables —
// see payment.types.ts for why this reaches into someone else's schema at
// all. Each method is a plain parameterized query, not a generic
// query-builder: the entities are few and small enough that explicit SQL
// per entity stays more readable than an abstraction over their
// differences (nullable columns, different FK targets, etc).
@Injectable()
export class PaymentDataService {
  constructor(private readonly db: PaymentDbService) {}

  // ---- Operators ----------------------------------------------------

  async listOperators(tenantId: string): Promise<Operator[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, name, stripe_account_id FROM ${tablePrefix}operators ORDER BY name`,
    );
    return rows.map(rowToOperator);
  }

  async getOperator(tenantId: string, id: number): Promise<Operator> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, name, stripe_account_id FROM ${tablePrefix}operators WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Operator not found');
    return rowToOperator(rows[0]);
  }

  async createOperator(tenantId: string, input: OperatorInput): Promise<Operator> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `INSERT INTO ${tablePrefix}operators (name, stripe_account_id) VALUES ($1, $2)
       RETURNING id, name, stripe_account_id`,
      [input.name, input.stripeAccountId],
    );
    return rowToOperator(rows[0]);
  }

  async updateOperator(tenantId: string, id: number, input: Partial<OperatorInput>): Promise<Operator> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `UPDATE ${tablePrefix}operators
       SET name = COALESCE($2, name), stripe_account_id = COALESCE($3, stripe_account_id)
       WHERE id = $1
       RETURNING id, name, stripe_account_id`,
      [id, input.name ?? null, input.stripeAccountId ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Operator not found');
    return rowToOperator(rows[0]);
  }

  async deleteOperator(tenantId: string, id: number): Promise<void> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${tablePrefix}operators WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Operator not found');
  }

  // ---- Locations ------------------------------------------------------

  async listLocations(tenantId: string): Promise<Location[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, location_id, address, postal_code, city, state, country, operator_id
       FROM ${tablePrefix}locations ORDER BY location_id`,
    );
    return rows.map(rowToLocation);
  }

  async getLocation(tenantId: string, id: number): Promise<Location> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, location_id, address, postal_code, city, state, country, operator_id
       FROM ${tablePrefix}locations WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Location not found');
    return rowToLocation(rows[0]);
  }

  async createLocation(tenantId: string, input: LocationInput): Promise<Location> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `INSERT INTO ${tablePrefix}locations
         (location_id, address, postal_code, city, state, country, operator_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, location_id, address, postal_code, city, state, country, operator_id`,
      [
        input.locationId,
        input.address ?? null,
        input.postalCode ?? null,
        input.city ?? null,
        input.state ?? null,
        input.country ?? null,
        input.operatorId ?? null,
      ],
    );
    return rowToLocation(rows[0]);
  }

  async updateLocation(tenantId: string, id: number, input: Partial<LocationInput>): Promise<Location> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `UPDATE ${tablePrefix}locations SET
         location_id = COALESCE($2, location_id),
         address = COALESCE($3, address),
         postal_code = COALESCE($4, postal_code),
         city = COALESCE($5, city),
         state = COALESCE($6, state),
         country = COALESCE($7, country),
         operator_id = COALESCE($8, operator_id)
       WHERE id = $1
       RETURNING id, location_id, address, postal_code, city, state, country, operator_id`,
      [
        id,
        input.locationId ?? null,
        input.address ?? null,
        input.postalCode ?? null,
        input.city ?? null,
        input.state ?? null,
        input.country ?? null,
        input.operatorId ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Location not found');
    return rowToLocation(rows[0]);
  }

  async deleteLocation(tenantId: string, id: number): Promise<void> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${tablePrefix}locations WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Location not found');
  }

  // ---- Evses ------------------------------------------------------------

  async listEvses(tenantId: string): Promise<Evse[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id
       FROM ${tablePrefix}evses ORDER BY evse_id`,
    );
    return rows.map(rowToEvse);
  }

  async getEvse(tenantId: string, id: number): Promise<Evse> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id
       FROM ${tablePrefix}evses WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Evse not found');
    return rowToEvse(rows[0]);
  }

  async createEvse(tenantId: string, input: EvseInput): Promise<Evse> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `INSERT INTO ${tablePrefix}evses
         (evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id`,
      [input.evseId, input.ocppEvseId, input.status, input.stationId, input.tenantId, input.locationId ?? null],
    );
    return rowToEvse(rows[0]);
  }

  async updateEvse(tenantId: string, id: number, input: Partial<EvseInput>): Promise<Evse> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `UPDATE ${tablePrefix}evses SET
         evse_id = COALESCE($2, evse_id),
         ocpp_evse_id = COALESCE($3, ocpp_evse_id),
         status = COALESCE($4, status),
         station_id = COALESCE($5, station_id),
         tenant_id = COALESCE($6, tenant_id),
         location_id = COALESCE($7, location_id)
       WHERE id = $1
       RETURNING id, evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id`,
      [
        id,
        input.evseId ?? null,
        input.ocppEvseId ?? null,
        input.status ?? null,
        input.stationId ?? null,
        input.tenantId ?? null,
        input.locationId ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Evse not found');
    return rowToEvse(rows[0]);
  }

  async deleteEvse(tenantId: string, id: number): Promise<void> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${tablePrefix}evses WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Evse not found');
  }

  // ---- Connectors ---------------------------------------------------

  async listConnectors(tenantId: string): Promise<Connector[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, connector_id, power_type, max_voltage, max_amperage, evse_id, tariff_id
       FROM ${tablePrefix}connectors ORDER BY connector_id`,
    );
    return rows.map(rowToConnector);
  }

  async getConnector(tenantId: string, id: number): Promise<Connector> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, connector_id, power_type, max_voltage, max_amperage, evse_id, tariff_id
       FROM ${tablePrefix}connectors WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Connector not found');
    return rowToConnector(rows[0]);
  }

  async createConnector(tenantId: string, input: ConnectorInput): Promise<Connector> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `INSERT INTO ${tablePrefix}connectors
         (connector_id, power_type, max_voltage, max_amperage, evse_id, tariff_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, connector_id, power_type, max_voltage, max_amperage, evse_id, tariff_id`,
      [
        input.connectorId,
        input.powerType,
        input.maxVoltage,
        input.maxAmperage,
        input.evseId ?? null,
        input.tariffId ?? null,
      ],
    );
    return rowToConnector(rows[0]);
  }

  async updateConnector(tenantId: string, id: number, input: Partial<ConnectorInput>): Promise<Connector> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `UPDATE ${tablePrefix}connectors SET
         connector_id = COALESCE($2, connector_id),
         power_type = COALESCE($3, power_type),
         max_voltage = COALESCE($4, max_voltage),
         max_amperage = COALESCE($5, max_amperage),
         evse_id = COALESCE($6, evse_id),
         tariff_id = COALESCE($7, tariff_id)
       WHERE id = $1
       RETURNING id, connector_id, power_type, max_voltage, max_amperage, evse_id, tariff_id`,
      [
        id,
        input.connectorId ?? null,
        input.powerType ?? null,
        input.maxVoltage ?? null,
        input.maxAmperage ?? null,
        input.evseId ?? null,
        input.tariffId ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Connector not found');
    return rowToConnector(rows[0]);
  }

  async deleteConnector(tenantId: string, id: number): Promise<void> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${tablePrefix}connectors WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Connector not found');
  }

  // ---- Tariffs ------------------------------------------------------

  async listTariffs(tenantId: string): Promise<Tariff[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, price_kwh, price_minute, price_session, currency, tax_rate,
              authorization_amount, payment_fee, stripe_price_id
       FROM ${tablePrefix}tariffs ORDER BY id`,
    );
    return rows.map(rowToTariff);
  }

  async getTariff(tenantId: string, id: number): Promise<Tariff> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, price_kwh, price_minute, price_session, currency, tax_rate,
              authorization_amount, payment_fee, stripe_price_id
       FROM ${tablePrefix}tariffs WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Tariff not found');
    return rowToTariff(rows[0]);
  }

  async createTariff(tenantId: string, input: TariffInput): Promise<Tariff> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `INSERT INTO ${tablePrefix}tariffs
         (price_kwh, price_minute, price_session, currency, tax_rate,
          authorization_amount, payment_fee, stripe_price_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, price_kwh, price_minute, price_session, currency, tax_rate,
                 authorization_amount, payment_fee, stripe_price_id`,
      [
        input.priceKwh ?? null,
        input.priceMinute ?? null,
        input.priceSession ?? null,
        input.currency,
        input.taxRate,
        input.authorizationAmount,
        input.paymentFee,
        input.stripePriceId ?? null,
      ],
    );
    return rowToTariff(rows[0]);
  }

  async updateTariff(tenantId: string, id: number, input: Partial<TariffInput>): Promise<Tariff> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `UPDATE ${tablePrefix}tariffs SET
         price_kwh = COALESCE($2, price_kwh),
         price_minute = COALESCE($3, price_minute),
         price_session = COALESCE($4, price_session),
         currency = COALESCE($5, currency),
         tax_rate = COALESCE($6, tax_rate),
         authorization_amount = COALESCE($7, authorization_amount),
         payment_fee = COALESCE($8, payment_fee),
         stripe_price_id = COALESCE($9, stripe_price_id)
       WHERE id = $1
       RETURNING id, price_kwh, price_minute, price_session, currency, tax_rate,
                 authorization_amount, payment_fee, stripe_price_id`,
      [
        id,
        input.priceKwh ?? null,
        input.priceMinute ?? null,
        input.priceSession ?? null,
        input.currency ?? null,
        input.taxRate ?? null,
        input.authorizationAmount ?? null,
        input.paymentFee ?? null,
        input.stripePriceId ?? null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Tariff not found');
    return rowToTariff(rows[0]);
  }

  async deleteTariff(tenantId: string, id: number): Promise<void> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const result = await pool.query(`DELETE FROM ${tablePrefix}tariffs WHERE id = $1`, [id]);
    if (result.rowCount === 0) throw new NotFoundException('Tariff not found');
  }

  // ---- Checkouts (read-only — citrineos-payment creates these itself) ---

  async listCheckouts(tenantId: string, limit = 100): Promise<Checkout[]> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, payment_intent_id, authorization_amount, connector_id, tariff_id,
              remote_request_status, remote_request_transaction_id,
              transaction_start_time, transaction_end_time, transaction_kwh, transaction_soc
       FROM ${tablePrefix}checkouts
       ORDER BY id DESC
       LIMIT $1`,
      [Math.min(limit, 500)],
    );
    return rows.map(rowToCheckout);
  }

  async getCheckout(tenantId: string, id: number): Promise<Checkout> {
    const { pool, tablePrefix } = await this.db.getPool(tenantId);
    const { rows } = await pool.query(
      `SELECT id, payment_intent_id, authorization_amount, connector_id, tariff_id,
              remote_request_status, remote_request_transaction_id,
              transaction_start_time, transaction_end_time, transaction_kwh, transaction_soc
       FROM ${tablePrefix}checkouts WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Checkout not found');
    return rowToCheckout(rows[0]);
  }
}

function rowToOperator(row: any): Operator {
  return { id: row.id, name: row.name, stripeAccountId: row.stripe_account_id };
}

function rowToLocation(row: any): Location {
  return {
    id: row.id,
    locationId: row.location_id,
    address: row.address,
    postalCode: row.postal_code,
    city: row.city,
    state: row.state,
    country: row.country,
    operatorId: row.operator_id,
  };
}

function rowToEvse(row: any): Evse {
  return {
    id: row.id,
    evseId: row.evse_id,
    ocppEvseId: row.ocpp_evse_id,
    status: row.status,
    stationId: row.station_id,
    tenantId: row.tenant_id,
    locationId: row.location_id,
  };
}

function rowToConnector(row: any): Connector {
  return {
    id: row.id,
    connectorId: row.connector_id,
    powerType: row.power_type,
    maxVoltage: row.max_voltage,
    maxAmperage: row.max_amperage,
    evseId: row.evse_id,
    tariffId: row.tariff_id,
  };
}

function rowToTariff(row: any): Tariff {
  return {
    id: row.id,
    priceKwh: row.price_kwh,
    priceMinute: row.price_minute,
    priceSession: row.price_session,
    currency: row.currency,
    taxRate: row.tax_rate,
    authorizationAmount: row.authorization_amount,
    paymentFee: row.payment_fee,
    stripePriceId: row.stripe_price_id,
  };
}

function rowToCheckout(row: any): Checkout {
  return {
    id: row.id,
    paymentIntentId: row.payment_intent_id,
    authorizationAmount: row.authorization_amount,
    connectorId: row.connector_id,
    tariffId: row.tariff_id,
    remoteRequestStatus: row.remote_request_status,
    remoteRequestTransactionId: row.remote_request_transaction_id,
    transactionStartTime: row.transaction_start_time,
    transactionEndTime: row.transaction_end_time,
    transactionKwh: row.transaction_kwh,
    transactionSoc: row.transaction_soc,
  };
}
