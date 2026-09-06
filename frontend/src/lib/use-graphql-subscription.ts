import { useEffect, useState } from 'react';
import type { SubscribePayload } from 'graphql-ws';
import { subscribe } from './graphql-client.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface UseGraphqlSubscriptionResult<T> {
  data: T | null;
  error: unknown;
  status: ConnectionStatus;
}

// Drives the Stations page's live status column and the connection
// indicator required by docs/architecture-proposal.md §9 ("Live-Updates
// via WebSocket/Subscriptions, nicht Polling, mit sichtbarem
// Verbindungsindikator"). `query`/`variables` are expected to be stable
// across renders (define them outside the component or memoize them) —
// this hook re-subscribes whenever the payload's JSON changes.
export function useGraphqlSubscription<T>(
  query: string,
  variables?: Record<string, unknown>,
): UseGraphqlSubscriptionResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const payloadKey = JSON.stringify({ query, variables });

  useEffect(() => {
    setStatus('connecting');
    const payload: SubscribePayload = { query, variables };
    const unsubscribe = subscribe<T>(payload, {
      next: (result) => {
        setData(result);
        setError(null);
        setStatus('connected');
      },
      error: (err) => {
        setError(err);
        setStatus('disconnected');
      },
      complete: () => setStatus('disconnected'),
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey]);

  return { data, error, status };
}
