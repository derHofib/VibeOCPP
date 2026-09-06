import { GraphQLClient, type RequestDocument, type Variables } from 'graphql-request';
import { createClient, type Client as WsClient, type SubscribePayload } from 'graphql-ws';

// Same-origin path, proxied to our own Hasura instance by vite.config.ts
// (dev) / the production reverse proxy — never a cross-origin URL, so no
// CORS setup is needed on Hasura's side.
const HTTP_URL = import.meta.env.VITE_HASURA_URL ?? '/hasura/v1/graphql';

export type AccessTokenProvider = () => string | null | Promise<string | null>;

let accessTokenProvider: AccessTokenProvider = () => null;

// Wired once from AuthProvider, the same way lib/api-client.ts is — one
// token source feeds both the REST client and this one.
export function configureGraphqlClient(options: { getAccessToken: AccessTokenProvider }): void {
  accessTokenProvider = options.getAccessToken;
}

// A relative path needs turning into an absolute ws(s):// URL by hand —
// `new URL(path, partialUrl)` throws on a non-absolute base, the same trap
// api-client.ts's buildUrl hit for the REST client.
function toWebSocketUrl(httpUrl: string): string {
  if (/^https?:\/\//.test(httpUrl)) {
    return httpUrl.replace(/^http/, 'ws');
  }
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}${httpUrl.startsWith('/') ? '' : '/'}${httpUrl}`;
}

const httpClient = new GraphQLClient(HTTP_URL);

export async function graphqlRequest<T>(document: RequestDocument, variables?: Variables): Promise<T> {
  const token = await accessTokenProvider();
  return httpClient.request<T>({
    document,
    variables,
    requestHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

let wsClient: WsClient | null = null;

// Lazy singleton: only opened once something actually subscribes, not on
// every page that happens to import this module.
function getWsClient(): WsClient {
  if (!wsClient) {
    wsClient = createClient({
      url: toWebSocketUrl(HTTP_URL),
      // Hasura's graphql-ws implementation reads the bearer token from a
      // `headers` object inside connectionParams — this is Hasura's own
      // documented convention for authenticating the websocket handshake,
      // not a graphql-ws default.
      connectionParams: async () => {
        const token = await accessTokenProvider();
        return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      },
    });
  }
  return wsClient;
}

export interface GraphqlSubscriptionHandlers<T> {
  next: (data: T) => void;
  error?: (error: unknown) => void;
  complete?: () => void;
}

// Thin wrapper so callers (the useGraphqlSubscription hook) don't need to
// know graphql-ws's iterator-vs-observer subscribe signature directly.
export function subscribe<T>(payload: SubscribePayload, handlers: GraphqlSubscriptionHandlers<T>): () => void {
  return getWsClient().subscribe<T>(payload, {
    next: (result) => {
      if (result.data) handlers.next(result.data);
    },
    error: (err) => handlers.error?.(err),
    complete: () => handlers.complete?.(),
  });
}

// Only for tests: drops the cached ws client so the next subscribe() call
// builds a fresh one against a freshly-mocked createClient.
export function __resetWsClientForTests(): void {
  wsClient = null;
}
