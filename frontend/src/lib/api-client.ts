export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

// Resolved once, not per call: the BFF base URL is set at build/deploy time
// (VITE_API_BASE_URL), defaulting to the same-origin /api prefix that
// vite.config.ts's dev proxy and the production reverse proxy both handle.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type AccessTokenProvider = () => string | null | Promise<string | null>;

let accessTokenProvider: AccessTokenProvider = () => null;
let onUnauthorized: (() => void) | null = null;

// Wired once from AuthProvider — keeps this module framework-agnostic
// (no React import here) while still letting every call attach the current
// access token and react to a 401 by triggering logout.
export function configureApiClient(options: {
  getAccessToken: AccessTokenProvider;
  onUnauthorized?: () => void;
}): void {
  accessTokenProvider = options.getAccessToken;
  onUnauthorized = options.onUnauthorized ?? null;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  // Deliberately not `new URL(path, BASE_URL)`: the URL constructor requires
  // its base argument to be an absolute URL, but BASE_URL is `/api` (a
  // same-origin relative path) by default — that combination throws
  // "Invalid base URL" rather than resolving against document.location the
  // way a browser's own relative-URL handling would.
  const base = BASE_URL.replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    params.set(key, String(value));
  }
  const queryString = params.toString();
  return `${base}/${cleanPath}${queryString ? `?${queryString}` : ''}`;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await accessTokenProvider();
  return rawFetch<T>(path, options, token, true);
}

// Bypasses the access-token provider entirely — login/refresh/logout don't
// carry a bearer token and, critically, must not call back into it: the
// token provider itself calls the refresh flow when there's no valid
// access token yet, and that flow calls this module to hit /auth/refresh.
// Routing that call back through apiFetch would recurse (getAccessToken ->
// refreshSession -> apiFetch -> getAccessToken -> ...) before the
// in-flight guard in auth-context.tsx ever gets to run.
export async function publicApiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return rawFetch<T>(path, options, null, false);
}

async function rawFetch<T>(
  path: string,
  options: RequestOptions,
  token: string | null,
  triggerOnUnauthorized: boolean,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && triggerOnUnauthorized) {
    onUnauthorized?.();
  }

  const text = await response.text();
  const parsed = text ? safeJsonParse(text) : undefined;

  if (!response.ok) {
    const message =
      (parsed as { message?: string } | undefined)?.message ??
      `Request to ${path} failed with status ${response.status}`;
    throw new ApiError(message, response.status, parsed);
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
