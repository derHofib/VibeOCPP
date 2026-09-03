import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// End-to-end coverage of the full Phase-1 slice: login, the encrypted
// settings store (including the rollback route, which once collided with
// the generic :category/:key upsert route — see settings.controller.ts),
// role enforcement, and refresh-token rotation. Exercises real HTTP + a
// real Postgres database, not mocks.
describe('Auth + Settings flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  const runId = randomUUID().slice(0, 8);
  const superAdminEmail = `superadmin-${runId}@example.test`;
  const staffEmail = `staff-${runId}@example.test`;
  const password = 'SuperSecret12345!';

  beforeAll(async () => {
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

    // AuthService.validateCredentials verifies with argon2, so seed via the
    // same code path a real signup would use.
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
    await prisma.setting.deleteMany({ where: { category: `test-${runId}` } });
    await app.close();
  });

  async function login(email: string, plainPassword: string = password) {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: plainPassword })
      .expect(200);
    return res.body as { accessToken: string; refreshToken: string };
  }

  it('logs in and receives a valid token pair', async () => {
    const { accessToken, refreshToken } = await login(superAdminEmail);
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();
  });

  it('rejects a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: superAdminEmail, password: 'wrong-password' })
      .expect(401);
  });

  it('stores a secret setting encrypted and returns it masked, then rolls it back by ID without hitting the upsert route', async () => {
    const { accessToken } = await login(superAdminEmail);
    const category = `test-${runId}`;

    const v1 = await request(app.getHttpServer())
      .post(`/settings/${category}/apiKey`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'secret', value: 'sk_live_abcdef1234' })
      .expect(201);
    expect(v1.body.value).toBe('••••1234');
    expect(v1.body.version).toBe(1);

    // Confirm the plaintext never touches the settings.value column.
    const raw = await prisma.setting.findUniqueOrThrow({ where: { id: v1.body.id } });
    expect(raw.value).toBeNull();
    expect(raw.encryptedValue).not.toBeNull();

    const v2 = await request(app.getHttpServer())
      .post(`/settings/${category}/apiKey`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ type: 'secret', value: 'sk_live_zzzz9999' })
      .expect(201);
    expect(v2.body.version).toBe(2);

    // The regression: this must be routed to rollback(), not upsert() with
    // ":category"="<id>" and ":key"="rollback".
    const rolledBack = await request(app.getHttpServer())
      .post(`/settings/rollback/${v1.body.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ toVersion: 1 })
      .expect(201);
    expect(rolledBack.body.value).toBe('••••1234');
    expect(rolledBack.body.version).toBe(3);
  });

  it('denies Mitarbeiter access to settings but allows the endpoint for SuperAdmin', async () => {
    const { accessToken: adminAccess } = await login(superAdminEmail);
    await request(app.getHttpServer())
      .post('/users')
      .set('Authorization', `Bearer ${adminAccess}`)
      .send({ email: staffEmail, password: 'MitarbeiterPass123!', role: 'Mitarbeiter' })
      .expect(201);

    const { accessToken: staffAccess } = await login(staffEmail, 'MitarbeiterPass123!');
    await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${staffAccess}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/settings')
      .set('Authorization', `Bearer ${adminAccess}`)
      .expect(200);
  });

  it('rotates refresh tokens and rejects replay of the token that was just used', async () => {
    const { refreshToken } = await login(superAdminEmail);

    const first = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.body.refreshToken })
      .expect(200);
  });

  it('rejects every protected route without a token', async () => {
    await request(app.getHttpServer()).get('/settings').expect(401);
    await request(app.getHttpServer()).get('/users').expect(401);
  });
});
