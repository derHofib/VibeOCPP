import { Injectable, InternalServerErrorException, OnModuleDestroy } from '@nestjs/common';
import { Pool, type QueryResultRow } from 'pg';
import { PaymentConfigService } from './payment-config.service.js';

// A pool per product tenant, lazily created from settings/payment/databaseUrl
// and cached until that setting changes (checked by comparing the
// connection string on every call — cheap, and correct if a SuperAdmin
// rotates credentials without restarting the backend).
@Injectable()
export class PaymentDbService implements OnModuleDestroy {
  private pools = new Map<string, { pool: Pool; databaseUrl: string; tablePrefix: string }>();

  constructor(private readonly configService: PaymentConfigService) {}

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((entry) => entry.pool.end()));
  }

  async getPool(tenantId: string): Promise<{ pool: Pool; tablePrefix: string }> {
    const config = await this.configService.getConfig(tenantId);
    const existing = this.pools.get(tenantId);
    if (existing && existing.databaseUrl === config.databaseUrl) {
      return { pool: existing.pool, tablePrefix: config.tablePrefix };
    }
    if (existing) {
      void existing.pool.end();
    }
    const pool = new Pool({ connectionString: config.databaseUrl, max: 5 });
    this.pools.set(tenantId, { pool, databaseUrl: config.databaseUrl, tablePrefix: config.tablePrefix });
    return { pool, tablePrefix: config.tablePrefix };
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    tenantId: string,
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const { pool } = await this.getPool(tenantId);
    const result = await pool.query<T>(sql, params);
    return result.rows;
  }

  // We never create citrineos-payment's tables ourselves — it owns that
  // schema via its own Base.metadata.create_all() on startup (see
  // db/init_db.py in citrineos-payment). This only checks they exist yet,
  // for a clear error instead of an opaque "relation does not exist".
  async testConnection(tenantId: string): Promise<void> {
    const { pool, tablePrefix } = await this.getPool(tenantId);
    const result = await pool.query<{ exists: string | null }>(
      `SELECT to_regclass($1)::text AS exists`,
      [`${tablePrefix}operators`],
    );
    if (!result.rows[0]?.exists) {
      throw new InternalServerErrorException(
        `Connected to the database, but ${tablePrefix}operators does not exist yet — ` +
          'has the citrineos-payment container started at least once?',
      );
    }
  }
}
