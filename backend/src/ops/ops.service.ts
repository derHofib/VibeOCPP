import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mirrors ops-agent/src/whitelist.ts — kept as a separate literal rather than
// a shared import because ops-agent is a standalone deployable with its own
// package boundary (see ops-agent/README.md), not a library this backend
// depends on. ops-agent re-validates every name against its own whitelist
// regardless, so a mismatch here only ever narrows what this controller
// accepts, never widens what ops-agent will act on.
export const OPS_SERVICES = ['product-db', 'backend', 'citrineos-payment', 'directus', 'hasura'] as const;
export type OpsService_ = (typeof OPS_SERVICES)[number];

export interface OpsServiceStatus {
  service: string;
  found: boolean;
  containerId?: string;
  state?: string;
  status?: string;
}

// Thin, purpose-built client for the ops-agent's tiny fixed API — not worth
// pulling in a generic HTTP client abstraction for three endpoints.
@Injectable()
export class OpsAgentClient {
  constructor(private readonly configService: ConfigService) {}

  private get baseUrl(): string {
    return this.configService.get<string>('OPS_AGENT_URL', { infer: true }) ?? 'http://ops-agent:3100';
  }

  private get sharedSecret(): string {
    const secret = this.configService.get<string>('OPS_AGENT_SHARED_SECRET', { infer: true });
    if (!secret) {
      throw new InternalServerErrorException('OPS_AGENT_SHARED_SECRET is not configured');
    }
    return secret;
  }

  private async call<T>(method: 'GET' | 'POST', path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: { 'x-ops-agent-secret': this.sharedSecret },
    });
    const body = (await response.json().catch(() => undefined)) as { error?: string } | undefined;
    if (!response.ok) {
      throw new InternalServerErrorException(
        `ops-agent responded ${response.status} for ${method} ${path}${body?.error ? `: ${body.error}` : ''}`,
      );
    }
    return body as T;
  }

  getAllStatus(): Promise<OpsServiceStatus[]> {
    return this.call<OpsServiceStatus[]>('GET', '/ops/status');
  }

  getStatus(service: string): Promise<OpsServiceStatus> {
    return this.call<OpsServiceStatus>('GET', `/ops/status/${encodeURIComponent(service)}`);
  }

  getLogs(service: string, tail?: number): Promise<{ service: string; logs: string }> {
    const query = tail ? `?tail=${encodeURIComponent(String(tail))}` : '';
    return this.call('GET', `/ops/logs/${encodeURIComponent(service)}${query}`);
  }

  restart(service: string): Promise<{ service: string; restarted: boolean }> {
    return this.call('POST', `/ops/restart/${encodeURIComponent(service)}`);
  }
}
