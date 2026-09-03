import { Injectable, Logger } from '@nestjs/common';
import { CitrineOsApiError } from './citrineos-api.error.js';

export type QueryValue = string | number | boolean | undefined | (string | number)[];

export interface RequestOptions {
  method: 'GET' | 'PUT' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.replace(/^\/+/, ''), `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      url.searchParams.append(key, String(v));
    }
  }
  return url.toString();
}

// Thin wrapper over fetch for CitrineOS's Data/Message APIs: builds the
// query string (repeating a key for array values, matching how CitrineOS's
// own querystring schemas accept `identifier` as one-or-many), enforces a
// timeout, and turns non-2xx responses into a typed CitrineOsApiError
// instead of a bare thrown Response.
//
// Retries exactly once, and only when fetch itself threw (DNS failure,
// connection refused, connection reset before any response) — never for an
// HTTP error status. A 4xx/5xx means CitrineOS received and processed the
// request; retrying it blindly on a Message API call could send a
// RemoteStart or Reset twice. A network-level failure before any response
// carries no such risk in the common case (nothing was accepted upstream),
// which is why it's the one class of failure this retries.
@Injectable()
export class CitrineOsHttpClient {
  private readonly logger = new Logger(CitrineOsHttpClient.name);

  async request<T>(baseUrl: string, options: RequestOptions): Promise<T> {
    const url = buildUrl(baseUrl, options.path, options.query);
    try {
      return await this.attempt<T>(url, options);
    } catch (error) {
      if (error instanceof CitrineOsApiError) throw error;
      this.logger.warn(`Retrying after network-level failure calling ${url}: ${String(error)}`);
      return this.attempt<T>(url, options);
    }
  }

  private async attempt<T>(url: string, options: RequestOptions): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        method: options.method,
        headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        throw new CitrineOsApiError(`Request to ${url} timed out`, url);
      }
      // Network-level failure — let it propagate for the one retry above.
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    const text = await response.text();
    const parsed = text ? this.tryParseJson(text) : undefined;

    if (!response.ok) {
      throw new CitrineOsApiError(
        `CitrineOS responded ${response.status} ${response.statusText} for ${url}`,
        url,
        response.status,
        parsed ?? text,
      );
    }

    return parsed as T;
  }

  private tryParseJson(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
