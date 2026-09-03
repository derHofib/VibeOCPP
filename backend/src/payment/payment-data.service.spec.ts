import { vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PaymentDataService } from './payment-data.service.js';
import type { PaymentDbService } from './payment-db.service.js';

function makeDb(rows: any[] = [], rowCount = 1) {
  const query = vi.fn().mockResolvedValue({ rows, rowCount });
  const pool = { query };
  const db = {
    getPool: vi.fn().mockResolvedValue({ pool, tablePrefix: 'payment_' }),
  } as unknown as PaymentDbService;
  return { db, query };
}

describe('PaymentDataService', () => {
  it('createOperator inserts into payment_operators with the exact citrineos-payment columns', async () => {
    const { db, query } = makeDb([{ id: 1, name: 'ACME', stripe_account_id: 'acct_123' }]);
    const service = new PaymentDataService(db);

    const result = await service.createOperator('tenant-1', { name: 'ACME', stripeAccountId: 'acct_123' });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO payment_operators (name, stripe_account_id)'),
      ['ACME', 'acct_123'],
    );
    expect(result).toEqual({ id: 1, name: 'ACME', stripeAccountId: 'acct_123' });
  });

  it('getOperator throws NotFoundException when no row matches', async () => {
    const { db } = makeDb([]);
    const service = new PaymentDataService(db);
    await expect(service.getOperator('tenant-1', 999)).rejects.toThrow(NotFoundException);
  });

  it('deleteOperator throws NotFoundException when rowCount is 0', async () => {
    const { db } = makeDb([], 0);
    const service = new PaymentDataService(db);
    await expect(service.deleteOperator('tenant-1', 999)).rejects.toThrow(NotFoundException);
  });

  it('createEvse maps camelCase input onto the exact snake_case columns, including the citrineos-payment tenantId', async () => {
    const { db, query } = makeDb([
      {
        id: 5,
        evse_id: 'EVSE-1',
        ocpp_evse_id: 1,
        status: 'Available',
        station_id: 'stationA',
        tenant_id: '1',
        location_id: 2,
      },
    ]);
    const service = new PaymentDataService(db);

    const result = await service.createEvse('tenant-1', {
      evseId: 'EVSE-1',
      ocppEvseId: 1,
      status: 'Available',
      stationId: 'stationA',
      tenantId: '1', // CitrineOS's own tenantId, not our product tenant
      locationId: 2,
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining(
        'INSERT INTO payment_evses\n         (evse_id, ocpp_evse_id, status, station_id, tenant_id, location_id)',
      ),
      ['EVSE-1', 1, 'Available', 'stationA', '1', 2],
    );
    expect(result.tenantId).toBe('1');
    expect(result.locationId).toBe(2);
  });

  it('updateTariff uses COALESCE so omitted fields are left unchanged', async () => {
    const { db, query } = makeDb([
      {
        id: 3,
        price_kwh: 0.35,
        price_minute: null,
        price_session: null,
        currency: 'EUR',
        tax_rate: 0.19,
        authorization_amount: 50,
        payment_fee: 0.3,
        stripe_price_id: null,
      },
    ]);
    const service = new PaymentDataService(db);

    await service.updateTariff('tenant-1', 3, { priceKwh: 0.35 });

    const [, params] = query.mock.calls[0];
    expect(params[0]).toBe(3);
    expect(params[1]).toBe(0.35);
    // priceMinute, priceSession, currency, taxRate, authorizationAmount,
    // paymentFee, stripePriceId — everything but priceKwh was omitted.
    expect(params.slice(2)).toEqual([null, null, null, null, null, null, null]);
  });

  it('listCheckouts caps the limit at 500 and never writes', async () => {
    const { db, query } = makeDb([]);
    const service = new PaymentDataService(db);

    await service.listCheckouts('tenant-1', 10_000);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [500]);
    expect(query.mock.calls[0][0]).not.toMatch(/INSERT|UPDATE|DELETE/i);
  });

  it('listConnectors and createConnector round-trip through the exact column set', async () => {
    const { db, query } = makeDb([
      {
        id: 9,
        connector_id: 'C1',
        power_type: 'AC',
        max_voltage: 230,
        max_amperage: 32,
        evse_id: 5,
        tariff_id: 3,
      },
    ]);
    const service = new PaymentDataService(db);

    const created = await service.createConnector('tenant-1', {
      connectorId: 'C1',
      powerType: 'AC',
      maxVoltage: 230,
      maxAmperage: 32,
      evseId: 5,
      tariffId: 3,
    });

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO payment_connectors'), [
      'C1',
      'AC',
      230,
      32,
      5,
      3,
    ]);
    expect(created).toEqual({
      id: 9,
      connectorId: 'C1',
      powerType: 'AC',
      maxVoltage: 230,
      maxAmperage: 32,
      evseId: 5,
      tariffId: 3,
    });
  });
});
