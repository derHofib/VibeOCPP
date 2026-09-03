import { z } from 'zod';

// These are the only values allowed to come from process.env — the
// bootstrap set from docs/architecture-proposal.md §5. Everything else is
// product configuration and lives in the `settings` table instead.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  SETTINGS_MASTER_KEY: z
    .string()
    .refine(
      (value) => Buffer.from(value, 'base64').length === 32,
      'SETTINGS_MASTER_KEY must be base64 for exactly 32 bytes (AES-256)',
    ),
  // Bootstrap, not settings: ops-agent has no database access at all (it
  // exists specifically to avoid handing Docker-socket access to anything
  // that does), so there's nowhere in the settings table it could read a
  // shared secret from even if we wanted this to live there instead.
  OPS_AGENT_URL: z.string().min(1, 'OPS_AGENT_URL is required').default('http://ops-agent:3100'),
  OPS_AGENT_SHARED_SECRET: z
    .string()
    .min(16, 'OPS_AGENT_SHARED_SECRET must be at least 16 characters'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
