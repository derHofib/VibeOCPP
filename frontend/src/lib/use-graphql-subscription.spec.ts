import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import * as graphqlClient from './graphql-client.js';
import { useGraphqlSubscription } from './use-graphql-subscription.js';

describe('useGraphqlSubscription', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in the connecting state and moves to connected on the first payload', async () => {
    let capturedHandlers: graphqlClient.GraphqlSubscriptionHandlers<{ x: number }> | null = null;
    vi.spyOn(graphqlClient, 'subscribe').mockImplementation((_payload, handlers) => {
      capturedHandlers = handlers as graphqlClient.GraphqlSubscriptionHandlers<{ x: number }>;
      return () => {};
    });

    const { result } = renderHook(() => useGraphqlSubscription<{ x: number }>('subscription { x }'));

    expect(result.current.status).toBe('connecting');

    capturedHandlers!.next({ x: 42 });

    await waitFor(() => expect(result.current.status).toBe('connected'));
    expect(result.current.data).toEqual({ x: 42 });
    expect(result.current.error).toBeNull();
  });

  it('moves to disconnected and surfaces the error when the subscription errors', async () => {
    let capturedHandlers: graphqlClient.GraphqlSubscriptionHandlers<unknown> | null = null;
    vi.spyOn(graphqlClient, 'subscribe').mockImplementation((_payload, handlers) => {
      capturedHandlers = handlers;
      return () => {};
    });

    const { result } = renderHook(() => useGraphqlSubscription('subscription { x }'));
    const boom = new Error('connection lost');
    capturedHandlers!.error!(boom);

    await waitFor(() => expect(result.current.status).toBe('disconnected'));
    expect(result.current.error).toBe(boom);
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    vi.spyOn(graphqlClient, 'subscribe').mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() => useGraphqlSubscription('subscription { x }'));
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('re-subscribes when the query or variables change', () => {
    const subscribeSpy = vi.spyOn(graphqlClient, 'subscribe').mockReturnValue(() => {});

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useGraphqlSubscription('subscription($id: uuid!) { x }', { id }),
      { initialProps: { id: 'a' } },
    );
    expect(subscribeSpy).toHaveBeenCalledTimes(1);

    rerender({ id: 'b' });
    expect(subscribeSpy).toHaveBeenCalledTimes(2);
  });
});
