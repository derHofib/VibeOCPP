import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// End-to-end coverage of the payment integration (increment 4) against a
// real Postgres database whose schema exactly mirrors citrineos-payment's
// own SQLAlchemy models (db/init_db.py in citrineos/citrineos-payment) —
// column names, types, and FKs, table-name prefix included. There is no
// live citrineos-payment container reachable from this sandbox, so this is
// the strongest available proof that our raw SQL matches its real schema.
describe('Payment integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let paymentPool: Pool;
  let paymentDbName: string;

  let tenantId: string;
  const runId = randomUUID().slice(0, 8);
  const superAdminEmail = `superadmin-payment-${runId}@example.test`;
  const adminEmail = `admin-payment-${runId}@example.test`;
  const staffEmail = `staff-payment-${runId}@example.test`;
  const password = 'SuperSecret12345!';

  async function createPaymentSchema(pool: Pool) {
    await pool.query(`
      CREATE TABLE payment_operators (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        stripe_account_id VARCHAR(255) NOT NULL UNIQUE
      );
      CREATE TABLE payment_locations (
        id SERIAL PRIMARY KEY,
        location_id VARCHAR(36) NOT NULL UNIQUE,
        address VARCHAR(255), postal_code VARCHAR(10), city VARCHAR(45),
        state VARCHAR(45), country VARCHAR(3),
        operator_id INTEGER REFERENCES payment_operators(id)
      );
      CREATE TABLE payment_evses (
        id SERIAL PRIMARY KEY,
        evse_id VARCHAR(48) NOT NULL UNIQUE,
        ocpp_evse_id INTEGER NOT NULL,
        status VARCHAR(48) NOT NULL,
        station_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(3) NOT NULL,
        location_id INTEGER REFERENCES payment_locations(id)
      );
      CREATE TABLE payment_tariffs (
        id SERIAL PRIMARY KEY,
        price_kwh FLOAT, price_minute FLOAT, price_session FLOAT,
        currency VARCHAR(3) NOT NULL,
        tax_rate FLOAT NOT NULL,
        authorization_amount FLOAT NOT NULL,
        payment_fee FLOAT NOT NULL,
        stripe_price_id VARCHAR(255) UNIQUE
      );
      CREATE TABLE payment_connectors (
        id SERIAL PRIMARY KEY,
        connector_id VARCHAR(36) NOT NULL,
        power_type VARCHAR(20) NOT NULL,
        max_voltage INTEGER NOT NULL,
        max_amperage INTEGER NOT NULL,
        evse_id INTEGER REFERENCES payment_evses(id),
        tariff_id INTEGER REFERENCES payment_tariffs(id)
      );
      CREATE TABLE payment_checkouts (
        id SERIAL PRIMARY KEY,
        payment_intent_id VARCHAR(255) UNIQUE,
        authorization_amount FLOAT,
        connector_id INTEGER REFERENCES payment_connectors(id),
        tariff_id INTEGER REFERENCES payment_tariffs(id),
        qr_code_message_id INTEGER,
        remote_request_status VARCHAR(8),
        remote_request_transaction_id VARCHAR(36),
        transaction_start_time TIMESTAMPTZ,
        transaction_end_time TIMESTAMPTZ,
        transaction_last_meter_reading FLOAT,
        transaction_kwh FLOAT,
        power_active_import FLOAT,
        transaction_soc FLOAT
      );
    `);
  }

  beforeAll(async () => {
    paymentDbName = `citrine_payment_test_${runId}`;
    const admin = new Pool({ connectionString: 'postgresql://csms:csms_dev_pw@localhost:5432/postgres' });
    await admin.query(`CREATE DATABASE ${paymentDbName}`);
    await admin.end();

    const paymentDbUrl = `postgresql://csms:csms_dev_pw@localhost:5432/${paymentDbName}`;
    paymentPool = new Pool({ connectionString: paymentDbUrl });
    await createPaymentSchema(paymentPool);

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'default' },
      update: {},
      create: { slug: 'default', name: 'Default' },
    });
    tenantId = tenant.id;

    const argon2 = await import('argon2');
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await prisma.user.createMany({
      data: [
        { tenantId, email: superAdminEmail, passwordHash, role: 'SuperAdmin' },
        { tenantId, email: adminEmail, passwordHash, role: 'Admin' },
        { tenantId, email: staffEmail, passwordHash, role: 'Mitarbeiter' },
      ],
    });

    // Configure settings/payment/* as SuperAdmin, same as an operator would
    // through the (not-yet-built) SuperAdmin UI.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdminEmail, password })
      .expect(200);
    const token = login.body.accessToken as string;
    await request(app.getHttpServer())
      .post('/settings/payment/databaseUrl')
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'secret', value: paymentDbUrl })
      .expect(201);
  }, 30000);

  afterAll(async () => {
    const testUsers = await prisma.user.findMany({
      where: { email: { in: [superAdminEmail, adminEmail, staffEmail] } },
      select: { id: true },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: testUsers.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { email: { in: [superAdminEmail, adminEmail, staffEmail] } } });
    await prisma.setting.deleteMany({ where: { tenantId, category: 'payment' } });
    await app.close(); // closes PaymentDbService's pools too (onModuleDestroy)
    await paymentPool.end();
    const admin = new Pool({ connectionString: 'postgresql://csms:csms_dev_pw@localhost:5432/postgres' });
    await admin.query(`DROP DATABASE IF EXISTS ${paymentDbName}`);
    await admin.end();
  });

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('reports healthy once the schema exists', async () => {
    const token = await login(superAdminEmail);
    await request(app.getHttpServer())
      .get('/payment/health')
      .set('Authorization', `Bearer ${token}`)
      .expect(200, { status: 'ok' });
  });

  it('walks Operator -> Location -> Tariff -> Evse -> Connector through real FK constraints', async () => {
    const token = await login(adminEmail);
    const http = request(app.getHttpServer());

    const operator = await http
      .post('/payment/operators')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `ACME-${runId}`, stripeAccountId: `acct_${runId}` })
      .expect(201);
    expect(operator.body).toMatchObject({ name: `ACME-${runId}`, stripeAccountId: `acct_${runId}` });

    const location = await http
      .post('/payment/locations')
      .set('Authorization', `Bearer ${token}`)
      .send({ locationId: `loc-${runId}`, city: 'Berlin', country: 'DEU', operatorId: operator.body.id })
      .expect(201);

    const tariff = await http
      .post('/payment/tariffs')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceKwh: 0.45, currency: 'EUR', taxRate: 0.19, authorizationAmount: 50, paymentFee: 0.3 })
      .expect(201);

    const evse = await http
      .post('/payment/evses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        evseId: `EVSE-${runId}`,
        ocppEvseId: 1,
        status: 'Available',
        stationId: `station-${runId}`,
        tenantId: '1',
        locationId: location.body.id,
      })
      .expect(201);

    const connector = await http
      .post('/payment/connectors')
      .set('Authorization', `Bearer ${token}`)
      .send({
        connectorId: `C-${runId}`,
        powerType: 'AC',
        maxVoltage: 230,
        maxAmperage: 32,
        evseId: evse.body.id,
        tariffId: tariff.body.id,
      })
      .expect(201);
    expect(connector.body.evseId).toBe(evse.body.id);
    expect(connector.body.tariffId).toBe(tariff.body.id);

    // Read back through GET, list, and update.
    const fetched = await http
      .get(`/payment/connectors/${connector.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(fetched.body).toEqual(connector.body);

    const updated = await http
      .patch(`/payment/tariffs/${tariff.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priceKwh: 0.5 })
      .expect(200);
    expect(updated.body.priceKwh).toBe(0.5);
    expect(updated.body.currency).toBe('EUR'); // untouched field preserved via COALESCE

    const list = await http.get('/payment/operators').set('Authorization', `Bearer ${token}`).expect(200);
    expect(list.body.some((o: any) => o.id === operator.body.id)).toBe(true);

    // Cleanup in FK order so later tests (e.g. a rerun) aren't blocked.
    await http.delete(`/payment/connectors/${connector.body.id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await http.delete(`/payment/evses/${evse.body.id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await http.delete(`/payment/tariffs/${tariff.body.id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await http.delete(`/payment/locations/${location.body.id}`).set('Authorization', `Bearer ${token}`).expect(204);
    await http.delete(`/payment/operators/${operator.body.id}`).set('Authorization', `Bearer ${token}`).expect(204);
  });

  it('returns 404 for a non-existent operator and on double delete', async () => {
    const token = await login(adminEmail);
    await request(app.getHttpServer())
      .get('/payment/operators/999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    await request(app.getHttpServer())
      .delete('/payment/operators/999999')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  it('reads seeded checkouts read-only, without ever writing to that table', async () => {
    const insert = await paymentPool.query(
      `INSERT INTO payment_checkouts (payment_intent_id, authorization_amount, remote_request_status, transaction_kwh)
       VALUES ($1, 50, 'accepted', 12.3) RETURNING id`,
      [`pi_${runId}`],
    );
    const checkoutId = insert.rows[0].id;
    const token = await login(adminEmail);

    const res = await request(app.getHttpServer())
      .get(`/payment/checkouts/${checkoutId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body).toMatchObject({
      paymentIntentId: `pi_${runId}`,
      remoteRequestStatus: 'accepted',
      transactionKwh: 12.3,
    });

    await paymentPool.query('DELETE FROM payment_checkouts WHERE id = $1', [checkoutId]);
  });

  it('denies Mitarbeiter access but allows Admin and SuperAdmin', async () => {
    const staffToken = await login(staffEmail);
    await request(app.getHttpServer())
      .get('/payment/operators')
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(403);

    const adminToken = await login(adminEmail);
    await request(app.getHttpServer())
      .get('/payment/operators')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('restricts /payment/health to SuperAdmin, unlike the rest of /payment', async () => {
    const adminToken = await login(adminEmail);
    await request(app.getHttpServer())
      .get('/payment/health')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);
  });
});
