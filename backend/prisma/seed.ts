// Bootstrap seed: creates the Phase-1 default tenant and its first
// SuperAdmin account, so there is a way to log in before any UI exists.
// Run with: pnpm db:seed
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { DEFAULT_TENANT_SLUG } from '../src/tenants/tenants.service.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEFAULT_TENANT_SLUG },
    update: {},
    create: { slug: DEFAULT_TENANT_SLUG, name: 'Default' },
  });

  const email = process.env.SEED_SUPERADMIN_EMAIL ?? 'superadmin@example.com';
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!password) {
    console.log(
      'SEED_SUPERADMIN_PASSWORD not set — skipping SuperAdmin creation. ' +
        'Set it and re-run `pnpm db:seed` to create the first login.',
    );
    return;
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: {},
    create: { tenantId: tenant.id, email, passwordHash, role: 'SuperAdmin' },
  });

  console.log(`Seeded tenant "${tenant.slug}" and SuperAdmin "${email}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
