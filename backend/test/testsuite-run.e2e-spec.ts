import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// End-to-end coverage of the testsuite orchestrator (increment 3) against a
// fake CitrineOS that behaves like the real one for the two mechanisms the
// executor depends on:
//  - a TriggerMessage confirmation, followed (asynchronously, like the real
//    subscription webhook) by the station's own spontaneous Call landing on
//    our /citrineos/webhooks/events endpoint;
//  - a command confirmation, followed by CitrineOS calling back to the
//    per-step callbackUrl we passed it with the OCPP response payload.
// The real CitrineOS instance is not reachable from this sandbox — see
// docs/architecture-proposal.md §0.
describe('Testsuite run (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeCitrineOs: Server;
  let fakeCitrineOsUrl: string;
  let backendBaseUrl: string;

  let tenantId: string;
  const runId = randomUUID().slice(0, 8);
  const superAdminEmail = `superadmin-testsuite-${runId}@example.test`;
  const password = 'SuperSecret12345!';
  const webhookSecret = `webhook-secret-${runId}`;
  const stationId = `station-${runId}`;

  function readJsonBody(req: import('node:http').IncomingMessage): Promise<any> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined));
    });
  }

  async function postJson(url: string, body: unknown) {
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  beforeAll(async () => {
    fakeCitrineOs = createServer(async (req, res) => {
      const url = new URL(req.url!, 'http://x');
      const body = await readJsonBody(req);
      const callbackUrl = url.searchParams.get('callbackUrl');

      if (url.pathname === '/ocpp/2/configuration/triggermessage') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ success: true }]));
        // Simulate the station complying: it independently sends
        // BootNotification, which CitrineOS relays via the Subscription
        // webhook we registered — asynchronously, like the real thing.
        setTimeout(() => {
          void postJson(`${backendBaseUrl}/citrineos/webhooks/events?secret=${webhookSecret}`, {
            ocppConnectionName: stationId,
            event: 'message',
            origin: 'ChargingStation',
            message: '[2,"corr-1","BootNotification",{"reason":"PowerUp"}]',
            info: { action: 'BootNotification', type: '2' },
          });
        }, 50);
        return;
      }

      if (url.pathname === '/ocpp/2/evdriver/requeststarttransaction') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ success: true }]));
        if (callbackUrl) {
          setTimeout(() => {
            void postJson(callbackUrl, { status: 'Accepted', transactionId: 'txn-1' });
          }, 50);
        }
        return;
      }

      if (url.pathname === '/ocpp/2/configuration/reset') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ success: true }]));
        if (callbackUrl) {
          setTimeout(() => {
            void postJson(callbackUrl, {
              messageId: body?.messageId ?? 'x',
              errorCode: 'NotImplemented',
              errorDescription: 'Reset while charging is not supported by this station',
              errorDetails: {},
            });
          }, 50);
        }
        return;
      }

      // Every other action (Heartbeat/StatusNotification/MeterValues
      // triggers, Authorize/TransactionEvent observe, GetVariables/
      // DataTransfer commands) — accept and never follow up, so those
      // steps genuinely exercise the timeout path.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify([{ success: true }]));
    });
    await new Promise<void>((resolve) => fakeCitrineOs.listen(0, '127.0.0.1', resolve));
    const address = fakeCitrineOs.address();
    if (!address || typeof address === 'string') throw new Error('failed to bind fake CitrineOS server');
    fakeCitrineOsUrl = `http://127.0.0.1:${address.port}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    await app.listen(0);
    const appAddress = app.getHttpServer().address();
    backendBaseUrl = `http://127.0.0.1:${appAddress.port}`;

    prisma = app.get(PrismaService);
    const tenant = await prisma.tenant.upsert({
      where: { slug: 'default' },
      update: {},
      create: { slug: 'default', name: 'Default' },
    });
    tenantId = tenant.id;

    const argon2 = await import('argon2');
    await prisma.user.create({
      data: {
        tenantId,
        email: superAdminEmail,
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        role: 'SuperAdmin',
      },
    });
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: superAdminEmail } });
    await prisma.setting.deleteMany({ where: { tenantId, category: 'citrineos' } });
    await prisma.testSuiteStep.deleteMany({ where: { run: { tenantId, ocppConnectionName: stationId } } });
    await prisma.testSuiteRun.deleteMany({ where: { tenantId, ocppConnectionName: stationId } });
    await prisma.citrineOsMessageLog.deleteMany({ where: { tenantId, ocppConnectionName: stationId } });
    await app.close();
    await new Promise<void>((resolve) => fakeCitrineOs.close(() => resolve()));
  });

  async function login() {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdminEmail, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('runs the full step catalog and resolves trigger, command, and skip outcomes correctly', async () => {
    const accessToken = await login();

    for (const [key, type, value] of [
      ['dataApiUrl', 'string', fakeCitrineOsUrl],
      ['messageApiUrl', 'string', fakeCitrineOsUrl],
      ['citrineosTenantId', 'string', '1'],
      ['ocppVersion', 'string', '2'],
      ['webhookBaseUrl', 'string', backendBaseUrl],
      ['webhookSecret', 'secret', webhookSecret],
    ] as const) {
      await request(app.getHttpServer())
        .post(`/settings/citrineos/${key}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type, value })
        .expect(201);
    }

    const started = await request(app.getHttpServer())
      .post('/testsuite/runs')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        ocppConnectionName: stationId,
        manufacturer: 'Bender',
        model: 'CC612',
        firmwareVersion: '1.0',
        ocppVersion: '2',
        params: { idToken: { idToken: 'abc123', type: 'ISO14443' }, remoteStartId: 1 },
        // Shortens every step's wait for this test run — see
        // testsuite-run.service.ts's maxTimeoutMs. The fake server answers
        // BootNotification/RemoteStart/Reset within 50ms; everything else
        // is deliberately left unanswered to exercise the timeout path, so
        // this keeps the test from taking the catalog's real 30s-120s.
        maxTimeoutMs: 600,
      })
      .expect(201);

    const runIdResponse = started.body.id;
    expect(started.body.status).toBe('running');
    expect(started.body.steps).toHaveLength(11);

    // maxTimeoutMs above caps every step's wait at 600ms, so the whole run
    // (11 steps, most either resolved quickly or timing out at 600ms)
    // finishes in single-digit seconds — this budget is generous, not
    // tight, for that.
    let finalRun: any;
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const res = await request(app.getHttpServer())
        .get(`/testsuite/runs/${runIdResponse}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      if (res.body.status !== 'running') {
        finalRun = res.body;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    expect(finalRun).toBeDefined();
    expect(finalRun.status).toBe('completed');

    const byAction = Object.fromEntries(finalRun.steps.map((s: any) => [s.action, s]));
    expect(byAction.BootNotification.status).toBe('pass'); // trigger, answered via webhook
    expect(byAction.Heartbeat.status).toBe('timeout'); // trigger, never answered
    expect(byAction.Authorize.status).toBe('timeout'); // observe, never answered
    expect(byAction.RemoteStart.status).toBe('pass'); // command, answered via callback
    expect(byAction.RemoteStart.responsePayload).toEqual({ status: 'Accepted', transactionId: 'txn-1' });
    expect(byAction.RemoteStop.status).toBe('skipped'); // no transactionId supplied
    expect(byAction.Reset.status).toBe('fail'); // command, answered via callback with a CallError
    expect(byAction.Reset.errorMessage).toContain('NotImplemented');
    expect(byAction.GetVariables.status).toBe('skipped'); // no componentName/variableName supplied
    expect(byAction.DataTransfer.status).toBe('skipped'); // no vendorId supplied
  }, 30_000);

  it('lists the run and includes it in listRuns', async () => {
    const accessToken = await login();
    const res = await request(app.getHttpServer())
      .get('/testsuite/runs')
      .query({ ocppConnectionName: stationId })
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].ocppConnectionName).toBe(stationId);
  });
});
