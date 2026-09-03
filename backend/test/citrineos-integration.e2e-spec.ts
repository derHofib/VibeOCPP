import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { createServer, type Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// End-to-end coverage of the CitrineOS integration layer (increment 2):
// settings-driven configuration, the Data/Message API clients against a
// real HTTP server (a tiny fake CitrineOS, since the real thing is not
// reachable from this sandbox — see docs/architecture-proposal.md §0), the
// webhook receiver's shared-secret check, and RBAC on the command/message
// endpoints.
describe('CitrineOS integration (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let fakeCitrineOs: Server;
  let fakeCitrineOsUrl: string;
  let receivedRequests: { method: string; url: string; body: unknown }[] = [];

  let tenantId: string;
  const runId = randomUUID().slice(0, 8);
  const superAdminEmail = `superadmin-citrineos-${runId}@example.test`;
  const staffEmail = `staff-citrineos-${runId}@example.test`;
  const password = 'SuperSecret12345!';
  const webhookSecret = `webhook-secret-${runId}`;

  beforeAll(async () => {
    fakeCitrineOs = createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        const bodyText = Buffer.concat(chunks).toString('utf8');
        receivedRequests.push({
          method: req.method!,
          url: req.url!,
          body: bodyText ? JSON.parse(bodyText) : undefined,
        });

        if (req.url?.startsWith('/data/ocpprouter/systemconfig')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        if (req.url?.startsWith('/ocpp/2/evdriver/requeststarttransaction')) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([{ success: true }]));
          return;
        }
        if (req.url?.startsWith('/data/ocpprouter/subscription') && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify([]));
          return;
        }
        if (req.url?.startsWith('/data/ocpprouter/subscription') && req.method === 'POST') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end('7');
          return;
        }
        res.writeHead(404);
        res.end();
      });
    });
    await new Promise<void>((resolve) => fakeCitrineOs.listen(0, '127.0.0.1', resolve));
    const address = fakeCitrineOs.address();
    if (!address || typeof address === 'string') throw new Error('failed to bind fake CitrineOS server');
    fakeCitrineOsUrl = `http://127.0.0.1:${address.port}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

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
  });

  afterAll(async () => {
    const testUsers = await prisma.user.findMany({
      where: { email: { in: [superAdminEmail, staffEmail] } },
      select: { id: true },
    });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: testUsers.map((u) => u.id) } } });
    await prisma.user.deleteMany({ where: { email: { in: [superAdminEmail, staffEmail] } } });
    await prisma.setting.deleteMany({ where: { tenantId, category: 'citrineos' } });
    await prisma.citrineOsMessageLog.deleteMany({ where: { tenantId } });
    await app.close();
    await new Promise<void>((resolve) => fakeCitrineOs.close(() => resolve()));
  });

  async function login(email: string, plainPassword: string = password) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: plainPassword })
      .expect(200);
    return res.body as { accessToken: string };
  }

  async function configureCitrineOsConnection(accessToken: string) {
    const settings: [string, 'string' | 'secret', string][] = [
      ['dataApiUrl', 'string', fakeCitrineOsUrl],
      ['messageApiUrl', 'string', fakeCitrineOsUrl],
      ['citrineosTenantId', 'string', '1'],
      ['ocppVersion', 'string', '2'],
      ['webhookBaseUrl', 'string', 'https://bff.example.test'],
      ['webhookSecret', 'secret', webhookSecret],
    ];
    for (const [key, type, value] of settings) {
      await request(app.getHttpServer())
        .post(`/settings/citrineos/${key}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ type, value })
        .expect(201);
    }
  }

  it('rejects CitrineOS calls before the connection has been configured', async () => {
    const { accessToken } = await login(superAdminEmail);
    await request(app.getHttpServer())
      .get('/citrineos/health')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(500);
  });

  it('pings a real HTTP endpoint once settings/citrineos/* is configured', async () => {
    receivedRequests = [];
    const { accessToken } = await login(superAdminEmail);
    await configureCitrineOsConnection(accessToken);

    await request(app.getHttpServer())
      .get('/citrineos/health')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200, { status: 'ok' });

    expect(receivedRequests[0].method).toBe('GET');
    expect(receivedRequests[0].url).toBe('/data/ocpprouter/systemconfig');
  });

  it('sends a real RemoteStart command with the identifier and tenantId query params', async () => {
    receivedRequests = [];
    const { accessToken } = await login(superAdminEmail);

    const res = await request(app.getHttpServer())
      .post('/citrineos/commands/remote-start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        ocppConnectionNames: ['stationA'],
        idToken: { idToken: 'abc123', type: 'ISO14443' },
        remoteStartId: 1,
      })
      .expect(201);

    expect(res.body).toEqual([{ success: true }]);
    const [received] = receivedRequests;
    const url = new URL(received.url, 'http://x');
    expect(url.pathname).toBe('/ocpp/2/evdriver/requeststarttransaction');
    expect(url.searchParams.getAll('identifier')).toEqual(['stationA']);
    expect(url.searchParams.get('tenantId')).toBe('1');
    expect(received.body).toMatchObject({ idToken: { idToken: 'abc123' }, remoteStartId: 1 });
  });

  it('denies Mitarbeiter access to the disruptive reset command but allows remote-start', async () => {
    const { accessToken: adminAccess } = await login(superAdminEmail);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({ email: staffEmail, password: 'MitarbeiterPass123!', role: 'Mitarbeiter' })
      .expect(201);
    const { accessToken: staffAccess } = await login(staffEmail, 'MitarbeiterPass123!');

    await request(app.getHttpServer())
      .post('/citrineos/commands/reset')
      .set('Authorization', `Bearer ${staffAccess}`)
      .send({ ocppConnectionNames: ['stationA'], type: 'Immediate' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/citrineos/commands/remote-start')
      .set('Authorization', `Bearer ${staffAccess}`)
      .send({
        ocppConnectionNames: ['stationA'],
        idToken: { idToken: 'abc123', type: 'ISO14443' },
        remoteStartId: 2,
      })
      .expect(201);
  });

  it('registers a subscription idempotently against the fake server', async () => {
    receivedRequests = [];
    const { accessToken } = await login(superAdminEmail);

    const first = await request(app.getHttpServer())
      .post('/citrineos/subscriptions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ocppConnectionName: 'stationA' })
      .expect(201);
    // A bare numeric JSON response body ("7") is a known supertest/superagent
    // parsing edge case — .text carries it reliably, .body does not.
    expect(first.text).toBe('7');

    const postCalls = receivedRequests.filter(
      (r) => r.method === 'POST' && r.url.startsWith('/data/ocpprouter/subscription'),
    );
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0].body).toMatchObject({
      ocppConnectionName: 'stationA',
      url: 'https://bff.example.test/citrineos/webhooks/events?secret=' + webhookSecret,
    });
  });

  it('accepts a webhook event with the correct secret, persists it, and it is readable by Mitarbeiter', async () => {
    await request(app.getHttpServer())
      .post(`/citrineos/webhooks/events?secret=${webhookSecret}`)
      .send({
        ocppConnectionName: 'stationA',
        event: 'message',
        origin: 'ChargingStation',
        message: '[2,"1","Heartbeat",{}]',
        info: { correlationId: 'corr-1', action: 'Heartbeat' },
      })
      .expect(200, { status: 'ok' });

    const { accessToken: staffAccess } = await login(staffEmail, 'MitarbeiterPass123!');
    const res = await request(app.getHttpServer())
      .get('/citrineos/messages')
      .query({ ocppConnectionName: 'stationA' })
      .set('Authorization', `Bearer ${staffAccess}`)
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      ocppConnectionName: 'stationA',
      event: 'message',
      rawMessage: '[2,"1","Heartbeat",{}]',
    });
  });

  it('rejects a webhook event with a wrong or missing secret and does not persist it', async () => {
    await request(app.getHttpServer())
      .post('/citrineos/webhooks/events?secret=wrong')
      .send({ ocppConnectionName: 'stationA', event: 'connected' })
      .expect(403);

    await request(app.getHttpServer())
      .post('/citrineos/webhooks/events')
      .send({ ocppConnectionName: 'stationA', event: 'connected' })
      .expect(403);

    const { accessToken: adminAccess } = await login(superAdminEmail);
    const res = await request(app.getHttpServer())
      .get('/citrineos/messages')
      .query({ ocppConnectionName: 'stationA' })
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(200);
    // Only the one accepted event from the previous test, none from the rejected calls.
    expect(res.body.filter((m: { event: string }) => m.event === 'connected')).toHaveLength(0);
  });
});
