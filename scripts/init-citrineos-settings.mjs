// One-shot job (see the citrineos-config-init service in
// docker-compose.yml): writes the settings/citrineos/* category so
// /citrineos/* endpoints work immediately after `docker compose up`,
// without the manual curl steps README.md used to require. Zero
// dependencies deliberately — this runs in a stock node:22-alpine
// container via a bind-mounted script, not a built image.
//
// Idempotent by checking what's already set before writing anything, not
// by relying on the upsert alone: settings/:category/:key always
// succeeds and bumps the version, so re-running unconditionally would
// still be "safe" but would clutter settings_history with an identical
// value on every `docker compose up`.
import { randomBytes } from 'node:crypto';

const backendUrl = required('BACKEND_URL');
const email = required('SEED_SUPERADMIN_EMAIL');
const password = required('SEED_SUPERADMIN_PASSWORD');
const dataApiUrl = required('CITRINEOS_DATA_API_URL');
const messageApiUrl = required('CITRINEOS_MESSAGE_API_URL');
const citrineosTenantId = required('CITRINEOS_TENANT_ID');
const ocppVersion = required('CITRINEOS_OCPP_VERSION');
const webhookBaseUrl = required('WEBHOOK_BASE_URL');

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loginWithRetry() {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.ok) return (await response.json()).accessToken;
    // depends_on: service_healthy already gates this, but the backend's
    // own seed step (docker-entrypoint.sh) runs on the same container
    // start and may not have committed the SuperAdmin row yet.
    if (attempt === maxAttempts) {
      throw new Error(`Login failed after ${maxAttempts} attempts: ${response.status} ${await response.text()}`);
    }
    await sleep(3000);
  }
}

async function listExistingKeys(accessToken) {
  const response = await fetch(`${backendUrl}/settings?category=citrineos`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`GET /settings failed: ${response.status} ${await response.text()}`);
  const settings = await response.json();
  return new Set(settings.map((s) => s.key));
}

async function upsertSetting(accessToken, key, type, value) {
  const response = await fetch(`${backendUrl}/settings/citrineos/${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ type, value }),
  });
  if (!response.ok) throw new Error(`POST /settings/citrineos/${key} failed: ${response.status} ${await response.text()}`);
}

const accessToken = await loginWithRetry();
const existingKeys = await listExistingKeys(accessToken);

const desired = [
  ['dataApiUrl', 'string', dataApiUrl],
  ['messageApiUrl', 'string', messageApiUrl],
  ['citrineosTenantId', 'string', citrineosTenantId],
  ['ocppVersion', 'string', ocppVersion],
  ['webhookBaseUrl', 'string', webhookBaseUrl],
  ['webhookSecret', 'secret', randomBytes(24).toString('hex')],
];

const missing = desired.filter(([key]) => !existingKeys.has(key));
if (missing.length === 0) {
  console.log('settings/citrineos/* already configured — nothing to do.');
  process.exit(0);
}

for (const [key, type, value] of missing) {
  await upsertSetting(accessToken, key, type, value);
  console.log(`set settings/citrineos/${key}`);
}
console.log(`Configured ${missing.length} CitrineOS setting(s).`);
